-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08a — Schema for the new 3-layer "up-only" market engine
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Two new objects:
--
-- 1. `engine_daily_runs` table
--    One row per (project_id, cron_run). Records what the engine
--    computed for each layer, what it raised the price by, and
--    which caps fired. The admin UI surfaces this so the founder
--    can see WHY today's rise was what it was.
--
-- 2. `v_project_monthly_rise` view
--    Per-project cumulative rise % this calendar month, derived
--    from price_history. Powers the sector-cap gate (Phase 14.08c)
--    and the monitor UI (Phase 14.08f).
--
-- No drops; everything is additive so the running engine isn't
-- disturbed.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. engine_daily_runs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.engine_daily_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Layer progress in [0, 1].
  layer1_progress    NUMERIC(6, 4) NOT NULL DEFAULT 0
    CHECK (layer1_progress >= 0 AND layer1_progress <= 1),
  layer2_progress    NUMERIC(6, 4) NOT NULL DEFAULT 0
    CHECK (layer2_progress >= 0 AND layer2_progress <= 1),
  layer3_progress    NUMERIC(6, 4) NOT NULL DEFAULT 0
    CHECK (layer3_progress >= 0 AND layer3_progress <= 1),

  -- Reward percentage that EACH layer contributed (= progress × max_reward).
  layer1_reward_pct  NUMERIC(6, 4) NOT NULL DEFAULT 0,
  layer2_reward_pct  NUMERIC(6, 4) NOT NULL DEFAULT 0,
  layer3_reward_pct  NUMERIC(6, 4) NOT NULL DEFAULT 0,

  -- Combined uncapped rise (sum of layer rewards).
  raw_rise_pct       NUMERIC(7, 4) NOT NULL DEFAULT 0,
  -- Final rise applied to current_market_price (after caps).
  applied_rise_pct   NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (applied_rise_pct >= 0),

  -- Which gates / caps fired during this run. Examples:
  --   {'engine_off'}, {'sector','daily'}, {} (nothing fired)
  capped_by          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  old_price          BIGINT NOT NULL CHECK (old_price >= 0),
  new_price          BIGINT NOT NULL CHECK (new_price >= 0),

  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.engine_daily_runs IS
  'Phase 14.08 — one row per (project, daily cron run). Records layer progress, raw+applied rise, and which caps fired.';

CREATE INDEX IF NOT EXISTS idx_engine_daily_runs_project_time
  ON public.engine_daily_runs (project_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_daily_runs_run_at
  ON public.engine_daily_runs (run_at DESC);

-- RLS — read-only for any authenticated user (helps the monitor UI),
-- writes ONLY via SECURITY DEFINER cron functions (no policy = denied).
ALTER TABLE public.engine_daily_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engine_daily_runs read" ON public.engine_daily_runs;
CREATE POLICY "engine_daily_runs read" ON public.engine_daily_runs
  FOR SELECT TO authenticated USING (TRUE);


-- ─── 2. v_project_monthly_rise view ────────────────────────────
--
-- Cumulative rise % in the CURRENT calendar month for each project.
-- The math is "sum of change_pct entries this month" — for a strictly
-- up-only engine that's also the geometric cumulative within a
-- small range, but the cap is enforced sum-based intentionally (the
-- founder wants the visible monthly headline to match the sum).
--
-- Includes EVERY trigger_type row (deal_completed + admin_manual +
-- daily_cron) so the cap consumes whatever moved the price.

CREATE OR REPLACE VIEW public.v_project_monthly_rise AS
SELECT
  p.id                                          AS project_id,
  p.name                                        AS project_name,
  p.sector                                      AS sector,
  COALESCE(p.current_market_price, p.share_price, 0)::BIGINT AS current_price,
  COALESCE(SUM(
    CASE
      WHEN ph.change_pct > 0 THEN ph.change_pct
      ELSE 0
    END
  ), 0)::NUMERIC(8, 4)                          AS monthly_rise_pct,
  COUNT(ph.id)                                  AS rise_events_count,
  MAX(ph.created_at)                            AS last_rise_at
FROM public.projects p
LEFT JOIN public.price_history ph
  ON ph.project_id = p.id
 AND ph.created_at >= date_trunc('month', NOW())
 AND ph.change_pct IS NOT NULL
GROUP BY p.id, p.name, p.sector, p.current_market_price, p.share_price;

COMMENT ON VIEW public.v_project_monthly_rise IS
  'Phase 14.08 — per-project cumulative rise % in current calendar month, drives sector-cap gate.';

GRANT SELECT ON public.v_project_monthly_rise TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08a schema additions complete.';
  RAISE NOTICE '  ✓ engine_daily_runs table created (RLS read-only)';
  RAISE NOTICE '  ✓ v_project_monthly_rise view created';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: 14.08b — Layer Functions (compute_layer1/2/3)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
