-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.68 — Fix contract activation trigger blocked by RLS
-- Date: 2026-05-12
-- Idempotent.
--
-- Bug: when an invited partner (NOT the creator) accepts a contract
-- invite, the AFTER UPDATE trigger `maybe_activate_contract` tries to
-- UPDATE partnership_contracts SET status='active'. The trigger
-- function inherits the CALLER's identity (no SECURITY DEFINER) so
-- the UPDATE goes through the table's UPDATE policy
-- ("creator_id = auth.uid() OR public.is_admin()") and is rejected
-- — the accepting user is a member, not the creator.
--
-- The rejection bubbles up as the trigger's own exception, the entire
-- RPC transaction rolls back, and the client sees a generic
-- "فشلت الموافقة" because the underlying Postgres error string isn't
-- mapped on the front end.
--
-- Fix: mark the trigger function SECURITY DEFINER so it runs as the
-- function owner (postgres) and bypasses RLS. The trigger's logic
-- only flips status when EVERY member has responded and shares sum
-- to 100 — those checks already enforce the safe activation gate, so
-- bypassing RLS here is sound.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.maybe_activate_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_total       NUMERIC(7,2);
  v_pending     INT;
  v_status      contract_status;
BEGIN
  v_contract_id := COALESCE(NEW.contract_id, OLD.contract_id);

  SELECT status INTO v_status FROM public.partnership_contracts
  WHERE id = v_contract_id;

  -- Only auto-activate if currently pending.
  IF v_status <> 'pending' THEN RETURN NEW; END IF;

  SELECT
    COALESCE(SUM(share_percent) FILTER (WHERE invite_status = 'accepted'), 0),
    COUNT(*) FILTER (WHERE invite_status = 'pending')
    INTO v_total, v_pending
  FROM public.contract_members
  WHERE contract_id = v_contract_id;

  -- Activate only when no pending invites remain AND share-percent
  -- of accepted members equals 100. This protects against partial
  -- activation if someone declines (creator can re-invite to fill).
  IF v_pending = 0 AND v_total = 100 THEN
    UPDATE public.partnership_contracts
    SET status     = 'active',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = v_contract_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger binding already exists; re-attach in case it was dropped
-- (idempotent — same name).
DROP TRIGGER IF EXISTS contract_member_invite_change
  ON public.contract_members;
CREATE TRIGGER contract_member_invite_change
  AFTER INSERT OR UPDATE OF invite_status OR DELETE
  ON public.contract_members
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_activate_contract();


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.68 trigger SECURITY DEFINER hotfix applied.';
  RAISE NOTICE '  ✓ maybe_activate_contract bypasses RLS now';
  RAISE NOTICE '  ✓ partner accept no longer blocked by creator-only';
  RAISE NOTICE '    UPDATE policy on partnership_contracts';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
