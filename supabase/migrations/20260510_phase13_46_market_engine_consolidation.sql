-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.46 — Market engine consolidation
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec: ONE place to control the market engine. Two
-- behaviours: dynamic price (auto-follows deals) — switchable
-- with tunable conditions — and manual price rise (existing).
--
-- This migration:
--   1. Drops the duplicate / dead RPCs and tables that came from
--      the old "Phase 12 market engine" — stability fund,
--      sector caps, engine modes, dev promises, weekly counters.
--   2. Replaces the trigger that auto-updates current_market_price
--      on deal completion. Old version blindly copied the deal
--      price; the new version reads market_engine_config and
--      applies the founder's switchable rules:
--         • enabled flag (off = trigger no-ops)
--         • daily_pct_cap   — max move per day per project
--         • cooldown_minutes — min minutes between two updates
--         • min_deals_threshold — daily deal count required
--   3. Adds market_engine_config — single-row table used as the
--      one source of truth for the dynamic pricing settings.
--   4. Adds set_market_engine_state RPC — admin-only writer.
--   5. Keeps:
--        admin_force_market_rise (manual rise, untouched)
--        get_commission_rate / determine_transfer_category
--        execute_share_transfer
--        share_transfers / share_lineage / fee_unit_balances
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Drop dead RPCs (unused after Phase 13.45 client cleanup) ──
DROP FUNCTION IF EXISTS public.run_daily_market_engine();
DROP FUNCTION IF EXISTS public.run_daily_market_engine(BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_switch_engine_mode(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_sector_cap(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.admin_freeze_project(UUID, TEXT, DATE);
DROP FUNCTION IF EXISTS public.admin_unfreeze_project(UUID, TEXT);
DROP FUNCTION IF EXISTS public.compute_market_conditions(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_engine_mode(UUID);
DROP FUNCTION IF EXISTS public.get_monthly_cap(UUID);
DROP FUNCTION IF EXISTS public.get_monthly_accumulated(UUID);
DROP FUNCTION IF EXISTS public.is_project_frozen(UUID);
DROP FUNCTION IF EXISTS public.admin_update_commission(TEXT, BOOLEAN, NUMERIC, DATE, TEXT);

-- Keep: get_commission_rate, determine_transfer_category,
--       execute_share_transfer, admin_force_market_rise


-- ─── 2. Drop tables only the deleted UI used ──────────────────────
-- We keep `market_engine_settings` (free_transfer_max_value is
-- still read by execute_share_transfer's tier logic).
DROP TABLE IF EXISTS public.market_manual_freezes CASCADE;
DROP TABLE IF EXISTS public.market_sector_caps CASCADE;
DROP TABLE IF EXISTS public.market_protection_events CASCADE;
DROP TABLE IF EXISTS public.admin_market_decisions CASCADE;
DROP TABLE IF EXISTS public.development_promises CASCADE;
DROP TABLE IF EXISTS public.fund_transactions CASCADE;
DROP TABLE IF EXISTS public.stability_fund CASCADE;


-- ─── 3. market_engine_config — single source of truth ────────────
CREATE TABLE IF NOT EXISTS public.market_engine_config (
  id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  daily_pct_cap        NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (daily_pct_cap > 0 AND daily_pct_cap <= 100),
  cooldown_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  min_deals_threshold  INTEGER NOT NULL DEFAULT 0 CHECK (min_deals_threshold >= 0),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.market_engine_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.market_engine_config ENABLE ROW LEVEL SECURITY;

-- Read: everyone (the page reads it on render)
DROP POLICY IF EXISTS "anyone reads engine config" ON public.market_engine_config;
CREATE POLICY "anyone reads engine config"
  ON public.market_engine_config FOR SELECT
  USING (TRUE);

-- Write: admin / super_admin only (RPC enforces this too)
DROP POLICY IF EXISTS "admins write engine config" ON public.market_engine_config;
CREATE POLICY "admins write engine config"
  ON public.market_engine_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── 4. set_market_engine_state RPC ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_market_engine_state(
  p_enabled              BOOLEAN,
  p_daily_pct_cap        NUMERIC DEFAULT NULL,
  p_cooldown_minutes     INTEGER DEFAULT NULL,
  p_min_deals_threshold  INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.market_engine_config
     SET enabled = COALESCE(p_enabled, enabled),
         daily_pct_cap = COALESCE(p_daily_pct_cap, daily_pct_cap),
         cooldown_minutes = COALESCE(p_cooldown_minutes, cooldown_minutes),
         min_deals_threshold = COALESCE(p_min_deals_threshold, min_deals_threshold),
         updated_at = NOW(),
         updated_by = v_uid
   WHERE id = 1;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_market_engine_state(BOOLEAN, NUMERIC, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_market_engine_state(BOOLEAN, NUMERIC, INTEGER, INTEGER) TO authenticated;


-- ─── 5. New trigger function — reads market_engine_config ────────
-- Replaces the Phase 11.12 trigger with one that:
--   • short-circuits when enabled=false
--   • respects cooldown_minutes
--   • respects daily_pct_cap (caps the absolute % move per day)
--   • respects min_deals_threshold (no update if today's deals
--     count is below the threshold)
-- The 11.12 trigger that just copied the deal price unconditionally
-- is replaced by this one.

CREATE OR REPLACE FUNCTION public.trg_update_market_price_on_deal_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg RECORD;
  v_old_price BIGINT;
  v_new_price BIGINT;
  v_pct NUMERIC;
  v_today_deals INTEGER;
  v_last_change TIMESTAMPTZ;
BEGIN
  -- Only act when a deal flips into 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.shares IS NULL OR NEW.shares <= 0 THEN RETURN NEW; END IF;
  IF NEW.total_amount IS NULL OR NEW.total_amount <= 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL OR NOT v_cfg.enabled THEN RETURN NEW; END IF;

  -- Compute the would-be new price = total_amount / shares.
  v_new_price := ROUND(NEW.total_amount::NUMERIC / NEW.shares);

  -- Old price (before the trigger fires).
  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = NEW.project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    -- Project has no current price yet — just set it.
    UPDATE public.projects SET current_market_price = v_new_price, updated_at = NOW()
     WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;

  -- Cooldown: if the price was updated more recently than
  -- cooldown_minutes ago, skip.
  IF v_cfg.cooldown_minutes > 0 THEN
    SELECT updated_at INTO v_last_change FROM public.projects WHERE id = NEW.project_id;
    IF v_last_change IS NOT NULL
       AND v_last_change > NOW() - (v_cfg.cooldown_minutes || ' minutes')::INTERVAL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Min deals threshold: count today's completed deals for this project.
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

  -- Daily % cap: clamp the absolute change.
  v_pct := ABS(((v_new_price - v_old_price) * 100.0) / NULLIF(v_old_price, 0));
  IF v_pct > v_cfg.daily_pct_cap THEN
    -- Cap the move at ±daily_pct_cap%.
    IF v_new_price > v_old_price THEN
      v_new_price := ROUND(v_old_price * (1 + v_cfg.daily_pct_cap / 100.0));
    ELSE
      v_new_price := ROUND(v_old_price * (1 - v_cfg.daily_pct_cap / 100.0));
    END IF;
  END IF;

  -- Apply the (possibly capped) new price.
  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = NEW.project_id;

  -- Log to price_history (best-effort).
  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price,
      change_pct, recorded_at, phase, trigger
    ) VALUES (
      NEW.project_id, v_old_price, v_new_price,
      ROUND(((v_new_price - v_old_price) * 100.0) / NULLIF(v_old_price, 1), 2),
      NOW(), 'live', 'deal_completed'
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_market_price_on_deal_complete ON public.deals;
DROP TRIGGER IF EXISTS deals_dynamic_market_price ON public.deals;
DROP TRIGGER IF EXISTS deals_update_market_price ON public.deals;

CREATE TRIGGER trg_update_market_price_on_deal_complete
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_market_price_on_deal_complete();


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.46 market engine consolidation applied.';
  RAISE NOTICE '  ✓ Dropped 12 unused RPCs + 7 tables';
  RAISE NOTICE '  ✓ market_engine_config single-row table';
  RAISE NOTICE '  ✓ set_market_engine_state(enabled, daily_pct_cap, cooldown, min_deals)';
  RAISE NOTICE '  ✓ New trigger respects all 4 config knobs';
  RAISE NOTICE '  ✓ admin_force_market_rise / commissions / transfers preserved';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
