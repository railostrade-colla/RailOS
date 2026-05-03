-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.3 — Support tickets schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two tables:
--   1. support_tickets   — header (subject, status, priority, category)
--   2. ticket_messages   — thread of messages (user + admin replies)
--
-- FAQs intentionally remain in mock-data — they're static content, no
-- need for DB management.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM (
    'technical', 'billing', 'kyc', 'complaint', 'feature_request', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM (
    'low', 'medium', 'high'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM (
    'new', 'in_progress', 'replied', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_sender_type AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. support_tickets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  category ticket_category NOT NULL DEFAULT 'other',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority
  ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned
  ON public.support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE public.support_tickets IS
  'تذاكر الدعم الفني (header + status)';

-- ─── 2. ticket_messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_type ticket_sender_type NOT NULL,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created
  ON public.ticket_messages(ticket_id, created_at);

COMMENT ON TABLE public.ticket_messages IS
  'رسائل/ردود التذاكر — thread كامل';

-- ─── Trigger: refresh ticket on new message ──────────────────
CREATE OR REPLACE FUNCTION public.refresh_ticket_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_tickets
  SET
    last_message_at = NEW.created_at,
    status = CASE
      WHEN status = 'closed' THEN 'closed'
      WHEN NEW.sender_type = 'admin' THEN 'replied'::ticket_status
      ELSE 'in_progress'::ticket_status
    END,
    updated_at = NOW()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_message_inserted ON public.ticket_messages;
CREATE TRIGGER ticket_message_inserted
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.refresh_ticket_on_message();

-- ─── updated_at trigger ──────────────────────────────────────
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── RPC: create_support_ticket ──────────────────────────────
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_body TEXT,
  p_category ticket_category DEFAULT 'other',
  p_priority ticket_priority DEFAULT 'medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF length(trim(p_subject)) = 0 OR length(trim(p_body)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_input');
  END IF;

  INSERT INTO public.support_tickets (user_id, subject, body, category, priority)
  VALUES (v_uid, p_subject, p_body, p_category, p_priority)
  RETURNING id INTO v_ticket_id;

  -- Mirror the body into the first message so the thread is uniform
  INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_type, body)
  VALUES (v_ticket_id, v_uid, 'user', p_body);

  RETURN jsonb_build_object('success', TRUE, 'ticket_id', v_ticket_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT, ticket_category, ticket_priority) TO authenticated;

-- ─── RPC: reply_to_ticket ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reply_to_ticket(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_sender_type ticket_sender_type;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF length(trim(p_body)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'empty_body');
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets
  WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Determine sender type (admin vs the ticket owner)
  IF public.is_admin() THEN
    v_sender_type := 'admin';
  ELSIF v_ticket.user_id = v_uid THEN
    v_sender_type := 'user';
  ELSE
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  IF v_ticket.status = 'closed' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ticket_closed');
  END IF;

  INSERT INTO public.ticket_messages (ticket_id, sender_id, sender_type, body)
  VALUES (p_ticket_id, v_uid, v_sender_type, p_body);

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_ticket(UUID, TEXT) TO authenticated;

-- ─── RPC: close_support_ticket ───────────────────────────────
CREATE OR REPLACE FUNCTION public.close_support_ticket(
  p_ticket_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_ticket FROM public.support_tickets
  WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF NOT (public.is_admin() OR v_ticket.user_id = v_uid) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  UPDATE public.support_tickets
  SET status = 'closed', closed_at = NOW(),
      closed_reason = COALESCE(p_reason, closed_reason),
      updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_support_ticket(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages  ENABLE ROW LEVEL SECURITY;

-- support_tickets: SELECT (owner + admin), INSERT (owner via RPC),
-- UPDATE (admin for status/assigned, owner for status='closed')
DROP POLICY IF EXISTS "View own tickets" ON public.support_tickets;
CREATE POLICY "View own tickets"
ON public.support_tickets FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Create own ticket" ON public.support_tickets;
CREATE POLICY "Create own ticket"
ON public.support_tickets FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Update tickets (admin/owner)" ON public.support_tickets;
CREATE POLICY "Update tickets (admin/owner)"
ON public.support_tickets FOR UPDATE
USING (public.is_admin() OR user_id = auth.uid())
WITH CHECK (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins delete tickets" ON public.support_tickets;
CREATE POLICY "Admins delete tickets"
ON public.support_tickets FOR DELETE USING (public.is_admin());

-- ticket_messages: SELECT/INSERT must verify ticket ownership or admin
DROP POLICY IF EXISTS "View ticket messages" ON public.ticket_messages;
CREATE POLICY "View ticket messages"
ON public.ticket_messages FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Send ticket message" ON public.ticket_messages;
CREATE POLICY "Send ticket message"
ON public.ticket_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_messages.ticket_id
        AND user_id = auth.uid()
    )
  )
);
