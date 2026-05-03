-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.3a — Multi-account contracts (member permissions + balance
-- + holdings + transactions)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Extends Phase 6.2 schema (partnership_contracts + contract_members)
-- with the pieces needed to switch a user between their personal
-- account and any contract they're a part of.
--
-- Additions:
--   • contract_member_permission enum (view_only | buy_only | buy_and_sell)
--   • contract_members.permission column (default view_only)
--   • partnership_contracts.total_balance column (live cash balance)
--   • Trigger that initialises total_balance = total_investment on
--     INSERT so existing createContract() doesn't need changes.
--   • contract_holdings table (per-project shares + cost basis)
--   • contract_transactions table (audit log)
--   • RPC get_user_contracts() — list active contracts for the
--     account-switcher dropdown
--   • RPC update_member_permission() — creator-only mutation
--
-- Deferred to phase 9.3b:
--   • execute_contract_trade RPC + /exchange integration. Trades from
--     contract balance need their own atomic flow + UI; we leave the
--     existing /exchange flow untouched for now.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Permission enum ──────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE contract_member_permission AS ENUM (
    'view_only', 'buy_only', 'buy_and_sell'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. New columns on existing tables ───────────────────────
ALTER TABLE public.contract_members
  ADD COLUMN IF NOT EXISTS permission contract_member_permission
    NOT NULL DEFAULT 'view_only';

ALTER TABLE public.partnership_contracts
  ADD COLUMN IF NOT EXISTS total_balance BIGINT NOT NULL DEFAULT 0;

-- Backfill: any existing contract that's still pending/active gets its
-- total_balance set to the original total_investment so legacy rows
-- behave like fresh ones.
UPDATE public.partnership_contracts
SET total_balance = total_investment
WHERE total_balance = 0
  AND status IN ('active', 'pending');

-- BEFORE INSERT trigger: auto-mirror total_investment → total_balance
-- when the caller didn't set it explicitly. Keeps the existing
-- createContract() data layer call working unchanged.
CREATE OR REPLACE FUNCTION public.contract_set_initial_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.total_balance IS NULL OR NEW.total_balance = 0 THEN
    NEW.total_balance := NEW.total_investment;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contract_set_initial_balance_trg
  ON public.partnership_contracts;
CREATE TRIGGER contract_set_initial_balance_trg
  BEFORE INSERT ON public.partnership_contracts
  FOR EACH ROW EXECUTE FUNCTION public.contract_set_initial_balance();

-- ─── 3. contract_holdings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.partnership_contracts(id)
    ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id)
    ON DELETE RESTRICT,
  shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
  total_invested BIGINT NOT NULL DEFAULT 0 CHECK (total_invested >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contract_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_holdings_contract
  ON public.contract_holdings(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_holdings_project
  ON public.contract_holdings(project_id);

COMMENT ON TABLE public.contract_holdings IS
  'حصص العقود الجماعية في كل مشروع — تُحدَّث عند تنفيذ صفقة من العقد';

-- ─── 4. contract_transactions ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.partnership_contracts(id)
    ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES public.profiles(id)
    ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN ('buy', 'sell', 'deposit', 'withdraw', 'distribution')
  ),
  amount BIGINT NOT NULL,
  shares INTEGER,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_transactions_contract
  ON public.contract_transactions(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_transactions_initiator
  ON public.contract_transactions(initiator_id);

COMMENT ON TABLE public.contract_transactions IS
  'سجلّ معاملات العقد الجماعي — buy/sell/deposit/withdraw/distribution';

-- ─── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE public.contract_holdings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View contract holdings (parties)" ON public.contract_holdings;
CREATE POLICY "View contract holdings (parties)"
ON public.contract_holdings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partnership_contracts pc
    WHERE pc.id = contract_holdings.contract_id
      AND (
        pc.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contract_members cm
          WHERE cm.contract_id = pc.id
            AND cm.user_id = auth.uid()
            AND cm.invite_status = 'accepted'
        )
      )
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "View contract transactions (parties)" ON public.contract_transactions;
CREATE POLICY "View contract transactions (parties)"
ON public.contract_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.partnership_contracts pc
    WHERE pc.id = contract_transactions.contract_id
      AND (
        pc.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contract_members cm
          WHERE cm.contract_id = pc.id
            AND cm.user_id = auth.uid()
            AND cm.invite_status = 'accepted'
        )
      )
  )
  OR public.is_admin()
);

-- INSERT policies are intentionally NOT added here — direct inserts
-- from clients are blocked. All writes will go through the trade
-- RPC in phase 9.3b (SECURITY DEFINER).

-- ─── 6. updated_at trigger for contract_holdings ─────────────
DROP TRIGGER IF EXISTS contract_holdings_updated_at ON public.contract_holdings;
CREATE TRIGGER contract_holdings_updated_at
  BEFORE UPDATE ON public.contract_holdings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 7. RPC: get_user_contracts ──────────────────────────────
-- Returns the list of active contracts the caller is a party of
-- (creator OR accepted member). Powers the AccountSwitcher dropdown.
CREATE OR REPLACE FUNCTION public.get_user_contracts()
RETURNS TABLE (
  contract_id UUID,
  contract_title TEXT,
  is_creator BOOLEAN,
  permission TEXT,
  total_balance BIGINT,
  status contract_status
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    pc.id            AS contract_id,
    pc.title         AS contract_title,
    (pc.creator_id = v_uid) AS is_creator,
    CASE
      WHEN pc.creator_id = v_uid THEN 'creator'
      ELSE COALESCE(cm.permission::TEXT, 'view_only')
    END              AS permission,
    pc.total_balance,
    pc.status
  FROM public.partnership_contracts pc
  LEFT JOIN public.contract_members cm
    ON cm.contract_id = pc.id
       AND cm.user_id = v_uid
       AND cm.invite_status = 'accepted'
  WHERE pc.status IN ('pending', 'active')
    AND (
      pc.creator_id = v_uid
      OR (cm.user_id = v_uid AND cm.invite_status = 'accepted')
    )
  ORDER BY pc.title;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_user_contracts() TO authenticated;

-- ─── 8. RPC: update_member_permission ────────────────────────
-- Creator-only mutation that changes a member's permission.
CREATE OR REPLACE FUNCTION public.update_member_permission(
  p_member_id UUID,
  p_permission contract_member_permission
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_creator_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT pc.creator_id INTO v_creator_id
  FROM public.contract_members cm
  JOIN public.partnership_contracts pc ON pc.id = cm.contract_id
  WHERE cm.id = p_member_id;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_creator');
  END IF;

  UPDATE public.contract_members
  SET permission = p_permission
  WHERE id = p_member_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.update_member_permission(
  UUID, contract_member_permission
) TO authenticated;
