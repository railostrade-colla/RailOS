-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.35 — fix execute_share_transfer (undefined v_has_mutual)
-- Date: 2026-05-10
-- Idempotent.
--
-- Bug: the original execute_share_transfer in
-- 20260509_phase12_market_engine_functions.sql writes
-- `v_has_mutual` into the share_transfers row but never DECLAREs
-- the variable. Anyone who reaches the INSERT statement gets
-- `column "v_has_mutual" does not exist` and the whole transfer
-- aborts — shares stay with the sender, recipient never gets them.
--
-- This migration replaces the function with the same body plus:
--   • DECLAREs v_has_mutual
--   • Computes it via a sub-select right before the INSERT
-- Everything else (KYC check, commission, holdings move, lineage)
-- is preserved bit-for-bit.
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
  v_has_mutual BOOLEAN := FALSE;   -- Phase 13.35 fix
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

  -- Move shares — atomic
  UPDATE holdings SET shares = shares - p_shares, updated_at = NOW()
   WHERE user_id = p_sender_id AND project_id = p_project_id;

  INSERT INTO holdings(user_id, project_id, shares, last_acquired_at)
  VALUES (p_recipient_id, p_project_id, p_shares, NOW())
  ON CONFLICT (user_id, project_id) DO UPDATE
  SET shares = holdings.shares + p_shares, last_acquired_at = NOW(), updated_at = NOW();

  -- Phase 13.35 — compute mutual-pattern flag here so the INSERT
  -- doesn't reference an undefined variable.
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

GRANT EXECUTE ON FUNCTION public.execute_share_transfer(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.35 execute_share_transfer hotfix applied.';
  RAISE NOTICE '  ✓ v_has_mutual now declared + computed before INSERT';
  RAISE NOTICE '  ✓ Existing logic preserved bit-for-bit';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
