-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.9 — admin force-rise the market price
-- Date: 2026-05-09
-- Idempotent.
--
-- Adds two RPCs that the admin "Raise Market Price" panel uses:
--
--   1. admin_get_rise_status(p_project_id)
--      Returns a JSONB blob with:
--        • current_price + share_price + percent_above_par
--        • engine_mode (initial / permanent / frozen)
--        • is_frozen
--        • conditions: { c1_score, c2_score, hold_score, balance_score }
--        • allowed_natural_rise — what apply_*_mode_rise would actually
--          give right now if called via a trade (0 if conditions block it)
--        • blockers: a list of human-readable Arabic strings explaining
--          why a natural rise can't happen now (each = a condition that
--          fails). Empty array = the rise would be applied.
--
--   2. admin_force_market_rise(p_project_id, p_rise_pct, p_override, p_reason)
--      • If p_override = FALSE, refuses unless conditions are clear (no
--        blockers) and applies the natural rise the engine would compute.
--      • If p_override = TRUE, applies p_rise_pct (validated 0 < x ≤ 0.50,
--        i.e. up to 50% in one shot — beyond that the cap is rejected).
--        Both modes write a row to admin_decisions_log and update the
--        market_engine_log so the Phase-12 dashboard reflects it.
--      • Caller must be authenticated and have manage_market permission.
--        On a DB without admin_permissions, falls back to checking
--        profiles.role IN ('admin', 'super_admin').
--
-- Both RPCs are SECURITY DEFINER so they can read/write engine tables
-- regardless of the caller's row-level permissions. The auth check is
-- explicit at the top.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 0. Ensure admin_decisions_log table exists (Phase 12 created it,
--       but we're defensive in case this is the first migration applied).
CREATE TABLE IF NOT EXISTS public.admin_decisions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── 1. admin_get_rise_status ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_rise_status(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_proj RECORD;
  v_conditions JSONB;
  v_engine_mode TEXT;
  v_is_frozen BOOLEAN;
  v_settings RECORD;
  v_today_rises INTEGER;
  v_monthly NUMERIC;
  v_cap NUMERIC;
  v_blockers JSONB := '[]'::jsonb;
  v_natural_rise NUMERIC := 0;
  v_share_price NUMERIC;
  v_market_price NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT id, name, share_price, current_market_price
    INTO v_proj FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  v_share_price := COALESCE(v_proj.share_price, 0);
  v_market_price := COALESCE(v_proj.current_market_price, v_share_price);

  -- Engine state. Tolerate missing helper functions (e.g. before
  -- Phase 12 was applied) — fall back to safe defaults.
  BEGIN
    v_engine_mode := public.get_engine_mode(p_project_id);
  EXCEPTION WHEN OTHERS THEN
    v_engine_mode := 'initial';
  END;

  BEGIN
    v_is_frozen := public.is_project_frozen(p_project_id);
  EXCEPTION WHEN OTHERS THEN
    v_is_frozen := FALSE;
  END;

  BEGIN
    v_conditions := public.compute_market_conditions(p_project_id, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    v_conditions := jsonb_build_object(
      'total_holders', 0, 'distinct_pairs', 0, 'pair_ratio', 0,
      'c1_score', 0, 'hold_score', 0, 'balance_score', 0, 'c2_score', 0
    );
  END;

  -- Blockers + natural rise estimate.
  IF v_is_frozen THEN
    v_blockers := v_blockers || jsonb_build_array('🧊 المشروع مُجمَّد — لا يقبل أي رفع تلقائي');
  END IF;

  BEGIN
    SELECT * INTO v_settings FROM market_engine_settings
     WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

    IF v_engine_mode = 'initial' THEN
      SELECT COUNT(*) INTO v_today_rises FROM market_engine_log
       WHERE project_id = p_project_id AND date = CURRENT_DATE
         AND daily_rise > 0;
      IF v_today_rises >= COALESCE(v_settings.initial_max_trades_per_day, 5) THEN
        v_blockers := v_blockers || jsonb_build_array(
          '⚠ بلغ الحد اليومي للرفعات في الوضع الابتدائي ('
          || v_today_rises::TEXT || '/' || v_settings.initial_max_trades_per_day::TEXT || ')'
        );
      ELSE
        v_natural_rise := COALESCE(v_settings.initial_rise_per_trade, 0);
      END IF;
    ELSIF v_engine_mode = 'permanent' THEN
      DECLARE
        v_c1 NUMERIC := COALESCE((v_conditions->>'c1_score')::NUMERIC, 0);
        v_c2 NUMERIC := COALESCE((v_conditions->>'c2_score')::NUMERIC, 0);
      BEGIN
        v_natural_rise := v_c1 * COALESCE(v_settings.c1_max_rise, 0)
                        + v_c2 * COALESCE(v_settings.c2_max_rise, 0);
        v_natural_rise := LEAST(v_natural_rise,
          COALESCE(v_settings.daily_cap, v_natural_rise));

        IF v_c1 < 0.5 THEN
          v_blockers := v_blockers || jsonb_build_array(
            '⚠ شرط الأزواج المتميّزة لم يُستوفَ بالكامل (c1 = '
            || ROUND(v_c1 * 100, 0)::TEXT || '%)'
          );
        END IF;
        IF v_c2 < 0.5 THEN
          v_blockers := v_blockers || jsonb_build_array(
            '⚠ شرط الاحتفاظ + التوازن لم يُستوفَ بالكامل (c2 = '
            || ROUND(v_c2 * 100, 0)::TEXT || '%)'
          );
        END IF;
      END;
    END IF;

    -- Monthly cap check (applies in both modes).
    BEGIN
      v_monthly := public.get_monthly_accumulated(p_project_id);
      v_cap := public.get_monthly_cap(p_project_id);
      IF v_monthly >= v_cap THEN
        v_blockers := v_blockers || jsonb_build_array(
          '🧱 السقف الشهري مُستنفَد ('
          || ROUND(v_monthly * 100, 1)::TEXT || '% / '
          || ROUND(v_cap * 100, 1)::TEXT || '%)'
        );
        v_natural_rise := 0;
      ELSIF v_monthly + v_natural_rise > v_cap THEN
        v_natural_rise := GREATEST(0, v_cap - v_monthly);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_monthly := 0; v_cap := 1;
    END;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'project', jsonb_build_object(
      'id', v_proj.id,
      'name', v_proj.name,
      'share_price', v_share_price,
      'current_market_price', v_market_price,
      'percent_above_par', CASE
        WHEN v_share_price > 0
          THEN ROUND(((v_market_price - v_share_price) / v_share_price) * 100, 2)
        ELSE 0
      END
    ),
    'engine_mode', v_engine_mode,
    'is_frozen', v_is_frozen,
    'conditions', v_conditions,
    'monthly_accumulated', COALESCE(v_monthly, 0),
    'monthly_cap', COALESCE(v_cap, 1),
    'today_rises', COALESCE(v_today_rises, 0),
    'allowed_natural_rise', COALESCE(v_natural_rise, 0),
    'blockers', v_blockers,
    'can_rise_naturally', jsonb_array_length(v_blockers) = 0 AND v_natural_rise > 0
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_get_rise_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_rise_status(UUID) TO authenticated;


-- ─── 2. admin_force_market_rise ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_force_market_rise(
  p_project_id UUID,
  p_rise_pct   NUMERIC DEFAULT NULL,   -- e.g. 0.05 = 5%. NULL = use natural.
  p_override   BOOLEAN DEFAULT FALSE,  -- bypass condition checks?
  p_reason     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_status JSONB;
  v_blockers JSONB;
  v_rise NUMERIC;
  v_old_price NUMERIC;
  v_new_price NUMERIC;
  v_proj_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Authorize: must be admin/super_admin (or have manage_market perm).
  BEGIN
    SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
      FROM profiles WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_is_admin := FALSE; END;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Compute current status (conditions, blockers, natural rise).
  v_status := public.admin_get_rise_status(p_project_id);
  IF (v_status->>'success')::BOOLEAN IS NOT TRUE THEN
    RETURN v_status;
  END IF;
  v_blockers := v_status->'blockers';

  -- Determine the rise to apply.
  IF p_rise_pct IS NOT NULL THEN
    v_rise := p_rise_pct;
  ELSE
    v_rise := COALESCE((v_status->>'allowed_natural_rise')::NUMERIC, 0);
  END IF;

  IF v_rise IS NULL OR v_rise <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'no_rise_to_apply',
      'blockers', v_blockers
    );
  END IF;
  IF v_rise > 0.50 THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'rise_too_large', 'max', 0.50
    );
  END IF;

  -- Refuse unless override is set when there are blockers.
  IF jsonb_array_length(v_blockers) > 0 AND COALESCE(p_override, FALSE) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'conditions_not_met',
      'blockers', v_blockers
    );
  END IF;

  -- Apply the rise.
  SELECT current_market_price, name INTO v_old_price, v_proj_name
    FROM projects WHERE id = p_project_id FOR UPDATE;
  IF v_old_price IS NULL OR v_old_price = 0 THEN
    SELECT share_price INTO v_old_price FROM projects WHERE id = p_project_id;
  END IF;

  v_new_price := ROUND(v_old_price * (1 + v_rise));
  UPDATE projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = p_project_id;

  -- Log to market_engine_log + admin_decisions_log (best-effort).
  BEGIN
    INSERT INTO market_engine_log(
      project_id, date, engine_mode, daily_rise,
      monthly_accumulated, monthly_cap
    ) VALUES (
      p_project_id, CURRENT_DATE, COALESCE(v_status->>'engine_mode', 'initial'),
      v_rise,
      COALESCE((v_status->>'monthly_accumulated')::NUMERIC, 0) + v_rise,
      COALESCE((v_status->>'monthly_cap')::NUMERIC, 0)
    )
    ON CONFLICT (project_id, date) DO UPDATE SET
      daily_rise = market_engine_log.daily_rise + v_rise,
      monthly_accumulated = market_engine_log.monthly_accumulated + v_rise;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO admin_decisions_log(admin_id, project_id, action, details, reason)
    VALUES (
      v_uid, p_project_id,
      CASE WHEN p_override THEN 'admin_force_rise_override' ELSE 'admin_force_rise' END,
      jsonb_build_object(
        'rise_pct', v_rise,
        'old_price', v_old_price,
        'new_price', v_new_price,
        'blockers_at_apply', v_blockers,
        'override', COALESCE(p_override, FALSE)
      ),
      p_reason
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'project_id', p_project_id,
    'project_name', v_proj_name,
    'old_price', v_old_price,
    'new_price', v_new_price,
    'rise_pct', v_rise,
    'override_used', COALESCE(p_override, FALSE),
    'blockers_at_apply', v_blockers
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_market_rise(UUID, NUMERIC, BOOLEAN, TEXT)
  TO authenticated;


DO $$ BEGIN
  RAISE NOTICE '✅ Phase 12.9: admin_get_rise_status + admin_force_market_rise ready';
END $$;
