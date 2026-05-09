-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.6 hotfix — explicit ::listing_status cast on UPDATE...CASE
-- Date: 2026-05-09
-- Idempotent: re-creates both place_deal_from_listing and
--             accept_buy_listing with the cast fix in place.
--
-- Bug:
--   The two deal-opening RPCs run:
--     UPDATE public.listings
--     SET status = CASE WHEN ... THEN 'completed' ELSE 'active' END,
--         ...
--   PostgreSQL will not implicitly cast a CASE expression of type
--   `text` to the `listing_status` enum, so this fails with:
--     ERROR:  column "status" is of type listing_status but expression
--             is of type text
--             SQLSTATE: 42804
--   The whole place/accept transaction aborts and the buyer sees
--   "تعذّر فتح الصفقة: column ... but expression is of type text".
--
-- Fix:
--   Wrap the CASE in (...)::listing_status so the result is cast to
--   the enum BEFORE Postgres assigns it to listings.status. INSERT
--   into deals.status with bare 'pending' is fine — INSERT auto-casts
--   bare string literals to enum target columns at parse time. CASE
--   does not get the same auto-cast.
--
-- Apply this once. Buy/sell flow on /exchange will succeed end-to-end.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. place_deal_from_listing ──────────────────────────────────
-- Caller is the BUYER reacting to a sell-listing.
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

  -- Lock the listing
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

  -- Capacity check
  IF v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_listing_capacity',
      'available', v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0)
    );
  END IF;

  -- Lock seller's holdings + verify
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

  -- ⚠ FIX: cast the CASE result to listing_status — Postgres will not
  --       auto-cast a text CASE result to an enum column.
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      status = (CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END)::listing_status,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Create the deal row. The deals.status enum auto-casts from the
  -- bare 'pending' literal at INSERT time, so no explicit cast needed.
  INSERT INTO public.deals (
    project_id, buyer_id, seller_id, shares_amount, price_per_share,
    total_amount, status, source, listing_id,
    buyer_commission, seller_commission,
    expires_at
  ) VALUES (
    v_listing.project_id, v_uid, v_listing.seller_id,
    p_quantity, v_listing.price_per_share,
    v_total_amount, 'pending', 'exchange', p_listing_id,
    v_commission, 0,
    NOW() + (p_duration_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_deal_id;

  -- Notify the seller (best-effort)
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
-- Caller is the SELLER reacting to a buy-listing.
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

  -- ⚠ FIX: cast the CASE result to listing_status (same bug as above).
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      frozen_fee_units = GREATEST(0, COALESCE(frozen_fee_units, 0) - v_proportional_freeze),
      status = (CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END)::listing_status,
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


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12.6 listing-status cast hotfix applied:';
  RAISE NOTICE '  ✓ place_deal_from_listing — UPDATE...CASE now ::listing_status';
  RAISE NOTICE '  ✓ accept_buy_listing      — UPDATE...CASE now ::listing_status';
  RAISE NOTICE 'After applying: try buying any listing — the deal will open';
  RAISE NOTICE 'cleanly and you will land on /deals/<id>.';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
