-- ═══════════════════════════════════════════════════════════════════
-- Phase 5.1 — admin SELECT/UPDATE on deals
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Existing policies on `deals` (from 03_deals.sql):
--   • SELECT — buyer or seller only
--   • INSERT — buyer only
--   • UPDATE — buyer or seller only
--
-- Gap: admins need to read every deal (dispute investigation,
-- support cases) and force-mutate state (e.g. force-cancel a
-- stuck deal). The Phase EE DisputesPanel already JOINs deals
-- and was failing for non-party admins because of this gap.
--
-- This migration ADDS new policies — the existing party-scoped
-- ones stay untouched, so end-user UX doesn't change.
-- ═══════════════════════════════════════════════════════════════════

-- RLS already enabled by 03_deals.sql:313 — re-asserting is a no-op
-- but documents intent for the migration reader.
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- ─── Admin SELECT — every deal ───────────────────────────────
DROP POLICY IF EXISTS "Admins can view all deals" ON public.deals;
CREATE POLICY "Admins can view all deals"
ON public.deals
FOR SELECT
USING (public.is_admin());

-- ─── Admin UPDATE — force state changes ──────────────────────
DROP POLICY IF EXISTS "Admins can update deals" ON public.deals;
CREATE POLICY "Admins can update deals"
ON public.deals
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE deliberately not granted. Deals are a financial audit
-- trail — even admins shouldn't delete from the client. If the
-- service role ever needs to redact, it bypasses RLS anyway.
