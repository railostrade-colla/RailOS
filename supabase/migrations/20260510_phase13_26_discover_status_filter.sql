-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.26 — Discover RPC: relax the status filter
-- Date: 2026-05-10
-- Idempotent.
--
-- Why:
--   Phase 13.17's get_discover_projects() filtered with
--   WHERE p.status = 'active'. That's too strict — projects in this
--   DB end up with various status values:
--     • 'active'       (canonical)
--     • 'published'    (legacy v1/v2 of admin_create_project)
--     • NULL           (legacy rows with the column unset)
--     • 'draft'        (still in admin draft mode — should NOT show)
--     • 'paused' / 'frozen' / 'archived' / 'cancelled' (off)
--   Strict equality dropped projects in the first three buckets,
--   which is why the founder sees "لا توجد مشاريع رائجة" even
--   though رايلوس is live with sold shares.
--
-- This migration replaces the function with a NEGATIVE filter:
-- include the project unless its status is explicitly one of the
-- "off" values OR it's still a 'draft' / 'pending' / 'review'.
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
    -- Phase 13.26 — negative filter: include unless explicitly off
    -- or still a draft. NULL status passes (legacy unset rows).
    WHERE COALESCE(LOWER(p.status::TEXT), 'active') NOT IN (
      'draft', 'pending', 'review',
      'paused', 'frozen', 'archived', 'cancelled', 'closed'
    )
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
  RAISE NOTICE 'Phase 13.26 discover status filter relaxed.';
  RAISE NOTICE '  Old: WHERE status = ''active''';
  RAISE NOTICE '  New: WHERE status NOT IN (draft, pending, paused, frozen, ...)';
  RAISE NOTICE '  NULL status now passes (legacy rows surface again).';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
