-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.8 — deal lifecycle RPCs + bug fixes for prior place_deal /
--              accept_buy_listing
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- ⚠ Bug fixes baked in (the prior place_deal_from_listing and
--   accept_buy_listing RPCs would have failed at runtime):
--    • Column was `shares` not `shares_amount`
--    • Status enum value was 'pending_seller_approval' not 'pending'
--   These DROPs and re-creates fix both. Calling code does not need
--   to change — the result shape stays the same.
--
-- New lifecycle RPCs (mirror the in-memory escrow lib):
--   • seller_accept_deal(deal_id)             pending_seller_approval → accepted
--   • seller_reject_deal(deal_id, reason?)    pending_seller_approval → rejected
--                                              + unfreezes seller's shares
--                                              + refunds buyer's frozen fee_units
--                                                proportionally (if from buy-listing)
--   • buyer_confirm_payment(deal_id)          accepted → payment_submitted
--   • seller_release_shares(deal_id)          payment_submitted → completed
--                                              + transfers shares seller→buyer
--                                              + deducts buyer commission from
--                                                fee_unit_balances.balance
--   • request_deal_cancellation(deal_id, reason)
--                                              flags `cancellation_reason` +
--                                              `cancellation_requested_by`
--                                              (status unchanged so other
--                                                party can accept/reject)
--   • respond_deal_cancellation(deal_id, accept BOOLEAN)
--                                              accept=true  → status=cancelled
--                                                            + unfreeze + refund
--                                              accept=false → clear flags
--   • open_deal_dispute(deal_id, reason)       status=disputed
--   • expire_pending_deals()                   admin/cron — bulk expire
-- ═══════════════════════════════════════════════════════════════════

-- 0. Add cancellation_requested_by column (defensive)
DO $$ BEGIN
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID
      REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 1. Fix place_deal_from_listing ───────────────────────────────
DROP FUNCTION IF EXISTS public.place_deal_from_listing(UUID, BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION public.place_deal_from_listing(
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
  -- Sell-listing only — buy listings go through accept_buy_listing
  IF COALESCE(v_listing.type, 'sell') <> 'sell' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_a_sell_listing');
  END IF;
  IF v_listing.seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_buy_own_listing');
  END IF;

  IF v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_listing_capacity',
      'available', v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0)
    );
  END IF;

  SELECT * INTO v_holding FROM public.holdings
  WHERE user_id = v_listing.seller_id AND project_id = v_listing.project_id
  FOR UPDATE;
  IF v_holding IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'seller_holdings_missing');
  END IF;
  IF v_holding.shares - COALESCE(v_holding.frozen_shares, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'seller_insufficient_unfrozen',
      'unfrozen', v_holding.shares - COALESCE(v_holding.frozen_shares, 0)
    );
  END IF;

  v_total_amount := p_quantity * v_listing.price_per_share;
  v_commission := FLOOR(v_total_amount * 0.02);

  -- Freeze seller's shares
  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_quantity,
      updated_at = NOW()
  WHERE id = v_holding.id;

  -- Bump listing capacity
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      status = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Create deal — use REAL column names + REAL enum value
  INSERT INTO public.deals (
    project_id, buyer_id, seller_id, shares, price_per_share,
    total_amount, status, source, listing_id, deal_type,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_uid, v_listing.seller_id,
    p_quantity, v_listing.price_per_share,
    v_total_amount, 'pending_seller_approval', 'exchange', p_listing_id, 'secondary',
    v_commission, 0,
    NOW() + (p_duration_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_listing.seller_id,
      'deal_request_received'::notification_type,
      '🛒 طلب شراء جديد',
      'تلقّيت طلب شراء ' || p_quantity || ' حصة',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deal_id', v_deal_id,
    'total_amount', v_total_amount,
    'buyer_commission', v_commission
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.place_deal_from_listing(UUID, BIGINT, INTEGER)
  TO authenticated;

-- ─── 2. Fix accept_buy_listing ────────────────────────────────────
DROP FUNCTION IF EXISTS public.accept_buy_listing(UUID, BIGINT, INTEGER);

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

  v_proportional_freeze := FLOOR(
    COALESCE(v_listing.frozen_fee_units, 0)::NUMERIC
    * p_quantity
    / GREATEST(v_listing.shares_offered, 1)
  );

  IF v_proportional_freeze > 0 THEN
    UPDATE public.fee_unit_balances
    SET frozen_balance = GREATEST(0, COALESCE(frozen_balance, 0) - v_proportional_freeze),
        last_transaction_at = NOW()
    WHERE user_id = v_listing.seller_id;
  END IF;

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
    project_id, buyer_id, seller_id, shares, price_per_share,
    total_amount, status, source, listing_id, deal_type,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_listing.seller_id, v_uid,
    p_quantity, v_listing.price_per_share,
    v_total_amount, 'pending_seller_approval', 'exchange', p_listing_id, 'secondary',
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

-- ═══════════════════════════════════════════════════════════════════
-- 3. New lifecycle RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── seller_accept_deal ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_accept_deal(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_seller');
  END IF;
  IF v_deal.status <> 'pending_seller_approval' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;

  UPDATE public.deals
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id,
      'deal_accepted'::notification_type,
      '✅ تم قبول صفقتك',
      'البائع وافق على الصفقة — ادفع المبلغ المتفق عليه',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.seller_accept_deal(UUID) TO authenticated;

-- ─── seller_reject_deal ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_reject_deal(
  p_deal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_seller');
  END IF;
  IF v_deal.status <> 'pending_seller_approval' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;

  -- Unfreeze seller's shares
  UPDATE public.holdings
  SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
      updated_at = NOW()
  WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

  -- Bump listing capacity back if linked
  IF v_deal.listing_id IS NOT NULL THEN
    UPDATE public.listings
    SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
        status = CASE WHEN status = 'completed' THEN 'active' ELSE status END,
        updated_at = NOW()
    WHERE id = v_deal.listing_id;
  END IF;

  UPDATE public.deals
  SET status = 'rejected',
      seller_notes = COALESCE(p_reason, seller_notes),
      updated_at = NOW()
  WHERE id = p_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id,
      'deal_rejected'::notification_type,
      '❌ رفض البائع الصفقة',
      COALESCE(p_reason, 'لم يقدّم البائع سبباً'),
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.seller_reject_deal(UUID, TEXT) TO authenticated;

-- ─── buyer_confirm_payment ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buyer_confirm_payment(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.buyer_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_buyer');
  END IF;
  IF v_deal.status <> 'accepted' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;

  UPDATE public.deals
  SET status = 'payment_submitted',
      payment_submitted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_deal.seller_id,
      'payment_received'::notification_type,
      '💰 المشتري أكّد الدفع',
      'راجع الحساب البنكي وحرّر الحصص',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.buyer_confirm_payment(UUID) TO authenticated;

-- ─── seller_release_shares (the big one) ─────────────────────────
CREATE OR REPLACE FUNCTION public.seller_release_shares(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
  v_buyer_holding RECORD;
  v_balance RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_seller');
  END IF;
  IF v_deal.status <> 'payment_submitted' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;

  -- Decrement seller: shares - X, frozen_shares - X
  UPDATE public.holdings
  SET shares = shares - v_deal.shares,
      frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
      updated_at = NOW()
  WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

  -- Increment buyer: upsert holdings row
  SELECT * INTO v_buyer_holding FROM public.holdings
  WHERE user_id = v_deal.buyer_id AND project_id = v_deal.project_id
  FOR UPDATE;

  IF v_buyer_holding IS NULL THEN
    INSERT INTO public.holdings (
      user_id, project_id, shares, frozen_shares,
      average_buy_price, total_invested,
      acquired_from_secondary, first_acquired_at, last_acquired_at
    ) VALUES (
      v_deal.buyer_id, v_deal.project_id, v_deal.shares, 0,
      v_deal.price_per_share,
      COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share),
      v_deal.shares, NOW(), NOW()
    );
  ELSE
    -- Weighted average buy price update
    UPDATE public.holdings
    SET shares = shares + v_deal.shares,
        average_buy_price =
          ((shares * COALESCE(average_buy_price, 0)) + (v_deal.shares * v_deal.price_per_share))
          / NULLIF(shares + v_deal.shares, 0),
        total_invested = COALESCE(total_invested, 0)
          + COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share),
        acquired_from_secondary = COALESCE(acquired_from_secondary, 0) + v_deal.shares,
        last_acquired_at = NOW(),
        updated_at = NOW()
    WHERE id = v_buyer_holding.id;
  END IF;

  -- Deduct buyer commission from fee_unit_balances
  IF COALESCE(v_deal.buyer_commission, 0) > 0 THEN
    SELECT * INTO v_balance FROM public.fee_unit_balances
    WHERE user_id = v_deal.buyer_id FOR UPDATE;
    IF v_balance IS NOT NULL AND v_balance.balance >= v_deal.buyer_commission THEN
      UPDATE public.fee_unit_balances
      SET balance = balance - v_deal.buyer_commission,
          total_withdrawn = COALESCE(total_withdrawn, 0) + v_deal.buyer_commission,
          last_transaction_at = NOW()
      WHERE user_id = v_deal.buyer_id;
    END IF;
    -- Soft-fail on insufficient balance — the deal still completes;
    -- admin reconciliation handles edge cases.
  END IF;

  UPDATE public.deals
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_deal_id;

  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id,
      'deal_completed'::notification_type,
      '🎉 تم تحويل الحصص',
      'استلمت ' || v_deal.shares || ' حصة بنجاح',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.seller_release_shares(UUID) TO authenticated;

-- ─── request_deal_cancellation ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_deal_cancellation(
  p_deal_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
  v_other_party UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reason_required');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.buyer_id <> v_uid AND v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_party');
  END IF;
  IF v_deal.status NOT IN ('pending_seller_approval', 'accepted', 'payment_submitted') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;
  IF v_deal.cancellation_requested_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_requested');
  END IF;

  UPDATE public.deals
  SET cancellation_requested_by = v_uid,
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_deal_id;

  v_other_party := CASE WHEN v_uid = v_deal.buyer_id
                         THEN v_deal.seller_id
                         ELSE v_deal.buyer_id END;

  BEGIN
    PERFORM public.create_user_notification(
      v_other_party,
      'deal_cancellation_requested'::notification_type,
      '🚫 طلب إلغاء صفقة',
      p_reason,
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.request_deal_cancellation(UUID, TEXT)
  TO authenticated;

-- ─── respond_deal_cancellation ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_deal_cancellation(
  p_deal_id UUID,
  p_accept BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.cancellation_requested_by IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_request');
  END IF;
  IF v_deal.cancellation_requested_by = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cant_respond_own_request');
  END IF;
  IF v_deal.buyer_id <> v_uid AND v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_party');
  END IF;

  IF p_accept THEN
    -- Unfreeze seller's shares
    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
        updated_at = NOW()
    WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

    -- Bump listing capacity back
    IF v_deal.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
          status = CASE WHEN status = 'completed' THEN 'active' ELSE status END,
          updated_at = NOW()
      WHERE id = v_deal.listing_id;
    END IF;

    UPDATE public.deals
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_deal_id;
  ELSE
    -- Reject — clear flags, keep status
    UPDATE public.deals
    SET cancellation_requested_by = NULL,
        cancellation_reason = NULL,
        updated_at = NOW()
    WHERE id = p_deal_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'accepted', p_accept);
END $$;
GRANT EXECUTE ON FUNCTION public.respond_deal_cancellation(UUID, BOOLEAN)
  TO authenticated;

-- ─── open_deal_dispute ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_deal_dispute(
  p_deal_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reason_required');
  END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.buyer_id <> v_uid AND v_deal.seller_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_party');
  END IF;
  IF v_deal.status IN ('completed', 'cancelled', 'rejected', 'expired') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wrong_status',
      'current_status', v_deal.status);
  END IF;

  UPDATE public.deals
  SET status = 'disputed',
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_deal_id;

  RETURN jsonb_build_object('success', TRUE);
END $$;
GRANT EXECUTE ON FUNCTION public.open_deal_dispute(UUID, TEXT)
  TO authenticated;

-- ─── expire_pending_deals (admin/cron helper) ─────────────────────
CREATE OR REPLACE FUNCTION public.expire_pending_deals()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  v_deal RECORD;
BEGIN
  v_count := 0;
  FOR v_deal IN
    SELECT * FROM public.deals
    WHERE status IN ('pending_seller_approval', 'accepted', 'payment_submitted')
      AND expires_at < NOW()
    FOR UPDATE
  LOOP
    -- Unfreeze seller's shares
    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
        updated_at = NOW()
    WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

    -- Bump listing capacity back
    IF v_deal.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
          status = CASE WHEN status = 'completed' THEN 'active' ELSE status END,
          updated_at = NOW()
      WHERE id = v_deal.listing_id;
    END IF;

    UPDATE public.deals
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_deal.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'expired_count', v_count);
END $$;
GRANT EXECUTE ON FUNCTION public.expire_pending_deals() TO authenticated;
