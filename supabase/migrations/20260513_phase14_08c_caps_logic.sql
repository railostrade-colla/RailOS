-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08c — Cap functions (sector / daily / yearly)
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Three caps gate every rise (whether per-deal or daily-cron):
--
--   • Sector monthly cap:
--       monthly_cap_<sector> in market_settings (Phase 14.06).
--       Compared against v_project_monthly_rise (Phase 14.08a).
--
--   • Daily curve cap:
--       Linear interpolation from daily_cap_start (day 1) to
--       daily_cap_end (day 30). Reasoning: early month allows bigger
--       moves, late month tightens to leave headroom for sector cap.
--
--   • Yearly cap:
--       yearly_cap setting (default 80%) vs cumulative rise since
--       Jan 1 of current year, computed live from price_history.
--
-- Plus:
--   apply_caps(p_project_id, p_raw_rise_pct)
--       → orchestrator: returns the FINAL allowed rise + which caps
--         fired. The cron + trigger both call this before writing.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Sector cap ────────────────────────────────────────────────
--
-- Returns the monthly cap percentage for a project's sector, looked
-- up via market_settings (key = 'monthly_cap_<sector_slug>'). The
-- slug map is intentionally hardcoded here so a renamed sector
-- doesn't silently slip the cap.
CREATE OR REPLACE FUNCTION public.get_applicable_sector_cap(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector  TEXT;
  v_key     TEXT;
  v_cap_pct NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;

  SELECT sector INTO v_sector FROM public.projects WHERE id = p_project_id;
  IF v_sector IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  -- Map the project's sector (Arabic text) to the setting key.
  -- Falls back to commercial cap when no match (safest middle ground).
  v_key := CASE
    WHEN v_sector ILIKE '%زراع%'   THEN 'monthly_cap_agricultural'
    WHEN v_sector ILIKE '%عقار%'   THEN 'monthly_cap_real_estate'
    WHEN v_sector ILIKE '%صناع%'   THEN 'monthly_cap_industrial'
    WHEN v_sector ILIKE '%تجار%'   THEN 'monthly_cap_commercial'
    WHEN v_sector ILIKE '%طب%'     THEN 'monthly_cap_medical'
    WHEN v_sector ILIKE '%تقن%'    THEN 'monthly_cap_technology'
    WHEN v_sector ILIKE '%خدم%'    THEN 'monthly_cap_commercial'
    ELSE 'monthly_cap_commercial'
  END;

  v_cap_pct := COALESCE(public.get_market_setting(v_key), 10.0);

  RETURN jsonb_build_object(
    'sector',      v_sector,
    'setting_key', v_key,
    'cap_pct',     v_cap_pct,
    'ok',          true
  );
END $$;

REVOKE ALL ON FUNCTION public.get_applicable_sector_cap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_applicable_sector_cap(UUID) TO authenticated;


-- ─── Daily cap curve ──────────────────────────────────────────
--
-- Linear interpolation:
--   day 1  → daily_cap_start (default 2.0%)
--   day 30 → daily_cap_end   (default 0.3%)
--   day d  → start + (end - start) × (d - 1) / 29
-- Days 31 stay at daily_cap_end (rare; clipped).
CREATE OR REPLACE FUNCTION public.get_daily_cap_curve(p_day_of_month INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start NUMERIC;
  v_end   NUMERIC;
  v_day   INTEGER;
BEGIN
  v_start := COALESCE(public.get_market_setting('daily_cap_start'), 2.0);
  v_end   := COALESCE(public.get_market_setting('daily_cap_end'),   0.3);
  v_day   := GREATEST(1, LEAST(COALESCE(p_day_of_month, 1), 30));
  IF v_day = 1 THEN
    RETURN v_start;
  END IF;
  IF v_day >= 30 THEN
    RETURN v_end;
  END IF;
  RETURN v_start + (v_end - v_start) * ((v_day - 1)::NUMERIC / 29.0);
END $$;

REVOKE ALL ON FUNCTION public.get_daily_cap_curve(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_cap_curve(INTEGER) TO authenticated;


-- ─── Yearly cap helper ────────────────────────────────────────
--
-- Returns the project's cumulative POSITIVE change_pct since Jan 1
-- of the current calendar year, derived from price_history.
CREATE OR REPLACE FUNCTION public.get_project_yearly_rise(p_project_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(GREATEST(change_pct, 0)), 0)::NUMERIC INTO v_sum
    FROM public.price_history
   WHERE project_id = p_project_id
     AND created_at >= date_trunc('year', NOW());
  RETURN COALESCE(v_sum, 0);
END $$;

REVOKE ALL ON FUNCTION public.get_project_yearly_rise(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_yearly_rise(UUID) TO authenticated;


-- ─── apply_caps — the orchestrator ────────────────────────────
--
-- Takes a raw rise % (from compute_all_layers OR a per-deal price
-- delta) and returns the FINAL allowed rise after running it
-- through the three caps. Reports which caps fired in `capped_by`.
--
-- Returns jsonb {
--   applied_rise_pct,     -- the rise that should actually fire
--   capped_by,            -- TEXT[]: subset of {sector,daily,yearly,engine_off}
--   raw_rise_pct,
--   sector_cap_remaining, -- how much room left under sector cap
--   daily_cap_pct,        -- the curve value used
--   yearly_cap_pct,
--   yearly_used,
--   engine_enabled,
--   ok
-- }
CREATE OR REPLACE FUNCTION public.apply_caps(
  p_project_id    UUID,
  p_raw_rise_pct  NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_engine_on        BOOLEAN;
  v_sector_meta      jsonb;
  v_sector_cap_pct   NUMERIC;
  v_monthly_so_far   NUMERIC;
  v_sector_remaining NUMERIC;
  v_day              INTEGER;
  v_daily_cap_pct    NUMERIC;
  v_yearly_cap_pct   NUMERIC;
  v_yearly_used      NUMERIC;
  v_yearly_remaining NUMERIC;
  v_applied          NUMERIC;
  v_capped_by        TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;
  IF p_raw_rise_pct IS NULL OR p_raw_rise_pct < 0 THEN
    p_raw_rise_pct := 0;
  END IF;

  -- 0. Master engine toggle (Phase 14.06b — engine_enabled setting).
  v_engine_on := COALESCE(public.get_market_setting('engine_enabled'), 1) >= 1;
  IF NOT v_engine_on THEN
    RETURN jsonb_build_object(
      'applied_rise_pct', 0,
      'capped_by',        ARRAY['engine_off']::TEXT[],
      'raw_rise_pct',     p_raw_rise_pct,
      'engine_enabled',   false,
      'ok',               true
    );
  END IF;

  -- 1. Sector monthly cap.
  v_sector_meta    := public.get_applicable_sector_cap(p_project_id);
  v_sector_cap_pct := COALESCE((v_sector_meta->>'cap_pct')::NUMERIC, 10.0);

  SELECT COALESCE(monthly_rise_pct, 0)::NUMERIC INTO v_monthly_so_far
    FROM public.v_project_monthly_rise
   WHERE project_id = p_project_id;
  v_monthly_so_far := COALESCE(v_monthly_so_far, 0);

  v_sector_remaining := GREATEST(0, v_sector_cap_pct - v_monthly_so_far);

  -- 2. Daily curve cap (today's calendar day).
  v_day := EXTRACT(DAY FROM NOW())::INTEGER;
  v_daily_cap_pct := public.get_daily_cap_curve(v_day);

  -- 3. Yearly cap.
  v_yearly_cap_pct   := COALESCE(public.get_market_setting('yearly_cap'), 80.0);
  v_yearly_used      := public.get_project_yearly_rise(p_project_id);
  v_yearly_remaining := GREATEST(0, v_yearly_cap_pct - v_yearly_used);

  -- 4. Apply caps in series: MIN of raw, sector-remaining, daily, yearly-remaining.
  v_applied := p_raw_rise_pct;

  IF v_applied > v_sector_remaining THEN
    v_applied := v_sector_remaining;
    v_capped_by := array_append(v_capped_by, 'sector');
  END IF;
  IF v_applied > v_daily_cap_pct THEN
    v_applied := v_daily_cap_pct;
    v_capped_by := array_append(v_capped_by, 'daily');
  END IF;
  IF v_applied > v_yearly_remaining THEN
    v_applied := v_yearly_remaining;
    v_capped_by := array_append(v_capped_by, 'yearly');
  END IF;

  IF v_applied < 0 THEN v_applied := 0; END IF;

  RETURN jsonb_build_object(
    'applied_rise_pct',     v_applied,
    'capped_by',            v_capped_by,
    'raw_rise_pct',         p_raw_rise_pct,
    'sector',               v_sector_meta->>'sector',
    'sector_cap_pct',       v_sector_cap_pct,
    'sector_used_pct',      v_monthly_so_far,
    'sector_remaining_pct', v_sector_remaining,
    'daily_cap_pct',        v_daily_cap_pct,
    'day_of_month',         v_day,
    'yearly_cap_pct',       v_yearly_cap_pct,
    'yearly_used_pct',      v_yearly_used,
    'yearly_remaining_pct', v_yearly_remaining,
    'engine_enabled',       true,
    'ok',                   true
  );
END $$;

REVOKE ALL ON FUNCTION public.apply_caps(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_caps(UUID, NUMERIC) TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08c cap functions created.';
  RAISE NOTICE '  ✓ get_applicable_sector_cap — sector → monthly_cap_*';
  RAISE NOTICE '  ✓ get_daily_cap_curve       — day-of-month interpolation';
  RAISE NOTICE '  ✓ get_project_yearly_rise   — YTD positive sum';
  RAISE NOTICE '  ✓ apply_caps                — orchestrator + engine_off gate';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: 14.08d — replace deal-completion trigger (up-only)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
