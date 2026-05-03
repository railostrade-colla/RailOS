-- ═══════════════════════════════════════════════════════════════════
-- Phase 7 — Council admin RPCs
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
-- All RPCs SECURITY DEFINER + is_admin() check.
-- ═══════════════════════════════════════════════════════════════════

-- Add a council member (founder/appointed by admin; elected go via
-- the election finalisation path)
CREATE OR REPLACE FUNCTION public.admin_add_council_member(
  p_user_id UUID,
  p_role council_member_role,
  p_position_title TEXT,
  p_bio TEXT DEFAULT NULL,
  p_term_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  INSERT INTO public.council_members (
    user_id, role, position_title, bio, term_ends_at, is_active
  ) VALUES (
    p_user_id, p_role, p_position_title, p_bio, p_term_ends_at, TRUE
  )
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        position_title = EXCLUDED.position_title,
        bio = EXCLUDED.bio,
        term_ends_at = EXCLUDED.term_ends_at,
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_member_id;

  RETURN jsonb_build_object('success', TRUE, 'member_id', v_member_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_council_member(
  UUID, council_member_role, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

-- Soft-remove a council member (sets is_active = false)
CREATE OR REPLACE FUNCTION public.admin_remove_council_member(
  p_member_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.council_members
  SET is_active = FALSE, updated_at = NOW()
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  PERFORM p_reason;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_council_member(UUID, TEXT) TO authenticated;

-- Update bio / position
CREATE OR REPLACE FUNCTION public.admin_update_council_member(
  p_member_id UUID,
  p_position_title TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.council_members
  SET position_title = COALESCE(p_position_title, position_title),
      bio = COALESCE(p_bio, bio),
      updated_at = NOW()
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_council_member(UUID, TEXT, TEXT) TO authenticated;

-- Announce a new election cycle
CREATE OR REPLACE FUNCTION public.admin_announce_election(
  p_title TEXT,
  p_registration_starts TIMESTAMPTZ,
  p_registration_ends TIMESTAMPTZ,
  p_voting_starts TIMESTAMPTZ,
  p_voting_ends TIMESTAMPTZ,
  p_seats_available INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_election_id UUID;
  v_eligible_voters INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_seats_available <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_seats');
  END IF;
  IF p_registration_ends <= p_registration_starts
     OR p_voting_starts < p_registration_ends
     OR p_voting_ends <= p_voting_starts THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_dates');
  END IF;

  -- Snapshot eligible voter count (anyone with approved KYC).
  -- Best effort — falls through if profiles is missing kyc_status column.
  BEGIN
    SELECT COUNT(*) INTO v_eligible_voters FROM public.profiles
    WHERE kyc_status = 'approved';
  EXCEPTION WHEN undefined_column THEN
    v_eligible_voters := 0;
  END;

  INSERT INTO public.council_elections (
    title, status, registration_starts, registration_ends,
    voting_starts, voting_ends, seats_available, total_eligible_voters
  ) VALUES (
    p_title,
    CASE WHEN p_registration_starts <= NOW() AND NOW() < p_registration_ends
         THEN 'registration'::council_election_status
         WHEN p_voting_starts <= NOW() AND NOW() < p_voting_ends
         THEN 'voting'::council_election_status
         ELSE 'registration'::council_election_status END,
    p_registration_starts, p_registration_ends,
    p_voting_starts, p_voting_ends, p_seats_available,
    COALESCE(v_eligible_voters, 0)
  )
  RETURNING id INTO v_election_id;

  RETURN jsonb_build_object('success', TRUE, 'election_id', v_election_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_announce_election(
  TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER
) TO authenticated;

-- Apply the final decision on a proposal (founder/admin only)
CREATE OR REPLACE FUNCTION public.admin_finalize_proposal(
  p_proposal_id UUID,
  p_decision TEXT,           -- 'approved' | 'rejected'
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_decision');
  END IF;

  UPDATE public.council_proposals
  SET final_decision = p_decision,
      final_decision_by = v_uid,
      final_decision_at = NOW(),
      status = p_decision::council_proposal_status,
      updated_at = NOW()
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  PERFORM p_notes;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_finalize_proposal(UUID, TEXT, TEXT) TO authenticated;
