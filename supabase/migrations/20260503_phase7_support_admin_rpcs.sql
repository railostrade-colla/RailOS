-- ═══════════════════════════════════════════════════════════════════
-- Phase 7 — Support admin RPCs
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
-- All RPCs SECURITY DEFINER + is_admin() check.
--
-- Note: create_support_ticket / reply_to_ticket / close_support_ticket
-- already exist from phase 6.3. This migration adds the assignment +
-- status RPCs needed by the admin inbox.
-- ═══════════════════════════════════════════════════════════════════

-- Assign a ticket to an admin (or unassign by passing NULL)
CREATE OR REPLACE FUNCTION public.admin_assign_ticket(
  p_ticket_id UUID,
  p_assignee_id UUID
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

  UPDATE public.support_tickets
  SET assigned_to = p_assignee_id,
      status = CASE
        WHEN p_assignee_id IS NOT NULL AND status = 'new'
          THEN 'in_progress'::ticket_status
        ELSE status END,
      updated_at = NOW()
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_ticket(UUID, UUID) TO authenticated;

-- Set ticket status (admin override; users only close their own via
-- the existing close_support_ticket RPC)
CREATE OR REPLACE FUNCTION public.admin_set_ticket_status(
  p_ticket_id UUID,
  p_status ticket_status
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

  UPDATE public.support_tickets
  SET status = p_status,
      closed_at = CASE WHEN p_status = 'closed' THEN NOW() ELSE closed_at END,
      updated_at = NOW()
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_ticket_status(UUID, ticket_status) TO authenticated;
