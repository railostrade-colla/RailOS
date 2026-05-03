-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.2 — place_deal_from_listing RPC (real /exchange wiring)
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- Buyer-side click on a sell-listing → creates a `deals` row with
-- status='pending' atomically:
--   1. Lock the listing row + verify capacity
--   2. Lock the seller's holdings + verify available shares
--   3. Decrement listing.shares_sold + listing.shares_offered as
--      appropriate (or shares_remaining via a recompute)
--   4. Bump seller's holdings.frozen_shares so they can't be
--      double-spent before the deal completes
--   5. INSERT into deals with the snapshot price
-- Buyer pays a 2% commission later when the deal completes — not
-- here. This RPC just places the order.
--
-- The flow mirrors what /exchange has been doing in the lib/escrow
-- mock — except now it's real and survives across sessions/devices.
-- ═══════════════════════════════════════════════════════════════════

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

  -- Capacity check — listings.shares_remaining is a derived view; use
  -- shares_offered - shares_sold defensively.
  IF v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0) < p_quantity THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_listing_capacity',
      'available', v_listing.shares_offered - COALESCE(v_listing.shares_sold, 0)
    );
  END IF;

  -- Lock seller's holdings + verify they actually hold the shares
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
  v_commission := FLOOR(v_total_amount * 0.02); -- 2% buyer commission

  -- Freeze seller's shares so concurrent listings can't double-sell
  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_quantity,
      updated_at = NOW()
  WHERE id = v_holding.id;

  -- Bump listing.shares_sold (defensive — listing may auto-complete
  -- when sold == offered)
  UPDATE public.listings
  SET shares_sold = COALESCE(shares_sold, 0) + p_quantity,
      status = CASE
        WHEN COALESCE(shares_sold, 0) + p_quantity >= shares_offered
          THEN 'completed'
        ELSE 'active'
      END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Create the deal row
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

-- Optional: fix listings.shares_sold column if older deployments have
-- it missing (safe NO-OP if already there).
DO $$ BEGIN
  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS shares_sold BIGINT NOT NULL DEFAULT 0
      CHECK (shares_sold >= 0);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES public.listings(id)
      ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_deals_listing_id ON public.deals(listing_id)
  WHERE listing_id IS NOT NULL;
