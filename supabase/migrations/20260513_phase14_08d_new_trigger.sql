-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08d — Replace deal-completion trigger with up-only logic
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Replaces the Phase 14.03 trigger (which still allowed DOWN moves)
-- with an UP-ONLY variant aligned with the new engine philosophy:
--
--   • If deal price > current_market_price → potentially raise.
--   • If deal price <= current_market_price → no-op (silently).
--
-- The trigger does NOT apply layer rewards — those are batched by
-- the daily cron (Phase 14.08e). All the per-deal trigger does is:
--
--   1. Read the engine_enabled master switch (market_settings).
--   2. Compute the per-deal price (total_amount / shares).
--   3. If higher than current, compute the raw delta_pct.
--   4. Run delta_pct through apply_caps() → final allowed rise.
--   5. Update projects.current_market_price.
--   6. Log to price_history with trigger_type='deal_completed'.
--
-- The Phase 13.47 advanced-conditions branch and Phase 14.03 daily
-- pct cap are gone — apply_caps owns all that logic centrally now.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_update_market_price_on_deal_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_price       BIGINT;
  v_deal_price      BIGINT;
  v_delta_pct       NUMERIC;
  v_caps            jsonb;
  v_applied_pct     NUMERIC;
  v_new_price       BIGINT;
  v_engine_enabled  BOOLEAN;
BEGIN
  -- Only act when the deal flips into 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.shares IS NULL OR NEW.shares <= 0 THEN RETURN NEW; END IF;
  IF NEW.total_amount IS NULL OR NEW.total_amount <= 0 THEN RETURN NEW; END IF;

  -- Master engine toggle (Phase 14.06b).
  v_engine_enabled := COALESCE(public.get_market_setting('engine_enabled'), 1) >= 1;
  IF NOT v_engine_enabled THEN
    -- Engine off: deals still complete (the share transfer ran in a
    -- separate function), but no price movement. Don't even log —
    -- the cron will report engine_off for the daily run summary.
    RETURN NEW;
  END IF;

  -- Per-deal implied price.
  v_deal_price := ROUND(NEW.total_amount::NUMERIC / NEW.shares);

  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = NEW.project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    -- Brand-new project with no seed price: take the deal price as
    -- the seed (one-time bootstrap, not a "rise" — no log row).
    UPDATE public.projects
       SET current_market_price = v_deal_price, updated_at = NOW()
     WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;

  -- ─── UP-ONLY GATE ────────────────────────────────────────────
  -- Phase 14.08d: deals priced AT OR BELOW current never move the
  -- price down. They count for the layer 1/3 computations later
  -- (via deals.status='completed'), but the headline price doesn't
  -- regress. Silently no-op.
  IF v_deal_price <= v_old_price THEN
    RETURN NEW;
  END IF;

  -- Raw delta percent (positive by definition above).
  v_delta_pct := ((v_deal_price - v_old_price) * 100.0) / NULLIF(v_old_price, 0);

  -- Run through the cap stack (sector / daily / yearly).
  v_caps := public.apply_caps(NEW.project_id, v_delta_pct);
  v_applied_pct := COALESCE((v_caps->>'applied_rise_pct')::NUMERIC, 0);

  IF v_applied_pct <= 0 THEN
    -- All caps consumed; nothing to do. Don't pollute price_history
    -- with zero-change rows.
    RETURN NEW;
  END IF;

  v_new_price := GREATEST(1, ROUND(v_old_price * (1 + v_applied_pct / 100.0))::BIGINT);
  IF v_new_price <= v_old_price THEN
    RETURN NEW;
  END IF;

  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at           = NOW()
   WHERE id = NEW.project_id;

  -- Log to price_history — best-effort, never blocks the price update.
  -- Phase 14.03 verified the real column names: created_at /
  -- market_phase / trigger_type.
  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price, change_pct,
      created_at, market_phase, trigger_type
    ) VALUES (
      NEW.project_id, v_old_price, v_new_price,
      ROUND(v_applied_pct, 4),
      NOW(), 'live', 'deal_completed'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_update_market_price_on_deal_complete: price_history insert failed (%): %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-bind explicitly so a stale binding can't linger.
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
  RAISE NOTICE 'Phase 14.08d up-only trigger replacement complete.';
  RAISE NOTICE '  ✓ Honours engine_enabled master switch';
  RAISE NOTICE '  ✓ Deals priced ≤ current are silent no-ops';
  RAISE NOTICE '  ✓ Positive deltas go through apply_caps()';
  RAISE NOTICE '  ✓ Phase 13.47 condition branch removed (cron-only now)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: 14.08e — daily cron orchestrator + scheduling';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
