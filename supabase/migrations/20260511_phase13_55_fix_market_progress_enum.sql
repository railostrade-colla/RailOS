-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.55 — Fix invalid deal_status values in market progress RPC
-- Date: 2026-05-11
-- Idempotent.
--
-- Bug (Phase 13.47): compute_market_condition_progress() filtered
-- pending demand using `status IN ('pending', 'submitted')` — neither
-- value exists in the canonical `deal_status` enum, so calling the
-- function (and the get_market_watch_advice() wrapper around it)
-- crashed with:
--   "invalid input value for enum deal_status: pending"
--
-- Visible in the admin panel as "تعذّر قراءة بيانات السوق" in the
-- مراقبة السوق (Market Watch) card.
--
-- Fix: replace the filter with the real "open demand" statuses:
--   • pending_seller_approval   — buyer placed order, awaiting seller
--   • accepted                  — seller agreed, shares frozen
--   • payment_submitted         — buyer uploaded proof, awaiting admin
--   • pending_payment           — direct-buy path waiting for proof
-- Everything else (`completed`, `cancelled`, `rejected`, `disputed`,
-- `expired`) is terminal and NOT open demand.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.compute_market_condition_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg                  RECORD;
  v_total_users          INTEGER;
  v_dealing_users        INTEGER;
  v_required_dealers     INTEGER;
  v_traded_value_24h     NUMERIC;
  v_pending_demand_value NUMERIC;
  v_demand_ratio_pct     NUMERIC;
  v_part_progress        NUMERIC;
  v_sd_progress          NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_config');
  END IF;

  -- Total platform users — count active investor accounts.
  SELECT COUNT(*)::INTEGER INTO v_total_users
    FROM public.profiles
   WHERE COALESCE(role::TEXT, 'user') NOT IN ('admin', 'super_admin');

  IF v_total_users IS NULL OR v_total_users <= 0 THEN
    v_total_users := 0;
  END IF;

  -- Distinct users who completed at least one deal (lifetime).
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_dealing_users
    FROM (
      SELECT buyer_id  AS user_id FROM public.deals WHERE status = 'completed'
      UNION
      SELECT seller_id AS user_id FROM public.deals WHERE status = 'completed'
    ) u
   WHERE user_id IS NOT NULL;

  v_dealing_users    := COALESCE(v_dealing_users, 0);
  v_required_dealers := CEIL(v_total_users * v_cfg.user_participation_required_pct / 100.0)::INTEGER;

  -- Traded value (last 24h) — sum of completed deals' total_amount.
  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_traded_value_24h
    FROM public.deals
   WHERE status = 'completed'
     AND completed_at >= NOW() - INTERVAL '24 hours';

  -- ─── FIX: real "open buy interest" enum values ───────────────
  -- Was: status IN ('pending', 'submitted')  ← non-existent enum values
  -- Now: every non-terminal in-progress status.
  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_pending_demand_value
    FROM public.deals
   WHERE status IN (
     'pending_seller_approval',
     'accepted',
     'payment_submitted',
     'pending_payment'
   );

  -- Demand-to-supply ratio as a percentage.
  IF v_traded_value_24h > 0 THEN
    v_demand_ratio_pct := (v_pending_demand_value * 100.0) / v_traded_value_24h;
  ELSE
    v_demand_ratio_pct := 0;
  END IF;

  -- Two progress ratios in [0, 1].
  IF v_cfg.user_participation_required_pct > 0 AND v_total_users > 0 THEN
    v_part_progress := LEAST(
      1.0,
      (v_dealing_users * 100.0 / v_total_users) / v_cfg.user_participation_required_pct
    );
  ELSE
    v_part_progress := 0;
  END IF;

  IF v_cfg.supply_demand_balance_target_pct > 0 THEN
    v_sd_progress := LEAST(1.0, v_demand_ratio_pct / v_cfg.supply_demand_balance_target_pct);
  ELSE
    v_sd_progress := 0;
  END IF;

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'total_users',              v_total_users,
    'dealing_users',            v_dealing_users,
    'required_dealers',         v_required_dealers,
    'participation_pct',        ROUND(
      CASE WHEN v_total_users > 0
           THEN v_dealing_users * 100.0 / v_total_users
           ELSE 0 END, 2),
    'participation_target_pct', v_cfg.user_participation_required_pct,
    'participation_progress',   ROUND(v_part_progress, 4),
    'participation_unlock_pct', ROUND(v_part_progress * v_cfg.participation_max_rise_pct, 4),
    'traded_value_24h',         v_traded_value_24h,
    'pending_demand_value',     v_pending_demand_value,
    'demand_ratio_pct',         ROUND(v_demand_ratio_pct, 2),
    'demand_target_pct',        v_cfg.supply_demand_balance_target_pct,
    'supply_demand_progress',   ROUND(v_sd_progress, 4),
    'supply_demand_unlock_pct', ROUND(v_sd_progress * v_cfg.supply_demand_max_rise_pct, 4),
    'combined_unlock_pct',      ROUND(
      v_part_progress * v_cfg.participation_max_rise_pct
      + v_sd_progress * v_cfg.supply_demand_max_rise_pct, 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_condition_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_market_condition_progress() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.55 market progress enum hotfix applied.';
  RAISE NOTICE '  ✓ status IN (pending_seller_approval, accepted,';
  RAISE NOTICE '              payment_submitted, pending_payment)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
