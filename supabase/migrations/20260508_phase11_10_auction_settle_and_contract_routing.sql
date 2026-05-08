-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.10 — Auction settlement + contract-routed share transfer
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Founder spec covers three flows; the direct-buy one was already
-- implemented in Phase 10.69 (admin_confirm_deal_payment). This
-- migration fills the remaining two:
--
-- 1) Auction settlement
--    "اذا عرضة حصص في المزاد زتتم الاحالى لاعلى سعر بعد انتهاء وقت
--     المزاد ايضا تخصم الحصص من محفظة المشروع وتحول الى محفظة
--     المستخدم المحال عليه".
--    New RPC admin_settle_auction(p_auction_id) — atomically picks
--    the highest bid, decrements the project's offering wallet,
--    grants the winner a holdings row (or contract_holdings row if
--    they bid on behalf of a contract), updates the auction status
--    to 'completed', notifies both parties.
--
-- 2) Contract-routed share transfer
--    "المشروع او العقد الذي دخل به مجموعة مستثمرين تحول الحصص الى
--     محفظة العقد".
--    Adds optional deals.contract_id + auction_bids.contract_id
--    columns. admin_confirm_deal_payment is rewritten so that when
--    contract_id is set on the deal, shares are deposited into
--    contract_holdings (and the contract balance is debited) instead
--    of the buyer's personal holdings.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Add contract_id columns ───────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.partnership_contracts(id) ON DELETE SET NULL;

ALTER TABLE public.auction_bids
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.partnership_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_contract        ON public.deals(contract_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_contract ON public.auction_bids(contract_id);


-- ─── 2. Helper: deposit shares into a holder (user OR contract) ──
-- Encapsulates the "INSERT or UPDATE with weighted-average price"
-- logic so admin_confirm_deal_payment + admin_settle_auction don't
-- duplicate it.
CREATE OR REPLACE FUNCTION public._deposit_shares_into_holder(
  p_user_id     UUID,
  p_contract_id UUID,
  p_project_id  UUID,
  p_shares      BIGINT,
  p_price       BIGINT,
  p_total       BIGINT,
  p_acquisition TEXT          -- 'primary' | 'secondary' | 'auction'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  IF p_contract_id IS NOT NULL THEN
    -- ── Contract-side: contract_holdings (simpler schema) ──
    SELECT * INTO v_existing
    FROM public.contract_holdings
    WHERE contract_id = p_contract_id AND project_id = p_project_id
    FOR UPDATE;

    IF v_existing.id IS NULL THEN
      INSERT INTO public.contract_holdings (
        contract_id, project_id, shares, total_invested
      ) VALUES (
        p_contract_id, p_project_id, p_shares, p_total
      );
    ELSE
      UPDATE public.contract_holdings
         SET shares         = shares + p_shares,
             total_invested = COALESCE(total_invested, 0) + p_total,
             updated_at     = NOW()
       WHERE id = v_existing.id;
    END IF;

    -- Best-effort audit row (table is optional)
    BEGIN
      INSERT INTO public.contract_transactions (
        contract_id, initiator_id, project_id, shares, amount, kind
      ) VALUES (
        p_contract_id, p_user_id, p_project_id, p_shares, p_total,
        CASE p_acquisition WHEN 'primary' THEN 'buy_primary'
                           WHEN 'auction' THEN 'auction_won'
                           ELSE 'buy_secondary' END
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;

  ELSE
    -- ── User-side: personal holdings (with weighted avg price) ──
    SELECT * INTO v_existing
    FROM public.holdings
    WHERE user_id = p_user_id AND project_id = p_project_id
    FOR UPDATE;

    IF v_existing.id IS NULL THEN
      INSERT INTO public.holdings (
        user_id, project_id, shares, frozen_shares,
        average_buy_price, total_invested,
        acquired_from_offering, acquired_from_secondary,
        first_acquired_at, last_acquired_at
      ) VALUES (
        p_user_id, p_project_id, p_shares, 0,
        p_price, p_total,
        CASE WHEN p_acquisition IN ('primary','auction') THEN p_shares ELSE 0 END,
        CASE WHEN p_acquisition NOT IN ('primary','auction') THEN p_shares ELSE 0 END,
        NOW(), NOW()
      );
    ELSE
      UPDATE public.holdings
         SET shares = shares + p_shares,
             average_buy_price =
               ((shares * COALESCE(average_buy_price, 0))
                + (p_shares * p_price))
               / NULLIF(shares + p_shares, 0),
             total_invested = COALESCE(total_invested, 0) + p_total,
             acquired_from_offering = CASE
               WHEN p_acquisition IN ('primary','auction')
               THEN COALESCE(acquired_from_offering, 0) + p_shares
               ELSE COALESCE(acquired_from_offering, 0)
             END,
             acquired_from_secondary = CASE
               WHEN p_acquisition NOT IN ('primary','auction')
               THEN COALESCE(acquired_from_secondary, 0) + p_shares
               ELSE COALESCE(acquired_from_secondary, 0)
             END,
             last_acquired_at = NOW(),
             updated_at = NOW()
       WHERE id = v_existing.id;
    END IF;
  END IF;
END $$;


-- ─── 3. Re-create admin_confirm_deal_payment with contract routing ─
DROP FUNCTION IF EXISTS public.admin_confirm_deal_payment(UUID);

CREATE OR REPLACE FUNCTION public.admin_confirm_deal_payment(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_deal      RECORD;
  v_offering  RECORD;
  v_total     BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_deal.status::TEXT NOT IN
     ('pending_payment','pending_seller_approval','accepted','payment_submitted','disputed') THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'invalid_status',
      'current', v_deal.status::TEXT
    );
  END IF;

  v_total := COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share);

  -- ─── 1. Pull shares from the right source ───────────────────────
  IF v_deal.deal_type::TEXT = 'primary' THEN
    SELECT * INTO v_offering FROM public.project_wallets
    WHERE project_id = v_deal.project_id AND wallet_type = 'offering'
    FOR UPDATE;

    IF v_offering.id IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'no_offering_wallet');
    END IF;
    IF v_offering.available_shares < v_deal.shares THEN
      RETURN jsonb_build_object(
        'success', FALSE, 'error', 'insufficient_offering',
        'available', v_offering.available_shares, 'needed', v_deal.shares
      );
    END IF;

    UPDATE public.project_wallets
       SET available_shares = available_shares - v_deal.shares,
           sold_shares      = sold_shares + v_deal.shares,
           updated_at       = NOW()
     WHERE id = v_offering.id;

  ELSIF v_deal.deal_type::TEXT IN ('secondary', 'quick_sell') THEN
    UPDATE public.holdings
       SET shares        = shares - v_deal.shares,
           frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
           updated_at    = NOW()
     WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;
  END IF;

  -- ─── 2. Deposit into the right destination ──────────────────────
  -- If deals.contract_id is set, shares go into contract_holdings
  -- and the contract balance is debited. Otherwise → personal holdings.
  PERFORM public._deposit_shares_into_holder(
    v_deal.buyer_id,
    v_deal.contract_id,
    v_deal.project_id,
    v_deal.shares,
    v_deal.price_per_share,
    v_total,
    CASE v_deal.deal_type::TEXT WHEN 'primary' THEN 'primary' ELSE 'secondary' END
  );

  IF v_deal.contract_id IS NOT NULL THEN
    BEGIN
      UPDATE public.partnership_contracts
         SET total_balance = GREATEST(0, COALESCE(total_balance, 0) - v_total),
             updated_at    = NOW()
       WHERE id = v_deal.contract_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSE
    BEGIN
      UPDATE public.profiles
         SET trades_completed = COALESCE(trades_completed, 0) + 1,
             total_invested   = COALESCE(total_invested, 0) + v_total,
             last_trade_at    = NOW()
       WHERE id = v_deal.buyer_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── 3. Mark deal completed ─────────────────────────────────────
  UPDATE public.deals
     SET status       = 'completed'::deal_status,
         completed_at = COALESCE(completed_at, NOW()),
         updated_at   = NOW()
   WHERE id = p_deal_id;

  -- ─── 4. Audit + notification ────────────────────────────────────
  BEGIN
    PERFORM public.log_admin_action(
      'confirm_deal_payment', 'deal', p_deal_id,
      jsonb_build_object(
        'buyer_id',   v_deal.buyer_id,
        'seller_id',  v_deal.seller_id,
        'contract_id', v_deal.contract_id,
        'amount',     v_total,
        'shares',     v_deal.shares,
        'deal_type',  v_deal.deal_type::TEXT
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.notifications (
      user_id, notification_type, title, message, priority, link_url, metadata
    ) VALUES (
      v_deal.buyer_id,
      'deal_completed'::notification_type,
      '🎉 تم تحويل الحصص',
      CASE WHEN v_deal.contract_id IS NOT NULL
        THEN 'استلم العقد ' || v_deal.shares::TEXT || ' حصة'
        ELSE 'استلمت ' || v_deal.shares::TEXT || ' حصة في محفظتك'
      END,
      'high'::notification_priority,
      CASE WHEN v_deal.contract_id IS NOT NULL
        THEN '/contracts/' || v_deal.contract_id::TEXT
        ELSE '/portfolio'
      END,
      jsonb_build_object('deal_id', p_deal_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',   TRUE,
    'deal_id',   p_deal_id,
    'shares',    v_deal.shares,
    'amount',    v_total,
    'contract',  v_deal.contract_id,
    'routed_to', CASE WHEN v_deal.contract_id IS NOT NULL THEN 'contract' ELSE 'user' END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_deal_payment(UUID) TO authenticated;


-- ─── 4. admin_settle_auction ──────────────────────────────────────
-- Picks the winning bid (the highest amount), atomically transfers
-- shares from offering wallet → winner's holdings (or contract), and
-- closes the auction. Idempotent: safe to call after status is
-- already 'completed' (returns the existing settlement).

CREATE OR REPLACE FUNCTION public.admin_settle_auction(
  p_auction_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_auction      RECORD;
  v_winning_bid  RECORD;
  v_offering     RECORD;
  v_share_price  BIGINT;
  v_total        BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Lock the auction row.
  SELECT * INTO v_auction FROM public.auctions
   WHERE id = p_auction_id FOR UPDATE;
  IF v_auction.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'auction_not_found');
  END IF;
  IF v_auction.status::TEXT = 'completed' THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'already_settled', TRUE,
      'winner_id', v_auction.winner_id
    );
  END IF;
  IF v_auction.status::TEXT NOT IN ('active','ended') THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'invalid_status',
      'current', v_auction.status::TEXT
    );
  END IF;

  -- Find the highest bid. Tie-break: earliest created_at (first to bid).
  SELECT * INTO v_winning_bid
    FROM public.auction_bids
   WHERE auction_id = p_auction_id
   ORDER BY amount DESC, created_at ASC
   LIMIT 1;

  IF v_winning_bid.id IS NULL THEN
    -- No bids — close as cancelled with no winner.
    UPDATE public.auctions
       SET status     = 'completed'::auction_status,
           winner_id  = NULL,
           updated_at = NOW()
     WHERE id = p_auction_id;
    RETURN jsonb_build_object(
      'success', TRUE, 'no_bids', TRUE, 'auction_id', p_auction_id
    );
  END IF;

  -- Per-share price = total bid amount / shares offered (rounded down)
  v_share_price := GREATEST(1, v_winning_bid.amount / NULLIF(v_auction.shares_offered, 0));
  v_total       := v_winning_bid.amount;

  -- Lock + decrement the offering wallet.
  SELECT * INTO v_offering FROM public.project_wallets
   WHERE project_id = v_auction.project_id AND wallet_type = 'offering'
   FOR UPDATE;
  IF v_offering.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_offering_wallet');
  END IF;
  IF v_offering.available_shares < v_auction.shares_offered THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'insufficient_offering',
      'available', v_offering.available_shares,
      'needed',    v_auction.shares_offered
    );
  END IF;

  UPDATE public.project_wallets
     SET available_shares = available_shares - v_auction.shares_offered,
         sold_shares      = sold_shares + v_auction.shares_offered,
         updated_at       = NOW()
   WHERE id = v_offering.id;

  -- Deposit into winner's holdings (or contract holdings if the
  -- winning bid was placed on behalf of a contract).
  PERFORM public._deposit_shares_into_holder(
    v_winning_bid.bidder_id,
    v_winning_bid.contract_id,
    v_auction.project_id,
    v_auction.shares_offered,
    v_share_price,
    v_total,
    'auction'
  );

  -- Bump the contract balance OR the user's profile counters.
  IF v_winning_bid.contract_id IS NOT NULL THEN
    BEGIN
      UPDATE public.partnership_contracts
         SET total_balance = GREATEST(0, COALESCE(total_balance, 0) - v_total),
             updated_at    = NOW()
       WHERE id = v_winning_bid.contract_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSE
    BEGIN
      UPDATE public.profiles
         SET trades_completed = COALESCE(trades_completed, 0) + 1,
             total_invested   = COALESCE(total_invested, 0) + v_total,
             last_trade_at    = NOW()
       WHERE id = v_winning_bid.bidder_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Close the auction.
  UPDATE public.auctions
     SET status      = 'completed'::auction_status,
         winner_id   = v_winning_bid.bidder_id,
         updated_at  = NOW()
   WHERE id = p_auction_id;

  -- Audit + notifications (best-effort).
  BEGIN
    PERFORM public.log_admin_action(
      'settle_auction', 'auction', p_auction_id,
      jsonb_build_object(
        'winner_id',     v_winning_bid.bidder_id,
        'winning_bid',   v_total,
        'shares',        v_auction.shares_offered,
        'contract_id',   v_winning_bid.contract_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.notifications (
      user_id, notification_type, title, message, priority, link_url, metadata
    ) VALUES (
      v_winning_bid.bidder_id,
      'auction_won'::notification_type,
      '🏆 ربحت المزاد',
      'استلمت ' || v_auction.shares_offered::TEXT ||
        ' حصة من مشروع · المبلغ: ' || v_total::TEXT || ' د.ع',
      'high'::notification_priority,
      CASE WHEN v_winning_bid.contract_id IS NOT NULL
        THEN '/contracts/' || v_winning_bid.contract_id::TEXT
        ELSE '/portfolio'
      END,
      jsonb_build_object('auction_id', p_auction_id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback if 'auction_won' isn't in notification_type enum:
    BEGIN
      INSERT INTO public.notifications (
        user_id, notification_type, title, message, priority, metadata
      ) VALUES (
        v_winning_bid.bidder_id,
        'system_announcement'::notification_type,
        '🏆 ربحت المزاد',
        'استلمت ' || v_auction.shares_offered::TEXT || ' حصة',
        'high'::notification_priority,
        jsonb_build_object('auction_id', p_auction_id)
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'auction_id',  p_auction_id,
    'winner_id',   v_winning_bid.bidder_id,
    'shares',      v_auction.shares_offered,
    'total',       v_total,
    'contract_id', v_winning_bid.contract_id,
    'routed_to',   CASE WHEN v_winning_bid.contract_id IS NOT NULL THEN 'contract' ELSE 'user' END
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_settle_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_settle_auction(UUID) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.10 applied:';
  RAISE NOTICE '  ✓ deals.contract_id + auction_bids.contract_id added';
  RAISE NOTICE '  ✓ _deposit_shares_into_holder() helper (user OR contract)';
  RAISE NOTICE '  ✓ admin_confirm_deal_payment now routes to contract_holdings';
  RAISE NOTICE '    when deals.contract_id is set; debits contract balance';
  RAISE NOTICE '  ✓ admin_settle_auction(): finds highest bid, transfers';
  RAISE NOTICE '    shares from offering wallet to winner (or contract),';
  RAISE NOTICE '    closes auction with status=completed';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
