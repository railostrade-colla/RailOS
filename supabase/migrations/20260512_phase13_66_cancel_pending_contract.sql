-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.66 — Cancel a pending partnership contract (creator side)
-- Date: 2026-05-12
-- Idempotent.
--
-- Founder spec: the creator should be able to abort a contract while
-- it's still in `pending` status (no all-members-accepted, no
-- activation). Existing `end_partnership_contract` RPC requires
-- `status = 'active'`, so we add a sibling for the pending path.
--
-- Semantics:
--   • Status flips to `cancelled` + cancelled_at = NOW().
--   • Pending member invites are marked declined so the
--     contract-invite modal no longer surfaces them.
--   • Triggered notifications for invitees (via the existing
--     trg_notify_contract_invite_responded) inform them the
--     creator withdrew. No fees, no share movements — nothing
--     was active yet.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.cancel_pending_contract(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_pending_contract(
  p_contract_id UUID,
  p_reason      TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_contract RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_contract_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT id, creator_id, status
    INTO v_contract
    FROM public.partnership_contracts
   WHERE id = p_contract_id;

  IF v_contract.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_contract.creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;
  IF v_contract.status::TEXT <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending');
  END IF;

  -- Mark all still-pending invites as declined so the global
  -- ContractInviteModal stops popping them up. The existing
  -- trg_notify_contract_invite_responded fires per-row to tell
  -- invitees that the contract was withdrawn.
  UPDATE public.contract_members
     SET invite_status  = 'declined'::member_invite_status,
         declined_at    = NOW(),
         decline_reason = COALESCE(
           NULLIF(TRIM(p_reason), ''),
           'تم سحب الدعوة من قِبل منشئ العقد'
         )
   WHERE contract_id = p_contract_id
     AND invite_status = 'pending';

  -- Flip the contract itself to cancelled.
  UPDATE public.partnership_contracts
     SET status              = 'cancelled'::contract_status,
         cancelled_at        = NOW(),
         cancellation_reason = NULLIF(TRIM(p_reason), ''),
         updated_at          = NOW()
   WHERE id = p_contract_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_contract(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_pending_contract(UUID, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.66 cancel_pending_contract applied.';
  RAISE NOTICE '  ✓ cancel_pending_contract(id, reason) RPC';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
