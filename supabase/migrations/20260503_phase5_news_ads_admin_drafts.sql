-- ═══════════════════════════════════════════════════════════════════
-- Phase 5.4 — admin sees drafts + expired on news/ads
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Existing SELECT policies (from 06_notifications.sql):
--   • news: USING (is_published = true)
--           → admins can't review drafts before publishing.
--   • ads:  USING (is_active=true AND starts_at<=NOW()
--                 AND (ends_at IS NULL OR ends_at>NOW()))
--           → admins can't see scheduled / expired / inactive ads
--             from the admin dashboard.
--
-- We REPLACE the SELECT policies with versions that OR-in is_admin().
-- INSERT/UPDATE policies (admin-only) stay untouched.
--
-- This is a SELECT broadening — public users still only see
-- published news + currently-active ads. Admins additionally see
-- everything else. No data is exposed to unauthorised users.
-- ═══════════════════════════════════════════════════════════════════

-- ─── news: SELECT broadened for admins ───────────────────────
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published news" ON public.news;
DROP POLICY IF EXISTS "Anyone can view published news or admins all"
  ON public.news;
CREATE POLICY "Anyone can view published news or admins all"
ON public.news
FOR SELECT
USING (is_published = TRUE OR public.is_admin());

-- ─── ads: SELECT broadened for admins ────────────────────────
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active ads" ON public.ads;
DROP POLICY IF EXISTS "Anyone can view active ads or admins all"
  ON public.ads;
CREATE POLICY "Anyone can view active ads or admins all"
ON public.ads
FOR SELECT
USING (
  (
    is_active = TRUE
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  )
  OR public.is_admin()
);

-- INSERT / UPDATE policies on both tables (admin-only by role
-- check) are unchanged — they were already correctly scoped.
-- DELETE is intentionally not granted on either table from the
-- client; service role handles it if needed.
