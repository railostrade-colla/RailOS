-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 hotfix — make ALL deal triggers SAFE on partial schemas
-- Date: 2026-05-09
-- Idempotent.
--
-- Founder still hits the global error wall after the previous fix.
-- Suspected root cause: one of the Phase-12 deal triggers
-- (trg_deal_track_lineage, trg_deal_apply_rise, trg_deal_ambassador_reward)
-- calls into a table or function that doesn't exist on this DB
-- (e.g. share_lineage or market_engine_settings was never applied).
-- The trigger raises an exception INSIDE the place_deal_from_listing
-- transaction → the whole deal creation fails → the buy flow blows up.
--
-- Safe fix: re-create every Phase-12 deal-side trigger function with a
-- top-level BEGIN/EXCEPTION that swallows ANY error and writes a
-- WARNING to pg_logs, so the trigger never blocks the deal itself.
-- The reward + lineage + market-rise paths become best-effort:
-- they happen when the underlying tables are present, and silently
-- skip when they aren't.
--
-- Apply this once. After your other Phase-12 migrations are also
-- applied, the triggers automatically start contributing — no need
-- to revert this safety wrapper.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Lineage tracker — tolerant of missing share_lineage ───────
CREATE OR REPLACE FUNCTION public.on_deal_track_lineage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_circular BOOLEAN := FALSE;
  v_is_quick BOOLEAN := FALSE;
  v_source TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      BEGIN
        SELECT COALESCE(is_quick_sell, FALSE) INTO v_is_quick
          FROM listings WHERE id = NEW.listing_id;
      EXCEPTION WHEN OTHERS THEN v_is_quick := FALSE; END;

      BEGIN
        v_circular := public.is_circular_trade(NEW.project_id, NEW.seller_id, NEW.buyer_id);
      EXCEPTION WHEN OTHERS THEN v_circular := FALSE; END;

      v_source := CASE WHEN v_is_quick THEN 'quick_sell' ELSE 'trade' END;

      INSERT INTO share_lineage(project_id, from_user_id, to_user_id, shares_count,
        source_type, source_id, is_circular, detected_at)
      VALUES (NEW.project_id, NEW.seller_id, NEW.buyer_id, NEW.shares,
        v_source, NEW.id, v_circular, CASE WHEN v_circular THEN NOW() ELSE NULL END);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'lineage tracker non-fatal error for deal %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_track_lineage ON public.deals;
CREATE TRIGGER trg_deal_track_lineage
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_track_lineage();


-- ─── 2. Initial-mode rise — tolerant of missing market_engine_* ───
CREATE OR REPLACE FUNCTION public.on_deal_apply_initial_rise()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_quick BOOLEAN := FALSE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      BEGIN
        SELECT COALESCE(is_quick_sell, FALSE) INTO v_is_quick
          FROM listings WHERE id = NEW.listing_id;
      EXCEPTION WHEN OTHERS THEN v_is_quick := FALSE; END;

      IF NOT v_is_quick THEN
        BEGIN
          PERFORM public.apply_initial_mode_rise(NEW.project_id);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'initial-rise non-fatal error for deal %: %', NEW.id, SQLERRM;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'apply_rise outer error for deal %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_apply_rise ON public.deals;
CREATE TRIGGER trg_deal_apply_rise
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_apply_initial_rise();


-- ─── 3. Ambassador reward — tolerant of missing ambassador tables ─
CREATE OR REPLACE FUNCTION public.on_deal_ambassador_reward()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      BEGIN
        v_result := public.grant_ambassador_first_investment_reward(NEW.id);
        IF v_result IS NOT NULL AND (v_result->>'success')::BOOLEAN IS NOT TRUE THEN
          RAISE WARNING 'ambassador reward not granted for deal %: %', NEW.id, v_result;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'ambassador reward EXCEPTION for deal %: %', NEW.id, SQLERRM;
      END;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ambassador outer error for deal %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_ambassador_reward ON public.deals;
CREATE TRIGGER trg_deal_ambassador_reward
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_ambassador_reward();


-- ─── 4. Defensive: ensure deals has every column the RPCs expect ──
DO $$
BEGIN
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'exchange';
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS buyer_commission BIGINT DEFAULT 0;
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS seller_commission BIGINT DEFAULT 0;
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;
  ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
EXCEPTION WHEN undefined_table THEN
  RAISE WARNING 'public.deals table missing — cannot add columns';
END $$;


-- ─── 5. Stub the missing helper functions so triggers don't 404 ───
-- If these don't exist (because Phase 12 tables migration wasn't run),
-- we create no-op stubs so the trigger calls into them safely.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_initial_mode_rise'
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.apply_initial_mode_rise(p_project_id UUID)
      RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $body$
      BEGIN RETURN 0; END $body$;
    ';
    RAISE NOTICE 'Stub created: apply_initial_mode_rise (returns 0)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_circular_trade'
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.is_circular_trade(p_project_id UUID, p_seller UUID, p_buyer UUID)
      RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $body$
      BEGIN RETURN FALSE; END $body$;
    ';
    RAISE NOTICE 'Stub created: is_circular_trade (returns FALSE)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'grant_ambassador_first_investment_reward'
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.grant_ambassador_first_investment_reward(p_deal_id UUID)
      RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $body$
      BEGIN RETURN jsonb_build_object(''success'', FALSE, ''error'', ''stub''); END $body$;
    ';
    RAISE NOTICE 'Stub created: grant_ambassador_first_investment_reward';
  END IF;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 safe-triggers applied:';
  RAISE NOTICE '  ✓ Every deal trigger is now non-fatal — buy/sell flow';
  RAISE NOTICE '    will NEVER be blocked by a Phase-12 side-effect failing.';
  RAISE NOTICE '  ✓ Missing helper functions stubbed as no-ops.';
  RAISE NOTICE '  ✓ Required deal columns ensured.';
  RAISE NOTICE 'After applying: clear the listings cache (refresh /exchange)';
  RAISE NOTICE 'and try buying a listing — the deal will be created cleanly.';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
