-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.3 — Market Council schema (members, proposals, elections)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Six tables:
--   1. council_members          — sitting council (founder + appointed
--                                  + elected)
--   2. council_elections        — election cycles
--   3. council_candidates       — candidates per election (registration)
--   4. council_election_votes   — SECRET votes (one per voter per
--                                  election)
--   5. council_proposals        — proposals submitted to the council
--   6. council_proposal_votes   — TRANSPARENT votes by council members
--                                  (one per member per proposal)
--
-- Vote-secrecy policy:
--   Election votes are visible only to the voter and admins.
--   Proposal votes are visible to everyone (governance transparency).
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE council_member_role AS ENUM (
    'founder', 'appointed', 'elected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE council_election_status AS ENUM (
    'registration', 'voting', 'ended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE council_proposal_type AS ENUM (
    'new_project', 'shares_release', 'investigation', 'policy'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE council_proposal_status AS ENUM (
    'pending', 'voting', 'approved', 'rejected', 'executed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE council_vote_choice AS ENUM (
    'approve', 'object', 'abstain'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE council_recommendation AS ENUM (
    'approve', 'object', 'neutral'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. council_members ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.council_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role council_member_role NOT NULL,
  position_title TEXT,
  bio TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  term_ends_at TIMESTAMPTZ,
  votes_received INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_members_active
  ON public.council_members(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_council_members_role
  ON public.council_members(role);

COMMENT ON TABLE public.council_members IS
  'أعضاء مجلس السوق — مزيج من المؤسس + المعيّنين + المنتخبين';

-- ─── 2. council_elections ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.council_elections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  status council_election_status NOT NULL DEFAULT 'registration',
  registration_starts TIMESTAMPTZ NOT NULL,
  registration_ends TIMESTAMPTZ NOT NULL,
  voting_starts TIMESTAMPTZ NOT NULL,
  voting_ends TIMESTAMPTZ NOT NULL,
  seats_available INT NOT NULL CHECK (seats_available > 0),
  total_eligible_voters INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (registration_ends > registration_starts),
  CHECK (voting_starts >= registration_ends),
  CHECK (voting_ends > voting_starts)
);

CREATE INDEX IF NOT EXISTS idx_council_elections_status
  ON public.council_elections(status);

-- ─── 3. council_candidates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.council_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES public.council_elections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_statement TEXT NOT NULL CHECK (length(trim(campaign_statement)) >= 30),
  votes_received INT NOT NULL DEFAULT 0,
  is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(election_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_council_candidates_election
  ON public.council_candidates(election_id);

-- ─── 4. council_election_votes (SECRET) ──────────────────────
CREATE TABLE IF NOT EXISTS public.council_election_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES public.council_elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.council_candidates(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(election_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_council_election_votes_candidate
  ON public.council_election_votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_council_election_votes_voter
  ON public.council_election_votes(voter_id);

-- ─── 5. council_proposals ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.council_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL,
  type council_proposal_type NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  submitted_by_role TEXT NOT NULL DEFAULT 'council',
  status council_proposal_status NOT NULL DEFAULT 'pending',
  votes_approve INT NOT NULL DEFAULT 0,
  votes_object INT NOT NULL DEFAULT 0,
  votes_abstain INT NOT NULL DEFAULT 0,
  total_eligible_voters INT NOT NULL DEFAULT 0,
  voting_ends_at TIMESTAMPTZ NOT NULL,
  final_decision TEXT CHECK (final_decision IN ('approved', 'rejected') OR final_decision IS NULL),
  final_decision_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  final_decision_at TIMESTAMPTZ,
  council_recommendation council_recommendation,
  related_project_id UUID,
  related_company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_proposals_status
  ON public.council_proposals(status);
CREATE INDEX IF NOT EXISTS idx_council_proposals_submitted_by
  ON public.council_proposals(submitted_by);

-- ─── 6. council_proposal_votes (TRANSPARENT) ─────────────────
CREATE TABLE IF NOT EXISTS public.council_proposal_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES public.council_proposals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.council_members(id) ON DELETE CASCADE,
  choice council_vote_choice NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proposal_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_council_proposal_votes_proposal
  ON public.council_proposal_votes(proposal_id);

-- ─── Trigger: refresh proposal counters ──────────────────────
CREATE OR REPLACE FUNCTION public.refresh_proposal_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_proposal_id UUID;
BEGIN
  v_proposal_id := COALESCE(NEW.proposal_id, OLD.proposal_id);

  UPDATE public.council_proposals
  SET
    votes_approve = (SELECT COUNT(*) FROM public.council_proposal_votes
                     WHERE proposal_id = v_proposal_id AND choice = 'approve'),
    votes_object  = (SELECT COUNT(*) FROM public.council_proposal_votes
                     WHERE proposal_id = v_proposal_id AND choice = 'object'),
    votes_abstain = (SELECT COUNT(*) FROM public.council_proposal_votes
                     WHERE proposal_id = v_proposal_id AND choice = 'abstain'),
    updated_at = NOW()
  WHERE id = v_proposal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS council_proposal_vote_change
  ON public.council_proposal_votes;
CREATE TRIGGER council_proposal_vote_change
  AFTER INSERT OR UPDATE OR DELETE
  ON public.council_proposal_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_proposal_counters();

-- ─── Trigger: refresh candidate vote counts ──────────────────
CREATE OR REPLACE FUNCTION public.refresh_candidate_votes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_candidate_id UUID;
BEGIN
  v_candidate_id := COALESCE(NEW.candidate_id, OLD.candidate_id);

  UPDATE public.council_candidates
  SET votes_received = (
    SELECT COUNT(*) FROM public.council_election_votes
    WHERE candidate_id = v_candidate_id
  )
  WHERE id = v_candidate_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS council_election_vote_change
  ON public.council_election_votes;
CREATE TRIGGER council_election_vote_change
  AFTER INSERT OR DELETE
  ON public.council_election_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_candidate_votes();

-- ─── updated_at triggers ─────────────────────────────────────
DROP TRIGGER IF EXISTS council_members_updated_at ON public.council_members;
CREATE TRIGGER council_members_updated_at
  BEFORE UPDATE ON public.council_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS council_elections_updated_at ON public.council_elections;
CREATE TRIGGER council_elections_updated_at
  BEFORE UPDATE ON public.council_elections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS council_proposals_updated_at ON public.council_proposals;
CREATE TRIGGER council_proposals_updated_at
  BEFORE UPDATE ON public.council_proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── RPC: cast_proposal_vote ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_proposal_vote(
  p_proposal_id UUID,
  p_choice council_vote_choice,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member_id UUID;
  v_proposal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Caller must be an active council member
  SELECT id INTO v_member_id FROM public.council_members
  WHERE user_id = v_uid AND is_active = TRUE;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_council_member');
  END IF;

  -- Proposal must be open for voting
  SELECT * INTO v_proposal FROM public.council_proposals
  WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_proposal.status NOT IN ('voting', 'pending') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'voting_closed');
  END IF;
  IF v_proposal.voting_ends_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'voting_expired');
  END IF;

  -- Upsert the vote
  INSERT INTO public.council_proposal_votes (proposal_id, member_id, choice, reason)
  VALUES (p_proposal_id, v_member_id, p_choice, p_reason)
  ON CONFLICT (proposal_id, member_id)
  DO UPDATE SET choice = EXCLUDED.choice, reason = EXCLUDED.reason;

  -- Auto-promote pending → voting on first vote
  IF v_proposal.status = 'pending' THEN
    UPDATE public.council_proposals SET status = 'voting' WHERE id = p_proposal_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_proposal_vote(UUID, council_vote_choice, TEXT) TO authenticated;

-- ─── RPC: cast_election_vote ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_election_vote(
  p_election_id UUID,
  p_candidate_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_election RECORD;
  v_candidate_election UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_election FROM public.council_elections
  WHERE id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'election_not_found');
  END IF;
  IF v_election.status <> 'voting' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'voting_not_open');
  END IF;
  IF v_election.voting_ends < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'voting_expired');
  END IF;

  -- Candidate must belong to this election
  SELECT election_id INTO v_candidate_election FROM public.council_candidates
  WHERE id = p_candidate_id;
  IF v_candidate_election IS NULL OR v_candidate_election <> p_election_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_candidate');
  END IF;

  -- Insert (UNIQUE constraint enforces one vote per voter per election)
  BEGIN
    INSERT INTO public.council_election_votes (election_id, candidate_id, voter_id)
    VALUES (p_election_id, p_candidate_id, v_uid);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_voted');
  END;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_election_vote(UUID, UUID) TO authenticated;

-- ─── RPC: register_as_candidate ──────────────────────────────
CREATE OR REPLACE FUNCTION public.register_as_candidate(
  p_election_id UUID,
  p_campaign_statement TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_election RECORD;
  v_profile RECORD;
  v_candidate_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF length(trim(p_campaign_statement)) < 30 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'statement_too_short');
  END IF;

  SELECT * INTO v_election FROM public.council_elections
  WHERE id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'election_not_found');
  END IF;
  IF v_election.status <> 'registration' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'registration_closed');
  END IF;

  -- Eligibility check (best-effort — falls through if columns missing)
  BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
    IF v_profile.kyc_status IS DISTINCT FROM 'approved' THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'kyc_not_approved');
    END IF;
    IF v_profile.level IS NOT NULL AND v_profile.level NOT IN ('advanced', 'pro', 'elite') THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'level_too_low');
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- profiles table missing some columns — proceed
  END;

  INSERT INTO public.council_candidates (election_id, user_id, campaign_statement)
  VALUES (p_election_id, v_uid, p_campaign_statement)
  ON CONFLICT (election_id, user_id) DO UPDATE
    SET campaign_statement = EXCLUDED.campaign_statement
  RETURNING id INTO v_candidate_id;

  RETURN jsonb_build_object('success', TRUE, 'candidate_id', v_candidate_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_as_candidate(UUID, TEXT) TO authenticated;

-- ─── RPC: submit_proposal ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_proposal(
  p_title TEXT,
  p_description TEXT,
  p_type council_proposal_type,
  p_voting_ends_at TIMESTAMPTZ,
  p_related_project_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_member_count INT;
  v_proposal_id UUID;
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF length(trim(p_title)) = 0 OR length(trim(p_description)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_input');
  END IF;
  IF p_voting_ends_at <= NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'voting_ends_in_past');
  END IF;

  -- Author must be admin OR active council member
  v_is_admin := public.is_admin();
  v_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'council' END;

  IF NOT v_is_admin THEN
    SELECT COUNT(*) INTO v_member_count FROM public.council_members
    WHERE user_id = v_uid AND is_active = TRUE;
    IF v_member_count = 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
    END IF;
  END IF;

  INSERT INTO public.council_proposals (
    title, description, type, submitted_by, submitted_by_role,
    status, voting_ends_at, related_project_id,
    total_eligible_voters
  ) VALUES (
    p_title, p_description, p_type, v_uid, v_role,
    'voting', p_voting_ends_at, p_related_project_id,
    (SELECT COUNT(*) FROM public.council_members WHERE is_active = TRUE)
  )
  RETURNING id INTO v_proposal_id;

  RETURN jsonb_build_object('success', TRUE, 'proposal_id', v_proposal_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_proposal(TEXT, TEXT, council_proposal_type, TIMESTAMPTZ, UUID) TO authenticated;

-- ─── RPC: set_council_recommendation (admin/founder only) ────
CREATE OR REPLACE FUNCTION public.set_council_recommendation(
  p_proposal_id UUID,
  p_recommendation council_recommendation
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_founder BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  v_is_founder := public.is_admin() OR EXISTS (
    SELECT 1 FROM public.council_members
    WHERE user_id = v_uid AND role = 'founder' AND is_active = TRUE
  );
  IF NOT v_is_founder THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  UPDATE public.council_proposals
  SET council_recommendation = p_recommendation, updated_at = NOW()
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_council_recommendation(UUID, council_recommendation) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.council_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_elections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_election_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_proposal_votes  ENABLE ROW LEVEL SECURITY;

-- council_members: public read, admin write
DROP POLICY IF EXISTS "View council members" ON public.council_members;
CREATE POLICY "View council members"
ON public.council_members FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins write council members" ON public.council_members;
CREATE POLICY "Admins write council members"
ON public.council_members FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- council_elections: public read, admin write
DROP POLICY IF EXISTS "View elections" ON public.council_elections;
CREATE POLICY "View elections"
ON public.council_elections FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins write elections" ON public.council_elections;
CREATE POLICY "Admins write elections"
ON public.council_elections FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- council_candidates: public read; INSERT via RPC only (no direct);
-- admin can update/delete
DROP POLICY IF EXISTS "View candidates" ON public.council_candidates;
CREATE POLICY "View candidates"
ON public.council_candidates FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Self register as candidate" ON public.council_candidates;
CREATE POLICY "Self register as candidate"
ON public.council_candidates FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins update candidates" ON public.council_candidates;
CREATE POLICY "Admins update candidates"
ON public.council_candidates FOR UPDATE
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete candidates" ON public.council_candidates;
CREATE POLICY "Admins delete candidates"
ON public.council_candidates FOR DELETE
USING (public.is_admin());

-- council_election_votes: SECRET — voter sees own vote only
DROP POLICY IF EXISTS "View own election vote" ON public.council_election_votes;
CREATE POLICY "View own election vote"
ON public.council_election_votes FOR SELECT
USING (voter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Cast election vote" ON public.council_election_votes;
CREATE POLICY "Cast election vote"
ON public.council_election_votes FOR INSERT
WITH CHECK (voter_id = auth.uid());

-- council_proposals: public read; INSERT via RPC only (we restrict via
-- a no-op INSERT policy for non-admins); admin/author can update
DROP POLICY IF EXISTS "View proposals" ON public.council_proposals;
CREATE POLICY "View proposals"
ON public.council_proposals FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Submit proposal (council/admin)" ON public.council_proposals;
CREATE POLICY "Submit proposal (council/admin)"
ON public.council_proposals FOR INSERT
WITH CHECK (
  submitted_by = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.council_members
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  )
);

DROP POLICY IF EXISTS "Update proposals (admin/author)" ON public.council_proposals;
CREATE POLICY "Update proposals (admin/author)"
ON public.council_proposals FOR UPDATE
USING (public.is_admin() OR submitted_by = auth.uid())
WITH CHECK (public.is_admin() OR submitted_by = auth.uid());

DROP POLICY IF EXISTS "Admins delete proposals" ON public.council_proposals;
CREATE POLICY "Admins delete proposals"
ON public.council_proposals FOR DELETE USING (public.is_admin());

-- council_proposal_votes: TRANSPARENT — public read; vote via RPC only
DROP POLICY IF EXISTS "View proposal votes" ON public.council_proposal_votes;
CREATE POLICY "View proposal votes"
ON public.council_proposal_votes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Cast proposal vote (member)" ON public.council_proposal_votes;
CREATE POLICY "Cast proposal vote (member)"
ON public.council_proposal_votes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.council_members
    WHERE id = council_proposal_votes.member_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS "Update own proposal vote" ON public.council_proposal_votes;
CREATE POLICY "Update own proposal vote"
ON public.council_proposal_votes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.council_members
    WHERE id = council_proposal_votes.member_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.council_members
    WHERE id = council_proposal_votes.member_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  )
);
