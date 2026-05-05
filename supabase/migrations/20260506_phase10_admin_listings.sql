-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.60 — admin listings (users + KYC) via SECURITY DEFINER RPCs
-- Date: 2026-05-06
-- Idempotent: safe to re-run.
--
-- Why this migration exists:
--   • The admin Users page selected `email` from `profiles` — but
--     email lives on `auth.users`, not `profiles`. PostgREST returned
--     400 and the panel rendered empty.
--   • KYC submissions sometimes don't appear in the admin queue when
--     the row's RLS context is ambiguous (admin role races, etc.).
--
-- The fix is two SECURITY DEFINER RPCs that:
--   1. Verify the caller is an admin (`is_admin()`).
--   2. Bypass RLS to return a clean joined row set including email
--      from `auth.users`.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. get_all_users_for_admin ──────────────────────────────────
DROP FUNCTION IF EXISTS public.get_all_users_for_admin(INT);
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin(p_limit INT DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id,
        COALESCE(p.full_name, p.username, '—') AS full_name,
        p.username,
        p.phone,
        u.email,
        COALESCE(p.role::TEXT, 'user') AS role,
        COALESCE(p.level::TEXT, 'basic') AS level,
        COALESCE(p.kyc_status::TEXT, 'not_submitted') AS kyc_status,
        p.is_active,
        p.is_banned,
        p.created_at,
        p.last_seen_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin(INT) TO authenticated;


-- ─── 2. get_kyc_submissions_admin ────────────────────────────────
DROP FUNCTION IF EXISTS public.get_kyc_submissions_admin(INT);
CREATE OR REPLACE FUNCTION public.get_kyc_submissions_admin(p_limit INT DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        k.id,
        k.user_id,
        k.full_name,
        k.date_of_birth,
        k.address,
        k.city,
        k.phone,
        k.document_type::TEXT AS document_type,
        k.document_number,
        k.document_front_url,
        k.document_back_url,
        k.selfie_url,
        k.status::TEXT AS status,
        k.review_notes,
        k.reviewed_by,
        k.reviewed_at,
        k.submitted_at,
        COALESCE(p.full_name, p.username, '—') AS profile_name,
        p.username AS profile_username,
        u.email AS user_email
      FROM public.kyc_submissions k
      LEFT JOIN public.profiles p ON p.id = k.user_id
      LEFT JOIN auth.users u      ON u.id = k.user_id
      ORDER BY k.submitted_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_kyc_submissions_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kyc_submissions_admin(INT) TO authenticated;


-- ─── 3. Diagnostic: count what an admin should see ──────────────
-- A tiny RPC the admin can run from the browser console to verify
-- the data is readable. Returns counts only — never sensitive data.
DROP FUNCTION IF EXISTS public.admin_listings_diag();
CREATE OR REPLACE FUNCTION public.admin_listings_diag()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_count INT := 0;
  v_kyc_count INT := 0;
  v_kyc_pending INT := 0;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  BEGIN
    SELECT COUNT(*) INTO v_users_count FROM public.profiles;
  EXCEPTION WHEN OTHERS THEN v_users_count := -1; END;

  BEGIN
    SELECT COUNT(*) INTO v_kyc_count FROM public.kyc_submissions;
    SELECT COUNT(*) INTO v_kyc_pending
    FROM public.kyc_submissions WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN
    v_kyc_count := -1;
    v_kyc_pending := -1;
  END;

  RETURN jsonb_build_object(
    'caller_uid', auth.uid(),
    'caller_role', COALESCE(v_role, 'unknown'),
    'is_admin', public.is_admin(),
    'profiles_count', v_users_count,
    'kyc_submissions_count', v_kyc_count,
    'kyc_pending_count', v_kyc_pending
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_listings_diag() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_listings_diag() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.60 applied:';
  RAISE NOTICE '  ✓ get_all_users_for_admin (joins auth.users for email)';
  RAISE NOTICE '  ✓ get_kyc_submissions_admin (bypasses RLS via DEFINER)';
  RAISE NOTICE '  ✓ admin_listings_diag (call from browser to verify)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
