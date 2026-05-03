-- ═══════════════════════════════════════════════════════════════════
-- Fee-units admin: queue access + approval RPCs (Phase BB)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two pieces:
--   1. Admin-side RLS additions for fee_unit_requests / _balances /
--      _transactions so the FeeUnitsRequestsPanel can read the queue
--      and audit related rows.
--   2. SECURITY DEFINER RPCs `admin_approve_fee_request` +
--      `admin_reject_fee_request` that wrap the multi-table approval
--      flow atomically — credit the balance, append the transaction
--      ledger row, mark the request reviewed — all in one round-trip.
--
-- Why an RPC instead of three client calls:
--   • Atomicity: a half-failed approval (request marked but balance
--     not credited) would corrupt the ledger. Wrapping in a function
--     gives us a single transaction.
--   • Trigger interplay: the existing handle_updated_at + similar
--     triggers fire deterministically inside the function.
--   • Admin gate: SECURITY DEFINER + an in-body is_admin() check
--     means only admins can call it, even with relaxed RLS.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1) Admin SELECT on all 3 tables ─────────────────────────
DROP POLICY IF EXISTS "Admins can read all fee requests"
  ON public.fee_unit_requests;
CREATE POLICY "Admins can read all fee requests"
ON public.fee_unit_requests
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all fee balances"
  ON public.fee_unit_balances;
CREATE POLICY "Admins can read all fee balances"
ON public.fee_unit_balances
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all fee transactions"
  ON public.fee_unit_transactions;
CREATE POLICY "Admins can read all fee transactions"
ON public.fee_unit_transactions
FOR SELECT
USING (public.is_admin());

-- ─── 2) RPC: admin_approve_fee_request ───────────────────────
-- Atomically:
--   • Marks the request approved, sets amount_approved + reviewer.
--   • UPSERTs the user's fee_unit_balances row, crediting `balance`
--     and bumping `total_deposited`.
--   • Appends a `deposit` transaction with `balance_after` so the
--     ledger stays consistent.
CREATE OR REPLACE FUNCTION public.admin_approve_fee_request(
  p_request_id UUID,
  p_amount_approved BIGINT DEFAULT NULL,  -- null → use amount_requested
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_amount BIGINT;
  v_new_balance BIGINT;
  v_admin_id UUID := auth.uid();
BEGIN
  -- Admin gate (defense-in-depth on top of GRANT EXECUTE).
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Lock the request row to prevent double-processing under
  -- concurrent admin clicks.
  SELECT *
    INTO v_request
    FROM public.fee_unit_requests
    WHERE id = p_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'not_pending',
      'current_status', v_request.status
    );
  END IF;

  v_amount := COALESCE(p_amount_approved, v_request.amount_requested);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- Mark the request approved.
  UPDATE public.fee_unit_requests
     SET status = 'approved',
         amount_approved = v_amount,
         admin_notes = COALESCE(p_admin_notes, admin_notes),
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE id = p_request_id;

  -- UPSERT the balances row, returning the new balance.
  INSERT INTO public.fee_unit_balances (user_id, balance, total_deposited, last_transaction_at)
  VALUES (v_request.user_id, v_amount, v_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.fee_unit_balances.balance + v_amount,
        total_deposited = public.fee_unit_balances.total_deposited + v_amount,
        last_transaction_at = NOW()
  RETURNING balance INTO v_new_balance;

  -- Append the audit-trail transaction.
  INSERT INTO public.fee_unit_transactions (
    user_id, transaction_type, amount, balance_after,
    source_type, source_id, description, executed_by
  )
  VALUES (
    v_request.user_id, 'deposit', v_amount, v_new_balance,
    'request', p_request_id,
    'موافقة طلب شحن وحدات الرسوم', v_admin_id
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'amount_credited', v_amount,
    'new_balance', v_new_balance
  );
END;
$$;

COMMENT ON FUNCTION public.admin_approve_fee_request(UUID, BIGINT, TEXT) IS
  'Atomic approval: marks the fee_unit_request approved + credits the '
  'user balance + appends a deposit transaction. Admin-only.';

GRANT EXECUTE ON FUNCTION public.admin_approve_fee_request(UUID, BIGINT, TEXT)
  TO authenticated;

-- ─── 3) RPC: admin_reject_fee_request ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reject_fee_request(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_status fee_unit_request_status;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reason_required');
  END IF;

  SELECT status INTO v_status
    FROM public.fee_unit_requests
    WHERE id = p_request_id
    FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'not_pending',
      'current_status', v_status
    );
  END IF;

  UPDATE public.fee_unit_requests
     SET status = 'rejected',
         rejection_reason = p_reason,
         reviewed_by = v_admin_id,
         reviewed_at = NOW()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

COMMENT ON FUNCTION public.admin_reject_fee_request(UUID, TEXT) IS
  'Marks the fee_unit_request rejected with a reason. Admin-only. '
  'No balance change.';

GRANT EXECUTE ON FUNCTION public.admin_reject_fee_request(UUID, TEXT)
  TO authenticated;
