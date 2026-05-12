-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.03 — Fix deal-completion trigger + drop leftover overload
-- Date: 2026-05-12
-- Idempotent. Single transaction.
--
-- Two cleanups in one migration:
--
-- 1. trg_update_market_price_on_deal_complete (Phase 13.47) inserts
--    into public.price_history using stale column names:
--      recorded_at  ← actual column is `created_at`
--      phase        ← actual column is `market_phase`
--      trigger      ← actual column is `trigger_type`
--    The INSERT is wrapped in `EXCEPTION WHEN OTHERS THEN NULL`, so
--    it silently fails for EVERY completed deal since Phase 13.46.
--    No audit row written.
--
-- 2. Discovery audit caught one more V7 leftover that Migration 14.02
--    missed (different arg signature):
--      get_fund_transactions(p_limit INTEGER)
--    Drop it now so the V7 function surface is fully clean.
--
-- This migration:
--   • Re-creates the trigger function with corrected column names
--   • Replaces the silent NULL handler with RAISE WARNING so failures
--     surface in Supabase logs (matches admin_force_market_rise pattern)
--   • Preserves every Phase-13.47 behaviour (config gates, cooldown,
--     min_deals, daily_pct_cap, UP combined rise, DOWN follow-down)
--   • Drops the last V7 overload
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── PART 1: Drop the last V7 leftover ────────────────────────
DROP FUNCTION IF EXISTS public.get_fund_transactions(INTEGER) CASCADE;


-- ─── PART 2: Re-create the deal-completion trigger function ───
CREATE OR REPLACE FUNCTION public.trg_update_market_price_on_deal_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg            RECORD;
  v_old_price      BIGINT;
  v_deal_price     BIGINT;
  v_new_price      BIGINT;
  v_pct            NUMERIC;
  v_today_deals    INTEGER;
  v_last_change    TIMESTAMPTZ;
  v_progress       jsonb;
  v_part_progress  NUMERIC;
  v_sd_progress    NUMERIC;
  v_combined_rise  NUMERIC;
BEGIN
  -- Only act when a deal flips into 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.shares IS NULL OR NEW.shares <= 0 THEN RETURN NEW; END IF;
  IF NEW.total_amount IS NULL OR NEW.total_amount <= 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL OR NOT v_cfg.enabled THEN RETURN NEW; END IF;

  v_deal_price := ROUND(NEW.total_amount::NUMERIC / NEW.shares);

  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = NEW.project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    -- Brand-new project, just set the deal price as the seed.
    UPDATE public.projects
       SET current_market_price = v_deal_price, updated_at = NOW()
     WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;

  -- Cooldown gate.
  IF v_cfg.cooldown_minutes > 0 THEN
    SELECT updated_at INTO v_last_change FROM public.projects WHERE id = NEW.project_id;
    IF v_last_change IS NOT NULL
       AND v_last_change > NOW() - (v_cfg.cooldown_minutes || ' minutes')::INTERVAL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Min daily deals gate.
  IF v_cfg.min_deals_threshold > 0 THEN
    SELECT COUNT(*) INTO v_today_deals
      FROM public.deals
     WHERE project_id = NEW.project_id
       AND status = 'completed'
       AND completed_at::DATE = CURRENT_DATE;
    IF COALESCE(v_today_deals, 0) < v_cfg.min_deals_threshold THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Direction: UP uses combined proportional rise from conditions;
  -- DOWN follows the deal price, capped by daily_pct_cap.
  IF v_deal_price >= v_old_price THEN
    v_progress       := public.compute_market_condition_progress();
    v_part_progress  := COALESCE((v_progress->>'participation_progress')::NUMERIC, 0);
    v_sd_progress    := COALESCE((v_progress->>'supply_demand_progress')::NUMERIC, 0);
    v_combined_rise  := v_part_progress * v_cfg.participation_max_rise_pct
                      + v_sd_progress   * v_cfg.supply_demand_max_rise_pct;

    IF v_combined_rise <= 0 THEN
      RETURN NEW;
    END IF;
    IF v_combined_rise > v_cfg.daily_pct_cap THEN
      v_combined_rise := v_cfg.daily_pct_cap;
    END IF;
    v_new_price := ROUND(v_old_price * (1 + v_combined_rise / 100.0));
  ELSE
    v_pct := ABS(((v_deal_price - v_old_price) * 100.0) / NULLIF(v_old_price, 0));
    IF v_pct > v_cfg.daily_pct_cap THEN
      v_new_price := ROUND(v_old_price * (1 - v_cfg.daily_pct_cap / 100.0));
    ELSE
      v_new_price := v_deal_price;
    END IF;
  END IF;

  IF v_new_price = v_old_price THEN
    RETURN NEW;
  END IF;

  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = NEW.project_id;

  -- ─── Log to price_history with CORRECT column names ──────────
  -- Founder verified the real schema has:
  --   created_at      (not recorded_at)
  --   market_phase    (not phase)
  --   trigger_type    (not trigger)
  -- The legacy version of this trigger used the wrong names AND
  -- swallowed errors with `WHEN OTHERS THEN NULL`, so it failed
  -- silently for every completed deal since Phase 13.46. Now we
  -- use the right columns and surface any future failure as a
  -- WARNING in Supabase logs.
  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price, change_pct,
      created_at, market_phase, trigger_type
    ) VALUES (
      NEW.project_id, v_old_price, v_new_price,
      ROUND(((v_new_price - v_old_price) * 100.0) / NULLIF(v_old_price, 1), 4),
      NOW(), 'live', 'deal_completed'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_update_market_price_on_deal_complete: failed to log to price_history (%): %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-bind the trigger explicitly so a stale binding can't linger.
DROP TRIGGER IF EXISTS trg_update_market_price_on_deal_complete ON public.deals;
CREATE TRIGGER trg_update_market_price_on_deal_complete
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_market_price_on_deal_complete();

NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.03 deal-trigger fix + leftover drop applied.';
  RAISE NOTICE '  ✓ trg_update_market_price_on_deal_complete';
  RAISE NOTICE '    rewired with REAL price_history column names';
  RAISE NOTICE '    (created_at / market_phase / trigger_type)';
  RAISE NOTICE '  ✓ EXCEPTION now RAISE WARNING (no silent fails)';
  RAISE NOTICE '  ✓ get_fund_transactions(INTEGER) dropped';
  RAISE NOTICE '  ✓ All Phase-13.47 behaviour preserved';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: Migration 4 — DROP 7 V7 tables';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
