-- ═══════════════════════════════════════════════════════════════════
-- audit_log RLS hardening — admin-only SELECT (Phase X)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- The audit_log table from 01_users.sql had no RLS policies, so any
-- authenticated user could SELECT every admin action. That's a leak —
-- audit content (refund amounts, dispute reasons, banned users…) is
-- explicitly admin-confidential.
--
-- Reuses the public.is_admin() helper from Phase W. One-line policy.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log"
ON public.audit_log
FOR SELECT
USING (public.is_admin());

-- INSERT remains restricted: there's no client-side INSERT policy, so
-- only SECURITY DEFINER triggers / RPCs (or the service-role key) can
-- write. That's intentional — clients shouldn't fabricate audit rows.

-- UPDATE / DELETE: deliberately omitted. The audit log is append-only.
-- Even admins shouldn't be able to mutate it from the client. If the
-- service role ever needs to redact a row, it bypasses RLS anyway.
