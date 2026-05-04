-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.7 — buy-listing fund escrow
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- Buy listings (إعلانات شراء) commit the buyer to spending Y د.ع per
-- share for X shares — but the platform only takes a 2% fee in
-- fee-units. To prevent buyers from filling the board with phantom
-- orders they can't pay the commission on, we freeze the projected
-- commission in their `fee_unit_balances` when they create a buy
-- listing, and refund it when:
--   • The listing is cancelled by the buyer
--   • The listing expires unfilled
--   • The deal that consumes capacity is rejected/cancelled
-- (Currently we just refund on listing cancel/complete — full deal-
-- side refunds are a follow-up once /deals/[id] migrates to DB.)
--
-- Schema changes:
--   • fee_unit_balances.frozen_balance (BIGINT, default 0, CHECK ≥ 0)
--   • listings.frozen_fee_units (BIGINT) — bookkeeping per listing so
--     we know exactly how much to refund on cancel.
--
-- RPC changes:
--   • create_listing — for type='buy', freeze 2% commission.
--   • cancel_listing(listing_id) — owner cancels; if buy-listing,
--     refund the unused frozen portion (unused = total frozen × (1 −
--     filled_ratio)).
--   • accept_buy_listing — unfreezes the proportional commission and
--     deducts it from balance. Idempotent on re-runs.
-- ═══════════════════════════════════════════════════════════════════

-- 1. fee_unit_balances.frozen_balance
DO $$ BEGIN
  ALTER TABLE public.fee_unit_balances
    ADD COLUMN IF NOT EXISTS frozen_balance BIGINT NOT NULL DEFAULT 0
      CHECK (frozen_balance >= 0);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2. listings.frozen_fee_units
DO $$ BEGIN
  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS frozen_fee_units BIGINT NOT NULL DEFAULT 0
      CHECK (frozen_fee_units >= 0);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 3. Update create_listing — freeze commission for buy-listings.
DROP FUNCTION IF EXISTS public.create_listing(UUID, BIGINT, NUMERIC, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.create_listing(
  p_project_id UUID,
  p_shares_offered BIGINT,
  p_price_per_share NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_is_quick_sell BOOLEAN DEFAULT FALSE,
  p_type TEXT DEFAULT 'sell'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_holding RECORD;
  v_balance RECORD;
  v_listing_id UUID;
  v_total NUMERIC;
  v_commission BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_shares_offered IS NULL OR p_shares_offered <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_shares');
  END IF;
  IF p_price_per_share IS NULL OR p_price_per_share <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_price');
  END IF;
  IF p_type NOT IN ('sell', 'buy') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_type');
  END IF;

  v_total := p_shares_offered::NUMERIC * p_price_per_share;
  v_commission := FLOOR(v_total * 0.02);

  IF p_type = 'sell' THEN
    -- Sell-listing: verify holdings.
    SELECT * INTO v_holding FROM public.holdings
    WHERE user_id = v_uid AND project_id = p_project_id
    FOR UPDATE;
    IF v_holding IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'no_holdings');
    END IF;
    IF v_holding.shares - COALESCE(v_holding.frozen_shares, 0) < p_shares_offered THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'insufficient_unfrozen',
        'available', v_holding.shares - COALESCE(v_holding.frozen_shares, 0)
      );
    END IF;
  ELSIF p_type = 'buy' THEN
    -- Buy-listing: freeze projected commission. Empty/missing balance
    -- row means insufficient funds.
    SELECT * INTO v_balance FROM public.fee_unit_balances
    WHERE user_id = v_uid
    FOR UPDATE;
    IF v_balance IS NULL OR
       (v_balance.balance - COALESCE(v_balance.frozen_balance, 0)) < v_commission THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'insufficient_fee_units',
        'required', v_commission,
        'available', COALESCE(
          v_balance.balance - COALESCE(v_balance.frozen_balance, 0),
          0
        )
      );
    END IF;

    -- Freeze it (on the SAME row we already locked)
    UPDATE public.fee_unit_balances
    SET frozen_balance = COALESCE(frozen_balance, 0) + v_commission,
        last_transaction_at = NOW()
    WHERE user_id = v_uid;
  END IF;

  INSERT INTO public.listings (
    seller_id, project_id, shares_offered, price_per_share,
    notes, is_quick_sell, status, type, frozen_fee_units
  ) VALUES (
    v_uid, p_project_id, p_shares_offered, p_price_per_share,
    p_notes, COALESCE(p_is_quick_sell, FALSE), 'active', p_type,
    CASE WHEN p_type = 'buy' THEN v_commission ELSE 0 END
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'listing_id', v_listing_id,
    'type', p_type,
    'frozen_fee_units', CASE WHEN p_type = 'buy' THEN v_commission ELSE 0 END
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.create_listing(
  UUID, BIGINT, NUMERIC, TEXT, BOOLEAN, TEXT
) TO authenticated;

-- 4. cancel_listing — owner cancels their own active listing.
--    For buy-listings, refunds the unused frozen fee-units back into
--    available balance. For sell-listings, just flips status (no
--    holdings unfreeze needed because we never freeze on creation —
--    sell freezes happen at acceptance time).
CREATE OR REPLACE FUNCTION public.cancel_listing(
  p_listing_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_listing RECORD;
  v_unfilled_ratio NUMERIC;
  v_refund BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_listing FROM public.listings
  WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'listing_not_found');
  END IF;
  IF v_listing.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_owner');
  END IF;
  IF v_listing.status NOT IN ('active', 'paused') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'not_cancellable',
      'current_status', v_listing.status
    );
  END IF;

  -- Refund unused frozen fee-units for buy-listings
  IF COALESCE(v_listing.type, 'sell') = 'buy'
     AND COALESCE(v_listing.frozen_fee_units, 0) > 0 THEN
    -- Unfilled ratio = (offered - sold) / offered
    v_unfilled_ratio := CASE
      WHEN v_listing.shares_offered > 0
        THEN (v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0))::NUMERIC
             / v_listing.shares_offered
      ELSE 0
    END;
    v_refund := FLOOR(v_listing.frozen_fee_units * v_unfilled_ratio);

    IF v_refund > 0 THEN
      UPDATE public.fee_unit_balances
      SET frozen_balance = GREATEST(0, COALESCE(frozen_balance, 0) - v_refund),
          last_transaction_at = NOW()
      WHERE user_id = v_uid;

      UPDATE public.listings
      SET frozen_fee_units = GREATEST(0, frozen_fee_units - v_refund)
      WHERE id = p_listing_id;
    END IF;
  END IF;

  UPDATE public.listings
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'refunded_fee_units', COALESCE(v_refund, 0)
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.cancel_listing(UUID) TO authenticated;

-- 5. Update accept_buy_listing — unfreeze + deduct proportional fee.
CREATE OR REPLACE FUNCTION public.accept_buy_listing(
  p_listing_id UUID,
  p_quantity BIGINT,
  p_duration_hours INTEGER DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_listing RECORD;
  v_holding RECORD;
  v_total_amount BIGINT;
  v_commission BIGINT;
  v_proportional_freeze BIGINT;
  v_deal_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_quantity');
  END IF;
  IF p_duration_hours NOT IN (24, 48, 72) THEN
    p_duration_hours := 24;
  END IF;

  SELECT * INTO v_listing FROM public.listings
  WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'listing_not_found');
  END IF;
  IF v_listing.status <> 'active' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'listing_inactive',
      'current_status', v_listing.status);
  END IF;
  IF COALESCE(v_listing.type, 'sell') <> 'buy' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_a_buy_listing');
  END IF;
  IF v_listing.seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_accept_own_listing');
  END IF;

  IF v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_listing_capacity',
      'available', v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0)
    );
  END IF;

  SELECT * INTO v_holding FROM public.holdings
  WHERE user_id = v_uid AND project_id = v_listing.project_id
  FOR UPDATE;
  IF v_holding IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_holdings');
  END IF;
  IF v_holding.shares - COALESCE(v_holding.frozen_shares, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_unfrozen',
      'unfrozen', v_holding.shares - COALESCE(v_holding.frozen_shares, 0)
    );
  END IF;

  v_total_amount := p_quantity * v_listing.price_per_share;
  v_commission := FLOOR(v_total_amount * 0.02);

  -- Proportional unfreeze on the buyer's fee-units. Compute as
  -- frozen_fee_units × (qty / shares_offered) so partial fills release
  -- exactly the right slice.
  v_proportional_freeze := FLOOR(
    COALESCE(v_listing.frozen_fee_units, 0)::NUMERIC
    * p_quantity
    / GREATEST(v_listing.shares_offered, 1)
  );

  IF v_proportional_freeze > 0 THEN
    UPDATE public.fee_unit_balances
    SET frozen_balance = GREATEST(0, COALESCE(frozen_balance, 0) - v_proportional_freeze),
        last_transaction_at = NOW()
    WHERE user_id = v_listing.seller_id; -- buyer in our naming
  END IF;

  -- Freeze acceptor's shares
  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_quantity,
      updated_at = NOW()
  WHERE id = v_holding.id;

  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      frozen_fee_units = GREATEST(0, COALESCE(frozen_fee_units, 0) - v_proportional_freeze),
      status = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.deals (
    project_id, buyer_id, seller_id, shares_amount, price_per_share,
    total_amount, status, source, listing_id,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_listing.seller_id, v_uid,
    p_quantity, v_listing.price_per_share,
    v_total_amount, 'pending', 'exchange', p_listing_id,
    v_commission, 0,
    NOW() + (p_duration_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_listing.seller_id,
      'deal_request_received'::notification_type,
      '✅ تم قبول طلب شرائك',
      'قَبِل بائع طلب شراء ' || p_quantity || ' حصة',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deal_id', v_deal_id,
    'total_amount', v_total_amount,
    'buyer_commission', v_commission,
    'fee_units_unfrozen', v_proportional_freeze
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.accept_buy_listing(UUID, BIGINT, INTEGER)
  TO authenticated;
