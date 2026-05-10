-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.12 — public RPC for project investor counts
-- Date: 2026-05-10
-- Idempotent.
--
-- Why:
--   The discover/home project card displays "المستثمرون" — the count
--   of distinct users holding shares > 0 in that project. The
--   client used to query `holdings` directly, but `holdings` has RLS
--   that restricts non-admin users to their own row. Result: every
--   discover card showed 0 investors for non-admin viewers.
--
--   This RPC returns ONLY the aggregate count (no user_ids, no shares
--   amounts, no PII), so it's safe to expose to anonymous/auth roles
--   without leaking who-owns-what.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_public_investor_counts(
  p_project_ids UUID[]
)
RETURNS TABLE (
  project_id UUID,
  investor_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.project_id,
    COUNT(DISTINCT h.user_id) AS investor_count
  FROM public.holdings h
  WHERE h.project_id = ANY(p_project_ids)
    AND COALESCE(h.shares, 0) > 0
  GROUP BY h.project_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_investor_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_investor_counts(UUID[]) TO authenticated, anon;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.12 public_investor_counts applied.';
  RAISE NOTICE '  ✓ get_public_investor_counts(uuid[]) -> count rows';
  RAISE NOTICE '  ✓ SECURITY DEFINER bypasses holdings RLS';
  RAISE NOTICE '  ✓ exposes only counts, no user_ids or shares amounts';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
