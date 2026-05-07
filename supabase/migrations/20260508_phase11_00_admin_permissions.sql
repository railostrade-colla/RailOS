-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.00 — Admin permissions + grant-admin RPC
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Founder spec: super_admin must be able to add a new admin from the
-- Admins panel directly (not via the Users list), AND choose which
-- areas the new admin can access. The granted admin then sees only
-- the panels they have permission for.
--
-- Adds:
--   • profiles.admin_permissions  JSONB  DEFAULT '[]'  — array of
--     capability strings the admin is allowed to use. super_admin
--     implicitly has all capabilities; this column is consulted only
--     when role='admin'.
--   • admin_grant_admin(user_id, permissions[])    — promote user→admin
--     with the given permission set. super_admin only.
--   • admin_set_admin_permissions(user_id, permissions[]) — update
--     the permission set on an existing admin row.
--   • get_my_admin_permissions() — returns the caller's effective
--     permission array. For super_admin returns the literal "*"
--     wildcard so the UI can short-circuit.
--
-- Capability vocabulary (frontend should match):
--   manage_users, manage_projects, manage_orders, manage_kyc,
--   manage_market, manage_payments, manage_fees, manage_content,
--   manage_companies, manage_admins, view_audit
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Column ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ─── 2. admin_grant_admin ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_admin(
  p_user_id     UUID,
  p_permissions JSONB DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  -- Validate the permissions array is a JSONB array of strings.
  IF jsonb_typeof(p_permissions) <> 'array' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_permissions');
  END IF;

  UPDATE public.profiles
     SET role = 'admin',
         admin_permissions = p_permissions
   WHERE id = p_user_id;

  -- Audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'grant_admin', 'profile', p_user_id,
      jsonb_build_object('permissions', p_permissions)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'user_id',     p_user_id,
    'permissions', p_permissions
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_grant_admin(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_admin(UUID, JSONB) TO authenticated;


-- ─── 3. admin_set_admin_permissions ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_admin_permissions(
  p_user_id     UUID,
  p_permissions JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  IF jsonb_typeof(p_permissions) <> 'array' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_permissions');
  END IF;

  UPDATE public.profiles
     SET admin_permissions = p_permissions
   WHERE id = p_user_id AND role IN ('admin', 'super_admin');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_an_admin');
  END IF;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'set_admin_permissions', 'profile', p_user_id,
      jsonb_build_object('permissions', p_permissions)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'permissions', p_permissions);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_admin_permissions(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_admin_permissions(UUID, JSONB) TO authenticated;


-- ─── 4. get_my_admin_permissions ──────────────────────────────────
-- Returns the caller's effective permission list:
--   • super_admin → ["*"] (wildcard — UI treats as "all permissions")
--   • admin       → the JSONB array from profiles.admin_permissions
--   • else        → []
CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_perms JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT role, admin_permissions
    INTO v_role, v_perms
  FROM public.profiles
   WHERE id = v_uid;

  IF v_role = 'super_admin' THEN
    RETURN jsonb_build_array('*');
  END IF;
  IF v_role = 'admin' THEN
    RETURN COALESCE(v_perms, '[]'::jsonb);
  END IF;
  RETURN '[]'::jsonb;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.00 applied:';
  RAISE NOTICE '  ✓ profiles.admin_permissions JSONB DEFAULT ''[]''';
  RAISE NOTICE '  ✓ admin_grant_admin(user_id, permissions)   — super_admin only';
  RAISE NOTICE '  ✓ admin_set_admin_permissions(user_id, ...) — super_admin only';
  RAISE NOTICE '  ✓ get_my_admin_permissions()                — auth users';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
