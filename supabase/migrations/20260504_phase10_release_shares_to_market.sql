-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.17 — release shares from reserve → offering (market)
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- Replaces the now-removed "transfer money" admin action on the
-- project wallets panel with a real, business-meaningful operation:
-- moving N shares from a project's RESERVE wallet to its OFFERING
-- wallet (= "السوق"). Once in offering, those shares are available
-- for primary distribution (and downstream secondary trading).
--
-- This is the "release_to_offering" flow alluded to in the share-
-- modification migration's comment: shares minted via the two-factor
-- modification flow always land in reserve; this RPC is how they
-- enter circulation.
--
-- Atomic: locks both wallets, validates capacity, applies the
-- transfer. Refuses to operate on frozen wallets.
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
  v_caller_role TEXT;
  v_reserve RECORD;
  v_offering RECORD;
BEGIN
  -- ─── auth ───
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_uid;
  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- ─── input validation ───
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- ─── lock reserve ───
  SELECT * INTO v_reserve FROM public.project_wallets
  WHERE project_id = p_project_id AND wallet_type = 'reserve'
  FOR UPDATE;
  IF v_reserve IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reserve_wallet_missing');
  END IF;
  IF COALESCE(v_reserve.is_frozen, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reserve_wallet_frozen');
  END IF;
  IF COALESCE(v_reserve.available_shares, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_reserve_shares',
      'available', COALESCE(v_reserve.available_shares, 0)
    );
  END IF;

  -- ─── lock offering ───
  SELECT * INTO v_offering FROM public.project_wallets
  WHERE project_id = p_project_id AND wallet_type = 'offering'
  FOR UPDATE;
  IF v_offering IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_missing');
  END IF;
  IF COALESCE(v_offering.is_frozen, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_frozen');
  END IF;

  -- ─── transfer ───
  UPDATE public.project_wallets
  SET total_shares = total_shares - p_amount,
      available_shares = available_shares - p_amount,
      updated_at = NOW()
  WHERE id = v_reserve.id;

  UPDATE public.project_wallets
  SET total_shares = total_shares + p_amount,
      available_shares = available_shares + p_amount,
      updated_at = NOW()
  WHERE id = v_offering.id;

  -- ─── audit log (best-effort) ───
  BEGIN
    INSERT INTO public.audit_log (
      user_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_uid,
      'release_shares_to_market',
      'project_wallet',
      v_offering.id,
      jsonb_build_object(
        'project_id', p_project_id,
        'amount', p_amount,
        'reason', p_reason,
        'reserve_wallet_id', v_reserve.id,
        'offering_wallet_id', v_offering.id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'amount', p_amount,
    'reserve_remaining', v_reserve.available_shares - p_amount,
    'offering_total', v_offering.available_shares + p_amount
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_release_shares_to_market(UUID, BIGINT, TEXT)
  TO authenticated;
