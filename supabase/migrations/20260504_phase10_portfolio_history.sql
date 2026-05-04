-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.6 — portfolio history RPC + realtime publication for deals
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- 1. `get_my_portfolio_history(months INT)` — aggregates the user's
--    portfolio value over the past N months by joining their current
--    holdings against `price_history`. Returns one row per month
--    bucket: { month, value }. We use *current* shares as the
--    multiplier (the platform doesn't track historical share counts
--    per user yet — close enough for the chart and matches the mock
--    behavior).
--
-- 2. Add `deals` to the Supabase Realtime publication so the deal
--    detail page can react to status changes (accept/reject/expire)
--    without polling. Wrapped in a DO block because the publication
--    might not exist on local dev clusters.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_portfolio_history(
  p_months INTEGER DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_months INTEGER;
  v_history JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  v_months := GREATEST(1, LEAST(36, COALESCE(p_months, 12)));

  -- For each month bucket in the window, take the most recent
  -- price_history entry per project at-or-before the bucket end
  -- (cheap approximation — exact: pick the last point inside each
  -- month, fall back to current_price). Multiply by user's current
  -- share count and sum across projects.
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW()) - ((v_months - 1) || ' months')::INTERVAL,
      date_trunc('month', NOW()),
      '1 month'::INTERVAL
    ) AS bucket
  ),
  user_holdings AS (
    SELECT project_id, shares::NUMERIC AS shares
    FROM public.holdings
    WHERE user_id = v_uid AND shares > 0
  ),
  monthly_prices AS (
    SELECT
      m.bucket,
      h.project_id,
      h.shares,
      COALESCE(
        (
          SELECT new_price
          FROM public.price_history ph
          WHERE ph.project_id = h.project_id
            AND ph.recorded_at <= m.bucket + INTERVAL '1 month' - INTERVAL '1 second'
          ORDER BY ph.recorded_at DESC
          LIMIT 1
        ),
        (SELECT current_price FROM public.market_state WHERE project_id = h.project_id),
        (SELECT share_price FROM public.projects WHERE id = h.project_id),
        0
      )::NUMERIC AS price
    FROM months m
    CROSS JOIN user_holdings h
  ),
  monthly_value AS (
    SELECT
      to_char(bucket, 'YYYY-MM') AS month,
      SUM(shares * price) AS value
    FROM monthly_prices
    GROUP BY bucket
    ORDER BY bucket
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', month,
    'value', ROUND(value)
  ) ORDER BY month), '[]'::jsonb)
  INTO v_history
  FROM monthly_value;

  RETURN jsonb_build_object(
    'success', TRUE,
    'months', v_months,
    'history', v_history
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.get_my_portfolio_history(INTEGER)
  TO authenticated;

-- ─── Realtime publication for deals ─────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN feature_not_supported THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Same for listings (so /exchange can update capacity live)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN feature_not_supported THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
