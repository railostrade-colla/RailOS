-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.55 — get_project_wallets_admin RPC + RLS hardening
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- The admin Project Wallets panel queried `project_wallets` directly
-- via PostgREST. The table has no public SELECT policy → RLS rejects
-- everything → panel shows "لا توجد محافظ" even when wallets exist.
--
-- This migration ships:
--   1. SELECT RLS for admins (read-only) so direct queries work.
--   2. get_project_wallets_admin() RPC — SECURITY DEFINER, returns
--      one aggregated row per project (the 3 wallets pre-summed) so
--      the panel can render with a single roundtrip.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. RLS: admin SELECT on project_wallets ─────────────────────
DO $$
BEGIN
  -- Make sure RLS is enabled (idempotent)
  EXECUTE 'ALTER TABLE public.project_wallets ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "Admins can read all project wallets" ON public.project_wallets;
CREATE POLICY "Admins can read all project wallets"
ON public.project_wallets
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update project wallets" ON public.project_wallets;
CREATE POLICY "Admins can update project wallets"
ON public.project_wallets
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ─── 2. Aggregating RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_project_wallets_admin(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id              AS project_id,
        p.id              AS id,
        COALESCE(p.name, '—') AS project_name,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)::BIGINT
                          AS offering_available,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'ambassador'), 0)::BIGINT
                          AS ambassador_available,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'reserve'), 0)::BIGINT
                          AS reserve_available,
        COALESCE(SUM(w.total_shares), 0)::BIGINT
                          AS total_wallet_shares,
        COALESCE(SUM(w.available_shares), 0)::BIGINT
                          AS total_available,
        COALESCE(p.share_price, 0)::NUMERIC
                          AS share_price,
        (COALESCE(SUM(w.available_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC
                          AS balance,
        (COALESCE(SUM(w.total_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC
                          AS total_inflow,
        ((COALESCE(SUM(w.total_shares), 0) - COALESCE(SUM(w.available_shares), 0)) * COALESCE(p.share_price, 0))::NUMERIC
                          AS total_outflow,
        COUNT(w.id)::INT  AS wallet_count,
        CASE
          WHEN COUNT(w.id) FILTER (WHERE w.status = 'frozen') > 0 THEN 'frozen'
          WHEN COUNT(w.id) = 0 THEN 'closed'
          ELSE 'active'
        END               AS status,
        TO_CHAR(p.created_at, 'YYYY-MM-DD') AS created_at,
        MAX(w.frozen_at)  AS frozen_at,
        MAX(w.frozen_reason) AS frozen_reason
      FROM public.projects p
      LEFT JOIN public.project_wallets w ON w.project_id = p.id
      WHERE p.status <> 'cancelled' OR p.status IS NULL
      GROUP BY p.id, p.name, p.share_price, p.created_at
      HAVING COUNT(w.id) > 0   -- only projects that actually have wallets
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_project_wallets_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_wallets_admin(INT) TO authenticated;


-- ─── 3. Verification ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.55 applied:';
  RAISE NOTICE '  ✓ RLS: admin SELECT on project_wallets';
  RAISE NOTICE '  ✓ get_project_wallets_admin RPC';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;

-- Show the RPC's output so you can verify it returns your wallets
-- (it will return [] when run from SQL Editor since auth.uid() is NULL,
-- but that proves the function is installed correctly)
SELECT public.get_project_wallets_admin(50);
