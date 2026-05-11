-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.51 — Community users RPC
-- Date: 2026-05-11
-- Idempotent.
--
-- Founder spec: the /community page must reliably show ALL
-- registered users (the canonical sign-up registry), regardless
-- of whether Phase 13.50's `profiles_public` view exists or
-- whether the schema has level/total_trades columns.
--
-- A SECURITY DEFINER RPC sidesteps every gotcha:
--   • bypasses RLS (so users see each other even with strict
--     row-level policy)
--   • runs as `postgres` so it can read any column the table has
--   • returns a stable shape regardless of which migrations are
--     applied — missing columns become NULL/defaults
--   • centralises the "safe to expose" column list in one place
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_community_users(INT);

CREATE OR REPLACE FUNCTION public.get_community_users(p_limit INT DEFAULT 500)
RETURNS TABLE (
  id                 UUID,
  full_name          TEXT,
  username           TEXT,
  avatar_url         TEXT,
  role               TEXT,
  level              TEXT,
  kyc_status         TEXT,
  rating_average     NUMERIC,
  rating_count       INT,
  total_trades       INT,
  successful_trades  INT,
  is_ambassador      BOOLEAN,
  created_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_has_level        BOOLEAN;
  v_has_total        BOOLEAN;
  v_has_successful   BOOLEAN;
  v_has_ambassador   BOOLEAN;
  v_sql              TEXT;
BEGIN
  -- Detect optional columns once (cached for the call).
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='level')
    INTO v_has_level;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='total_trades')
    INTO v_has_total;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='successful_trades')
    INTO v_has_successful;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_ambassador')
    INTO v_has_ambassador;

  v_sql := format($f$
    SELECT
      p.id,
      p.full_name,
      p.username,
      p.avatar_url,
      COALESCE(p.role::TEXT, 'user') AS role,
      %s AS level,
      COALESCE(p.kyc_status::TEXT, 'not_submitted') AS kyc_status,
      COALESCE(p.rating_average, 0)::NUMERIC AS rating_average,
      COALESCE(p.rating_count, 0)::INT AS rating_count,
      %s AS total_trades,
      %s AS successful_trades,
      %s AS is_ambassador,
      p.created_at
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, FALSE) = FALSE
      AND COALESCE(p.is_active, TRUE) = TRUE
      AND ($1 IS NULL OR p.id <> $1)
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT $2
  $f$,
    CASE WHEN v_has_level      THEN 'COALESCE(p.level::TEXT, ''basic'')'
                               ELSE '''basic''::TEXT' END,
    CASE WHEN v_has_total      THEN 'COALESCE(p.total_trades, 0)::INT'
                               ELSE '0::INT' END,
    CASE WHEN v_has_successful THEN 'COALESCE(p.successful_trades, 0)::INT'
                               ELSE '0::INT' END,
    CASE WHEN v_has_ambassador THEN 'COALESCE(p.is_ambassador, FALSE)'
                               ELSE 'FALSE' END
  );

  RETURN QUERY EXECUTE v_sql USING v_uid, GREATEST(1, LEAST(p_limit, 2000));
END;
$$;

REVOKE ALL ON FUNCTION public.get_community_users(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_users(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_users(INT) TO anon;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.51 community users RPC applied.';
  RAISE NOTICE '  ✓ get_community_users(limit) → full registered registry';
  RAISE NOTICE '  ✓ Bypasses RLS via SECURITY DEFINER';
  RAISE NOTICE '  ✓ Tolerates missing schema columns';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
