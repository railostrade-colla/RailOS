-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.1 — link_referral_by_code RPC
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Atomically links the calling user to an ambassador via the referral
-- code. Designed to be called from:
--   1. The OAuth callback (app/api/auth/callback) right after a fresh
--      Google signup, when the ?ref=… cookie is present.
--   2. Future signup flows that need to attach a referral after the
--      profile already exists.
--
-- Guarantees:
--   • Idempotent — calling twice is a no-op (already_linked).
--   • Validates link is active + not expired + ambassador is_active.
--   • Prevents self-referral (user can't use their own code).
--   • Mirrors `profiles.referred_by` for fast lookups + falls back
--     gracefully if the column is missing on older DBs.
--   • Existing `increment_referral_signups` trigger handles counter
--     bumps, so the counts stay consistent.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.link_referral_by_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_link RECORD;
  v_ambassador_user_id UUID;
  v_ambassador_active BOOLEAN;
  v_existing UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_code');
  END IF;

  -- Already referred? short-circuit (idempotent)
  SELECT id INTO v_existing FROM public.referrals
  WHERE referred_user_id = v_uid;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'already_linked', TRUE);
  END IF;

  -- Validate the code: must be active + unexpired
  SELECT * INTO v_link FROM public.referral_links
  WHERE code = p_code AND status = 'active' AND expires_at > NOW()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_or_expired_code');
  END IF;

  -- Fetch ambassador owner + active flag
  SELECT user_id, is_active
    INTO v_ambassador_user_id, v_ambassador_active
  FROM public.ambassadors
  WHERE id = v_link.ambassador_id;

  IF v_ambassador_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ambassador_not_found');
  END IF;
  IF v_ambassador_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ambassador_inactive');
  END IF;

  -- Block self-referral
  IF v_ambassador_user_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_refer_self');
  END IF;

  -- Insert the referral row (existing trigger increments counters)
  INSERT INTO public.referrals (
    ambassador_id, referral_link_id, referred_user_id
  ) VALUES (
    v_link.ambassador_id, v_link.id, v_uid
  );

  -- Mirror onto profiles.referred_by — best-effort (older DBs may
  -- lack the column).
  BEGIN
    UPDATE public.profiles
    SET referred_by = v_ambassador_user_id
    WHERE id = v_uid;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'ambassador_user_id', v_ambassador_user_id,
    'referral_link_id', v_link.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_referral_by_code(TEXT) TO authenticated;

-- ─── Public helper: lookup ambassador display name from a code ──
-- Used by /register?ref=... to show "you've been invited by X" before
-- the user actually creates an account. SELECT-only on aggregated +
-- non-sensitive fields, so SECURITY DEFINER is safe here.
CREATE OR REPLACE FUNCTION public.get_ambassador_by_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_name TEXT;
  v_active BOOLEAN;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT rl.*, a.is_active AS amb_active, p.full_name AS amb_name
    INTO v_link
  FROM public.referral_links rl
  JOIN public.ambassadors a ON a.id = rl.ambassador_id
  JOIN public.profiles p ON p.id = a.user_id
  WHERE rl.code = p_code
    AND rl.status = 'active'
    AND rl.expires_at > NOW();

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  v_name := COALESCE(v_link.amb_name, 'سفير');
  v_active := COALESCE(v_link.amb_active, FALSE);

  RETURN jsonb_build_object(
    'found', v_active,
    'ambassador_name', v_name,
    'expires_at', v_link.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_by_code(TEXT) TO anon, authenticated;
