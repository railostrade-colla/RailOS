-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.5 — buy-listings (طلبات الشراء)
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- Until now, `listings` only modeled sell-side offers (a holder
-- offers shares for sale). Buy-side (a buyer signals they want to
-- buy at a given price) was mock-only on /exchange.
--
-- Approach: extend the existing `listings` table with a `type`
-- column (sell|buy) so RLS, indexes, and the create_listing /
-- exchange flow can reuse the same schema. For buy listings:
--   - listing.seller_id is the *buyer* (column name kept for back-
--     compat — it really means "listing creator").
--   - shares_offered means "shares wanted".
--   - When a seller accepts a buy listing, we run the symmetric
--     RPC `accept_buy_listing` which locks the *acceptor's*
--     holdings, freezes shares, and creates a deal with:
--       buyer_id  = listing.seller_id
--       seller_id = auth.uid()
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add `type` column (default 'sell' so existing rows are unaffected)
DO $$ BEGIN
  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'sell'
      CHECK (type IN ('sell', 'buy'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_listings_type_status
  ON public.listings(type, status)
  WHERE status = 'active';

-- 2. Update create_listing to accept the type. Drop the old signature
--    first because PostgreSQL won't let us add a parameter via REPLACE.
DROP FUNCTION IF EXISTS public.create_listing(UUID, BIGINT, NUMERIC, TEXT, BOOLEAN);

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
  v_listing_id UUID;
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

  -- For sell-listings, verify the creator actually holds the shares.
  -- For buy-listings, no holding check is needed — anyone can place a
  -- buy order. (Future: lock fee_units to back the order.)
  IF p_type = 'sell' THEN
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
  END IF;

  INSERT INTO public.listings (
    seller_id, project_id, shares_offered, price_per_share,
    notes, is_quick_sell, status, type
  ) VALUES (
    v_uid, p_project_id, p_shares_offered, p_price_per_share,
    p_notes, COALESCE(p_is_quick_sell, FALSE), 'active', p_type
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'listing_id', v_listing_id,
    'type', p_type
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.create_listing(
  UUID, BIGINT, NUMERIC, TEXT, BOOLEAN, TEXT
) TO authenticated;

-- 3. accept_buy_listing — symmetric to place_deal_from_listing but
--    for buy-side. Acceptor (auth.uid) is the seller in the deal.
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

  -- Lock listing + verify it's an active BUY listing
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

  -- Capacity check
  IF v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_listing_capacity',
      'available', v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0)
    );
  END IF;

  -- Lock acceptor's holdings (acceptor is the SELLER in the resulting deal)
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
  v_commission := FLOOR(v_total_amount * 0.02); -- 2% buyer commission

  -- Freeze acceptor's shares
  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_quantity,
      updated_at = NOW()
  WHERE id = v_holding.id;

  -- Bump listing.shares_sold and possibly mark complete
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      status = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Create deal: buyer = listing creator, seller = acceptor
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

  -- Notify the buyer (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      v_listing.seller_id, -- the buyer
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
    'buyer_commission', v_commission
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.accept_buy_listing(UUID, BIGINT, INTEGER)
  TO authenticated;
