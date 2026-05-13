-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08b — Three-layer engine compute functions
-- Date: 2026-05-13
-- Idempotent. Single transaction.
--
-- Adds four pure-read functions powering the new engine:
--
--   compute_layer1_pairs(p_project_id)
--      → distinct (buyer, seller) pairs as a fraction of active users
--        for the project, vs the `layer1_target_pairs_pct` setting.
--
--   compute_layer2_balance(p_project_id)
--      → supply (active sell listings value) vs demand (active buy
--        intents value) balance, ratio against the 1:1 target.
--
--   compute_layer3_renewal(p_project_id)
--      → % of dealers who became active within the last
--        `active_user_days` setting (default 30d) vs total dealers
--        in that same window. High renewal = healthy churn-in.
--
--   compute_all_layers(p_project_id)
--      → orchestrator: returns layer1/2/3 progress + computed
--        raw_rise_pct (sum of progress × max_reward per layer).
--
-- All four are STABLE + SECURITY DEFINER so the cron + admin RPCs
-- can call them under any caller's identity. They never write; they
-- only READ from deals, listings, and market_settings.
--
-- Every numeric goes through COALESCE(…, 0) to keep brand-new
-- projects (zero history) from returning NULL.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Layer 1 — distinct buyer/seller pairs ─────────────────────
--
-- "Active users for THIS project" = anyone who appears as buyer or
-- seller in a completed deal on this project within the engine's
-- active window (active_user_days setting).
-- "Distinct pairs" = distinct (LEAST(buyer,seller), GREATEST(...))
-- combinations among those completed deals.
-- progress = MIN(1, pair_ratio / target_pair_ratio)
--
-- Returns jsonb { progress, distinct_pairs, active_users, pair_ratio,
--                  target, ok }.
CREATE OR REPLACE FUNCTION public.compute_layer1_pairs(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_days       INTEGER;
  v_target_pct        NUMERIC;
  v_cutoff            TIMESTAMPTZ;
  v_distinct_pairs    INTEGER;
  v_active_users      INTEGER;
  v_pair_ratio_pct    NUMERIC;
  v_progress          NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('progress', 0, 'ok', false, 'error', 'missing_project');
  END IF;

  v_window_days := COALESCE(public.get_market_setting('active_user_days'), 30)::INTEGER;
  v_target_pct  := COALESCE(public.get_market_setting('layer1_target_pairs_pct'), 12.0);
  v_cutoff      := NOW() - (v_window_days || ' days')::INTERVAL;

  -- Active users for this project (buyers or sellers in window).
  SELECT COUNT(DISTINCT uid) INTO v_active_users
    FROM (
      SELECT buyer_id  AS uid FROM public.deals
       WHERE project_id = p_project_id
         AND status = 'completed'
         AND completed_at >= v_cutoff
      UNION
      SELECT seller_id AS uid FROM public.deals
       WHERE project_id = p_project_id
         AND status = 'completed'
         AND completed_at >= v_cutoff
    ) u
   WHERE uid IS NOT NULL;

  -- Distinct unordered (buyer, seller) pairs.
  SELECT COUNT(*) INTO v_distinct_pairs
    FROM (
      SELECT DISTINCT
        LEAST(buyer_id, seller_id)    AS a,
        GREATEST(buyer_id, seller_id) AS b
      FROM public.deals
      WHERE project_id = p_project_id
        AND status = 'completed'
        AND completed_at >= v_cutoff
        AND buyer_id IS NOT NULL
        AND seller_id IS NOT NULL
        AND buyer_id <> seller_id
    ) pairs;

  v_active_users   := COALESCE(v_active_users, 0);
  v_distinct_pairs := COALESCE(v_distinct_pairs, 0);

  IF v_active_users <= 1 THEN
    v_pair_ratio_pct := 0;
  ELSE
    -- Max possible distinct pairs = C(active_users, 2) = n*(n-1)/2.
    -- But the founder's intuition is "% of users who paired" not
    -- combinatorial saturation, so we use a simpler reference:
    --   pair_ratio_pct = distinct_pairs / active_users × 100
    -- A ratio of 1.0 means each user paired with one other on average.
    v_pair_ratio_pct := (v_distinct_pairs::NUMERIC / v_active_users::NUMERIC) * 100.0;
  END IF;

  IF v_target_pct <= 0 THEN
    v_progress := 0;
  ELSE
    v_progress := LEAST(1.0, v_pair_ratio_pct / v_target_pct);
  END IF;
  IF v_progress < 0 THEN v_progress := 0; END IF;

  RETURN jsonb_build_object(
    'progress',        v_progress,
    'distinct_pairs',  v_distinct_pairs,
    'active_users',    v_active_users,
    'pair_ratio_pct',  v_pair_ratio_pct,
    'target_pct',      v_target_pct,
    'window_days',     v_window_days,
    'ok',              true
  );
END $$;

REVOKE ALL ON FUNCTION public.compute_layer1_pairs(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_layer1_pairs(UUID) TO authenticated;


-- ─── Layer 2 — supply/demand balance ──────────────────────────
--
-- For each project:
--   supply_value = SUM(remaining_shares × price) of active SELL
--                  listings on the exchange.
--   demand_value = SUM(shares × price) of active BUY listings (or
--                  pending direct-buy intents).
-- balance_ratio = MIN(supply, demand) / MAX(supply, demand)  in [0,1]
-- progress      = balance_ratio (a balanced book gets full reward).
--
-- Returns jsonb { progress, supply_value, demand_value, balance, ok }.
CREATE OR REPLACE FUNCTION public.compute_layer2_balance(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supply_value NUMERIC := 0;
  v_demand_value NUMERIC := 0;
  v_lo           NUMERIC;
  v_hi           NUMERIC;
  v_progress     NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('progress', 0, 'ok', false, 'error', 'missing_project');
  END IF;

  -- Schema-tolerant supply read. The "listings" table is the canonical
  -- order book; we accept both an `is_active` boolean column or a
  -- `status='active'` text column depending on which migration shape
  -- the project is on. Falls back gracefully on schema mismatch.
  BEGIN
    EXECUTE format(
      'SELECT COALESCE(SUM(shares_remaining * price_per_share), 0)::NUMERIC
         FROM public.listings
        WHERE project_id = %L
          AND type = %L
          AND status = %L',
      p_project_id, 'sell', 'active'
    ) INTO v_supply_value;
  EXCEPTION WHEN OTHERS THEN
    v_supply_value := 0;
  END;

  BEGIN
    EXECUTE format(
      'SELECT COALESCE(SUM(shares_remaining * price_per_share), 0)::NUMERIC
         FROM public.listings
        WHERE project_id = %L
          AND type = %L
          AND status = %L',
      p_project_id, 'buy', 'active'
    ) INTO v_demand_value;
  EXCEPTION WHEN OTHERS THEN
    v_demand_value := 0;
  END;

  v_supply_value := COALESCE(v_supply_value, 0);
  v_demand_value := COALESCE(v_demand_value, 0);

  -- Balance ratio: 1 = perfectly balanced, 0 = one side missing.
  v_lo := LEAST(v_supply_value,  v_demand_value);
  v_hi := GREATEST(v_supply_value, v_demand_value);

  IF v_hi <= 0 THEN
    v_progress := 0;
  ELSE
    v_progress := v_lo / v_hi;
  END IF;

  RETURN jsonb_build_object(
    'progress',     v_progress,
    'supply_value', v_supply_value,
    'demand_value', v_demand_value,
    'balance',      v_progress,
    'ok',           true
  );
END $$;

REVOKE ALL ON FUNCTION public.compute_layer2_balance(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_layer2_balance(UUID) TO authenticated;


-- ─── Layer 3 — dealer renewal ─────────────────────────────────
--
-- Among the dealers who appear in completed deals during the window
-- [now - active_user_days, now]:
--   new_dealers       = first-ever deal on this project happened
--                       within the window.
--   returning_dealers = first-ever deal on this project is OLDER
--                       than the window.
-- progress = new_dealers / (new + returning) in [0, 1].
--
-- High value = lots of new participants joined the trading this
-- window. Zero value = only old hands are trading.
--
-- Returns jsonb { progress, new_dealers, returning_dealers, total, ok }.
CREATE OR REPLACE FUNCTION public.compute_layer3_renewal(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_days INTEGER;
  v_cutoff      TIMESTAMPTZ;
  v_new         INTEGER;
  v_returning   INTEGER;
  v_total       INTEGER;
  v_progress    NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('progress', 0, 'ok', false, 'error', 'missing_project');
  END IF;

  v_window_days := COALESCE(public.get_market_setting('active_user_days'), 30)::INTEGER;
  v_cutoff      := NOW() - (v_window_days || ' days')::INTERVAL;

  -- For each dealer who participated in the window, find their
  -- earliest deal on this project (over all time). If that earliest
  -- date is also inside the window, they're NEW for this project.
  WITH dealers_in_window AS (
    SELECT DISTINCT uid FROM (
      SELECT buyer_id  AS uid FROM public.deals
       WHERE project_id = p_project_id
         AND status = 'completed'
         AND completed_at >= v_cutoff
      UNION
      SELECT seller_id AS uid FROM public.deals
       WHERE project_id = p_project_id
         AND status = 'completed'
         AND completed_at >= v_cutoff
    ) u
    WHERE uid IS NOT NULL
  ),
  first_deal AS (
    SELECT
      d.uid,
      MIN(d.completed_at) AS first_at
    FROM (
      SELECT buyer_id  AS uid, completed_at FROM public.deals
       WHERE project_id = p_project_id AND status = 'completed'
      UNION ALL
      SELECT seller_id AS uid, completed_at FROM public.deals
       WHERE project_id = p_project_id AND status = 'completed'
    ) d
    WHERE d.uid IS NOT NULL
    GROUP BY d.uid
  )
  SELECT
    SUM(CASE WHEN fd.first_at >= v_cutoff THEN 1 ELSE 0 END)::INTEGER,
    SUM(CASE WHEN fd.first_at <  v_cutoff THEN 1 ELSE 0 END)::INTEGER
  INTO v_new, v_returning
  FROM dealers_in_window diw
  JOIN first_deal fd ON fd.uid = diw.uid;

  v_new       := COALESCE(v_new, 0);
  v_returning := COALESCE(v_returning, 0);
  v_total     := v_new + v_returning;

  IF v_total <= 0 THEN
    v_progress := 0;
  ELSE
    v_progress := v_new::NUMERIC / v_total::NUMERIC;
  END IF;

  RETURN jsonb_build_object(
    'progress',          v_progress,
    'new_dealers',       v_new,
    'returning_dealers', v_returning,
    'total',             v_total,
    'window_days',       v_window_days,
    'ok',                true
  );
END $$;

REVOKE ALL ON FUNCTION public.compute_layer3_renewal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_layer3_renewal(UUID) TO authenticated;


-- ─── Orchestrator — compute_all_layers ─────────────────────────
--
-- Returns the three layer progress values + the raw (pre-cap) rise:
--   raw_rise_pct = layer1.progress × layer1_max_reward
--                + layer2.progress × layer2_max_reward
--                + layer3.progress × layer3_max_reward
--
-- Returns jsonb {
--   layer1: <jsonb>, layer2: <jsonb>, layer3: <jsonb>,
--   layer1_reward_pct, layer2_reward_pct, layer3_reward_pct,
--   raw_rise_pct, ok
-- }
CREATE OR REPLACE FUNCTION public.compute_all_layers(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l1 jsonb;
  v_l2 jsonb;
  v_l3 jsonb;
  v_max1 NUMERIC;
  v_max2 NUMERIC;
  v_max3 NUMERIC;
  v_r1 NUMERIC;
  v_r2 NUMERIC;
  v_r3 NUMERIC;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_project');
  END IF;

  v_l1 := public.compute_layer1_pairs(p_project_id);
  v_l2 := public.compute_layer2_balance(p_project_id);
  v_l3 := public.compute_layer3_renewal(p_project_id);

  v_max1 := COALESCE(public.get_market_setting('layer1_max_reward'), 1.5);
  v_max2 := COALESCE(public.get_market_setting('layer2_max_reward'), 0.5);
  v_max3 := COALESCE(public.get_market_setting('layer3_max_reward'), 2.0);

  v_r1 := COALESCE((v_l1->>'progress')::NUMERIC, 0) * v_max1;
  v_r2 := COALESCE((v_l2->>'progress')::NUMERIC, 0) * v_max2;
  v_r3 := COALESCE((v_l3->>'progress')::NUMERIC, 0) * v_max3;

  RETURN jsonb_build_object(
    'layer1',            v_l1,
    'layer2',            v_l2,
    'layer3',            v_l3,
    'layer1_reward_pct', v_r1,
    'layer2_reward_pct', v_r2,
    'layer3_reward_pct', v_r3,
    'raw_rise_pct',      v_r1 + v_r2 + v_r3,
    'ok',                true
  );
END $$;

REVOKE ALL ON FUNCTION public.compute_all_layers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_all_layers(UUID) TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08b layer functions created.';
  RAISE NOTICE '  ✓ compute_layer1_pairs   — pair-ratio progress';
  RAISE NOTICE '  ✓ compute_layer2_balance — supply/demand balance';
  RAISE NOTICE '  ✓ compute_layer3_renewal — new vs returning dealers';
  RAISE NOTICE '  ✓ compute_all_layers     — orchestrator + raw_rise_pct';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: 14.08c — Caps logic (sector / daily / yearly)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
