-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.02 — DROP V7 functions + CREATE new admin_force_market_rise
-- Date: 2026-05-12
-- Idempotent. Single transaction.
--
-- Founder approval (post-discovery):
--   • 7 V7 functions are dead/broken (depend on tables we're dropping)
--   • admin_force_market_rise is replaced with a clean 30-line version
--     that has ZERO V7 dependencies — just updates current_market_price
--     and appends a row to price_history
--
-- DROP list (7 functions):
--   1. admin_force_market_rise   (Phase 12.9 — broken: depends on
--                                 get_monthly_cap + get_monthly_accumulated
--                                 dropped in Phase 13.46)
--   2. admin_get_rise_status     (Phase 12.9 — same broken deps)
--   3. apply_initial_mode_rise   (Phase 12 — dead, init mode removed)
--   4. apply_permanent_mode_rise (Phase 12 — dead, permanent mode removed)
--   5. get_development_promises_for_project (V7 reader — table dropped)
--   6. get_fund_transactions     (V7 reader — table dropped)
--   7. get_market_engine_overview(V7 reader — stability_fund dropped)
--
-- CREATE: admin_force_market_rise(UUID, NUMERIC, TEXT) → jsonb
--   Single transaction so the panel never sees a missing function.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── PART 1: Drop V7 functions ───────────────────────────────────
-- Use IF EXISTS + CASCADE so the migration is safe on partial DBs.
-- CASCADE drops dependent objects (triggers, views) — none expected
-- here since these are all leaf functions.

DROP FUNCTION IF EXISTS public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_force_market_rise(UUID, NUMERIC, TEXT)          CASCADE;
DROP FUNCTION IF EXISTS public.admin_force_market_rise(UUID, NUMERIC)                CASCADE;
DROP FUNCTION IF EXISTS public.admin_force_market_rise(UUID)                         CASCADE;

DROP FUNCTION IF EXISTS public.admin_get_rise_status(UUID) CASCADE;

DROP FUNCTION IF EXISTS public.apply_initial_mode_rise(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.apply_initial_mode_rise(UUID)          CASCADE;
DROP FUNCTION IF EXISTS public.apply_initial_mode_rise()              CASCADE;

DROP FUNCTION IF EXISTS public.apply_permanent_mode_rise(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.apply_permanent_mode_rise(UUID)          CASCADE;
DROP FUNCTION IF EXISTS public.apply_permanent_mode_rise()              CASCADE;

DROP FUNCTION IF EXISTS public.get_development_promises_for_project(UUID) CASCADE;

DROP FUNCTION IF EXISTS public.get_fund_transactions(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_fund_transactions()     CASCADE;

DROP FUNCTION IF EXISTS public.get_market_engine_overview(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_market_engine_overview()     CASCADE;


-- ─── PART 2: NEW admin_force_market_rise (clean, ~30 lines) ─────
-- Behavior per founder spec:
--   1. Validate caller is admin/super_admin
--   2. Validate p_rise_pct in [-100, 100]   (allow negative for drops)
--   3. Read current_market_price (fallback to share_price)
--   4. Compute new_price = ROUND(old × (1 + pct/100))
--   5. UPDATE projects.current_market_price + updated_at
--   6. INSERT into price_history with phase='live', trigger='admin_manual',
--      change_pct stamped exactly
--   7. RETURN jsonb { success, old_price, new_price, change_pct, project_id }

CREATE OR REPLACE FUNCTION public.admin_force_market_rise(
  p_project_id UUID,
  p_rise_pct   NUMERIC,
  p_reason     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_old_price BIGINT;
  v_new_price BIGINT;
  v_proj_name TEXT;
BEGIN
  -- 1. Auth gate (founder verified: only 'super_admin' should pass)
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') <> 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_super_admin');
  END IF;

  -- 2. Input validation
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_project');
  END IF;
  IF p_rise_pct IS NULL OR p_rise_pct < -100 OR p_rise_pct > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_rise_pct');
  END IF;

  -- 3. Read current price (fallback chain: market → share_price)
  SELECT name, COALESCE(current_market_price, share_price, 0)::BIGINT
    INTO v_proj_name, v_old_price
    FROM public.projects
   WHERE id = p_project_id
   FOR UPDATE;

  IF v_proj_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_found');
  END IF;
  IF v_old_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_base_price');
  END IF;

  -- 4. Compute new price
  v_new_price := GREATEST(1, ROUND(v_old_price * (1 + p_rise_pct / 100.0))::BIGINT);

  IF v_new_price = v_old_price THEN
    RETURN jsonb_build_object(
      'success',     true,
      'old_price',   v_old_price,
      'new_price',   v_new_price,
      'change_pct',  0,
      'project_id',  p_project_id,
      'note',        'no_op'
    );
  END IF;

  -- 5. Apply the new price
  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = p_project_id;

  -- 6. Log to price_history (best-effort — never fails the price update).
  -- Founder verified the REAL column names against the live schema:
  --   • created_at      (not recorded_at)
  --   • market_phase    (not phase)
  --   • trigger_type    (not trigger)
  -- An EXCEPTION here doesn't roll back the UPDATE, but unlike the
  -- silent `WHEN OTHERS THEN NULL` pattern (which once hid a broken
  -- column reference), we now RAISE WARNING so the failure surfaces
  -- in Supabase logs.
  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price, change_pct,
      created_at, market_phase, trigger_type
    ) VALUES (
      p_project_id, v_old_price, v_new_price, ROUND(p_rise_pct, 4),
      NOW(), 'live', 'admin_manual'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin_force_market_rise: failed to log to price_history (%): %',
      SQLSTATE, SQLERRM;
  END;

  -- 7. Done
  RETURN jsonb_build_object(
    'success',     true,
    'old_price',   v_old_price,
    'new_price',   v_new_price,
    'change_pct',  ROUND(p_rise_pct, 4),
    'project_id',  p_project_id,
    'project_name', v_proj_name,
    'reason',      p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, TEXT) TO authenticated;

-- Force PostgREST to reload its function cache so the new shape is
-- callable immediately (without waiting up to 60s).
NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.02 V7-functions hotfix applied.';
  RAISE NOTICE '  ✓ 7 V7 functions DROPPED (all overloads handled)';
  RAISE NOTICE '  ✓ admin_force_market_rise CREATED — clean, 3-arg,';
  RAISE NOTICE '    zero V7 dependencies, ~30 lines body';
  RAISE NOTICE '  ✓ PostgREST schema cache reloaded';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: RaiseMarketPricePanel.tsx still uses the old';
  RAISE NOTICE '  4-arg signature; Migration 5 will update the UI.';
  RAISE NOTICE '  Until then, the manual-rise button is BROKEN.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
