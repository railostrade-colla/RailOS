-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Market Engine + Commission RPCs (19 functions)
-- Date: 2026-05-09
-- Idempotent: CREATE OR REPLACE everywhere.
--
-- Adapted to RailOS actual schema:
--   • fee_unit_balances (NOT fee_units) — `balance` column
--   • holdings.last_acquired_at (NOT last_buy_at)
--   • listings.is_quick_sell (deals derive via listing_id JOIN)
--   • projects.project_type (NOT sector — but we accept either via fallback)
--   • profiles.kyc_status enum (we map 'approved' → kyc_complete=TRUE)
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Engine mode (per-project override falls back to global) ───
CREATE OR REPLACE FUNCTION public.get_engine_mode(p_project_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mode TEXT;
BEGIN
  IF p_project_id IS NOT NULL THEN
    SELECT engine_mode INTO v_mode FROM market_engine_settings
     WHERE scope = 'project' AND project_id = p_project_id;
    IF v_mode IS NOT NULL THEN RETURN v_mode; END IF;
  END IF;
  SELECT engine_mode INTO v_mode FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;
  RETURN COALESCE(v_mode, 'initial');
END $$;


-- ─── 2. Read commission rate dynamically (THE core helper) ────────
CREATE OR REPLACE FUNCTION public.get_commission_rate(p_type TEXT)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_setting RECORD;
BEGIN
  SELECT * INTO v_setting FROM commission_settings WHERE commission_type = p_type;
  IF NOT FOUND OR NOT v_setting.is_enabled THEN RETURN 0; END IF;

  -- Auto-restore default after paused_until expires.
  IF v_setting.paused_until IS NOT NULL AND v_setting.paused_until < CURRENT_DATE THEN
    UPDATE commission_settings
       SET current_rate = default_rate, paused_until = NULL,
           changed_at = NOW(),
           notes = COALESCE(notes,'') || ' [auto-restored ' || CURRENT_DATE::TEXT || ']'
     WHERE commission_type = p_type;
    RETURN v_setting.default_rate;
  END IF;

  RETURN v_setting.current_rate;
END $$;


-- ─── 3. Admin: update a commission ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_commission(
  p_type TEXT, p_is_enabled BOOLEAN, p_new_rate NUMERIC,
  p_paused_until DATE DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old RECORD;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO v_old FROM commission_settings WHERE commission_type = p_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_commission_type'; END IF;
  IF p_new_rate < 0 OR p_new_rate > 0.10 THEN
    RAISE EXCEPTION 'rate_out_of_range';
  END IF;

  UPDATE commission_settings
     SET is_enabled = p_is_enabled,
         current_rate = p_new_rate,
         paused_until = p_paused_until,
         changed_at = NOW(),
         changed_by = auth.uid(),
         notes = p_notes
   WHERE commission_type = p_type;

  INSERT INTO admin_market_decisions(admin_id, decision_type, decision_target,
    before_state, after_state, rationale)
  VALUES (auth.uid(), 'update_commission', p_type,
    jsonb_build_object('enabled', v_old.is_enabled, 'rate', v_old.current_rate,
                       'paused_until', v_old.paused_until),
    jsonb_build_object('enabled', p_is_enabled, 'rate', p_new_rate,
                       'paused_until', p_paused_until),
    p_notes);
  RETURN TRUE;
END $$;


-- ─── 4. Monthly cap (sector-driven, with fallback to project_type) ─
CREATE OR REPLACE FUNCTION public.get_monthly_cap(p_project_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sector TEXT; v_cap NUMERIC;
BEGIN
  -- Try `sector` column if it exists, else fall back to project_type.
  BEGIN
    EXECUTE 'SELECT sector FROM projects WHERE id = $1' INTO v_sector USING p_project_id;
  EXCEPTION WHEN undefined_column THEN
    SELECT project_type::TEXT INTO v_sector FROM projects WHERE id = p_project_id;
  END;
  IF v_sector IS NULL THEN
    SELECT project_type::TEXT INTO v_sector FROM projects WHERE id = p_project_id;
  END IF;

  SELECT monthly_cap_percent INTO v_cap
    FROM market_sector_caps
   WHERE sector = v_sector AND is_active = TRUE;

  RETURN COALESCE(v_cap, 0.10);
END $$;


-- ─── 5. Monthly accumulated rises ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_accumulated(p_project_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(daily_rise), 0) INTO v_total
    FROM market_engine_log
   WHERE project_id = p_project_id
     AND date >= DATE_TRUNC('month', CURRENT_DATE)::DATE;
  RETURN v_total;
END $$;


-- ─── 6. Frozen check ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_project_frozen(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM market_manual_freezes
     WHERE project_id = p_project_id AND resolved_at IS NULL
       AND (freeze_end_date IS NULL OR freeze_end_date >= CURRENT_DATE)
  );
END $$;


-- ─── 7. Account age in days ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_account_age_days(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_created TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO v_created FROM profiles WHERE id = p_user_id;
  IF v_created IS NULL THEN RETURN 0; END IF;
  RETURN EXTRACT(DAY FROM (NOW() - v_created))::INTEGER;
END $$;


-- ─── 8. Circular trade detection ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_circular_trade(
  p_project_id UUID, p_seller_id UUID, p_buyer_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_window INTEGER; v_circular BOOLEAN := FALSE;
BEGIN
  SELECT circular_detection_window_days INTO v_window
    FROM market_engine_settings WHERE scope = 'global'
    ORDER BY changed_at DESC LIMIT 1;
  v_window := COALESCE(v_window, 7);

  SELECT EXISTS(
    SELECT 1 FROM share_lineage
     WHERE project_id = p_project_id
       AND from_user_id = p_buyer_id
       AND to_user_id = p_seller_id
       AND created_at >= NOW() - (v_window || ' days')::INTERVAL
  ) INTO v_circular;
  RETURN v_circular;
END $$;


-- ─── 9. Distinct qualified pairs today ────────────────────────────
CREATE OR REPLACE FUNCTION public.count_distinct_qualified_pairs(
  p_project_id UUID, p_date DATE
) RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_min_age INTEGER; v_count INTEGER;
BEGIN
  SELECT min_account_age_days INTO v_min_age
    FROM market_engine_settings WHERE scope = 'global'
    ORDER BY changed_at DESC LIMIT 1;
  v_min_age := COALESCE(v_min_age, 30);

  -- A deal is "qualified" only when both parties are >= min_age days old,
  -- not a circular pair, and NOT a quick-sell (joins through listings).
  SELECT COUNT(DISTINCT
           (LEAST(d.seller_id, d.buyer_id), GREATEST(d.seller_id, d.buyer_id)))
    INTO v_count
    FROM deals d
    LEFT JOIN listings l ON l.id = d.listing_id
   WHERE d.project_id = p_project_id
     AND d.completed_at::DATE = p_date
     AND d.status = 'completed'
     AND COALESCE(l.is_quick_sell, FALSE) = FALSE
     AND public.get_account_age_days(d.seller_id) >= v_min_age
     AND public.get_account_age_days(d.buyer_id) >= v_min_age
     AND NOT public.is_circular_trade(p_project_id, d.seller_id, d.buyer_id);
  RETURN COALESCE(v_count, 0);
END $$;


-- ─── 10. Compute both market conditions ───────────────────────────
CREATE OR REPLACE FUNCTION public.compute_market_conditions(
  p_project_id UUID, p_date DATE
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD;
  v_total_holders INTEGER; v_pairs INTEGER;
  v_pair_ratio NUMERIC; v_c1_score NUMERIC;
  v_non_sellers INTEGER; v_hold_ratio NUMERIC; v_hold_score NUMERIC;
  v_buy NUMERIC; v_sell NUMERIC;
  v_imbalance NUMERIC; v_balance_score NUMERIC; v_c2_score NUMERIC;
BEGIN
  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  SELECT COUNT(DISTINCT user_id) INTO v_total_holders
    FROM holdings WHERE project_id = p_project_id AND shares > 0;
  v_total_holders := GREATEST(1, COALESCE(v_total_holders, 0));

  v_pairs := public.count_distinct_qualified_pairs(p_project_id, p_date);
  v_pair_ratio := v_pairs::NUMERIC / v_total_holders;
  v_c1_score := LEAST(1, v_pair_ratio / NULLIF(v_settings.c1_target_pair_ratio, 0));

  -- Holders who haven't sold in the last 3 days.
  SELECT COUNT(DISTINCT h.user_id) INTO v_non_sellers
    FROM holdings h
   WHERE h.project_id = p_project_id AND h.shares > 0
     AND NOT EXISTS(
       SELECT 1 FROM deals d
        WHERE d.project_id = p_project_id AND d.seller_id = h.user_id
          AND d.completed_at >= p_date - INTERVAL '3 days'
          AND d.status = 'completed'
     );
  v_hold_ratio := v_non_sellers::NUMERIC / v_total_holders;
  v_hold_score := LEAST(1, v_hold_ratio / NULLIF(v_settings.c2_target_hold_ratio, 0));

  -- Buy/sell volume balance — ignore quick-sell listings.
  -- Pre-Phase-10 listings tables don't have `type`; fall back to all listings.
  BEGIN
    EXECUTE $sql$
      SELECT COALESCE(SUM(CASE WHEN type = 'buy' THEN shares_offered - COALESCE(shares_sold,0) ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN type = 'sell' THEN shares_offered - COALESCE(shares_sold,0) ELSE 0 END), 0)
        FROM listings
       WHERE project_id = $1 AND status = 'active'
         AND COALESCE(is_quick_sell, FALSE) = FALSE
    $sql$ INTO v_buy, v_sell USING p_project_id;
  EXCEPTION WHEN undefined_column THEN
    SELECT 0, COALESCE(SUM(shares_offered - COALESCE(shares_sold,0)), 0)
      INTO v_buy, v_sell
      FROM listings
     WHERE project_id = p_project_id AND status = 'active'
       AND COALESCE(is_quick_sell, FALSE) = FALSE;
  END;

  IF COALESCE(v_buy,0) + COALESCE(v_sell,0) > 0 THEN
    v_imbalance := ABS(v_buy - v_sell) / (v_buy + v_sell);
    v_balance_score := GREATEST(0, 1 - v_imbalance);
  ELSE
    v_balance_score := 0;
  END IF;

  v_c2_score := (COALESCE(v_hold_score,0) + COALESCE(v_balance_score,0)) / 2;

  RETURN jsonb_build_object(
    'total_holders', v_total_holders,
    'distinct_pairs', v_pairs,
    'pair_ratio', ROUND(COALESCE(v_pair_ratio,0)::NUMERIC, 4),
    'c1_score', ROUND(COALESCE(v_c1_score,0)::NUMERIC, 4),
    'hold_score', ROUND(COALESCE(v_hold_score,0)::NUMERIC, 4),
    'balance_score', ROUND(COALESCE(v_balance_score,0)::NUMERIC, 4),
    'c2_score', ROUND(COALESCE(v_c2_score,0)::NUMERIC, 4)
  );
END $$;


-- ─── 11. Apply initial-mode rise (per-trade, capped) ──────────────
CREATE OR REPLACE FUNCTION public.apply_initial_mode_rise(p_project_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD; v_today_rises INTEGER;
  v_monthly NUMERIC; v_cap NUMERIC; v_rise NUMERIC; v_old_price NUMERIC;
BEGIN
  IF public.is_project_frozen(p_project_id) THEN RETURN 0; END IF;
  IF public.get_engine_mode(p_project_id) <> 'initial' THEN RETURN 0; END IF;

  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  SELECT COUNT(*) INTO v_today_rises FROM market_engine_log
   WHERE project_id = p_project_id AND date = CURRENT_DATE AND daily_rise > 0;
  IF v_today_rises >= v_settings.initial_max_trades_per_day THEN RETURN 0; END IF;

  v_monthly := public.get_monthly_accumulated(p_project_id);
  v_cap := public.get_monthly_cap(p_project_id);
  IF v_monthly >= v_cap THEN RETURN 0; END IF;

  v_rise := v_settings.initial_rise_per_trade;
  IF v_monthly + v_rise > v_cap THEN v_rise := GREATEST(0, v_cap - v_monthly); END IF;
  IF v_rise <= 0 THEN RETURN 0; END IF;

  SELECT current_market_price INTO v_old_price FROM projects WHERE id = p_project_id;
  IF v_old_price IS NULL OR v_old_price = 0 THEN
    SELECT share_price INTO v_old_price FROM projects WHERE id = p_project_id;
  END IF;

  UPDATE projects
     SET current_market_price = ROUND(v_old_price * (1 + v_rise)),
         updated_at = NOW()
   WHERE id = p_project_id;

  INSERT INTO market_engine_log(project_id, date, engine_mode,
    trades_count_today, daily_rise, monthly_accumulated, monthly_cap)
  VALUES (p_project_id, CURRENT_DATE, 'initial',
    v_today_rises + 1, v_rise, v_monthly + v_rise, v_cap)
  ON CONFLICT (project_id, date) DO UPDATE SET
    trades_count_today = market_engine_log.trades_count_today + 1,
    daily_rise = market_engine_log.daily_rise + v_rise,
    monthly_accumulated = v_monthly + v_rise;

  RETURN v_rise;
END $$;


-- ─── 12. Apply permanent-mode rise (daily, two conditions) ────────
CREATE OR REPLACE FUNCTION public.apply_permanent_mode_rise(p_project_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD; v_conditions JSONB;
  v_c1_rise NUMERIC; v_c2_rise NUMERIC; v_total_rise NUMERIC;
  v_monthly NUMERIC; v_cap NUMERIC; v_old_price NUMERIC;
BEGIN
  IF public.is_project_frozen(p_project_id) THEN
    INSERT INTO market_engine_log(project_id, date, engine_mode, is_frozen, daily_rise)
    VALUES (p_project_id, CURRENT_DATE, 'frozen', TRUE, 0)
    ON CONFLICT (project_id, date) DO UPDATE SET is_frozen = TRUE, engine_mode = 'frozen';
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  v_conditions := public.compute_market_conditions(p_project_id, CURRENT_DATE);
  v_c1_rise := COALESCE((v_conditions->>'c1_score')::NUMERIC, 0) * v_settings.c1_max_rise;
  v_c2_rise := COALESCE((v_conditions->>'c2_score')::NUMERIC, 0) * v_settings.c2_max_rise;
  v_total_rise := v_c1_rise + v_c2_rise;
  v_total_rise := LEAST(v_total_rise, v_settings.daily_cap);

  v_monthly := public.get_monthly_accumulated(p_project_id);
  v_cap := public.get_monthly_cap(p_project_id);
  IF v_monthly + v_total_rise > v_cap THEN
    v_total_rise := GREATEST(0, v_cap - v_monthly);
  END IF;

  IF v_total_rise > 0 THEN
    SELECT current_market_price INTO v_old_price FROM projects WHERE id = p_project_id;
    IF v_old_price IS NULL OR v_old_price = 0 THEN
      SELECT share_price INTO v_old_price FROM projects WHERE id = p_project_id;
    END IF;
    UPDATE projects
       SET current_market_price = ROUND(v_old_price * (1 + v_total_rise)),
           updated_at = NOW()
     WHERE id = p_project_id;
  END IF;

  INSERT INTO market_engine_log(project_id, date, engine_mode,
    condition1_score, condition2_hold_score, condition2_balance_score, condition2_score,
    distinct_pairs_today, total_holders, daily_rise, monthly_accumulated, monthly_cap)
  VALUES (p_project_id, CURRENT_DATE, 'permanent',
    (v_conditions->>'c1_score')::NUMERIC,
    (v_conditions->>'hold_score')::NUMERIC,
    (v_conditions->>'balance_score')::NUMERIC,
    (v_conditions->>'c2_score')::NUMERIC,
    (v_conditions->>'distinct_pairs')::INTEGER,
    (v_conditions->>'total_holders')::INTEGER,
    v_total_rise, v_monthly + v_total_rise, v_cap)
  ON CONFLICT (project_id, date) DO UPDATE SET
    condition1_score = EXCLUDED.condition1_score,
    condition2_hold_score = EXCLUDED.condition2_hold_score,
    condition2_balance_score = EXCLUDED.condition2_balance_score,
    condition2_score = EXCLUDED.condition2_score,
    distinct_pairs_today = EXCLUDED.distinct_pairs_today,
    total_holders = EXCLUDED.total_holders,
    daily_rise = EXCLUDED.daily_rise,
    monthly_accumulated = EXCLUDED.monthly_accumulated;
END $$;


-- ─── 13. Daily engine run (cron) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_daily_market_engine()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_p IN SELECT id FROM projects WHERE status = 'active' LOOP
    IF public.get_engine_mode(v_p.id) = 'permanent' THEN
      PERFORM public.apply_permanent_mode_rise(v_p.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('processed', v_count, 'date', CURRENT_DATE);
END $$;


-- ─── 14. Determine transfer category (with mutual-pattern penalty) ─
CREATE OR REPLACE FUNCTION public.determine_transfer_category(
  p_sender_id UUID, p_recipient_id UUID
) RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings RECORD; v_count INTEGER; v_week_start DATE; v_has_mutual BOOLEAN;
BEGIN
  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  -- Mutual-pattern penalty: if recipient has sent to sender within window,
  -- apply tier-3 (regardless of weekly count).
  SELECT EXISTS(
    SELECT 1 FROM share_transfers
     WHERE sender_id = p_recipient_id AND recipient_id = p_sender_id
       AND created_at >= NOW() - (v_settings.mutual_transfer_window_days || ' days')::INTERVAL
  ) INTO v_has_mutual;
  IF v_has_mutual THEN RETURN 'transfer_third'; END IF;

  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  SELECT COALESCE(transfers_count, 0) INTO v_count
    FROM weekly_transfer_counter
   WHERE user_id = p_sender_id AND week_start_date = v_week_start;

  RETURN CASE
    WHEN COALESCE(v_count,0) = 0 THEN 'transfer_first'
    WHEN v_count = 1 THEN 'transfer_second'
    ELSE 'transfer_third'
  END;
END $$;


-- ─── 15. Execute share transfer (uses get_commission_rate dynamic) ─
CREATE OR REPLACE FUNCTION public.execute_share_transfer(
  p_sender_id UUID, p_recipient_id UUID, p_project_id UUID,
  p_shares INTEGER, p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_settings RECORD; v_market_price NUMERIC; v_market_value NUMERIC;
  v_category TEXT; v_commission_rate NUMERIC; v_commission_amount NUMERIC;
  v_sender_shares INTEGER; v_fee_balance NUMERIC;
  v_week_start DATE; v_count INTEGER; v_transfer_id UUID;
  v_sender_kyc TEXT; v_recipient_kyc TEXT;
BEGIN
  IF p_sender_id = p_recipient_id THEN RAISE EXCEPTION 'cannot_transfer_to_self'; END IF;

  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  -- KYC requirement — check profiles.kyc_status enum.
  SELECT kyc_status::TEXT INTO v_sender_kyc FROM profiles WHERE id = p_sender_id;
  SELECT kyc_status::TEXT INTO v_recipient_kyc FROM profiles WHERE id = p_recipient_id;
  IF v_sender_kyc <> 'approved' OR v_recipient_kyc <> 'approved' THEN
    RAISE EXCEPTION 'kyc_required_for_transfer';
  END IF;

  -- Market price (live).
  SELECT COALESCE(current_market_price, share_price) INTO v_market_price
    FROM projects WHERE id = p_project_id;
  v_market_value := v_market_price * p_shares;

  -- Determine tier and read its commission DYNAMICALLY.
  v_category := public.determine_transfer_category(p_sender_id, p_recipient_id);
  v_commission_rate := public.get_commission_rate(v_category);

  -- Free-tier value cap: bump to tier-2 if exceeded.
  IF v_category = 'transfer_first' AND v_market_value > v_settings.free_transfer_max_value THEN
    v_category := 'transfer_second';
    v_commission_rate := public.get_commission_rate('transfer_second');
  END IF;

  v_commission_amount := ROUND(v_market_value * v_commission_rate);

  -- Sender share check.
  SELECT shares INTO v_sender_shares FROM holdings
   WHERE user_id = p_sender_id AND project_id = p_project_id FOR UPDATE;
  IF COALESCE(v_sender_shares, 0) < p_shares THEN
    RAISE EXCEPTION 'insufficient_shares';
  END IF;

  -- Fee deduction (RailOS unit = 1 IQD).
  IF v_commission_amount > 0 THEN
    SELECT balance INTO v_fee_balance FROM fee_unit_balances WHERE user_id = p_sender_id;
    IF COALESCE(v_fee_balance, 0) < v_commission_amount THEN
      RAISE EXCEPTION 'insufficient_fee_units';
    END IF;
    UPDATE fee_unit_balances
       SET balance = balance - v_commission_amount,
           total_withdrawn = COALESCE(total_withdrawn,0) + v_commission_amount,
           last_transaction_at = NOW(), updated_at = NOW()
     WHERE user_id = p_sender_id;
    -- Ledger entry
    BEGIN
      INSERT INTO fee_unit_transactions(user_id, transaction_type, amount, balance_after,
        source_type, description, executed_by)
      VALUES (p_sender_id, 'withdrawal', v_commission_amount,
        COALESCE(v_fee_balance,0) - v_commission_amount,
        'transfer', 'عمولة إرسال — ' || v_category, p_sender_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Counter
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  INSERT INTO weekly_transfer_counter(user_id, week_start_date, transfers_count)
  VALUES (p_sender_id, v_week_start, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET transfers_count = CASE
        WHEN weekly_transfer_counter.week_start_date = v_week_start
          THEN weekly_transfer_counter.transfers_count + 1
        ELSE 1
      END,
      week_start_date = v_week_start, updated_at = NOW();
  SELECT transfers_count INTO v_count FROM weekly_transfer_counter WHERE user_id = p_sender_id;

  -- Move shares
  UPDATE holdings SET shares = shares - p_shares, updated_at = NOW()
   WHERE user_id = p_sender_id AND project_id = p_project_id;

  INSERT INTO holdings(user_id, project_id, shares, last_acquired_at)
  VALUES (p_recipient_id, p_project_id, p_shares, NOW())
  ON CONFLICT (user_id, project_id) DO UPDATE
  SET shares = holdings.shares + p_shares, last_acquired_at = NOW(), updated_at = NOW();

  -- Record transfer + lineage
  INSERT INTO share_transfers(sender_id, recipient_id, project_id, shares_count,
    market_value, commission_type, commission_rate, commission_amount,
    transfer_number_in_week, week_start_date, is_mutual_pattern_penalty, notes)
  VALUES (p_sender_id, p_recipient_id, p_project_id, p_shares,
    v_market_value, v_category, v_commission_rate, v_commission_amount,
    v_count, v_week_start, v_has_mutual, p_notes)
  RETURNING id INTO v_transfer_id;

  INSERT INTO share_lineage(project_id, from_user_id, to_user_id, shares_count, source_type, source_id)
  VALUES (p_project_id, p_sender_id, p_recipient_id, p_shares, 'transfer', v_transfer_id);

  RETURN v_transfer_id;
END $$;


-- ─── 16. Admin: freeze project ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_freeze_project(
  p_project_id UUID, p_reason TEXT, p_end_date DATE DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  INSERT INTO market_manual_freezes(project_id, freeze_reason, freeze_end_date, triggered_by_user_id)
  VALUES (p_project_id, p_reason, p_end_date, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO admin_market_decisions(admin_id, decision_type, decision_target, rationale, after_state)
  VALUES (auth.uid(), 'freeze_project', p_project_id::TEXT, p_reason,
    jsonb_build_object('reason', p_reason, 'end_date', p_end_date));
  RETURN v_id;
END $$;


-- ─── 17. Admin: unfreeze project ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unfreeze_project(p_project_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE market_manual_freezes
     SET resolved_at = NOW(), resolved_by = auth.uid(), resolution_notes = p_notes
   WHERE project_id = p_project_id AND resolved_at IS NULL;
  INSERT INTO admin_market_decisions(admin_id, decision_type, decision_target, rationale)
  VALUES (auth.uid(), 'unfreeze_project', p_project_id::TEXT, p_notes);
  RETURN TRUE;
END $$;


-- ─── 18. Admin: switch engine mode ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_switch_engine_mode(p_new_mode TEXT, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_new_mode NOT IN ('initial','permanent') THEN RAISE EXCEPTION 'invalid_mode'; END IF;
  UPDATE market_engine_settings
     SET engine_mode = p_new_mode, changed_at = NOW(),
         changed_by = auth.uid(), notes = p_notes
   WHERE scope = 'global' AND project_id IS NULL;
  IF NOT FOUND THEN
    INSERT INTO market_engine_settings(scope, engine_mode, changed_by, notes)
    VALUES ('global', p_new_mode, auth.uid(), p_notes);
  END IF;
  INSERT INTO admin_market_decisions(admin_id, decision_type, decision_target, after_state, rationale)
  VALUES (auth.uid(), 'switch_engine_mode', 'global',
    jsonb_build_object('new_mode', p_new_mode), p_notes);
  RETURN TRUE;
END $$;


-- ─── 19. Admin: update sector cap ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_sector_cap(
  p_sector TEXT, p_new_cap NUMERIC, p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_new_cap < 0 OR p_new_cap > 1 THEN RAISE EXCEPTION 'cap_out_of_range'; END IF;
  SELECT monthly_cap_percent INTO v_old FROM market_sector_caps WHERE sector = p_sector;
  UPDATE market_sector_caps
     SET monthly_cap_percent = p_new_cap, changed_at = NOW(), changed_by = auth.uid()
   WHERE sector = p_sector;
  INSERT INTO admin_market_decisions(admin_id, decision_type, decision_target,
    before_state, after_state, rationale)
  VALUES (auth.uid(), 'update_sector_cap', p_sector,
    jsonb_build_object('cap', v_old), jsonb_build_object('cap', p_new_cap), p_notes);
  RETURN TRUE;
END $$;


-- ─── Grants ───────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_commission_rate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_engine_mode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_cap(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_accumulated(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_frozen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_market_conditions(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.determine_transfer_category(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_share_transfer(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_commission(TEXT, BOOLEAN, NUMERIC, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_freeze_project(UUID, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_project(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_switch_engine_mode(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_sector_cap(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_market_engine() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 functions migration applied:';
  RAISE NOTICE '  ✓ 19 functions created (get_commission_rate is the new core)';
  RAISE NOTICE '  ✓ Auto-restore of paused commissions wired via get_commission_rate';
  RAISE NOTICE '  ✓ All admin RPCs gated with is_admin() + decision log';
  RAISE NOTICE '  ✓ Schema-tolerant: handles either projects.sector or project_type';
  RAISE NOTICE 'Next: apply ..._phase12_market_engine_triggers.sql';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
