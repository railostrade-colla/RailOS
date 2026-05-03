-- ═══════════════════════════════════════════════════════════════════
-- Phase 8.4 — Audit log helper + automatic admin-action logging
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- The audit_log table existed (with admin-only RLS for SELECT) but
-- nothing was actually writing to it. The AuditLogPanel only ever
-- showed mock rows. This migration ships:
--
--   1. log_admin_action(action, entity_type, entity_id, metadata)
--      A reusable SECURITY DEFINER helper. Silently skips if the
--      caller isn't an admin or no JWT is present. Wrapped in a
--      catch-all so audit logging can never break the parent
--      operation.
--
--   2. AFTER triggers on the most-sensitive admin-mutated tables.
--      Each trigger detects a relevant transition (status→approved,
--      role removal, deletion, etc.) and forwards a structured
--      action name + entity_id + metadata to log_admin_action().
--
--      Tables covered (10 total):
--        - healthcare_applications (review approve/reject)
--        - council_members (add / soft-remove)
--        - council_proposals (final decision)
--        - partnership_contracts (force end / cancel)
--        - share_modification_requests (approve / reject)
--        - share_modification_codes (super-admin generated)
--        - user_gifts (granted / revoked)
--        - companies (create / update / delete)
--        - discount_brands (activate / deactivate)
--        - auctions (cancel / end early)
--
-- Why triggers instead of patching every RPC:
--   - 30+ admin RPCs would each need re-creation with PERFORM calls.
--   - Triggers stay correct even if a future RPC mutates the same
--     row from a different code path.
--   - No need to redeploy the existing RPCs (Phase 7 + 9 stay
--     untouched).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Helper RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  -- Anonymous mutations (cron jobs, raw service-role writes) skip.
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  -- Only audit admin-driven changes. is_admin() returns FALSE for
  -- regular users, so triggers that fire for both user-driven and
  -- admin-driven changes self-filter without needing per-trigger logic.
  IF NOT public.is_admin() THEN RETURN NULL; END IF;

  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid, p_action, p_entity_type, p_entity_id, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Defensive: never let audit logging break the parent action.
  RETURN NULL;
END
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER FUNCTIONS — one per table, only logging meaningful actions
-- ═══════════════════════════════════════════════════════════════════

-- ─── 2. healthcare_applications ─────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_healthcare_app()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.log_admin_action(
      'healthcare_app_' || NEW.status,
      'healthcare_application',
      NEW.id,
      jsonb_build_object(
        'previous_status', OLD.status,
        'requested_amount', NEW.requested_amount,
        'rejection_reason', NEW.rejection_reason
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_healthcare_app_trg ON public.healthcare_applications;
CREATE TRIGGER audit_healthcare_app_trg
  AFTER UPDATE OF status ON public.healthcare_applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_healthcare_app();

-- ─── 3. council_members ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_council_member_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_action(
      'add_council_member',
      'council_member',
      NEW.id,
      jsonb_build_object(
        'role', NEW.role,
        'position_title', NEW.position_title,
        'user_id', NEW.user_id
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    PERFORM public.log_admin_action(
      'remove_council_member',
      'council_member',
      NEW.id,
      jsonb_build_object(
        'role', NEW.role,
        'user_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_council_member_insert_trg ON public.council_members;
CREATE TRIGGER audit_council_member_insert_trg
  AFTER INSERT ON public.council_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_council_member_change();

DROP TRIGGER IF EXISTS audit_council_member_update_trg ON public.council_members;
CREATE TRIGGER audit_council_member_update_trg
  AFTER UPDATE OF is_active ON public.council_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_council_member_change();

-- ─── 4. council_proposals (finalize) ────────────────────────
CREATE OR REPLACE FUNCTION public.audit_council_proposal_finalize()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.final_decision IS NOT NULL
     AND OLD.final_decision IS DISTINCT FROM NEW.final_decision THEN
    PERFORM public.log_admin_action(
      'finalize_proposal_' || NEW.final_decision,
      'council_proposal',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'votes_approve', NEW.votes_approve,
        'votes_object', NEW.votes_object,
        'votes_abstain', NEW.votes_abstain
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_council_proposal_trg ON public.council_proposals;
CREATE TRIGGER audit_council_proposal_trg
  AFTER UPDATE OF final_decision ON public.council_proposals
  FOR EACH ROW EXECUTE FUNCTION public.audit_council_proposal_finalize();

-- ─── 5. partnership_contracts (force end / cancel) ──────────
CREATE OR REPLACE FUNCTION public.audit_partnership_contract_terminate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('ended', 'cancelled') THEN
    PERFORM public.log_admin_action(
      CASE WHEN NEW.status = 'ended' THEN 'force_end_contract'
           ELSE 'cancel_contract' END,
      'contract',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'previous_status', OLD.status,
        'total_investment', NEW.total_investment,
        'cancellation_reason', NEW.cancellation_reason
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_partnership_contract_trg ON public.partnership_contracts;
CREATE TRIGGER audit_partnership_contract_trg
  AFTER UPDATE OF status ON public.partnership_contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_partnership_contract_terminate();

-- ─── 6. share_modification_requests ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_share_modification_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.log_admin_action(
      'share_modification_' || NEW.status,
      'share_modification_request',
      NEW.id,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'modification_type', NEW.modification_type,
        'shares_amount', NEW.shares_amount,
        'super_admin_note', NEW.super_admin_note
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_share_modification_trg ON public.share_modification_requests;
CREATE TRIGGER audit_share_modification_trg
  AFTER UPDATE OF status ON public.share_modification_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_share_modification_decision();

-- ─── 7. share_modification_codes (generation) ───────────────
CREATE OR REPLACE FUNCTION public.audit_share_code_generated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM public.log_admin_action(
    'generate_share_code',
    'share_modification_code',
    NEW.id,
    jsonb_build_object(
      'project_id', NEW.project_id,
      'expires_at', NEW.expires_at
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_share_code_insert_trg ON public.share_modification_codes;
CREATE TRIGGER audit_share_code_insert_trg
  AFTER INSERT ON public.share_modification_codes
  FOR EACH ROW EXECUTE FUNCTION public.audit_share_code_generated();

-- ─── 8. user_gifts ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_user_gift_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_action(
      'grant_gift',
      'user_gift',
      NEW.id,
      jsonb_build_object(
        'gift_type', NEW.gift_type,
        'recipient_user_id', NEW.user_id,
        'reason', NEW.granted_reason
      )
    );
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_action(
      'revoke_gift',
      'user_gift',
      OLD.id,
      jsonb_build_object(
        'gift_type', OLD.gift_type,
        'recipient_user_id', OLD.user_id
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS audit_user_gift_insert_trg ON public.user_gifts;
CREATE TRIGGER audit_user_gift_insert_trg
  AFTER INSERT ON public.user_gifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_gift_change();

DROP TRIGGER IF EXISTS audit_user_gift_delete_trg ON public.user_gifts;
CREATE TRIGGER audit_user_gift_delete_trg
  AFTER DELETE ON public.user_gifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_gift_change();

-- ─── 9. companies ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_company_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_action(
      'create_company',
      'company',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'sector', NEW.sector)
    );
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_admin_action(
      'update_company',
      'company',
      NEW.id,
      jsonb_build_object('name', NEW.name)
    );
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_action(
      'delete_company',
      'company',
      OLD.id,
      jsonb_build_object('name', OLD.name)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS audit_company_insert_trg ON public.companies;
CREATE TRIGGER audit_company_insert_trg
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();

DROP TRIGGER IF EXISTS audit_company_update_trg ON public.companies;
CREATE TRIGGER audit_company_update_trg
  AFTER UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();

DROP TRIGGER IF EXISTS audit_company_delete_trg ON public.companies;
CREATE TRIGGER audit_company_delete_trg
  AFTER DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_company_change();

-- ─── 10. discount_brands (activate / deactivate) ────────────
CREATE OR REPLACE FUNCTION public.audit_discount_active_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.log_admin_action(
      CASE WHEN NEW.is_active THEN 'activate_discount'
           ELSE 'deactivate_discount' END,
      'discount',
      NEW.id,
      jsonb_build_object(
        'brand_name', NEW.brand_name,
        'discount_percent', NEW.discount_percent
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_discount_active_trg ON public.discount_brands;
CREATE TRIGGER audit_discount_active_trg
  AFTER UPDATE OF is_active ON public.discount_brands
  FOR EACH ROW EXECUTE FUNCTION public.audit_discount_active_change();

-- ─── 11. auctions (cancel / end early) ──────────────────────
CREATE OR REPLACE FUNCTION public.audit_auction_terminate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'ended' AND OLD.status IN ('active', 'upcoming') THEN
    PERFORM public.log_admin_action(
      'cancel_auction',
      'auction',
      NEW.id,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'previous_status', OLD.status,
        'shares_offered', NEW.shares_offered
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_auction_terminate_trg ON public.auctions;
CREATE TRIGGER audit_auction_terminate_trg
  AFTER UPDATE OF status ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.audit_auction_terminate();
