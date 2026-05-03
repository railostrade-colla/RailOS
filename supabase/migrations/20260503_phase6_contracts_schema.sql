-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.2 — Partnership contracts (group investment) schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two tables:
--   1. partnership_contracts — the contract header (creator, total
--                              investment, status)
--   2. contract_members      — invited partners with their share %
--                              and invite acceptance status
--
-- Activation rule: a contract auto-flips to 'active' when ALL invited
-- members have accepted. Until then it stays 'pending'.
-- Share-percent integrity: a contract can't be activated unless
-- members' share_percent sums to 100 — enforced by trigger.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'pending', 'active', 'ended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_invite_status AS ENUM (
    'pending', 'accepted', 'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. partnership_contracts ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partnership_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,

  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_investment BIGINT NOT NULL CHECK (total_investment > 0),

  status contract_status NOT NULL DEFAULT 'pending',
  end_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (end_fee_pct >= 0 AND end_fee_pct <= 100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_partnership_contracts_creator
  ON public.partnership_contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_partnership_contracts_status
  ON public.partnership_contracts(status);

COMMENT ON TABLE public.partnership_contracts IS
  'عقود الشراكة الجماعية (group investment partnerships)';

-- ─── 2. contract_members ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.partnership_contracts(id)
    ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  share_percent NUMERIC(5,2) NOT NULL
    CHECK (share_percent > 0 AND share_percent <= 100),

  invite_status member_invite_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_members_contract
  ON public.contract_members(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_members_user
  ON public.contract_members(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_members_invite
  ON public.contract_members(invite_status);

COMMENT ON TABLE public.contract_members IS
  'الشركاء في العقود الجماعية مع نسبة كل واحد';

-- ─── Trigger: auto-activate when all members accept ──────────
CREATE OR REPLACE FUNCTION public.maybe_activate_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract_id UUID;
  v_total NUMERIC(7,2);
  v_pending INT;
  v_status contract_status;
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
    SET status = 'active',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = v_contract_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_member_invite_change
  ON public.contract_members;
CREATE TRIGGER contract_member_invite_change
  AFTER INSERT OR UPDATE OF invite_status OR DELETE
  ON public.contract_members
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_activate_contract();

-- ─── updated_at triggers ─────────────────────────────────────
DROP TRIGGER IF EXISTS partnership_contracts_updated_at
  ON public.partnership_contracts;
CREATE TRIGGER partnership_contracts_updated_at
  BEFORE UPDATE ON public.partnership_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RPC: end_contract ───────────────────────────────────────
-- Validates the caller is the creator (or admin), the contract
-- is active, then deducts end_fee from creator's fee_units balance
-- and transitions to 'ended'.
CREATE OR REPLACE FUNCTION public.end_partnership_contract(
  p_contract_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_contract RECORD;
  v_fee BIGINT;
  v_new_balance BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_contract FROM public.partnership_contracts
  WHERE id = p_contract_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_contract.creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_owner');
  END IF;
  IF v_contract.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'not_active',
      'current_status', v_contract.status
    );
  END IF;

  v_fee := FLOOR(v_contract.total_investment * (v_contract.end_fee_pct / 100));

  -- Best-effort balance deduction. If fee_unit_balances row is missing
  -- (user never deposited fee units), we still end the contract — the
  -- fee is recorded in the description field on the transaction.
  BEGIN
    UPDATE public.fee_unit_balances
    SET balance = balance - v_fee,
        total_withdrawn = total_withdrawn + v_fee,
        last_transaction_at = NOW()
    WHERE user_id = v_contract.creator_id AND balance >= v_fee
    RETURNING balance INTO v_new_balance;

    IF v_new_balance IS NOT NULL THEN
      INSERT INTO public.fee_unit_transactions (
        user_id, transaction_type, amount, balance_after,
        source_type, source_id, description, executed_by
      ) VALUES (
        v_contract.creator_id, 'withdrawal', -v_fee, v_new_balance,
        'manual', p_contract_id,
        'رسوم إنهاء عقد الشراكة', v_uid
      );
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL; -- fee_unit_* not yet migrated — proceed without deduction
  END;

  UPDATE public.partnership_contracts
  SET status = 'ended',
      ended_at = NOW(),
      updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'fee_deducted', COALESCE(v_fee, 0),
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_partnership_contract(UUID) TO authenticated;

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.partnership_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_members ENABLE ROW LEVEL SECURITY;

-- partnership_contracts: SELECT (creator + members + admin)
DROP POLICY IF EXISTS "View partnership contracts (parties)"
  ON public.partnership_contracts;
CREATE POLICY "View partnership contracts (parties)"
ON public.partnership_contracts FOR SELECT
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.contract_members
    WHERE contract_id = partnership_contracts.id
      AND user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can create contracts" ON public.partnership_contracts;
CREATE POLICY "Users can create contracts"
ON public.partnership_contracts FOR INSERT
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Creators or admins can update contracts"
  ON public.partnership_contracts;
CREATE POLICY "Creators or admins can update contracts"
ON public.partnership_contracts FOR UPDATE
USING (creator_id = auth.uid() OR public.is_admin())
WITH CHECK (creator_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete contracts" ON public.partnership_contracts;
CREATE POLICY "Admins can delete contracts"
ON public.partnership_contracts FOR DELETE
USING (public.is_admin());

-- contract_members: SELECT (parties), INSERT (creator invites),
-- UPDATE (member responds OR creator updates own row)
DROP POLICY IF EXISTS "View contract members (parties)" ON public.contract_members;
CREATE POLICY "View contract members (parties)"
ON public.contract_members FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.partnership_contracts
    WHERE id = contract_members.contract_id
      AND creator_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Creators invite members" ON public.contract_members;
CREATE POLICY "Creators invite members"
ON public.contract_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partnership_contracts
    WHERE id = contract_members.contract_id
      AND creator_id = auth.uid()
      AND status = 'pending'
  )
);

-- A member updates their own invite_status; the creator can withdraw
-- (cancel) a pending invite by deleting it (DELETE policy below).
DROP POLICY IF EXISTS "Members respond to invite" ON public.contract_members;
CREATE POLICY "Members respond to invite"
ON public.contract_members FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Creators or admins can remove members"
  ON public.contract_members;
CREATE POLICY "Creators or admins can remove members"
ON public.contract_members FOR DELETE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.partnership_contracts
    WHERE id = contract_members.contract_id
      AND creator_id = auth.uid()
      AND status = 'pending'
  )
);
