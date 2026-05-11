-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.48 — Portfolio change-metrics RPC
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec: the dashboard hero card under the wallet total
-- must show three signals (replacing the placeholder "+0 د.ع +0%"):
--   1. الفرق عن السعر المرجعي  → IQD difference between current
--      market price and the project's reference share_price,
--      weighted by user's shares across every holding.
--   2. تغيّر اليوم %            → portfolio-weighted % change in
--      market price since "today's 6 AM" reset.
--   3. تغيّر الأسبوع %          → portfolio-weighted % change vs
--      7 days ago.
--
-- Both #2 and #3 use price_history (the canonical price-change
-- ledger). Baseline price for a project is the most recent row
-- recorded BEFORE the cutoff; if no such row exists the project's
-- share_price (reference price) is used as the baseline.
--
-- Returns a single jsonb row — failures fall back to all-zero on
-- the client.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_portfolio_change_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();

  -- The "today" cutoff is the most recent 6 AM that has already
  -- passed (Asia/Baghdad locally — but the trigger / DB run in UTC,
  -- so we keep this in UTC and the front-end can re-anchor if needed).
  v_today_cutoff TIMESTAMPTZ;
  v_week_cutoff  TIMESTAMPTZ;

  v_total_value      NUMERIC := 0;
  v_total_reference  NUMERIC := 0;
  v_total_today_base NUMERIC := 0;
  v_total_week_base  NUMERIC := 0;
  v_total_shares     NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'reference_delta_iqd', 0,
      'daily_change_iqd',    0,
      'daily_change_pct',    0,
      'weekly_change_iqd',   0,
      'weekly_change_pct',   0
    );
  END IF;

  -- "Today" = most recent 06:00 that has already occurred.
  v_today_cutoff := DATE_TRUNC('day', NOW()) + INTERVAL '6 hours';
  IF v_today_cutoff > NOW() THEN
    v_today_cutoff := v_today_cutoff - INTERVAL '1 day';
  END IF;
  v_week_cutoff := NOW() - INTERVAL '7 days';

  WITH user_holdings AS (
    SELECT
      h.project_id,
      h.shares::NUMERIC AS shares
    FROM public.holdings h
    WHERE h.user_id = v_uid
      AND h.shares > 0
  ),
  with_proj AS (
    SELECT
      uh.project_id,
      uh.shares,
      COALESCE(p.current_market_price, p.share_price, 0)::NUMERIC AS current_price,
      COALESCE(p.share_price, p.current_market_price, 0)::NUMERIC AS reference_price
    FROM user_holdings uh
    JOIN public.projects p ON p.id = uh.project_id
  ),
  -- Most-recent price BEFORE today's cutoff (i.e. the closing price
  -- as of yesterday's 6 AM rollover). If no row exists we use the
  -- reference share_price.
  today_base AS (
    SELECT DISTINCT ON (ph.project_id)
      ph.project_id,
      ph.new_price::NUMERIC AS price
    FROM public.price_history ph
    JOIN with_proj wp ON wp.project_id = ph.project_id
    WHERE ph.recorded_at < v_today_cutoff
    ORDER BY ph.project_id, ph.recorded_at DESC
  ),
  -- Most-recent price BEFORE 7 days ago.
  week_base AS (
    SELECT DISTINCT ON (ph.project_id)
      ph.project_id,
      ph.new_price::NUMERIC AS price
    FROM public.price_history ph
    JOIN with_proj wp ON wp.project_id = ph.project_id
    WHERE ph.recorded_at < v_week_cutoff
    ORDER BY ph.project_id, ph.recorded_at DESC
  )
  SELECT
    COALESCE(SUM(wp.shares * wp.current_price), 0),
    COALESCE(SUM(wp.shares * wp.reference_price), 0),
    COALESCE(SUM(wp.shares * COALESCE(tb.price, wp.reference_price)), 0),
    COALESCE(SUM(wp.shares * COALESCE(wb.price, wp.reference_price)), 0),
    COALESCE(SUM(wp.shares), 0)
  INTO
    v_total_value,
    v_total_reference,
    v_total_today_base,
    v_total_week_base,
    v_total_shares
  FROM with_proj wp
  LEFT JOIN today_base tb ON tb.project_id = wp.project_id
  LEFT JOIN week_base  wb ON wb.project_id = wp.project_id;

  RETURN jsonb_build_object(
    'total_shares',         v_total_shares,
    'total_value',          v_total_value,
    'reference_total',      v_total_reference,
    'today_base_total',     v_total_today_base,
    'week_base_total',      v_total_week_base,
    'reference_delta_iqd',  ROUND(v_total_value - v_total_reference),
    'daily_change_iqd',     ROUND(v_total_value - v_total_today_base),
    'daily_change_pct',     CASE
                              WHEN v_total_today_base > 0
                              THEN ROUND(((v_total_value - v_total_today_base) * 100.0) / v_total_today_base, 2)
                              ELSE 0
                            END,
    'weekly_change_iqd',    ROUND(v_total_value - v_total_week_base),
    'weekly_change_pct',    CASE
                              WHEN v_total_week_base > 0
                              THEN ROUND(((v_total_value - v_total_week_base) * 100.0) / v_total_week_base, 2)
                              ELSE 0
                            END,
    'today_cutoff',         v_today_cutoff,
    'week_cutoff',           v_week_cutoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_portfolio_change_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portfolio_change_metrics() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.48 portfolio change metrics applied.';
  RAISE NOTICE '  ✓ get_portfolio_change_metrics() ready';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
