-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.98 — admin_set_user_level + admin_set_user_kyc
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Two new RPCs the admin Users panel calls:
--   • admin_set_user_level — change a user's level (basic/advanced/pro/elite)
--                            super_admin only.
--   • admin_set_user_kyc   — flip a user's profiles.kyc_status
--                            (approved / pending / rejected / not_submitted)
--                            admin or super_admin.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. admin_set_user_level ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_level(
  p_user_id UUID,
  p_level   TEXT
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

  IF p_level NOT IN ('basic', 'advanced', 'pro', 'elite') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_level');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  -- The level column was added by the levels-system migration as
  -- profiles.level TEXT DEFAULT 'basic'. We also stamp the override
  -- columns so the level stays manually-set even if the auto-promoter
  -- runs over it.
  UPDATE public.profiles
     SET level = p_level
   WHERE id = p_user_id;

  -- Best-effort: stamp override fields if they exist
  BEGIN
    UPDATE public.profiles
       SET level_override          = p_level,
           level_override_reason   = 'admin_manual_set',
           level_overridden_at     = NOW(),
           level_overridden_by     = v_uid,
           level_locked            = TRUE
     WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'set_user_level', 'profile', p_user_id,
      jsonb_build_object('level', p_level)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'level', p_level);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_level(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_level(UUID, TEXT) TO authenticated;


-- ─── 2. admin_set_user_kyc ────────────────────────────────────────
-- Direct flip of profiles.kyc_status. For full kyc-submission review
-- (with reason + evidence), use admin_approve_kyc / admin_reject_kyc
-- — those operate on a kyc_submissions row. This RPC is the quick
-- "trust-this-user" toggle in the users list.

CREATE OR REPLACE FUNCTION public.admin_set_user_kyc(
  p_user_id UUID,
  p_status  TEXT
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
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  IF p_status NOT IN ('approved', 'pending', 'rejected', 'not_submitted') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_status');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  -- profiles.kyc_status is either an enum or text; we cast tolerantly.
  BEGIN
    EXECUTE format(
      'UPDATE public.profiles SET kyc_status = %L WHERE id = %L',
      p_status, p_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'update_failed',
      'detail',  SQLERRM
    );
  END;

  -- Mirror to any latest kyc_submission so the kyc tab stays consistent.
  BEGIN
    UPDATE public.kyc_submissions
       SET status = p_status,
           reviewed_by = v_uid,
           reviewed_at = NOW()
     WHERE user_id = p_user_id
       AND id = (
         SELECT id FROM public.kyc_submissions
          WHERE user_id = p_user_id
          ORDER BY created_at DESC
          LIMIT 1
       );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'set_user_kyc', 'profile', p_user_id,
      jsonb_build_object('status', p_status)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'status', p_status);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_kyc(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_kyc(UUID, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.98 applied:';
  RAISE NOTICE '  ✓ admin_set_user_level (super_admin) — basic/advanced/pro/elite';
  RAISE NOTICE '  ✓ admin_set_user_kyc   (admin/super_admin) — approved/pending/rejected/not_submitted';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
