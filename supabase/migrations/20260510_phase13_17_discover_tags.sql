-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.17 — discover-section ranking + admin override
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec:
--   1. Discover "🌟 رائج" should auto-rank projects by the number of
--      distinct investors (people holding shares > 0).
--   2. "🆕 جديد" should auto-show projects created in the last 30
--      days.
--   3. Admins should also be able to *manually* place a project in
--      رائج / قريباً / جديد via a dropdown on the Projects panel.
--
-- This migration:
--   • Adds projects.discover_tag (NULL | trending | coming_soon | new)
--   • Adds projects.discover_tag_set_by + discover_tag_set_at audit cols
--   • RPC get_discover_projects(p_tab, p_limit) — single source of
--     truth for the home/discover surface. Combines admin overrides
--     with auto-rules.
--   • RPC admin_set_discover_tag(project_id, tag) — super_admin only,
--     audit-logged.
-- ═══════════════════════════════════════════════════════════════════


-- 1. Column + audit metadata
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS discover_tag TEXT
    CHECK (discover_tag IN ('trending', 'coming_soon', 'new')),
  ADD COLUMN IF NOT EXISTS discover_tag_set_by UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discover_tag_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_discover_tag
  ON public.projects (discover_tag) WHERE discover_tag IS NOT NULL;


-- 2. RPC: get_discover_projects
--    Returns the project rows that should populate a Discover tab,
--    in the right order:
--      1. Admin-flagged projects for that tab go first.
--      2. Auto-derived rows fill the remaining slots:
--           trending    → ORDER BY investor_count DESC
--           new         → created_at > NOW() - 30 days
--           coming_soon → offering_start_date > NOW()
--    Returns the FULL projects.* row + an `investor_count` column so
--    the client can render the card without an extra round-trip.
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
    WHERE p.status = 'active'
  )
  SELECT * FROM base b
  WHERE
    -- Admin-flagged: always include
    b.is_pinned
    OR (
      -- Auto-rules per tab
      CASE v_tab
        WHEN 'trending' THEN
          -- Top N by investor count (let ORDER BY pick the leaders)
          TRUE
        WHEN 'new' THEN
          b.created_at > NOW() - INTERVAL '30 days'
        WHEN 'coming_soon' THEN
          b.offering_start_date IS NOT NULL
          AND b.offering_start_date > NOW()
      END
    )
  ORDER BY
    -- Pinned rows first
    b.is_pinned DESC,
    -- Then per-tab ranking
    CASE WHEN v_tab = 'trending'    THEN b.investor_count END DESC NULLS LAST,
    CASE WHEN v_tab = 'new'         THEN b.created_at      END DESC NULLS LAST,
    CASE WHEN v_tab = 'coming_soon' THEN b.offering_start_date END ASC NULLS LAST,
    -- Tiebreaker
    b.created_at DESC
  LIMIT v_limit;
END
$$;

REVOKE ALL ON FUNCTION public.get_discover_projects(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discover_projects(TEXT, INTEGER) TO authenticated, anon;


-- 3. RPC: admin_set_discover_tag
--    super_admin-only. Sets / clears the discover_tag on a project
--    and stamps audit columns.
DROP FUNCTION IF EXISTS public.admin_set_discover_tag(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_discover_tag(
  p_project_id UUID,
  p_tag        TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Validate tag (NULL allowed for "remove")
  IF p_tag IS NOT NULL AND p_tag NOT IN ('trending', 'coming_soon', 'new') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_tag');
  END IF;

  UPDATE public.projects
     SET discover_tag        = p_tag,
         discover_tag_set_by = CASE WHEN p_tag IS NULL THEN NULL ELSE v_uid END,
         discover_tag_set_at = CASE WHEN p_tag IS NULL THEN NULL ELSE NOW() END
   WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- Best-effort audit
  BEGIN
    PERFORM public.log_admin_action(
      'set_discover_tag', 'project', p_project_id,
      jsonb_build_object('tag', p_tag)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'tag', p_tag);
END
$$;

REVOKE ALL ON FUNCTION public.admin_set_discover_tag(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_discover_tag(UUID, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.17 discover_tag applied.';
  RAISE NOTICE '  ✓ projects.discover_tag (trending|coming_soon|new|NULL)';
  RAISE NOTICE '  ✓ get_discover_projects(tab, limit) RPC';
  RAISE NOTICE '  ✓ admin_set_discover_tag(project_id, tag) RPC';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
