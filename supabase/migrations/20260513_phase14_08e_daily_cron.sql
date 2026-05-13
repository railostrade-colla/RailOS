-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08e — Daily cron orchestrator + scheduling
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Three new objects:
--
--   • run_daily_engine_for_project(p_project_id)
--       For ONE project: compute the three layers, run the raw rise
--       through apply_caps(), bump current_market_price, and write
--       to BOTH price_history (trigger_type='daily_cron') and
--       engine_daily_runs.
--
--   • run_daily_engine()
--       Loops over every project the founder considers "active"
--       (offering_status IN ('active','launching') OR sold > 0)
--       and calls the single-project function. Returns a summary.
--
--   • pg_cron schedule
--       Schedules run_daily_engine() at `cron_job_hour` UTC if the
--       extension is available. Falls back to a NOTICE if pg_cron
--       isn't installed in this Supabase project (so the migration
--       still applies).
--
-- All writes go through SECURITY DEFINER so the cron process can
-- bypass RLS on engine_daily_runs / price_history / projects.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Per-project runner ───────────────────────────────────────
--
-- Returns jsonb with everything the monitor UI + logging need.
-- Idempotent in spirit: if applied_rise_pct === 0 we still INSERT
-- a row into engine_daily_runs (with capped_by populated) so the
-- founder can see WHY a day moved nothing — but we DON'T write to
-- price_history for zero-change days (keeps that table compact).
CREATE OR REPLACE FUNCTION public.run_daily_engine_for_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layers       jsonb;
  v_l1_p         NUMERIC;
  v_l2_p         NUMERIC;
  v_l3_p         NUMERIC;
  v_l1_r         NUMERIC;
  v_l2_r         NUMERIC;
  v_l3_r         NUMERIC;
  v_raw          NUMERIC;
  v_caps         jsonb;
  v_applied      NUMERIC;
  v_capped_by    TEXT[];
  v_old_price    BIGINT;
  v_new_price    BIGINT;
  v_run_id       UUID;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;

  -- Lock the project row so a concurrent deal-trigger can't race the
  -- price update we're about to do.
  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = p_project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    -- Project has no seed price yet; nothing to grow. Log a run row
    -- so the monitor can show "skipped — no seed".
    INSERT INTO public.engine_daily_runs(
      project_id, raw_rise_pct, applied_rise_pct, capped_by,
      old_price, new_price, notes
    ) VALUES (
      p_project_id, 0, 0, ARRAY['no_seed']::TEXT[],
      0, 0, 'skipped: project has no current_market_price/share_price'
    )
    RETURNING id INTO v_run_id;
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

  -- 3. Compute new price (up-only by construction — applied >= 0).
  v_new_price := GREATEST(v_old_price, ROUND(v_old_price * (1 + v_applied / 100.0))::BIGINT);

  -- 4. Persist the price + the engine_daily_runs row.
  IF v_new_price > v_old_price THEN
    UPDATE public.projects
       SET current_market_price = v_new_price,
           updated_at           = NOW()
     WHERE id = p_project_id;

    -- Log to price_history only when there was a real move.
    BEGIN
      INSERT INTO public.price_history(
        project_id, old_price, new_price, change_pct,
        created_at, market_phase, trigger_type
      ) VALUES (
        p_project_id, v_old_price, v_new_price,
        ROUND(v_applied, 4), NOW(), 'live', 'daily_cron'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'run_daily_engine: price_history insert failed (%): %',
        SQLSTATE, SQLERRM;
    END;
  END IF;

  INSERT INTO public.engine_daily_runs(
    project_id,
    layer1_progress, layer2_progress, layer3_progress,
    layer1_reward_pct, layer2_reward_pct, layer3_reward_pct,
    raw_rise_pct, applied_rise_pct, capped_by,
    old_price, new_price
  ) VALUES (
    p_project_id,
    v_l1_p, v_l2_p, v_l3_p,
    v_l1_r, v_l2_r, v_l3_r,
    v_raw, v_applied, v_capped_by,
    v_old_price, v_new_price
  )
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'run_id',           v_run_id,
    'old_price',        v_old_price,
    'new_price',        v_new_price,
    'raw_rise_pct',     v_raw,
    'applied_rise_pct', v_applied,
    'capped_by',        v_capped_by,
    'layers',           v_layers,
    'caps',             v_caps
  );
END $$;

REVOKE ALL ON FUNCTION public.run_daily_engine_for_project(UUID) FROM PUBLIC;
-- Service role only (pg_cron runs as superuser). Authenticated
-- callers can hit it for testing through manual_trigger_daily_engine
-- (Phase 14.08g), which gates on super_admin.


-- ─── All-projects loop ────────────────────────────────────────
--
-- Iterates every "active" project. Definition is broad on purpose:
--   * Phase 10.93 added offering_suspended / offering_suspension_reason.
--   * We treat any project that ISN'T suspended AND HAS a price as
--     eligible. Brand-new projects (no price) are auto-skipped inside
--     run_daily_engine_for_project itself.
CREATE OR REPLACE FUNCTION public.run_daily_engine()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id      UUID;
  v_processed       INTEGER := 0;
  v_moved           INTEGER := 0;
  v_total_rise      NUMERIC := 0;
  v_engine_enabled  BOOLEAN;
  v_per_project     jsonb;
  v_start           TIMESTAMPTZ := NOW();
BEGIN
  v_engine_enabled := COALESCE(public.get_market_setting('engine_enabled'), 1) >= 1;
  IF NOT v_engine_enabled THEN
    RETURN jsonb_build_object(
      'ok', true, 'skipped', 'engine_off', 'processed', 0
    );
  END IF;

  FOR v_project_id IN
    SELECT id FROM public.projects
     WHERE COALESCE(offering_suspended, false) = false
       AND COALESCE(current_market_price, share_price, 0) > 0
     ORDER BY id
  LOOP
    BEGIN
      v_per_project := public.run_daily_engine_for_project(v_project_id);
      v_processed := v_processed + 1;
      IF (v_per_project->>'new_price')::BIGINT >
         (v_per_project->>'old_price')::BIGINT THEN
        v_moved := v_moved + 1;
        v_total_rise := v_total_rise + COALESCE((v_per_project->>'applied_rise_pct')::NUMERIC, 0);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'run_daily_engine: project % failed (%): %',
        v_project_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',           true,
    'started_at',   v_start,
    'finished_at',  NOW(),
    'processed',    v_processed,
    'moved',        v_moved,
    'total_rise',   v_total_rise
  );
END $$;

REVOKE ALL ON FUNCTION public.run_daily_engine() FROM PUBLIC;


-- ─── pg_cron schedule ─────────────────────────────────────────
--
-- Supabase exposes pg_cron in the `cron` schema. We schedule the
-- daily engine to run at the hour stored in market_settings
-- (cron_job_hour, default 0 UTC = midnight). If pg_cron is missing
-- (e.g. local Postgres), we emit a NOTICE and the founder can
-- invoke run_daily_engine() manually via the admin RPC.
DO $$
DECLARE
  v_hour INTEGER;
  v_schedule TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    v_hour := COALESCE(public.get_market_setting('cron_job_hour'), 0)::INTEGER;
    IF v_hour < 0 OR v_hour > 23 THEN v_hour := 0; END IF;
    -- "<minute> <hour> * * *" = every day at <hour>:00 UTC.
    v_schedule := '0 ' || v_hour || ' * * *';

    -- Unschedule any previous version (idempotent re-run).
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'railos_daily_engine';

    PERFORM cron.schedule(
      'railos_daily_engine',
      v_schedule,
      $cron$SELECT public.run_daily_engine();$cron$
    );
    RAISE NOTICE '  ✓ pg_cron scheduled: railos_daily_engine @ %', v_schedule;
  ELSE
    RAISE NOTICE '  ⚠ pg_cron extension not present — schedule skipped.';
    RAISE NOTICE '    Enable from Supabase Dashboard → Database → Extensions.';
    RAISE NOTICE '    Until then, call SELECT public.run_daily_engine();';
    RAISE NOTICE '    on whatever cadence you want (e.g. external GitHub Action).';
  END IF;
END $$;


NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08e daily cron orchestrator complete.';
  RAISE NOTICE '  ✓ run_daily_engine_for_project(uuid) created';
  RAISE NOTICE '  ✓ run_daily_engine() loop created';
  RAISE NOTICE '  ✓ pg_cron schedule attempted (see above)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: 14.08f — admin UI monitor';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
