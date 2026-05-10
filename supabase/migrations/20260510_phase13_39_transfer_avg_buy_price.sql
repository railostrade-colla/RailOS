-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.39 — fix execute_share_transfer recipient holding insert
-- Date: 2026-05-10
-- Idempotent.
--
-- Bug: when the recipient doesn't already hold this project, the
-- INSERT into `holdings` only sets (user_id, project_id, shares,
-- last_acquired_at). But the table has NOT NULL on
-- `average_buy_price` (and likely `total_invested`), so the insert
-- fails:
--   "null value in column average_buy_price of relation holdings
--    violates not-null constraint"
-- and the whole transfer transaction rolls back. Sender keeps the
-- shares; recipient never gets them.
--
-- Fix: at the moment of INSERT, set the recipient's cost basis to
-- the live market_price (so future P&L uses a sensible anchor).
-- For the UPDATE branch (recipient already has shares), recompute
-- average_buy_price using a weighted average of existing shares
-- × existing avg + transferred shares × market_price.
-- total_invested is bumped by market_value of the transferred
-- block.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_share_transfer(
  p_sender_id UUID, p_recipient_id UUID, p_project_id UUID,
  p_shares INTEGER, p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_settings RECORD; v_market_price NUMERIC; v_market_value NUMERIC;
  v_category TEXT; v_commission_rate NUMERIC; v_commission_amount NUMERIC;
  v_sender_shares INTEGER; v_fee_balance NUMERIC;
  v_week_start DATE; v_count INTEGER; v_transfer_id UUID;
  v_sender_kyc TEXT; v_recipient_kyc TEXT;
  v_has_mutual BOOLEAN := FALSE;
  v_recipient_existing_shares INTEGER;
  v_recipient_existing_avg NUMERIC;
BEGIN
  IF p_sender_id = p_recipient_id THEN RAISE EXCEPTION 'cannot_transfer_to_self'; END IF;

  SELECT * INTO v_settings FROM market_engine_settings
   WHERE scope = 'global' ORDER BY changed_at DESC LIMIT 1;

  -- KYC requirement.
  SELECT kyc_status::TEXT INTO v_sender_kyc FROM profiles WHERE id = p_sender_id;
  SELECT kyc_status::TEXT INTO v_recipient_kyc FROM profiles WHERE id = p_recipient_id;
  IF v_sender_kyc <> 'approved' OR v_recipient_kyc <> 'approved' THEN
    RAISE EXCEPTION 'kyc_required_for_transfer';
  END IF;

  -- Live market price (NEVER NULL — falls back to share_price).
  SELECT COALESCE(current_market_price, share_price, 0) INTO v_market_price
    FROM projects WHERE id = p_project_id;
  IF v_market_price IS NULL OR v_market_price <= 0 THEN
    v_market_price := 1;  -- last-ditch fallback so the NOT NULL passes
  END IF;
  v_market_value := v_market_price * p_shares;

  -- Determine tier and commission.
  v_category := public.determine_transfer_category(p_sender_id, p_recipient_id);
  v_commission_rate := public.get_commission_rate(v_category);
  IF v_category = 'transfer_first' AND v_settings IS NOT NULL
     AND v_market_value > v_settings.free_transfer_max_value THEN
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

  -- Fee deduction.
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

  -- Move shares — sender side
  UPDATE holdings
     SET shares = shares - p_shares,
         updated_at = NOW()
   WHERE user_id = p_sender_id AND project_id = p_project_id;

  -- Phase 13.39 — recipient side. Read existing holding (if any)
  -- so we can recompute the weighted avg_buy_price properly. The
  -- INSERT path now ALWAYS provides avg_buy_price + total_invested
  -- to satisfy the NOT NULL constraints.
  SELECT shares, average_buy_price
    INTO v_recipient_existing_shares, v_recipient_existing_avg
    FROM holdings
   WHERE user_id = p_recipient_id AND project_id = p_project_id
   FOR UPDATE;

  IF v_recipient_existing_shares IS NULL THEN
    -- New row.
    INSERT INTO holdings(
      user_id, project_id, shares,
      average_buy_price, total_invested,
      last_acquired_at
    )
    VALUES (
      p_recipient_id, p_project_id, p_shares,
      v_market_price, v_market_value,
      NOW()
    );
  ELSE
    -- Existing row — weighted-average the cost basis.
    DECLARE
      v_new_total_shares INTEGER := v_recipient_existing_shares + p_shares;
      v_new_avg NUMERIC;
    BEGIN
      v_new_avg := (
        (v_recipient_existing_shares * COALESCE(v_recipient_existing_avg, v_market_price))
        + (p_shares * v_market_price)
      ) / NULLIF(v_new_total_shares, 0);
      UPDATE holdings
         SET shares = v_new_total_shares,
             average_buy_price = COALESCE(v_new_avg, v_market_price),
             total_invested = COALESCE(total_invested, 0) + v_market_value,
             last_acquired_at = NOW(),
             updated_at = NOW()
       WHERE user_id = p_recipient_id AND project_id = p_project_id;
    END;
  END IF;

  -- Mutual-pattern flag (Phase 13.35).
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM share_transfers st
       WHERE st.sender_id = p_recipient_id
         AND st.recipient_id = p_sender_id
         AND st.created_at > NOW() - INTERVAL '7 days'
    ) INTO v_has_mutual;
  EXCEPTION WHEN OTHERS THEN
    v_has_mutual := FALSE;
  END;

  -- Audit rows.
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

GRANT EXECUTE ON FUNCTION public.execute_share_transfer(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.39 transfer NOT NULL hotfix applied.';
  RAISE NOTICE '  ✓ recipient INSERT now sets avg_buy_price + total_invested';
  RAISE NOTICE '  ✓ existing-row UPDATE uses weighted-average cost basis';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
