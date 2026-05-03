-- ═══════════════════════════════════════════════════════════════════
-- public.is_admin() — reusable admin gate for RLS policies (Phase W)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Why:
--   Phase U inlined the same EXISTS-on-profiles check four times
--   inside level_settings policies. Every future admin-gated table
--   would copy-paste the same block — drift waiting to happen.
--   Centralising it has three benefits:
--     1. Policy lines collapse to a single function call.
--     2. Changing the role set later (e.g. adding 'moderator') is a
--        one-line edit instead of a hunt across migrations.
--     3. SECURITY DEFINER + STABLE makes it cheap and cacheable
--        per-statement.
--
-- Function contract:
--   • Returns TRUE iff the calling auth.uid() maps to a profile
--     with role IN ('admin', 'super_admin').
--   • Returns FALSE for unauthenticated callers, missing profiles,
--     or any non-admin role.
--   • Never raises — even on missing profiles row.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns TRUE iff the caller (auth.uid()) is an admin or super_admin. '
  'Used as a one-liner gate inside RLS policies on admin-only tables. '
  'STABLE + SECURITY DEFINER so the planner caches it per statement.';

-- Authenticated users may call it (it just returns false for them).
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ─── Replace the verbose level_settings policies with one-liners ──
-- These DROP+CREATE pairs are idempotent. Behaviour is identical to
-- Phase U; the migration just collapses the boilerplate.

DROP POLICY IF EXISTS "Admins can insert level settings"
  ON public.level_settings;
CREATE POLICY "Admins can insert level settings"
ON public.level_settings
FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update level settings"
  ON public.level_settings;
CREATE POLICY "Admins can update level settings"
ON public.level_settings
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete level settings"
  ON public.level_settings;
CREATE POLICY "Admins can delete level settings"
ON public.level_settings
FOR DELETE
USING (public.is_admin());

-- The SELECT policy from Phase U stays as-is — it's already a
-- single-expression `USING (true)`, no helper needed.
