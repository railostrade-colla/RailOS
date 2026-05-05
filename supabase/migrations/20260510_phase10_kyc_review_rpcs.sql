-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.65 — KYC review RPCs (approve / reject) via SECURITY DEFINER
-- Date: 2026-05-10
-- Idempotent: safe to re-run.
--
-- Why this exists:
--   The legacy `reviewKyc` data-layer function did UPDATE + SELECT
--   on `kyc_submissions` then `.single()` — which fails with
--   "Cannot coerce the result to a single JSON object" when the
--   UPDATE returns 0 rows (RLS UPDATE policy missing or blocking).
--
--   This migration ships two SECURITY DEFINER RPCs that bypass RLS
--   entirely. They:
--     • verify the caller is an admin (`is_admin()`)
--     • update kyc_submissions.status + reviewer + reviewed_at
--     • mirror profiles.kyc_status so user-side state is consistent
--     • write to audit_log
--     • return a clean { success, error } JSONB
--
-- Also re-asserts the Phase Z admin RLS policies on kyc_submissions
-- so the legacy data-layer path still works as a fallback.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. admin_approve_kyc ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_approve_kyc(UUID);
CREATE OR REPLACE FUNCTION public.admin_approve_kyc(p_submission_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_user_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.kyc_submissions
  WHERE id = p_submission_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  UPDATE public.kyc_submissions
     SET status       = 'approved'::kyc_status,
         review_notes = NULL,
         reviewed_by  = v_uid,
         reviewed_at  = NOW()
   WHERE id = p_submission_id;

  -- Mirror to profiles
  BEGIN
    UPDATE public.profiles
       SET kyc_status = 'approved'::kyc_status
     WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Audit
  BEGIN
    PERFORM public.log_admin_action(
      'approve_kyc', 'kyc_submission', p_submission_id,
      jsonb_build_object('user_id', v_user_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'submission_id', p_submission_id,
    'user_id',       v_user_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_approve_kyc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(UUID) TO authenticated;


-- ─── 2. admin_reject_kyc ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_reject_kyc(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_reject_kyc(
  p_submission_id UUID,
  p_reason        TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_user_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reason_required');
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.kyc_submissions
  WHERE id = p_submission_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  UPDATE public.kyc_submissions
     SET status       = 'rejected'::kyc_status,
         review_notes = trim(p_reason),
         reviewed_by  = v_uid,
         reviewed_at  = NOW()
   WHERE id = p_submission_id;

  BEGIN
    UPDATE public.profiles
       SET kyc_status = 'rejected'::kyc_status
     WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.log_admin_action(
      'reject_kyc', 'kyc_submission', p_submission_id,
      jsonb_build_object('user_id', v_user_id, 'reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'submission_id', p_submission_id,
    'user_id',       v_user_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_reject_kyc(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(UUID, TEXT) TO authenticated;


-- ─── 3. Re-assert Phase Z admin RLS policies (defensive) ───────
-- These already exist from 20260503_kyc_admin_policies.sql, but
-- re-asserting them here makes this migration self-contained for
-- environments where Phase Z wasn't applied.

DROP POLICY IF EXISTS "Admins can read all KYC submissions" ON public.kyc_submissions;
CREATE POLICY "Admins can read all KYC submissions"
  ON public.kyc_submissions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update KYC submissions" ON public.kyc_submissions;
CREATE POLICY "Admins can update KYC submissions"
  ON public.kyc_submissions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── Done ──────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.65 applied:';
  RAISE NOTICE '  ✓ admin_approve_kyc(submission_id)';
  RAISE NOTICE '  ✓ admin_reject_kyc(submission_id, reason)';
  RAISE NOTICE '  ✓ Re-asserted admin RLS policies on kyc_submissions';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
