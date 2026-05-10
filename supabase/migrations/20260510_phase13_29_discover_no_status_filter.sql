-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.29 — Discover RPC: drop the status filter entirely
-- Date: 2026-05-10
-- Idempotent.
--
-- Why:
--   Phase 13.26 relaxed the filter from `status = 'active'` to a
--   negative IN list. The founder's project رايلوس still didn't
--   surface — its actual DB status is something we can't predict
--   ('draft' from the legacy create RPC default? a custom legacy
--   value?). Phase 13.28 already dropped the JS-side filter; this
--   migration mirrors that decision server-side so the canonical
--   RPC also ignores status.
--
--   Soft-deleted / admin-archived rows are still hidden via the
--   projects RLS policy (the row simply isn't returned to non-admin
--   callers), so removing the WHERE clause here doesn't leak
--   anything that wasn't already visible.
--
--   The "draft means hidden" UX is preserved by the admin Projects
--   panel: drafts live in the مسوّداتي tab and aren't sent to the
--   discover surface that way.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_discover_projects(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_discover_projects(
  p_tab   TEXT,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_description TEXT,
  description TEXT,
  project_type TEXT,
  logo_url TEXT,
  cover_url TEXT,
  cover_image_url TEXT,
  symbol TEXT,
  total_shares BIGINT,
  share_price BIGINT,
  total_value BIGINT,
  current_market_price BIGINT,
  offering_percentage NUMERIC,
  status TEXT,
  offering_start_date TIMESTAMPTZ,
  offering_end_date TIMESTAMPTZ,
  duration_open BOOLEAN,
  duration_months INTEGER,
  created_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  risk_level TEXT,
  expected_return_min NUMERIC,
  expected_return_max NUMERIC,
  distribution_type TEXT,
  discover_tag TEXT,
  investor_count BIGINT,
  is_pinned BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab TEXT := COALESCE(p_tab, 'trending');
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 6), 50));
BEGIN
  IF v_tab NOT IN ('trending', 'coming_soon', 'new') THEN
    v_tab := 'trending';
  END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT
      h.project_id,
      COUNT(DISTINCT h.user_id)::BIGINT AS investor_count
    FROM public.holdings h
    WHERE COALESCE(h.shares, 0) > 0
    GROUP BY h.project_id
  ),
  base AS (
    SELECT
      p.id, p.name, p.short_description, p.description, p.project_type,
      p.logo_url, p.cover_url, p.cover_image_url, p.symbol,
      p.total_shares::BIGINT,
      p.share_price::BIGINT,
      p.total_value::BIGINT,
      p.current_market_price::BIGINT,
      p.offering_percentage::NUMERIC,
      p.status::TEXT,
      p.offering_start_date,
      p.offering_end_date,
      p.duration_open,
      p.duration_months,
      p.created_at,
      p.published_at,
      p.risk_level::TEXT,
      p.expected_return_min::NUMERIC,
      p.expected_return_max::NUMERIC,
      p.distribution_type::TEXT,
      p.discover_tag::TEXT,
      COALESCE(c.investor_count, 0)::BIGINT AS investor_count,
      (p.discover_tag = v_tab) AS is_pinned
    FROM public.projects p
    LEFT JOIN counts c ON c.project_id = p.id
    -- Phase 13.29 — no status filter. RLS hides what shouldn't
    -- be visible; everything readable is eligible for Discover.
  )
  SELECT * FROM base b
  WHERE
    b.is_pinned
    OR (
      CASE v_tab
        WHEN 'trending' THEN
          TRUE
        WHEN 'new' THEN
          b.created_at > NOW() - INTERVAL '30 days'
        WHEN 'coming_soon' THEN
          b.offering_start_date IS NOT NULL
          AND b.offering_start_date > NOW()
      END
    )
  ORDER BY
    b.is_pinned DESC,
    CASE WHEN v_tab = 'trending'    THEN b.investor_count END DESC NULLS LAST,
    CASE WHEN v_tab = 'new'         THEN b.created_at      END DESC NULLS LAST,
    CASE WHEN v_tab = 'coming_soon' THEN b.offering_start_date END ASC NULLS LAST,
    b.created_at DESC
  LIMIT v_limit;
END
$$;

REVOKE ALL ON FUNCTION public.get_discover_projects(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discover_projects(TEXT, INTEGER) TO authenticated, anon;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.29 discover status filter removed.';
  RAISE NOTICE '  Discover now lists every project the RLS exposes.';
  RAISE NOTICE '  Hide unwanted projects by deleting them from the';
  RAISE NOTICE '  admin Projects panel (the soft-delete RLS keeps';
  RAISE NOTICE '  them out of the user-side surface).';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
