-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.22 — get_project_live_snapshot RPC
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec: every screen that displays project data should pull
-- live values from one canonical source so the numbers cannot drift
-- across the app. The Investment page, the Discover cards, the
-- Project detail screen, the Portfolio holdings — all should hit
-- the same RPC and get the same answer.
--
-- This RPC is GRANTed to authenticated + anon (returns only
-- aggregate, non-PII fields), so it bypasses the admin-only RLS on
-- project_wallets while still safely exposing the live numbers.
--
-- Returned fields are organised per the founder's three buckets:
--   1. Form fields (immutable inputs from the create-project form)
--   2. Dynamic ratios (recomputed from project_wallets every call)
--   3. Market state (live prices + investor + dividend totals)
--
-- Funding rule (CRITICAL):
--   funding_pct = (offering_sold / offering_total) × 100
--   The owner's equity NEVER enters that ratio. When admin clicks
--   "إضافة حصص للطرح" the offering_wallet.total_shares grows, the
--   denominator grows, the funding_pct adjusts naturally — but the
--   owner's share count is never part of the meter.
-- ═══════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.get_project_live_snapshot(
  p_project_id UUID
)
RETURNS TABLE (
  -- ─── 1. Form fields ─────────────────────────────────────
  id UUID,
  name TEXT,
  short_description TEXT,
  description TEXT,
  project_type TEXT,
  symbol TEXT,
  logo_url TEXT,
  cover_url TEXT,
  status TEXT,
  risk_level TEXT,
  distribution_type TEXT,
  expected_return_min NUMERIC,
  expected_return_max NUMERIC,
  duration_open BOOLEAN,
  duration_months INTEGER,
  offering_start_date TIMESTAMPTZ,
  offering_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,

  -- ─── 2. Dynamic ratios ─────────────────────────────────
  total_shares BIGINT,
  /** offering_wallet.total_shares — grows when admin adds shares. */
  offering_total BIGINT,
  /** offering_wallet.available_shares — drops as buyers complete deals. */
  offering_available BIGINT,
  /** Derived: total - SUM(all wallet.total_shares). */
  owner_shares BIGINT,
  /** Sold to investors only — equals offering_total − offering_available. */
  offering_sold BIGINT,
  /** Funding meter — sold ÷ offering, NEVER includes owner equity. */
  funding_pct NUMERIC,

  -- ─── 3. Market state ──────────────────────────────────
  /** Original offering price (immutable, derived from total_value). */
  original_price BIGINT,
  /** Current displayed share price (mutable — admin/dynamic engine). */
  share_price BIGINT,
  /** Latest market price from the price engine. */
  current_market_price BIGINT,
  /** total_value = original_price × total_shares (immutable). */
  total_value BIGINT,
  investor_count BIGINT,
  /** Sum of dividends.amount where project_id matches; -1 if table missing. */
  dividends_total BIGINT,

  -- ─── Suspension flags (read-only mirror) ─────────────────
  trading_suspended BOOLEAN,
  trading_suspension_reason TEXT,
  offering_suspended BOOLEAN,
  offering_suspension_reason TEXT,
  discover_tag TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dividends_total BIGINT := -1;
BEGIN
  -- Best-effort dividends sum. Table may not exist on older DBs.
  BEGIN
    SELECT COALESCE(SUM(d.amount), 0)::BIGINT
      INTO v_dividends_total
    FROM public.dividends d
    WHERE d.project_id = p_project_id;
  EXCEPTION WHEN undefined_table THEN
    v_dividends_total := -1;
  END;

  RETURN QUERY
  WITH
    p AS (
      SELECT * FROM public.projects WHERE id = p_project_id
    ),
    wallet_sum AS (
      SELECT
        COALESCE(SUM(total_shares), 0)::BIGINT       AS sum_total,
        COALESCE(SUM(total_shares) FILTER (WHERE wallet_type = 'offering'), 0)::BIGINT  AS off_total,
        COALESCE(SUM(available_shares) FILTER (WHERE wallet_type = 'offering'), 0)::BIGINT AS off_avail
      FROM public.project_wallets
      WHERE project_id = p_project_id
    ),
    investors AS (
      SELECT COUNT(DISTINCT user_id)::BIGINT AS cnt
      FROM public.holdings
      WHERE project_id = p_project_id AND COALESCE(shares, 0) > 0
    )
  SELECT
    -- 1. Form fields
    p.id,
    p.name::TEXT,
    p.short_description::TEXT,
    p.description::TEXT,
    p.project_type::TEXT,
    p.symbol::TEXT,
    p.logo_url::TEXT,
    p.cover_url::TEXT,
    p.status::TEXT,
    p.risk_level::TEXT,
    p.distribution_type::TEXT,
    p.expected_return_min::NUMERIC,
    p.expected_return_max::NUMERIC,
    p.duration_open,
    p.duration_months,
    p.offering_start_date,
    p.offering_end_date,
    p.created_at,

    -- 2. Dynamic ratios
    p.total_shares::BIGINT,
    ws.off_total                                                       AS offering_total,
    ws.off_avail                                                       AS offering_available,
    GREATEST(0, p.total_shares::BIGINT - ws.sum_total)                 AS owner_shares,
    GREATEST(0, ws.off_total - ws.off_avail)                           AS offering_sold,
    CASE
      WHEN ws.off_total > 0 THEN
        ROUND(((ws.off_total - ws.off_avail)::NUMERIC / ws.off_total) * 100, 2)
      ELSE 0
    END                                                                AS funding_pct,

    -- 3. Market state
    -- original_price derivation: total_value / total_shares
    CASE
      WHEN COALESCE(p.total_shares, 0) > 0 AND COALESCE(p.total_value, 0) > 0
        THEN ROUND(p.total_value::NUMERIC / p.total_shares)::BIGINT
      ELSE p.share_price::BIGINT
    END                                                                AS original_price,
    p.share_price::BIGINT,
    COALESCE(p.current_market_price, p.share_price)::BIGINT            AS current_market_price,
    p.total_value::BIGINT,
    COALESCE(i.cnt, 0)::BIGINT                                         AS investor_count,
    v_dividends_total                                                  AS dividends_total,

    -- Suspension flags
    COALESCE(p.trading_suspended, FALSE),
    p.trading_suspension_reason::TEXT,
    COALESCE(p.offering_suspended, FALSE),
    p.offering_suspension_reason::TEXT,
    p.discover_tag::TEXT
  FROM p
  CROSS JOIN wallet_sum ws
  LEFT JOIN investors i ON TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.get_project_live_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_live_snapshot(UUID) TO authenticated, anon;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.22 get_project_live_snapshot applied.';
  RAISE NOTICE '  ✓ Single-source-of-truth RPC for project values';
  RAISE NOTICE '  ✓ funding_pct = (offering_sold / offering_total) × 100';
  RAISE NOTICE '  ✓ owner_shares derived dynamically (never stored)';
  RAISE NOTICE '  ✓ Public — GRANTed to authenticated + anon';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
