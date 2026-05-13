-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.1 — Hotfixes for the new 3-layer engine
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Three small but important additions on top of the working 14.08
-- series:
--
--   1. New market_settings row: `monthly_cap_services`.
--      Currently project_type='services' falls back to the
--      `monthly_cap_commercial` value (10%). Adding a dedicated row
--      lets the founder tune services independently without changing
--      commercial. Default 10% to preserve existing behaviour.
--
--   2. Idempotency in run_daily_engine_for_project.
--      Without it, manual_trigger calls can stack rises within the
--      same calendar day (each new run consumes the daily cap again,
--      which is why three manual runs in two minutes raised the
--      price three times in the smoke test). Now: if a row already
--      exists in engine_daily_runs for the project on the current
--      UTC date, the function returns early with skipped='already_ran_today'.
--      pg_cron always fires once per day, so this affects only
--      manual / API callers.
--
--   3. A `p_force` flag on run_daily_engine_for_project AND
--      manual_trigger_daily_engine that bypasses the idempotency
--      check. Default FALSE. Intended for testing only — the UI
--      surfaces it behind a separate, clearly-labelled button.
--
-- Rollback notes (manual — no DOWN migration framework here):
--   • Drop monthly_cap_services row from market_settings.
--   • Restore the previous run_daily_engine_for_project / manual_trigger
--     bodies from migrations 14.08e and 14.08g.
-- See "DOWN" comment block at the end of this file for ready-to-paste
-- rollback SQL.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Seed monthly_cap_services ─────────────────────────────
INSERT INTO public.market_settings
  (key, value, value_type, category, label_ar, label_en,
   description_ar, min_value, max_value, default_value)
VALUES
  ('monthly_cap_services',
   10.0,
   'percent',
   'sector_caps',
   'سقف خدمات شهري',
   'Services monthly cap',
   'السقف الشهري الأعلى لمشاريع الخدمات (services). يُستخدم تلقائياً متى كان project_type=''services''.',
   1,
   20,
   10.0)
ON CONFLICT (key) DO NOTHING;


-- ─── 2. Rewire sector mapping to use the new key ──────────────
-- Was: services → monthly_cap_commercial (10%, fallback)
-- Now: services → monthly_cap_services (own row, founder-tunable)
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

  SELECT project_type::TEXT INTO v_sector
    FROM public.projects WHERE id = p_project_id;

  IF v_sector IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  v_key := CASE
    WHEN v_sector ILIKE '%زراع%'  OR v_sector ILIKE '%agric%'        THEN 'monthly_cap_agricultural'
    WHEN v_sector ILIKE '%عقار%'  OR v_sector ILIKE '%real%estate%'
                                  OR v_sector ILIKE '%real_estate%'  THEN 'monthly_cap_real_estate'
    WHEN v_sector ILIKE '%صناع%'  OR v_sector ILIKE '%industri%'     THEN 'monthly_cap_industrial'
    WHEN v_sector ILIKE '%تجار%'  OR v_sector ILIKE '%commerc%'      THEN 'monthly_cap_commercial'
    WHEN v_sector ILIKE '%طب%'    OR v_sector ILIKE '%medic%'
                                  OR v_sector ILIKE '%health%'       THEN 'monthly_cap_medical'
    WHEN v_sector ILIKE '%تقن%'   OR v_sector ILIKE '%tech%'         THEN 'monthly_cap_technology'
    -- Phase 14.08.1: services now has its own setting.
    WHEN v_sector ILIKE '%خدم%'   OR v_sector ILIKE '%service%'      THEN 'monthly_cap_services'
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


-- ─── 3. Idempotent + force-aware per-project runner ───────────
-- Replaces the 14.08e body. New 2-arg signature so the old 1-arg
-- callers (cron in particular) keep working — see the wrapper below.
CREATE OR REPLACE FUNCTION public.run_daily_engine_for_project(
  p_project_id UUID,
  p_force      BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layers       jsonb;
  v_l1_p         NUMERIC; v_l2_p NUMERIC; v_l3_p NUMERIC;
  v_l1_r         NUMERIC; v_l2_r NUMERIC; v_l3_r NUMERIC;
  v_raw          NUMERIC;
  v_caps         jsonb;
  v_applied      NUMERIC;
  v_capped_by    TEXT[];
  v_old_price    BIGINT;
  v_new_price    BIGINT;
  v_run_id       UUID;
  v_already      BOOLEAN;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;

  -- ─── Idempotency (skip when we've already run today) ───
  -- Day-of-year + year tuple to be robust around year-end edges.
  -- Skipped runs do NOT write a new engine_daily_runs row (we keep
  -- the table compact — the original day's row IS the record).
  IF NOT p_force THEN
    SELECT EXISTS (
      SELECT 1 FROM public.engine_daily_runs
       WHERE project_id = p_project_id
         AND DATE(run_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')
    ) INTO v_already;
    IF v_already THEN
      RETURN jsonb_build_object(
        'ok',      true,
        'skipped', 'already_ran_today',
        'project_id', p_project_id,
        'hint',    'pass p_force=TRUE to override (testing only)'
      );
    END IF;
  END IF;

  -- Lock the project row.
  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = p_project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    INSERT INTO public.engine_daily_runs(
      project_id, raw_rise_pct, applied_rise_pct, capped_by,
      old_price, new_price, notes
    ) VALUES (
      p_project_id, 0, 0, ARRAY['no_seed']::TEXT[],
      0, 0, 'skipped: project has no current_market_price/share_price'
    ) RETURNING id INTO v_run_id;
    RETURN jsonb_build_object('ok', true, 'run_id', v_run_id, 'skipped', 'no_seed');
  END IF;

  -- 1. Compute layer progress + raw rise.
  v_layers := public.compute_all_layers(p_project_id);
  v_l1_p   := COALESCE((v_layers->'layer1'->>'progress')::NUMERIC, 0);
  v_l2_p   := COALESCE((v_layers->'layer2'->>'progress')::NUMERIC, 0);
  v_l3_p   := COALESCE((v_layers->'layer3'->>'progress')::NUMERIC, 0);
  v_l1_r   := COALESCE((v_layers->>'layer1_reward_pct')::NUMERIC, 0);
  v_l2_r   := COALESCE((v_layers->>'layer2_reward_pct')::NUMERIC, 0);
  v_l3_r   := COALESCE((v_layers->>'layer3_reward_pct')::NUMERIC, 0);
  v_raw    := COALESCE((v_layers->>'raw_rise_pct')::NUMERIC, 0);

  -- 2. Apply caps.
  v_caps      := public.apply_caps(p_project_id, v_raw);
  v_applied   := COALESCE((v_caps->>'applied_rise_pct')::NUMERIC, 0);
  v_capped_by := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_caps->'capped_by')),
    ARRAY[]::TEXT[]
  );

  -- 3. Compute new price (up-only).
  v_new_price := GREATEST(v_old_price, ROUND(v_old_price * (1 + v_applied / 100.0))::BIGINT);

  IF v_new_price > v_old_price THEN
    UPDATE public.projects
       SET current_market_price = v_new_price, updated_at = NOW()
     WHERE id = p_project_id;

    BEGIN
      INSERT INTO public.price_history(
        project_id, old_price, new_price, change_pct,
        created_at, market_phase, trigger_type
      ) VALUES (
        p_project_id, v_old_price, v_new_price,
        ROUND(v_applied, 4), NOW(), 'live',
        CASE WHEN p_force THEN 'manual_force' ELSE 'daily_cron' END
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'run_daily_engine: price_history insert failed (%): %', SQLSTATE, SQLERRM;
    END;
  END IF;

  INSERT INTO public.engine_daily_runs(
    project_id, layer1_progress, layer2_progress, layer3_progress,
    layer1_reward_pct, layer2_reward_pct, layer3_reward_pct,
    raw_rise_pct, applied_rise_pct, capped_by,
    old_price, new_price, notes
  ) VALUES (
    p_project_id, v_l1_p, v_l2_p, v_l3_p,
    v_l1_r, v_l2_r, v_l3_r, v_raw, v_applied, v_capped_by,
    v_old_price, v_new_price,
    CASE WHEN p_force THEN 'forced manual run' ELSE NULL END
  ) RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'ok', true, 'run_id', v_run_id,
    'forced', p_force,
    'old_price', v_old_price, 'new_price', v_new_price,
    'raw_rise_pct', v_raw, 'applied_rise_pct', v_applied,
    'capped_by', v_capped_by, 'layers', v_layers, 'caps', v_caps
  );
END $$;

REVOKE ALL ON FUNCTION public.run_daily_engine_for_project(UUID, BOOLEAN) FROM PUBLIC;
-- No GRANT to authenticated — only callable from SECURITY DEFINER
-- wrappers (run_daily_engine + manual_trigger_daily_engine).

-- Keep the legacy 1-arg overload alive as a thin shim so the existing
-- run_daily_engine() loop and pg_cron entry don't break. The shim
-- forwards force=FALSE.
CREATE OR REPLACE FUNCTION public.run_daily_engine_for_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.run_daily_engine_for_project(p_project_id, FALSE);
$$;

REVOKE ALL ON FUNCTION public.run_daily_engine_for_project(UUID) FROM PUBLIC;


-- ─── 4. manual_trigger_daily_engine — adds p_force ────────────
CREATE OR REPLACE FUNCTION public.manual_trigger_daily_engine(
  p_project_id UUID    DEFAULT NULL,
  p_force      BOOLEAN DEFAULT FALSE
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
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_super_admin');
  END IF;

  IF p_project_id IS NULL THEN
    -- Whole loop. Force is passed through only when each per-project
    -- call is invoked — to do that under the loop we'd need a forced
    -- variant of run_daily_engine(). For now: force=TRUE on the
    -- 'all' scope is treated as TRUE-per-project by re-iterating
    -- here instead of calling run_daily_engine().
    IF p_force THEN
      DECLARE
        v_processed INTEGER := 0;
        v_pid UUID;
      BEGIN
        FOR v_pid IN
          SELECT id FROM public.projects
           WHERE COALESCE(offering_suspended, false) = false
             AND COALESCE(current_market_price, share_price, 0) > 0
           ORDER BY id
        LOOP
          PERFORM public.run_daily_engine_for_project(v_pid, TRUE);
          v_processed := v_processed + 1;
        END LOOP;
        v_result := jsonb_build_object('ok', true, 'forced', true, 'processed', v_processed);
      END;
    ELSE
      v_result := public.run_daily_engine();
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'scope', 'all',
      'forced', p_force, 'triggered_by', v_uid, 'result', v_result
    );
  ELSE
    v_result := public.run_daily_engine_for_project(p_project_id, p_force);
    RETURN jsonb_build_object(
      'ok', true, 'scope', 'single', 'project_id', p_project_id,
      'forced', p_force, 'triggered_by', v_uid, 'result', v_result
    );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.manual_trigger_daily_engine(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_trigger_daily_engine(UUID, BOOLEAN) TO authenticated;

-- Keep the 1-arg overload (force defaults to FALSE) so anyone still
-- calling the old signature gets the safe path automatically.
CREATE OR REPLACE FUNCTION public.manual_trigger_daily_engine(p_project_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.manual_trigger_daily_engine(p_project_id, FALSE);
$$;

REVOKE ALL ON FUNCTION public.manual_trigger_daily_engine(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_trigger_daily_engine(UUID) TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- DOWN — manual rollback (paste in SQL Editor if needed):
--
--   BEGIN;
--   DELETE FROM public.market_settings WHERE key = 'monthly_cap_services';
--   -- restore mapping (services → commercial)
--   -- restore run_daily_engine_for_project body from 14.08e
--   -- restore manual_trigger_daily_engine body from 14.08g
--   COMMIT;
--
-- The function bodies in 14.08e + 14.08g are the source of truth for
-- the rollback. No data is dropped — only logic resets.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.1 hotfixes applied.';
  RAISE NOTICE '  ✓ monthly_cap_services row seeded (default 10%%)';
  RAISE NOTICE '  ✓ get_applicable_sector_cap services → own setting';
  RAISE NOTICE '  ✓ run_daily_engine_for_project idempotent (one-per-day)';
  RAISE NOTICE '  ✓ p_force flag wired through manual_trigger';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Test:';
  RAISE NOTICE '  SELECT run_daily_engine_for_project(uuid);          -- second call same day → already_ran_today';
  RAISE NOTICE '  SELECT run_daily_engine_for_project(uuid, TRUE);    -- force override';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
