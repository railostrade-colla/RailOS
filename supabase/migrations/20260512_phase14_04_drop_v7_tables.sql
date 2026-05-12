-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.04 — DROP 7 V7 tables (atomic with execute_share_transfer fix)
-- Date: 2026-05-12
-- Idempotent. Single transaction.
--
-- Founder approved: drop the 7 V7 legacy tables. All data is already
-- archived in v7_archive (Migration 14.01).
--
-- ⚠ Critical: market_engine_settings is read by execute_share_transfer
--   (Phase 13.39) for `free_transfer_max_value`. Founder confirmed
--   the table is EMPTY → no value to migrate. The function's existing
--   guard `IF v_settings IS NOT NULL AND ...` already skips when the
--   table is empty, so removing the SELECT is a behaviour-preserving
--   change.
--
--   Without that fix, DROP TABLE market_engine_settings would break
--   every P2P transfer with `relation "market_engine_settings" does
--   not exist`. We rewrite the function FIRST in the same transaction,
--   then DROP the table — atomic.
--
-- Tables dropped (all CASCADE-safe — verified no FKs from active
-- tables):
--   1. account_trust_score        (0 rows)
--   2. admin_decisions_log        (3 rows — archived)
--   3. market_engine_log          (2 rows — archived)
--   4. market_engine_settings     (0 rows — schema archived)
--   5. railos_dividend_distributions (0 rows — schema archived)
--   6. railos_eligibility_tracking  (0 rows — schema archived)
--   7. user_activity_scores       (0 rows — schema archived)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── PART 1: Rewrite execute_share_transfer to drop the dependency
-- on market_engine_settings (the ONLY current consumer).
--
-- Changes from Phase 13.39:
--   • Remove v_settings RECORD declaration
--   • Remove SELECT INTO v_settings (was lines 43-44)
--   • Remove the conditional tier upgrade (was lines 64-68) — since
--     the table was always empty, this branch never fired anyway.
-- Everything else (KYC checks, commission, holdings move, mutual
-- pattern flag, audit inserts) is byte-identical to Phase 13.39.

CREATE OR REPLACE FUNCTION public.execute_share_transfer(
  p_sender_id UUID, p_recipient_id UUID, p_project_id UUID,
  p_shares INTEGER, p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_market_price NUMERIC; v_market_value NUMERIC;
  v_category TEXT; v_commission_rate NUMERIC; v_commission_amount NUMERIC;
  v_sender_shares INTEGER; v_fee_balance NUMERIC;
  v_week_start DATE; v_count INTEGER; v_transfer_id UUID;
  v_sender_kyc TEXT; v_recipient_kyc TEXT;
  v_has_mutual BOOLEAN := FALSE;
  v_recipient_existing_shares INTEGER;
  v_recipient_existing_avg NUMERIC;
BEGIN
  IF p_sender_id = p_recipient_id THEN RAISE EXCEPTION 'cannot_transfer_to_self'; END IF;

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
    v_market_price := 1;
  END IF;
  v_market_value := v_market_price * p_shares;

  -- Determine tier and commission.
  -- Phase 14.04 — removed the market_engine_settings-based tier
  -- upgrade. The original branch never fired (table was always empty).
  v_category := public.determine_transfer_category(p_sender_id, p_recipient_id);
  v_commission_rate := public.get_commission_rate(v_category);
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

  -- Counter.
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

  -- Move shares — sender side.
  UPDATE holdings
     SET shares = shares - p_shares,
         updated_at = NOW()
   WHERE user_id = p_sender_id AND project_id = p_project_id;

  -- Recipient side (weighted-average cost basis if existing holding).
  SELECT shares, average_buy_price
    INTO v_recipient_existing_shares, v_recipient_existing_avg
    FROM holdings
   WHERE user_id = p_recipient_id AND project_id = p_project_id
   FOR UPDATE;

  IF v_recipient_existing_shares IS NULL THEN
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

  -- Mutual-pattern flag.
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


-- ─── PART 2: DROP the 7 V7 tables ─────────────────────────────
-- All data archived in v7_archive (Migration 14.01). CASCADE handles
-- any residual FKs from already-deleted V7 functions.

DROP TABLE IF EXISTS public.account_trust_score          CASCADE;
DROP TABLE IF EXISTS public.admin_decisions_log          CASCADE;
DROP TABLE IF EXISTS public.market_engine_log            CASCADE;
DROP TABLE IF EXISTS public.market_engine_settings       CASCADE;
DROP TABLE IF EXISTS public.railos_dividend_distributions CASCADE;
DROP TABLE IF EXISTS public.railos_eligibility_tracking  CASCADE;
DROP TABLE IF EXISTS public.user_activity_scores         CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.04 V7 table cleanup complete.';
  RAISE NOTICE '  ✓ execute_share_transfer rewired (no more';
  RAISE NOTICE '    market_engine_settings dependency)';
  RAISE NOTICE '  ✓ 7 V7 tables DROPPED CASCADE';
  RAISE NOTICE '  ✓ All data preserved in v7_archive schema';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: Migration 5 — UI update for RaiseMarketPricePanel.tsx';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
