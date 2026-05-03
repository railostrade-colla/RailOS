-- ═══════════════════════════════════════════════════════════════════
-- KYC admin policies (Phase Z)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- The base policies on kyc_submissions (from 01_users.sql) only let
-- users see + create their own rows. Admins need to:
--   • SELECT every row to staff the review queue.
--   • UPDATE status / review_notes / reviewed_by / reviewed_at to
--     approve, reject, or request resubmission.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Admin SELECT — all rows ─────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all KYC submissions"
  ON public.kyc_submissions;
CREATE POLICY "Admins can read all KYC submissions"
ON public.kyc_submissions
FOR SELECT
USING (public.is_admin());

-- ─── Admin UPDATE — review actions ───────────────────────────
DROP POLICY IF EXISTS "Admins can update KYC submissions"
  ON public.kyc_submissions;
CREATE POLICY "Admins can update KYC submissions"
ON public.kyc_submissions
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE deliberately omitted. KYC submissions are an audit trail —
-- if an admin needs to remove one, the service role bypasses RLS.
