-- ═══════════════════════════════════════════════════════════════════
-- level_settings RLS hardening (Phase U)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Why:
--   The original migration `10-levels-system.sql` created the table
--   without enabling RLS. Without policies, anyone authenticated can
--   modify the level catalogue — which Phase S (admin upsert) now
--   relies on for its `reason: "rls"` failure mode.
--
-- Policies:
--   • SELECT — open to anyone (the catalogue drives the public
--     /levels page and the user-side level progress tracker).
--   • INSERT / UPDATE / DELETE — restricted to admin + super_admin
--     by joining profiles.role for the calling auth.uid().
--
-- The Phase-S panel already maps PostgREST 42501 to a friendly
-- "لا تملك صلاحيات التعديل" toast, so non-admins get a clear
-- failure instead of silently mutating the table.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.level_settings ENABLE ROW LEVEL SECURITY;

-- ─── Public read ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read level settings"
  ON public.level_settings;
CREATE POLICY "Anyone can read level settings"
ON public.level_settings
FOR SELECT
USING (true);

-- ─── Admin-only write (INSERT) ───────────────────────────────
-- Helper expression repeated in each policy to keep the migration
-- single-file; if we add more admin-only tables we'll factor it
-- into an `is_admin()` SECURITY DEFINER function.
DROP POLICY IF EXISTS "Admins can insert level settings"
  ON public.level_settings;
CREATE POLICY "Admins can insert level settings"
ON public.level_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- ─── Admin-only write (UPDATE) ───────────────────────────────
DROP POLICY IF EXISTS "Admins can update level settings"
  ON public.level_settings;
CREATE POLICY "Admins can update level settings"
ON public.level_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- ─── Admin-only write (DELETE) ───────────────────────────────
-- Deleting level rows is rare (the catalogue is fixed at 4) but
-- gating it keeps the policy set complete.
DROP POLICY IF EXISTS "Admins can delete level settings"
  ON public.level_settings;
CREATE POLICY "Admins can delete level settings"
ON public.level_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);
