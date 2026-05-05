-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.41 — admin role bootstrap + diagnostic helpers
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Why: every admin RLS policy gates on `public.is_admin()`, which
-- returns TRUE only when `profiles.role IN ('admin','super_admin')`
-- for the calling auth.uid(). On a fresh deployment NO profile row
-- has that role, so every admin query — even with the FK-bypass
-- RPCs — returns empty. Submitted requests live in the DB but never
-- show in the admin panel.
--
-- Two helpers:
--   1. whoami_admin() — read-only. Returns the caller's uid +
--      profile.role + is_admin() result. Powers the diagnostic
--      banner the admin layout shows when access fails.
--
--   2. bootstrap_first_super_admin() — write, but ONLY if no
--      super_admin exists in profiles yet. Promotes the calling
--      user. Once any super_admin exists, this RPC is a no-op
--      (returns success=false, reason='already_seeded'). Subsequent
--      promotions go through the existing admin_set_user_role
--      flow which requires a super_admin caller.
--
-- After bootstrap, the admin panel works end-to-end without ever
-- touching the SQL editor manually.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. whoami_admin ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.whoami_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_full_name TEXT;
  v_email TEXT;
  v_super_admin_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', FALSE,
      'is_admin', FALSE,
      'role', NULL,
      'super_admin_count', 0
    );
  END IF;

  SELECT role, full_name
    INTO v_role, v_full_name
    FROM public.profiles
    WHERE id = v_uid;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  SELECT COUNT(*) INTO v_super_admin_count
    FROM public.profiles WHERE role = 'super_admin';

  RETURN jsonb_build_object(
    'authenticated', TRUE,
    'user_id', v_uid,
    'email', v_email,
    'full_name', v_full_name,
    'role', COALESCE(v_role, 'unknown'),
    'is_admin', COALESCE(v_role IN ('admin', 'super_admin'), FALSE),
    'is_super_admin', COALESCE(v_role = 'super_admin', FALSE),
    'super_admin_count', v_super_admin_count,
    'has_profile_row', v_role IS NOT NULL
  );
END
$$;

REVOKE ALL ON FUNCTION public.whoami_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whoami_admin() TO authenticated;


-- ─── 2. bootstrap_first_super_admin ───────────────────────────────
-- Promotes the calling user to super_admin IFF no super_admin exists
-- in the system yet. This is the legitimate self-service path for
-- the founder on a fresh deployment.
CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing_count INT := 0;
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'unauthenticated');
  END IF;

  SELECT COUNT(*) INTO v_existing_count
    FROM public.profiles
    WHERE role = 'super_admin';

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'reason', 'already_seeded',
      'existing_super_admin_count', v_existing_count
    );
  END IF;

  -- Ensure a profiles row exists. If the auto-create trigger from
  -- Phase 10.32 isn't applied yet, this UPSERT covers the gap.
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  INSERT INTO public.profiles (id, role, full_name, created_at)
  VALUES (v_uid, 'super_admin', COALESCE(v_email, 'Founder'), now())
  ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin';

  -- Audit best-effort.
  BEGIN
    PERFORM public.log_admin_action(
      'bootstrap_super_admin',
      'profile',
      v_uid,
      jsonb_build_object('promoted_self', TRUE)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_uid,
    'role', 'super_admin'
  );
END
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin() TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.41 applied: whoami_admin + bootstrap_first_super_admin.';
END $$;
