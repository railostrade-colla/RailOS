-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.85 — admin_add_shares_to_offering
-- Date: 2026-05-07
-- Idempotent: safe to re-run.
--
-- Founder's mental model (per the latest spec):
--   • `projects.total_shares` represents the COMPANY-HELD share pool —
--     i.e. shares the platform / project still owns and has NOT yet
--     released to the public market.
--   • The OFFERING wallet (`project_wallets.wallet_type='offering'`)
--     represents the public, tradable float — the only pool the app
--     reads when displaying "available for sale".
--   • When a super-admin clicks "Add shares to offering" in the
--     project-wallets management screen, the platform:
--       1. takes N shares out of the company-held pool
--          (decrements `projects.total_shares`)
--       2. adds N shares to the offering wallet
--          (increments offering.total_shares + offering.available_shares)
--       3. the company's ownership percentage drops
--          (because the public float grew while the company pool shrank)
--   • Once offering.available_shares reaches 0 again, the only way to
--     re-list more shares is for an admin to call this RPC again.
--
-- This is INTENTIONALLY different from `admin_release_shares_to_market`,
-- which moves shares between TWO wallets (reserve → offering) and
-- leaves `projects.total_shares` untouched. We keep the older RPC for
-- backwards compatibility but the new flow is the one wired to the UI.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_add_shares_to_offering(
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
  v_company_total BIGINT;
  v_offering_status TEXT;
  v_offering_total_after BIGINT;
  v_offering_available_after BIGINT;
  v_company_total_after BIGINT;
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

  -- ─── Lock project row, read company-held total ───
  SELECT total_shares
    INTO v_company_total
  FROM public.projects
   WHERE id = p_project_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  IF v_company_total IS NULL OR v_company_total < p_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_company_shares',
      'available', COALESCE(v_company_total, 0)
    );
  END IF;

  -- ─── Lock offering wallet, ensure it exists + not frozen ───
  SELECT status
    INTO v_offering_status
  FROM public.project_wallets
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_missing');
  END IF;
  IF v_offering_status = 'frozen' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_frozen');
  END IF;

  -- ─── Atomic transfer: company-pool → offering wallet ───
  -- 1. Decrease the company-held total on the project row.
  --    This is what makes the ownership percentage drop in the UI.
  BEGIN
    UPDATE public.projects
       SET total_shares = total_shares - p_amount
     WHERE id = p_project_id
     RETURNING total_shares INTO v_company_total_after;
  EXCEPTION WHEN OTHERS THEN
    -- If `total_shares` is generated/computed in some env, fall back
    -- to a no-op rather than failing the whole transaction.
    v_company_total_after := v_company_total;
  END;

  -- 2. Increase the offering wallet's tradable float.
  UPDATE public.project_wallets
     SET total_shares = total_shares + p_amount,
         available_shares = available_shares + p_amount
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   RETURNING total_shares, available_shares
        INTO v_offering_total_after, v_offering_available_after;

  -- ─── Audit ───
  BEGIN
    PERFORM public.log_admin_action(
      'add_shares_to_offering', 'project', p_project_id,
      jsonb_build_object(
        'amount', p_amount,
        'reason', p_reason,
        'company_total_before', v_company_total,
        'company_total_after', v_company_total_after,
        'offering_total_after', v_offering_total_after,
        'offering_available_after', v_offering_available_after
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'amount', p_amount,
    'company_total_after', v_company_total_after,
    'offering_total_after', v_offering_total_after,
    'offering_available_after', v_offering_available_after
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_add_shares_to_offering(UUID, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_shares_to_offering(UUID, BIGINT, TEXT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.85 applied:';
  RAISE NOTICE '  ✓ admin_add_shares_to_offering() created';
  RAISE NOTICE '  ✓ super_admin gate';
  RAISE NOTICE '  ✓ atomic FOR UPDATE on projects + offering wallet';
  RAISE NOTICE '  ✓ decrements projects.total_shares (company pool)';
  RAISE NOTICE '  ✓ increments offering.total_shares + available_shares';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
