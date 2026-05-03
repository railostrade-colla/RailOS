-- ═══════════════════════════════════════════════════════════════════
-- Phase 5.2 — admin SELECT on deal_messages
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Existing policies on `deal_messages` (from 03_deals.sql):
--   • SELECT — deal parties only (buyer/seller)
--   • INSERT — deal parties only (sender_id = auth.uid())
--
-- Gap: admins need to read messages on disputed deals to
-- investigate. This was a known limitation of the dispute UI —
-- admins resolve based on summary text and evidence URLs, but
-- couldn't read the actual chat trail.
--
-- We grant admin SELECT only. INSERT stays parties-only so
-- admins can't fabricate messages — if intervention is needed,
-- the service role bypasses RLS or a SECURITY DEFINER RPC can
-- log a system message (separate phase).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.deal_messages ENABLE ROW LEVEL SECURITY;

-- ─── Admin SELECT — every message on every deal ──────────────
DROP POLICY IF EXISTS "Admins can view all deal messages"
  ON public.deal_messages;
CREATE POLICY "Admins can view all deal messages"
ON public.deal_messages
FOR SELECT
USING (public.is_admin());

-- INSERT/UPDATE/DELETE NOT extended for admins on this table.
-- Chat history is testimony — admins can read it but not edit it
-- from the client. Service role + audit logging cover any
-- legitimate need to redact.
