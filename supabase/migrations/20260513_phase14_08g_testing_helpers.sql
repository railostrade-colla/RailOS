-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08g — Testing helpers (super_admin manual trigger)
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Two helpers for testing the engine without waiting for the cron:
--
--   manual_trigger_daily_engine(p_project_id UUID DEFAULT NULL)
--      super_admin-only. Calls run_daily_engine_for_project(p_project_id)
--      if a project id is given, otherwise run_daily_engine() over
--      all eligible projects. Returns the payload so the UI can show
--      the per-run outcome immediately.
--
--   peek_engine_for_project(p_project_id UUID)
--      Pure-read combo: returns compute_all_layers + apply_caps in a
--      single call so the monitor UI can build a "what would happen"
--      preview without firing the runner.
--
-- Both are SECURITY DEFINER, search_path=public, RPCs (callable from
-- the frontend via supabase.rpc). Authentication & role checks are
-- enforced inside the body.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── manual_trigger_daily_engine ──────────────────────────────
CREATE OR REPLACE FUNCTION public.manual_trigger_daily_engine(
  p_project_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_role   TEXT;
  v_result jsonb;
BEGIN
  -- 1. Auth + role check.
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_super_admin');
  END IF;

  -- 2. Fire the runner.
  IF p_project_id IS NULL THEN
    v_result := public.run_daily_engine();
    -- Surface a slightly richer "manual" flag so the audit can
    -- distinguish operator-triggered runs from the scheduled cron.
    RETURN jsonb_build_object(
      'ok',          true,
      'scope',       'all',
      'triggered_by', v_uid,
      'result',      v_result
    );
  ELSE
    v_result := public.run_daily_engine_for_project(p_project_id);
    RETURN jsonb_build_object(
      'ok',          true,
      'scope',       'single',
      'project_id',  p_project_id,
      'triggered_by', v_uid,
      'result',      v_result
    );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.manual_trigger_daily_engine(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_trigger_daily_engine(UUID) TO authenticated;


-- ─── peek_engine_for_project ──────────────────────────────────
-- Live "what would happen if we ran it RIGHT NOW" for one project.
-- Doesn't write to engine_daily_runs or price_history.
CREATE OR REPLACE FUNCTION public.peek_engine_for_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layers jsonb;
  v_caps   jsonb;
  v_raw    NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;

  v_layers := public.compute_all_layers(p_project_id);
  v_raw    := COALESCE((v_layers->>'raw_rise_pct')::NUMERIC, 0);
  v_caps   := public.apply_caps(p_project_id, v_raw);

  RETURN jsonb_build_object(
    'ok',     true,
    'layers', v_layers,
    'caps',   v_caps
  );
END $$;

REVOKE ALL ON FUNCTION public.peek_engine_for_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_engine_for_project(UUID) TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- Smoke-test SQL (run manually in Supabase SQL Editor — NOT in this
-- migration so it doesn't fail on a fresh DB without seed data):
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. Sanity: every layer function returns without erroring on a
--    real project.
--      SELECT public.compute_layer1_pairs(id) FROM public.projects LIMIT 1;
--      SELECT public.compute_layer2_balance(id) FROM public.projects LIMIT 1;
--      SELECT public.compute_layer3_renewal(id) FROM public.projects LIMIT 1;
--
-- 2. Caps preview — no DB write:
--      SELECT public.peek_engine_for_project(
--        (SELECT id FROM public.projects LIMIT 1)
--      );
--
-- 3. Manual trigger ONE project (super_admin only):
--      SELECT public.manual_trigger_daily_engine(
--        (SELECT id FROM public.projects LIMIT 1)
--      );
--
-- 4. Manual trigger ALL projects:
--      SELECT public.manual_trigger_daily_engine(NULL);
--
-- 5. Inspect what got logged:
--      SELECT run_at, project_id,
--             layer1_progress, layer2_progress, layer3_progress,
--             raw_rise_pct, applied_rise_pct, capped_by,
--             old_price, new_price
--        FROM public.engine_daily_runs
--        ORDER BY run_at DESC
--        LIMIT 20;
--
-- 6. Monthly rise per project (the cap-feed view):
--      SELECT * FROM public.v_project_monthly_rise
--       ORDER BY monthly_rise_pct DESC;
--
-- 7. Cron schedule status (if pg_cron is enabled):
--      SELECT * FROM cron.job WHERE jobname = 'railos_daily_engine';

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08g testing helpers complete.';
  RAISE NOTICE '  ✓ manual_trigger_daily_engine(uuid?) — super_admin only';
  RAISE NOTICE '  ✓ peek_engine_for_project(uuid)     — read-only preview';
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 14.08 series done: a → g all shipped.';
  RAISE NOTICE 'Run order in Supabase SQL Editor:';
  RAISE NOTICE '  1. 14.08a (schema)';
  RAISE NOTICE '  2. 14.08b (layer functions)';
  RAISE NOTICE '  3. 14.08c (cap functions)';
  RAISE NOTICE '  4. 14.08d (new trigger)';
  RAISE NOTICE '  5. 14.08e (daily cron — requires pg_cron extension)';
  RAISE NOTICE '  6. 14.08g (testing helpers — this one)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
