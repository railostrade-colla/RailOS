-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.69 — Hotfix: wrong enum names in contract invite RPCs
-- Date: 2026-05-12
-- Idempotent.
--
-- Bug: Phase 13.58 + 13.66 cast invite_status to a non-existent enum
-- name `contract_member_invite_status` and contract.status to
-- `partnership_contract_status`. The real enum names from the Phase
-- 6 schema are `member_invite_status` and `contract_status`. The
-- mistype caused the RPCs to crash with:
--   type "contract_member_invite_status" does not exist
-- and the front end surfaced it as "فشلت الموافقة" on every
-- contract-invite accept.
--
-- Fix: re-create both RPCs with the correct casts. Idempotent —
-- safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. respond_to_contract_invite (correct enum) ──────────────
DROP FUNCTION IF EXISTS public.respond_to_contract_invite(UUID, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.respond_to_contract_invite(
  p_contract_id   UUID,
  p_accept        BOOLEAN,
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_updated INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_contract_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  UPDATE public.contract_members
     SET invite_status  = (CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END)::member_invite_status,
         joined_at      = CASE WHEN p_accept THEN NOW() ELSE joined_at END,
         declined_at    = CASE WHEN NOT p_accept THEN NOW() ELSE declined_at END,
         decline_reason = CASE WHEN NOT p_accept THEN p_decline_reason ELSE decline_reason END
   WHERE contract_id = p_contract_id
     AND user_id     = v_uid
     AND invite_status = 'pending'
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_invite');
  END IF;

  RETURN jsonb_build_object('success', true, 'accepted', p_accept);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_contract_invite(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_contract_invite(UUID, BOOLEAN, TEXT) TO authenticated;


-- ─── 2. cancel_pending_contract (correct enums) ────────────────
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

  UPDATE public.contract_members
     SET invite_status  = 'declined'::member_invite_status,
         declined_at    = NOW(),
         decline_reason = COALESCE(
           NULLIF(TRIM(p_reason), ''),
           'تم سحب الدعوة من قِبل منشئ العقد'
         )
   WHERE contract_id = p_contract_id
     AND invite_status = 'pending';

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


-- Force PostgREST to reload schema cache so the new function shapes
-- become callable immediately.
NOTIFY pgrst, 'reload schema';


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.69 enum-name hotfix applied.';
  RAISE NOTICE '  ✓ respond_to_contract_invite uses member_invite_status';
  RAISE NOTICE '  ✓ cancel_pending_contract uses contract_status +';
  RAISE NOTICE '    member_invite_status';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
