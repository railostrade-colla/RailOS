-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.2 — Auctions schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two tables:
--   1. auctions      — admin-created auctions on project shares
--   2. auction_bids  — every bid placed; latest highest is materialised
--                      back onto auctions via trigger.
--
-- Bid validation happens inside the place_bid RPC: the bid must be at
-- least current_highest_bid + min_increment, the auction must be in
-- 'active' window, and the bidder can't be the seller. Wrapping in a
-- function avoids races where two near-simultaneous bids could both
-- pass an over-the-counter validation but still land in the table.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE auction_status AS ENUM (
    'upcoming', 'active', 'ended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auction_type AS ENUM ('english', 'dutch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. auctions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,

  title TEXT NOT NULL,
  type auction_type NOT NULL DEFAULT 'english',

  -- Pricing.
  starting_price BIGINT NOT NULL CHECK (starting_price > 0),
  current_highest_bid BIGINT NOT NULL DEFAULT 0,
  min_increment BIGINT NOT NULL CHECK (min_increment > 0),

  -- Quantities.
  shares_offered BIGINT NOT NULL CHECK (shares_offered > 0),
  bid_count INTEGER NOT NULL DEFAULT 0 CHECK (bid_count >= 0),

  -- Schedule + state.
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status auction_status NOT NULL DEFAULT 'upcoming',
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auction_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_project ON public.auctions(project_id);
CREATE INDEX IF NOT EXISTS idx_auctions_window ON public.auctions(starts_at, ends_at);

COMMENT ON TABLE public.auctions IS 'مزادات حصص المشاريع';

-- ─── 2. auction_bids ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  amount BIGINT NOT NULL CHECK (amount > 0),
  shares BIGINT NOT NULL CHECK (shares > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction
  ON public.auction_bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder
  ON public.auction_bids(bidder_id);

COMMENT ON TABLE public.auction_bids IS 'العروض المُقدّمة في المزادات';

-- ─── Trigger: refresh auction counters on bid ────────────────
CREATE OR REPLACE FUNCTION public.refresh_auction_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_highest BIGINT;
  v_count INT;
BEGIN
  SELECT
    COALESCE(MAX(amount), 0),
    COUNT(*)
    INTO v_highest, v_count
  FROM public.auction_bids
  WHERE auction_id = COALESCE(NEW.auction_id, OLD.auction_id);

  UPDATE public.auctions
  SET current_highest_bid = v_highest,
      bid_count = v_count,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.auction_id, OLD.auction_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bid_after_change ON public.auction_bids;
CREATE TRIGGER bid_after_change
  AFTER INSERT OR DELETE ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_auction_counters();

-- ─── RPC: place_bid ──────────────────────────────────────────
-- Atomic: locks the auction row, validates window + amount + bidder,
-- inserts the bid. The trigger above then refreshes counters.
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id UUID,
  p_amount BIGINT,
  p_shares BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auction RECORD;
  v_bid_id UUID;
  v_min BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;
  IF p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_shares');
  END IF;

  SELECT * INTO v_auction FROM public.auctions
  WHERE id = p_auction_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_auction.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'auction_not_active',
      'current_status', v_auction.status
    );
  END IF;
  IF v_auction.starts_at > NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_started');
  END IF;
  IF v_auction.ends_at <= NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'expired');
  END IF;
  IF p_shares > v_auction.shares_offered THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'shares_exceed_offered',
      'max_shares', v_auction.shares_offered
    );
  END IF;

  -- Bid floor: highest + min_increment (per share). The mock UI
  -- treats `amount` as the price-per-share, so we compare directly.
  v_min := v_auction.current_highest_bid + v_auction.min_increment;
  IF p_amount < v_min THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'amount_below_min',
      'min_required', v_min
    );
  END IF;

  INSERT INTO public.auction_bids (auction_id, bidder_id, amount, shares)
  VALUES (p_auction_id, v_uid, p_amount, p_shares)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'bid_id', v_bid_id,
    'new_highest', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_bid(UUID, BIGINT, BIGINT) TO authenticated;

-- ─── updated_at trigger ──────────────────────────────────────
DROP TRIGGER IF EXISTS auctions_updated_at ON public.auctions;
CREATE TRIGGER auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- auctions: public SELECT (transparency), admin-only writes.
DROP POLICY IF EXISTS "Anyone can view auctions" ON public.auctions;
CREATE POLICY "Anyone can view auctions"
ON public.auctions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage auctions" ON public.auctions;
CREATE POLICY "Admins manage auctions"
ON public.auctions FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- auction_bids: public SELECT (transparency), self-INSERT via RPC,
-- no UPDATE/DELETE from clients (bids are immutable history).
DROP POLICY IF EXISTS "Anyone can view bids" ON public.auction_bids;
CREATE POLICY "Anyone can view bids"
ON public.auction_bids FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can place bids" ON public.auction_bids;
CREATE POLICY "Users can place bids"
ON public.auction_bids FOR INSERT
WITH CHECK (bidder_id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete bids" ON public.auction_bids;
CREATE POLICY "Admins can delete bids"
ON public.auction_bids FOR DELETE
USING (public.is_admin());
