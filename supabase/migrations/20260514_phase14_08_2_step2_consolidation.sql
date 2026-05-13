-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2: DB Consolidation
-- Date: 2026-05-14
-- Idempotent. Single transaction.
--
-- Prerequisites:
--   ✅ Step 1 backup (20260514_phase14_08_2_step1_backup.sql) ran first
--   ✅ engine_backup_20260514._manifest verified non-empty
--
-- What this migration does:
--   1. FIXES THE BROKEN DEAL TRIGGER (critical — was rolling back deals)
--      DROP trg_deal_apply_rise + on_deal_apply_initial_rise()
--   2. DROPs OLD-engine RPCs nobody should call any more:
--      admin_get_rise_status(uuid)
--      get_strategic_market_advisor()
--      set_market_engine_state(... 8 args ...)
--      get_market_watch_advice()
--   3. REWRITES admin_force_market_rise as a clean Phase-14-era version
--      that doesn't depend on any of the archived tables/functions.
--      Same signature (uuid, numeric, boolean, text) → TS callers
--      continue to work unchanged.
--   4. ARCHIVES OLD-engine tables to v7_archive schema:
--      market_engine_config, market_engine_log, market_engine_settings
--
-- NOT touched (explicit founder decision):
--   ✋ market_state              — still read by 4 portfolio RPCs (Phase 14.09)
--   ✋ admin_decisions_log       — used by the new admin_force_market_rise
--   ✋ Phase-12 legacy tables    — kept for future features
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- PART 1 — Drop the broken deal trigger (fixes deal completion)
-- ─────────────────────────────────────────────────────────────────
-- trg_deal_apply_rise calls on_deal_apply_initial_rise() which calls
-- apply_initial_mode_rise() — but that function was dropped CASCADE
-- in Phase 14.02. PERFORM doesn't create pg_depend entries, so the
-- trigger function survived the CASCADE — meaning every non-quick-sell
-- deal completion has been rolling back since Phase 14.02.
DROP TRIGGER  IF EXISTS trg_deal_apply_rise          ON public.deals;
DROP FUNCTION IF EXISTS public.on_deal_apply_initial_rise() CASCADE;


-- ─────────────────────────────────────────────────────────────────
-- PART 2 — Drop old engine RPCs (all redundant in Phase-14 arch)
-- ─────────────────────────────────────────────────────────────────

-- admin_get_rise_status: read-only status RPC that called functions
-- already dropped in Phase 13.46 (get_monthly_accumulated, get_monthly_cap)
-- and tables we're about to archive. Returned mostly-empty payloads.
DROP FUNCTION IF EXISTS public.admin_get_rise_status(UUID) CASCADE;

-- get_strategic_market_advisor: Phase 13.56 "health card" RPC.
-- Reads market_engine_config (being archived). Superseded by the
-- engine-monitor page (/admin/engine-monitor).
DROP FUNCTION IF EXISTS public.get_strategic_market_advisor() CASCADE;

-- set_market_engine_state: Phase 13.46 / 13.47 toggle for the old
-- engine. engine_enabled now lives in market_settings (Phase 14.06b).
-- Drop every overload variant.
DROP FUNCTION IF EXISTS public.set_market_engine_state(BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.set_market_engine_state(BOOLEAN, NUMERIC, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.set_market_engine_state(
  BOOLEAN, NUMERIC, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) CASCADE;

-- get_market_watch_advice: Phase 13.47 condition-watch advice RPC.
-- Reads market_engine_config (being archived). Superseded by the
-- engine-monitor page + peek_engine_for_project.
DROP FUNCTION IF EXISTS public.get_market_watch_advice() CASCADE;


-- ─────────────────────────────────────────────────────────────────
-- PART 3 — Rewrite admin_force_market_rise as Phase-14-clean
-- ─────────────────────────────────────────────────────────────────
-- The old implementation (Phase 12.9):
--   • called admin_get_rise_status (now dropped)
--   • read market_engine_settings (being archived)
--   • wrote market_engine_log (being archived)
--   • called get_monthly_accumulated / get_monthly_cap (dropped Phase 13.46)
--   • only "worked" because every legacy call was wrapped in
--     EXCEPTION WHEN OTHERS THEN NULL — meaning it lost half its
--     functionality silently.
--
-- The new implementation:
--   • Auth: admin or super_admin only.
--   • Cap: rise_pct ≤ 0.50 (50%) and > 0 (up-only philosophy).
--   • Reads current_market_price from `projects` (canonical source).
--   • Writes:
--       1. UPDATE projects.current_market_price
--       2. INSERT INTO price_history (trigger_type = 'admin_force_rise')
--       3. INSERT INTO admin_decisions_log (full audit row)
--   • Returns a stable JSONB shape backward-compatible with the
--     existing TS wrapper at lib/data/admin-rise.ts.
--
-- Signature kept identical to avoid breaking any caller:
--   admin_force_market_rise(uuid, numeric, boolean, text) → jsonb
-- The `p_override` parameter is now a no-op (there are no condition
-- checks to bypass in the new architecture) — kept only for ABI
-- compatibility. A pseudo-blockers field stays in the response so the
-- UI doesn't break.

DROP FUNCTION IF EXISTS public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.admin_force_market_rise(
  p_project_id UUID,
  p_rise_pct   NUMERIC,
  p_override   BOOLEAN DEFAULT FALSE,   -- kept for ABI compatibility; ignored
  p_reason     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_old_price NUMERIC;
  v_new_price NUMERIC;
  v_proj_name TEXT;
  v_share_pr  NUMERIC;
BEGIN
  -- 1. Auth.
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- 2. Validate rise.
  IF p_rise_pct IS NULL OR p_rise_pct <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_rise_to_apply');
  END IF;
  IF p_rise_pct > 0.50 THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'rise_too_large', 'max', 0.50
    );
  END IF;

  -- 3. Require a reason (audit hygiene).
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 10 THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'reason_required',
      'detail', 'Reason must be at least 10 characters'
    );
  END IF;

  -- 4. Lock the project row + read canonical price.
  SELECT name, share_price, current_market_price
    INTO v_proj_name, v_share_pr, v_old_price
    FROM public.projects
   WHERE id = p_project_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  v_old_price := COALESCE(NULLIF(v_old_price, 0), v_share_pr, 0);
  IF v_old_price <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_baseline_price');
  END IF;

  v_new_price := ROUND(v_old_price * (1 + p_rise_pct));

  -- 5. Apply.
  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = p_project_id;

  -- 6. Log to price_history (best-effort — never fail the rise).
  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price, change_pct,
      created_at, market_phase, trigger_type
    ) VALUES (
      p_project_id, v_old_price, v_new_price, p_rise_pct,
      NOW(), 'phase14', 'admin_force_rise'
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7. Log to admin_decisions_log (best-effort).
  BEGIN
    INSERT INTO public.admin_decisions_log(
      admin_id, project_id, action, details, reason
    ) VALUES (
      v_uid, p_project_id, 'admin_force_rise',
      jsonb_build_object(
        'rise_pct',  p_rise_pct,
        'old_price', v_old_price,
        'new_price', v_new_price,
        'override',  COALESCE(p_override, FALSE)
      ),
      p_reason
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',   TRUE,
    'project',   jsonb_build_object(
      'id',   p_project_id,
      'name', v_proj_name
    ),
    'old_price', v_old_price,
    'new_price', v_new_price,
    'rise_pct',  p_rise_pct,
    'blockers',  '[]'::jsonb,        -- ABI compat: always empty in new arch
    'reason',    p_reason
  );
END $$;

REVOKE ALL   ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────
-- PART 4 — Archive old engine tables to v7_archive schema
-- ─────────────────────────────────────────────────────────────────
-- These tables are no longer read by ANY Phase-14 code (verified
-- during Phase 14.08.2 discovery). Moving to v7_archive keeps the
-- data accessible by direct SELECT but removes them from PostgREST's
-- exposed schema → frontend can't accidentally pull stale data, no
-- function will silently rebuild a row.
--
-- To restore (rollback):
--   ALTER TABLE v7_archive.market_engine_config   SET SCHEMA public;
--   ALTER TABLE v7_archive.market_engine_log      SET SCHEMA public;
--   ALTER TABLE v7_archive.market_engine_settings SET SCHEMA public;

CREATE SCHEMA IF NOT EXISTS v7_archive;
COMMENT ON SCHEMA v7_archive IS
  'Decommissioned tables from pre-Phase-14.08 architecture. Read-only via direct SELECT; not exposed by PostgREST.';

-- Move only if still in public (idempotent re-run safe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'market_engine_config'
  ) THEN
    EXECUTE 'ALTER TABLE public.market_engine_config SET SCHEMA v7_archive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'market_engine_log'
  ) THEN
    EXECUTE 'ALTER TABLE public.market_engine_log SET SCHEMA v7_archive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'market_engine_settings'
  ) THEN
    EXECUTE 'ALTER TABLE public.market_engine_settings SET SCHEMA v7_archive';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────
-- PART 5 — Tell PostgREST to reload the schema cache
-- ─────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION (run separately)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Confirm the broken trigger is gone:
-- (Expect 0 rows.)
SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'public.deals'::regclass
   AND tgname = 'trg_deal_apply_rise';

-- 2. Confirm the broken function is gone:
-- (Expect 0 rows.)
SELECT proname FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN (
     'on_deal_apply_initial_rise',
     'admin_get_rise_status',
     'get_strategic_market_advisor',
     'set_market_engine_state',
     'get_market_watch_advice'
   );

-- 3. Confirm the new admin_force_market_rise is in place:
-- (Expect 1 row.)
SELECT proname, pg_get_function_identity_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'admin_force_market_rise';

-- 4. Confirm the tables moved to v7_archive:
-- (Expect 3 rows.)
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_name IN ('market_engine_config', 'market_engine_log', 'market_engine_settings')
 ORDER BY table_name;

-- 5. Confirm the up-only trigger is still active:
-- (Expect 1 row with the right function.)
SELECT t.tgname, p.proname
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE t.tgrelid = 'public.deals'::regclass
   AND t.tgname = 'trg_update_market_price_on_deal_complete';

-- 6. Smoke-test admin_force_market_rise (super_admin only; expect
--    'unauthenticated' from SQL Editor because auth.uid() = NULL):
SELECT public.admin_force_market_rise(
  (SELECT id FROM public.projects LIMIT 1),
  0.01,
  FALSE,
  'Phase 14.08.2 smoke test — should return unauthenticated from SQL Editor'
);


-- ═══════════════════════════════════════════════════════════════════
-- DEAL-COMPLETION SMOKE TEST (critical — run via the UI, not here)
-- ═══════════════════════════════════════════════════════════════════
-- 1. As a regular user: create a listing, have another user create a
--    deal against it, then complete the deal.
-- 2. EXPECT: deal status → 'completed' WITHOUT rollback.
-- 3. EXPECT: a new row in price_history if deal_price > current price,
--    OR no row if deal_price ≤ current (up-only silent no-op).
-- 4. EXPECT: trg_deal_track_lineage still wrote a share_lineage row.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.2 — Step 2 CONSOLIDATION complete.';
  RAISE NOTICE '';
  RAISE NOTICE '  Fixed: trg_deal_apply_rise removed (deal completion';
  RAISE NOTICE '         no longer rolls back on non-quick-sell deals).';
  RAISE NOTICE '  Dropped: 4 legacy RPCs + 1 broken trigger function.';
  RAISE NOTICE '  Rewrote: admin_force_market_rise (clean Phase-14 impl).';
  RAISE NOTICE '  Archived: 3 tables → v7_archive schema.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT: smoke-test deal completion via the UI.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
