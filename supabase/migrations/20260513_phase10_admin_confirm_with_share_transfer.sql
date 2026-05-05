-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.69 — admin_confirm_deal_payment now actually transfers shares
-- Date: 2026-05-13
-- Idempotent: safe to re-run.
--
-- The previous version only flipped status='completed' but never:
--   • decremented project_wallets.offering.available_shares (primary)
--   • decremented seller's holdings (secondary)
--   • inserted/updated buyer's holdings row
--   • updated profiles.trades_completed + total_invested
--
-- This migration replaces the function with a complete share-transfer
-- implementation that handles BOTH deal types:
--   • primary    → shares come from project_wallets.offering
--   • secondary / quick_sell → shares come from seller's holdings
--
-- Also publishes the relevant tables to supabase_realtime so the
-- portfolio page can subscribe and auto-update without F5.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_confirm_deal_payment(UUID);

CREATE OR REPLACE FUNCTION public.admin_confirm_deal_payment(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_deal          RECORD;
  v_buyer_holding RECORD;
  v_offering      RECORD;
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
     ('pending_seller_approval', 'accepted', 'payment_submitted', 'disputed') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_status',
      'current', v_deal.status::TEXT);
  END IF;

  -- ─── 1. Pull shares from the right source ──────────────────────
  IF v_deal.deal_type::TEXT = 'primary' THEN
    SELECT * INTO v_offering FROM public.project_wallets
    WHERE project_id = v_deal.project_id AND wallet_type = 'offering'
    FOR UPDATE;

    IF v_offering.id IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'no_offering_wallet');
    END IF;
    IF v_offering.available_shares < v_deal.shares THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'insufficient_offering',
        'available', v_offering.available_shares, 'needed', v_deal.shares);
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

  -- ─── 2. Push shares into buyer's holdings ──────────────────────
  SELECT * INTO v_buyer_holding FROM public.holdings
  WHERE user_id = v_deal.buyer_id AND project_id = v_deal.project_id
  FOR UPDATE;

  IF v_buyer_holding.id IS NULL THEN
    INSERT INTO public.holdings (
      user_id, project_id, shares, frozen_shares,
      average_buy_price, total_invested,
      acquired_from_offering, acquired_from_secondary,
      first_acquired_at, last_acquired_at
    ) VALUES (
      v_deal.buyer_id, v_deal.project_id, v_deal.shares, 0,
      v_deal.price_per_share,
      COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share),
      CASE WHEN v_deal.deal_type::TEXT = 'primary' THEN v_deal.shares ELSE 0 END,
      CASE WHEN v_deal.deal_type::TEXT <> 'primary' THEN v_deal.shares ELSE 0 END,
      NOW(), NOW()
    );
  ELSE
    UPDATE public.holdings
       SET shares = shares + v_deal.shares,
           average_buy_price =
             ((shares * COALESCE(average_buy_price, 0))
              + (v_deal.shares * v_deal.price_per_share))
             / NULLIF(shares + v_deal.shares, 0),
           total_invested = COALESCE(total_invested, 0)
             + COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share),
           acquired_from_offering = CASE
             WHEN v_deal.deal_type::TEXT = 'primary'
             THEN COALESCE(acquired_from_offering, 0) + v_deal.shares
             ELSE COALESCE(acquired_from_offering, 0)
           END,
           acquired_from_secondary = CASE
             WHEN v_deal.deal_type::TEXT <> 'primary'
             THEN COALESCE(acquired_from_secondary, 0) + v_deal.shares
             ELSE COALESCE(acquired_from_secondary, 0)
           END,
           last_acquired_at = NOW(),
           updated_at = NOW()
     WHERE id = v_buyer_holding.id;
  END IF;

  -- ─── 3. Bump buyer's profile counters ──────────────────────────
  BEGIN
    UPDATE public.profiles
       SET trades_completed = COALESCE(trades_completed, 0) + 1,
           total_invested   = COALESCE(total_invested, 0)
             + COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share),
           last_trade_at    = NOW()
     WHERE id = v_deal.buyer_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ─── 4. Mark deal completed ────────────────────────────────────
  UPDATE public.deals
     SET status = 'completed'::deal_status,
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
   WHERE id = p_deal_id;

  -- ─── 5. Audit + notifications ──────────────────────────────────
  BEGIN
    PERFORM public.log_admin_action(
      'confirm_deal_payment', 'deal', p_deal_id,
      jsonb_build_object(
        'buyer_id', v_deal.buyer_id, 'seller_id', v_deal.seller_id,
        'amount', v_deal.total_amount, 'shares', v_deal.shares,
        'deal_type', v_deal.deal_type::TEXT
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id, 'deal_completed'::notification_type,
      '🎉 تم تحويل الحصص',
      'استلمت ' || v_deal.shares::TEXT || ' حصة بنجاح في محفظتك',
      'high'::notification_priority,
      '/portfolio'
    );
    PERFORM public.create_user_notification(
      v_deal.seller_id, 'deal_completed'::notification_type,
      '💰 صفقتك مكتملة',
      'الإدارة أكّدت استلام الدفعة',
      'high'::notification_priority,
      '/deals/' || p_deal_id::TEXT
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'deal_id',           p_deal_id,
    'shares_transferred', v_deal.shares,
    'deal_type',         v_deal.deal_type::TEXT
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_deal_payment(UUID) TO authenticated;


-- ─── Realtime: publish tables so portfolio can auto-update ────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.holdings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_wallets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.69 applied:';
  RAISE NOTICE '  ✓ admin_confirm_deal_payment now transfers shares';
  RAISE NOTICE '  ✓ Realtime enabled on holdings + project_wallets + deals + profiles';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
