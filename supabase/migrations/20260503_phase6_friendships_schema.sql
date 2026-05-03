-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.3 — Friendships schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two tables:
--   1. friend_requests — pending/accepted/declined/cancelled invites
--   2. friendships     — accepted bidirectional relationships
--                         (canonicalized user_a < user_b)
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUM ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE friend_request_status AS ENUM (
    'pending', 'accepted', 'declined', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. friend_requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status friend_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id <> recipient_id)
);

-- Only one pending request can exist between a given pair at a time
-- (resending after decline/cancel allowed because old row is no longer pending).
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_unique_pending
  ON public.friend_requests (sender_id, recipient_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient
  ON public.friend_requests(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
  ON public.friend_requests(sender_id, status);

COMMENT ON TABLE public.friend_requests IS
  'طلبات الصداقة (pending → accepted/declined/cancelled)';

-- ─── 2. friendships ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id_a < user_id_b),
  UNIQUE(user_id_a, user_id_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON public.friendships(user_id_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON public.friendships(user_id_b);

COMMENT ON TABLE public.friendships IS
  'الصداقات المقبولة — canonicalized user_a < user_b للوحدانية';

-- ─── Trigger: create friendship on accept ────────────────────
CREATE OR REPLACE FUNCTION public.on_friend_request_accepted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_a UUID;
  v_b UUID;
BEGIN
  IF NEW.status = 'accepted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    v_a := LEAST(NEW.sender_id, NEW.recipient_id);
    v_b := GREATEST(NEW.sender_id, NEW.recipient_id);

    INSERT INTO public.friendships (user_id_a, user_id_b)
    VALUES (v_a, v_b)
    ON CONFLICT DO NOTHING;

    NEW.responded_at := NOW();
  ELSIF NEW.status IN ('declined', 'cancelled')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.responded_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_request_status_change ON public.friend_requests;
CREATE TRIGGER friend_request_status_change
  BEFORE INSERT OR UPDATE OF status
  ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_friend_request_accepted();

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── RPC: send_friend_request ────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_recipient_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_a UUID;
  v_b UUID;
  v_request_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF v_uid = p_recipient_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_befriend_self');
  END IF;

  -- Already friends?
  v_a := LEAST(v_uid, p_recipient_id);
  v_b := GREATEST(v_uid, p_recipient_id);
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id_a = v_a AND user_id_b = v_b
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_friends');
  END IF;

  -- Existing pending request?
  IF EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'pending'
      AND (
        (sender_id = v_uid AND recipient_id = p_recipient_id)
        OR (sender_id = p_recipient_id AND recipient_id = v_uid)
      )
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'request_pending');
  END IF;

  INSERT INTO public.friend_requests (sender_id, recipient_id, message)
  VALUES (v_uid, p_recipient_id, p_message)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', TRUE, 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID, TEXT) TO authenticated;

-- ─── RPC: respond_to_friend_request ──────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  p_request_id UUID,
  p_accept BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_request RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_request FROM public.friend_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_request.recipient_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_recipient');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_responded');
  END IF;

  UPDATE public.friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted'::friend_request_status
                    ELSE 'declined'::friend_request_status END
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', TRUE, 'accepted', p_accept);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(UUID, BOOLEAN) TO authenticated;

-- ─── RPC: cancel_friend_request ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_friend_request(
  p_request_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_request RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_request FROM public.friend_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_request.sender_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_sender');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_pending');
  END IF;

  UPDATE public.friend_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID) TO authenticated;

-- ─── RPC: unfriend ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unfriend(
  p_other_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_a UUID;
  v_b UUID;
  v_deleted INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  v_a := LEAST(v_uid, p_other_user_id);
  v_b := GREATEST(v_uid, p_other_user_id);

  DELETE FROM public.friendships
  WHERE user_id_a = v_a AND user_id_b = v_b;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_friends');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unfriend(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships     ENABLE ROW LEVEL SECURITY;

-- friend_requests: SELECT (sender + recipient + admin),
-- INSERT (sender = self), UPDATE (recipient or sender), DELETE (admin)
DROP POLICY IF EXISTS "View friend requests (parties)" ON public.friend_requests;
CREATE POLICY "View friend requests (parties)"
ON public.friend_requests FOR SELECT
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Send friend request" ON public.friend_requests;
CREATE POLICY "Send friend request"
ON public.friend_requests FOR INSERT
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Update friend request (parties)" ON public.friend_requests;
CREATE POLICY "Update friend request (parties)"
ON public.friend_requests FOR UPDATE
USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin())
WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins delete friend requests" ON public.friend_requests;
CREATE POLICY "Admins delete friend requests"
ON public.friend_requests FOR DELETE USING (public.is_admin());

-- friendships: SELECT (parties + admin), DELETE (parties + admin),
-- INSERT happens through trigger only
DROP POLICY IF EXISTS "View own friendships" ON public.friendships;
CREATE POLICY "View own friendships"
ON public.friendships FOR SELECT
USING (
  user_id_a = auth.uid()
  OR user_id_b = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Delete own friendship" ON public.friendships;
CREATE POLICY "Delete own friendship"
ON public.friendships FOR DELETE
USING (
  user_id_a = auth.uid()
  OR user_id_b = auth.uid()
  OR public.is_admin()
);

-- INSERT is performed by SECURITY DEFINER trigger; deny direct inserts
-- by simply not adding an INSERT policy (default deny).
