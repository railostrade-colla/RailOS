-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.60 — Fix RLS recursion on partnership_contracts <-> contract_members
-- Date: 2026-05-12
-- Idempotent.
--
-- Bug: the original Phase-6 policies (20260503_phase6_contracts_schema)
-- had a circular dependency:
--
--   partnership_contracts.SELECT
--     USING (... EXISTS SELECT FROM contract_members WHERE ...)
--   contract_members.SELECT
--     USING (... EXISTS SELECT FROM partnership_contracts WHERE ...)
--
-- When PostgreSQL evaluates either policy, the EXISTS subquery on the
-- other table fires THAT table's SELECT policy, which fires the
-- first one again → "infinite recursion detected in policy for
-- relation 'partnership_contracts'".
--
-- The error became reachable on contract creation as soon as the
-- INSERT path tried to read back the new row via .select("id"),
-- and trigger-driven membership reads from Phase 13.58 multiplied
-- the chance of hitting the recursion.
--
-- Fix: factor the cross-table checks into SECURITY DEFINER helper
-- functions. SD runs as the function owner (postgres), which
-- bypasses RLS by default — so the helpers can peek at the other
-- table without re-entering its policy.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Helper functions (SECURITY DEFINER bypass RLS) ──────────

CREATE OR REPLACE FUNCTION public._is_contract_member(
  p_contract_id UUID,
  p_user_id     UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contract_members
    WHERE contract_id = p_contract_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public._is_contract_creator(
  p_contract_id UUID,
  p_user_id     UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partnership_contracts
    WHERE id = p_contract_id AND creator_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public._is_contract_creator_pending(
  p_contract_id UUID,
  p_user_id     UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partnership_contracts
    WHERE id = p_contract_id
      AND creator_id = p_user_id
      AND status = 'pending'
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_contract_member(UUID, UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public._is_contract_creator(UUID, UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public._is_contract_creator_pending(UUID, UUID) TO authenticated;


-- ─── 2. Replace the recursive policies ──────────────────────────

-- partnership_contracts.SELECT — use the SD helper for the
-- cross-table membership check.
DROP POLICY IF EXISTS "View partnership contracts (parties)"
  ON public.partnership_contracts;
CREATE POLICY "View partnership contracts (parties)"
ON public.partnership_contracts FOR SELECT
USING (
  creator_id = auth.uid()
  OR public._is_contract_member(id, auth.uid())
  OR public.is_admin()
);

-- contract_members.SELECT — use the SD helper for the cross-table
-- creator check.
DROP POLICY IF EXISTS "View contract members (parties)"
  ON public.contract_members;
CREATE POLICY "View contract members (parties)"
ON public.contract_members FOR SELECT
USING (
  user_id = auth.uid()
  OR public._is_contract_creator(contract_id, auth.uid())
  OR public.is_admin()
);

-- contract_members.INSERT — same fix, pending-status helper.
DROP POLICY IF EXISTS "Creators invite members"
  ON public.contract_members;
CREATE POLICY "Creators invite members"
ON public.contract_members FOR INSERT
WITH CHECK (
  public._is_contract_creator_pending(contract_id, auth.uid())
);

-- contract_members.DELETE — same pattern.
DROP POLICY IF EXISTS "Creators or admins can remove members"
  ON public.contract_members;
CREATE POLICY "Creators or admins can remove members"
ON public.contract_members FOR DELETE
USING (
  public._is_contract_creator(contract_id, auth.uid())
  OR public.is_admin()
);


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.60 contracts RLS recursion hotfix applied.';
  RAISE NOTICE '  ✓ _is_contract_member / _is_contract_creator';
  RAISE NOTICE '    / _is_contract_creator_pending SD helpers';
  RAISE NOTICE '  ✓ 4 policies rewritten to break the recursion';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
