-- ═══════════════════════════════════════════════════════════════════
-- Phase 5.3 — INSERT/UPDATE/DELETE policies on project_updates
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Bug found during Phase 5 audit:
--   project_updates had RLS enabled (02_projects.sql:343) and a
--   SELECT policy ("Anyone can view project updates"), but NO
--   INSERT/UPDATE/DELETE policies. With RLS enabled and no write
--   policy, PostgreSQL's default-deny rejected every write — even
--   from admins. The "تحديثات" tab on /project/[id] (Phase O)
--   would render an empty list because no one could ever post.
--
-- This migration adds the missing write policies:
--   • INSERT — project creator OR admin
--   • UPDATE — only the user who posted the update OR admin
--   • DELETE — admin only (audit trail intent)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- ─── INSERT — project creator OR admin ───────────────────────
-- We require created_by to match the caller (or the caller is
-- an admin) so authorship can't be spoofed.
DROP POLICY IF EXISTS "Project creators or admins can post updates"
  ON public.project_updates;
CREATE POLICY "Project creators or admins can post updates"
ON public.project_updates
FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND created_by = auth.uid()
    )
  )
);

-- ─── UPDATE — original poster OR admin ───────────────────────
DROP POLICY IF EXISTS "Update authors or admins can edit"
  ON public.project_updates;
CREATE POLICY "Update authors or admins can edit"
ON public.project_updates
FOR UPDATE
USING (created_by = auth.uid() OR public.is_admin())
WITH CHECK (created_by = auth.uid() OR public.is_admin());

-- ─── DELETE — admin only ─────────────────────────────────────
-- Updates are part of the project's public timeline; the user
-- who posted shouldn't be able to wipe history. If they need a
-- correction, they edit (UPDATE).
DROP POLICY IF EXISTS "Admins can delete project updates"
  ON public.project_updates;
CREATE POLICY "Admins can delete project updates"
ON public.project_updates
FOR DELETE
USING (public.is_admin());
