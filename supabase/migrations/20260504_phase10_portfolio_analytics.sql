-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.4 — portfolio analytics RPC + DB-backed listing creation
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- 1. `get_my_portfolio_analytics()` — single round-trip aggregation
--    used by /investment + /portfolio. Returns:
--      total_cost, total_value, total_profit, total_profit_percent,
--      total_shares, holdings_count, projects_count,
--      sector_breakdown jsonb, performance jsonb (per-holding),
--      best/worst performer.
--    Pulls live `share_price` from projects (or falls back to
--    average_buy_price when the project has no live price).
--
-- 2. `create_listing(project_id, shares_offered, price_per_share,
--    notes, is_quick_sell)` — atomic sell-listing creation that
--    verifies the seller actually holds enough unfrozen shares
--    before inserting. RLS would catch the wrong user_id, but the
--    capacity check needs to happen server-side anyway, so we wrap
--    both into one RPC for atomicity.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Portfolio analytics ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_portfolio_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_total_cost NUMERIC := 0;
  v_total_value NUMERIC := 0;
  v_total_shares BIGINT := 0;
  v_holdings_count INT := 0;
  v_projects_count INT := 0;
  v_performance JSONB := '[]'::jsonb;
  v_sector_breakdown JSONB := '[]'::jsonb;
  v_best JSONB;
  v_worst JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Per-holding performance + totals (defensive: skip rows with 0 shares)
  WITH rows AS (
    SELECT
      h.id,
      h.project_id,
      p.name AS project_name,
      COALESCE(p.project_type, p.sector, '—') AS project_sector,
      COALESCE(p.share_price, h.average_buy_price, 0)::NUMERIC AS live_price,
      h.shares::BIGINT AS shares,
      COALESCE(h.frozen_shares, 0)::BIGINT AS frozen,
      COALESCE(h.average_buy_price, 0)::NUMERIC AS buy_price,
      h.shares::NUMERIC * COALESCE(h.average_buy_price, 0)::NUMERIC AS cost,
      h.shares::NUMERIC * COALESCE(p.share_price, h.average_buy_price, 0)::NUMERIC AS value
    FROM public.holdings h
    LEFT JOIN public.projects p ON p.id = h.project_id
    WHERE h.user_id = v_uid
      AND h.shares > 0
  )
  SELECT
    COALESCE(SUM(cost), 0),
    COALESCE(SUM(value), 0),
    COALESCE(SUM(shares), 0),
    COUNT(*),
    COUNT(DISTINCT project_id),
    COALESCE(jsonb_agg(jsonb_build_object(
      'holding_id',  id,
      'project_id',  project_id,
      'project_name', project_name,
      'project_sector', project_sector,
      'shares',      shares,
      'frozen_shares', frozen,
      'buy_price',   buy_price,
      'live_price',  live_price,
      'cost',        cost,
      'current_value', value,
      'profit',      value - cost,
      'profit_percent',
        CASE WHEN cost > 0 THEN ((value - cost) / cost) * 100 ELSE 0 END
    ) ORDER BY value DESC), '[]'::jsonb)
  INTO v_total_cost, v_total_value, v_total_shares,
       v_holdings_count, v_projects_count, v_performance
  FROM rows;

  -- Sector breakdown (concentration per sector)
  WITH rows AS (
    SELECT
      COALESCE(p.project_type, p.sector, '—') AS sector,
      h.shares::NUMERIC * COALESCE(p.share_price, h.average_buy_price, 0)::NUMERIC AS value
    FROM public.holdings h
    LEFT JOIN public.projects p ON p.id = h.project_id
    WHERE h.user_id = v_uid AND h.shares > 0
  ),
  agg AS (
    SELECT sector, SUM(value) AS sector_value
    FROM rows GROUP BY sector
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sector', sector,
    'value', sector_value,
    'percent',
      CASE WHEN v_total_value > 0
        THEN ROUND((sector_value / v_total_value) * 100, 2)
        ELSE 0
      END
  ) ORDER BY sector_value DESC), '[]'::jsonb)
  INTO v_sector_breakdown
  FROM agg;

  -- Best / worst performer
  SELECT v_performance->0  INTO v_best;
  SELECT v_performance->-1 INTO v_worst;

  RETURN jsonb_build_object(
    'success', TRUE,
    'total_cost', v_total_cost,
    'total_value', v_total_value,
    'total_profit', v_total_value - v_total_cost,
    'total_profit_percent',
      CASE WHEN v_total_cost > 0
        THEN ROUND(((v_total_value - v_total_cost) / v_total_cost) * 100, 2)
        ELSE 0
      END,
    'total_shares', v_total_shares,
    'holdings_count', v_holdings_count,
    'projects_count', v_projects_count,
    'sector_breakdown', v_sector_breakdown,
    'performance', v_performance,
    'best_performer', v_best,
    'worst_performer', v_worst
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.get_my_portfolio_analytics() TO authenticated;

-- ─── Atomic listing creation ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_listing(
  p_project_id UUID,
  p_shares_offered BIGINT,
  p_price_per_share NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_is_quick_sell BOOLEAN DEFAULT FALSE
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

  -- Lock seller's holdings + verify capacity (the seller must actually
  -- hold enough unfrozen shares to back this listing — we DON'T freeze
  -- here because they might list more than once and decide later; the
  -- freeze happens when a buyer hits "place deal").
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

  INSERT INTO public.listings (
    seller_id, project_id, shares_offered, price_per_share,
    notes, is_quick_sell, status
  ) VALUES (
    v_uid, p_project_id, p_shares_offered, p_price_per_share,
    p_notes, COALESCE(p_is_quick_sell, FALSE), 'active'
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'listing_id', v_listing_id
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.create_listing(
  UUID, BIGINT, NUMERIC, TEXT, BOOLEAN
) TO authenticated;
