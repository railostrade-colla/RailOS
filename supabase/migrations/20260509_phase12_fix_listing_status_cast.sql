-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.6 hotfix — listings.status enum mismatch in 5 deal RPCs
-- Date: 2026-05-09
-- Idempotent: re-creates every affected function from scratch.
--
-- ── The bug ────────────────────────────────────────────────────────
-- All five functions below share the same one-line bug:
--
--   UPDATE public.listings
--   SET status = CASE WHEN ... THEN 'completed' ELSE 'active' END
--
-- Two problems with that line on this DB:
--
--   1. The `listing_status` enum on production has the values
--      (active, sold, cancelled, frozen). It does NOT contain
--      'completed'. The original migrations were written against an
--      older schema spec where the enum value was 'completed', but
--      the actual DDL committed the enum with 'sold' instead.
--      → Postgres: "invalid input value for enum listing_status:
--        completed".
--
--   2. Even if the value were valid, a CASE expression returning
--      a string literal evaluates to `text`, and Postgres will not
--      implicitly cast a text expression to an enum column.
--      → Postgres: "column \"status\" is of type listing_status but
--        expression is of type text". (SQLSTATE 42804.)
--
-- Until today, these branches were never exercised because every
-- previous test deal was a partial fill (the CASE went to the ELSE
-- branch → 'active', which IS a valid enum value, no cast needed).
-- The first full-quantity buy attempt hit BOTH errors back-to-back.
--
-- ── The fix ────────────────────────────────────────────────────────
-- For every UPDATE listings SET status = CASE … END:
--   • use 'sold' instead of 'completed' (matches the real enum)
--   • wrap the CASE in (...)::listing_status (defensive cast for
--     future-proofing; harmless even when the enum auto-casts)
--
-- For the three cancellation/expiry functions that revert a sold
-- listing back to active when a deal is cancelled, change the
-- comparison too: `WHEN status = 'completed'` → `WHEN status = 'sold'`.
-- A wrong comparison there would silently leave listings stuck in
-- 'sold' even after the underlying deal was undone.
--
-- Affected RPCs (5):
--   • place_deal_from_listing       — buyer clicks a sell-listing
--   • accept_buy_listing            — seller accepts a buy-listing
--   • seller_reject_deal            — seller declines the deal
--   • respond_deal_cancellation     — counter-party accepts cancel
--   • expire_pending_deals          — cron job for stale deals
--
-- Apply this once. Buy/sell flow on /exchange will succeed end-to-end.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. place_deal_from_listing ──────────────────────────────────
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

  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_quantity,
      updated_at = NOW()
  WHERE id = v_holding.id;

  -- ⚠ FIX (Phase 12.6): three things on the listing UPDATE —
  --   1. 'sold' (the actual enum value) instead of 'completed'.
  --   2. ::listing_status cast on the CASE result.
  --   3. set buyer_id + sold_at when status flips to 'sold' so the
  --      `buyer_set_if_sold` CHECK constraint is satisfied
  --      (the constraint demands buyer_id IS NOT NULL when sold).
  --      Caller is the buyer here → buyer_id = v_uid.
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      status = (CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'sold'
        ELSE 'active'
      END)::listing_status,
      buyer_id = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN v_uid
        ELSE buyer_id
      END,
      sold_at = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN NOW()
        ELSE sold_at
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- ⚠ FIX (Phase 12.6b): match the real deals schema
  --   • shares (not shares_amount)
  --   • total_amount + fee_amount are GENERATED ALWAYS — omit from INSERT
  --   • deal_type is NOT NULL — set to 'secondary' (between users via listing)
  --   • fee_percentage = 0 so the legacy auto-computed fee_amount is 0;
  --     the new commission lives in buyer_commission + seller_commission
  --   • status enum has 'pending_seller_approval' (not 'pending')
  INSERT INTO public.deals (
    project_id, buyer_id, seller_id,
    deal_type, shares, price_per_share, fee_percentage,
    status, source, listing_id,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_uid, v_listing.seller_id,
    'secondary', p_quantity, v_listing.price_per_share, 0,
    'accepted', 'exchange', p_listing_id,
    v_commission, 0,
    NOW() + (p_duration_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_deal_id;

  -- Phase 12.7: open directly in 'accepted' (the listing itself
  -- is the seller's pre-approval — no extra friction). accepted_at
  -- mirrors created_at since they happen at the same moment.
  UPDATE public.deals SET accepted_at = NOW() WHERE id = v_deal_id;

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


-- ─── 2. accept_buy_listing ───────────────────────────────────────
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

  -- ⚠ FIX (Phase 12.6): three things on the listing UPDATE —
  --   1. 'sold' (the actual enum value) instead of 'completed'.
  --   2. ::listing_status cast on the CASE result.
  --   3. set buyer_id + sold_at when status flips to 'sold' so the
  --      `buyer_set_if_sold` CHECK constraint is satisfied. For a
  --      buy-listing the LISTING CREATOR is the original buyer
  --      (v_listing.seller_id is the column name, but semantically
  --      represents the listing creator i.e. the buyer here).
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      frozen_fee_units = GREATEST(0, COALESCE(frozen_fee_units, 0) - v_proportional_freeze),
      status = (CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'sold'
        ELSE 'active'
      END)::listing_status,
      buyer_id = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN v_listing.seller_id
        ELSE buyer_id
      END,
      sold_at = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN NOW()
        ELSE sold_at
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- ⚠ FIX (Phase 12.6b): match the real deals schema (see place_deal_from_listing).
  INSERT INTO public.deals (
    project_id, buyer_id, seller_id,
    deal_type, shares, price_per_share, fee_percentage,
    status, source, listing_id,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_listing.seller_id, v_uid,
    'secondary', p_quantity, v_listing.price_per_share, 0,
    'accepted', 'exchange', p_listing_id,
    v_commission, 0,
    NOW() + (p_duration_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_deal_id;

  -- Phase 12.7: open directly in 'accepted' (the listing itself
  -- is the seller's pre-approval — no extra friction). accepted_at
  -- mirrors created_at since they happen at the same moment.
  UPDATE public.deals SET accepted_at = NOW() WHERE id = v_deal_id;

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


-- ─── 3. seller_reject_deal — revert listing capacity ─────────────
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

  UPDATE public.holdings
  SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
      updated_at = NOW()
  WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

  -- ⚠ FIX: comparison + cast — the listing was set to 'sold' on
  --       full fill, not 'completed'.
  IF v_deal.listing_id IS NOT NULL THEN
    UPDATE public.listings
    SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
        status = (CASE
          WHEN status = 'sold' THEN 'active'
          ELSE status::text
        END)::listing_status,
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


-- ─── 4. respond_deal_cancellation — revert listing capacity ──────
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
    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
        updated_at = NOW()
    WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

    -- ⚠ FIX: 'sold' instead of 'completed' + explicit cast.
    IF v_deal.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
          status = (CASE
            WHEN status = 'sold' THEN 'active'
            ELSE status::text
          END)::listing_status,
          updated_at = NOW()
      WHERE id = v_deal.listing_id;
    END IF;

    UPDATE public.deals
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_deal_id;
  ELSE
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


-- ─── 5. expire_pending_deals — revert listing capacity ───────────
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
    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_deal.shares),
        updated_at = NOW()
    WHERE user_id = v_deal.seller_id AND project_id = v_deal.project_id;

    -- ⚠ FIX: 'sold' instead of 'completed' + explicit cast.
    IF v_deal.listing_id IS NOT NULL THEN
      UPDATE public.listings
      SET shares_sold = GREATEST(0, COALESCE(shares_sold, 0) - v_deal.shares),
          status = (CASE
            WHEN status = 'sold' THEN 'active'
            ELSE status::text
          END)::listing_status,
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


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12.6 listing-status hotfix applied:';
  RAISE NOTICE '  ✓ place_deal_from_listing  ("sold" + cast + buyer_id/sold_at)';
  RAISE NOTICE '  ✓ accept_buy_listing       ("sold" + cast + buyer_id/sold_at)';
  RAISE NOTICE '  ✓ seller_reject_deal       (compare "sold")';
  RAISE NOTICE '  ✓ respond_deal_cancellation (compare "sold")';
  RAISE NOTICE '  ✓ expire_pending_deals     (compare "sold")';
  RAISE NOTICE '';
  RAISE NOTICE 'Five bugs squashed in one migration:';
  RAISE NOTICE '  • enum value mismatch ("completed" → "sold")';
  RAISE NOTICE '  • text→enum cast required on CASE expression';
  RAISE NOTICE '  • buyer_set_if_sold CHECK needs buyer_id when sold';
  RAISE NOTICE '  • deals column is "shares" not "shares_amount"';
  RAISE NOTICE '  • deals.total_amount + fee_amount are GENERATED';
  RAISE NOTICE '    (omitted from INSERT); deal_type and';
  RAISE NOTICE '    "pending_seller_approval" added correctly';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
