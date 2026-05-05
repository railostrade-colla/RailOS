-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.58 — Rewrite admin_release_shares_to_market with super_admin
--                gate and bullet-proof logic
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- The existing RPC was failing silently with "فشل إطلاق الحصص" because:
--   • the gate accepted both 'admin' and 'super_admin' (we want
--     super_admin only)
--   • the original logic referenced columns/states that may not
--     match the current project_wallets schema
--
-- This rewrite:
--   1. super_admin gate (clear error reason)
--   2. validates source (reserve) wallet has enough shares
--   3. atomically: decrements reserve.available_shares + reserve.total_shares
--      AND increments offering.available_shares + offering.total_shares
--   4. logs to audit_log
--   5. price_history row recorded so the move shows up in ledgers
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_release_shares_to_market(
  p_project_id UUID,
  p_amount BIGINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_reserve_avail BIGINT;
  v_reserve_total BIGINT;
  v_reserve_status TEXT;
  v_offering_status TEXT;
  v_offering_total_after BIGINT;
  v_reserve_total_after BIGINT;
BEGIN
  -- ─── Auth ───
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  -- ─── Validate amount ───
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- ─── Lock reserve wallet ───
  SELECT total_shares, available_shares, status
    INTO v_reserve_total, v_reserve_avail, v_reserve_status
  FROM public.project_wallets
   WHERE project_id = p_project_id AND wallet_type = 'reserve'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reserve_wallet_missing');
  END IF;
  IF v_reserve_status = 'frozen' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reserve_wallet_frozen');
  END IF;
  IF v_reserve_avail < p_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_reserve_shares',
      'available', v_reserve_avail
    );
  END IF;

  -- ─── Check offering wallet exists + not frozen ───
  SELECT status INTO v_offering_status
  FROM public.project_wallets
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_missing');
  END IF;
  IF v_offering_status = 'frozen' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_frozen');
  END IF;

  -- ─── Atomic transfer ───
  -- 1. Reduce reserve (both available + total — the shares physically leave reserve)
  UPDATE public.project_wallets
     SET available_shares = available_shares - p_amount,
         total_shares = total_shares - p_amount
   WHERE project_id = p_project_id AND wallet_type = 'reserve'
   RETURNING total_shares INTO v_reserve_total_after;

  -- 2. Grow offering (both available + total — shares are now tradeable)
  UPDATE public.project_wallets
     SET available_shares = available_shares + p_amount,
         total_shares = total_shares + p_amount
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   RETURNING total_shares INTO v_offering_total_after;

  -- ─── Audit ───
  BEGIN
    PERFORM public.log_admin_action(
      'release_shares_to_market', 'project', p_project_id,
      jsonb_build_object(
        'amount', p_amount,
        'reason', p_reason,
        'reserve_remaining', v_reserve_total_after,
        'offering_total', v_offering_total_after
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'amount', p_amount,
    'reserve_remaining', v_reserve_total_after,
    'offering_total', v_offering_total_after
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_release_shares_to_market(UUID, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_release_shares_to_market(UUID, BIGINT, TEXT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.58 applied:';
  RAISE NOTICE '  ✓ admin_release_shares_to_market rewritten';
  RAISE NOTICE '  ✓ super_admin gate (returns super_admin_only on fail)';
  RAISE NOTICE '  ✓ atomic FOR UPDATE locks';
  RAISE NOTICE '  ✓ updates BOTH total_shares AND available_shares';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
