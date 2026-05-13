-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2e: More speed indexes (round 2)
-- Date: 2026-05-14
-- Idempotent. Safe to re-run. Pure additions — no schema changes.
--
-- After Step 2c the portfolio dropdown loaded in <500 ms. This round
-- targets the OTHER hot paths in the user-facing app:
--
--   1. /exchange feed       (getExchangeListings)
--   2. /project/[id]        (price_history reads, market-state lookups)
--   3. Engine cron + caps   (apply_caps, v_project_monthly_rise)
--   4. Discover/dashboard   (projects.status filter)
--
-- All five indexes below are PARTIAL or COMPOSITE — designed to be
-- both small on disk AND a perfect match for the existing query
-- predicates. Each one is safe: no data change, no schema change,
-- only a new B-tree the planner can choose to use.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. listings — /exchange main feed
-- ─────────────────────────────────────────────────────────────────
-- Query is:  WHERE status='active' ORDER BY created_at DESC
-- A composite partial index covers BOTH predicates in one B-tree.
-- The planner can use this for an index-only scan + skip the sort.
CREATE INDEX IF NOT EXISTS idx_listings_active_recent
  ON public.listings (created_at DESC)
  WHERE status = 'active';

-- The PostgREST embed `seller:profiles!seller_id(...)` joins on
-- listings.seller_id. Without an index, every fetch does a sort
-- merge or nested loop with seq-scan. FK columns are not auto-indexed
-- in Postgres.
CREATE INDEX IF NOT EXISTS idx_listings_seller
  ON public.listings (seller_id);

-- Same story for the `project:projects!project_id(...)` embed.
CREATE INDEX IF NOT EXISTS idx_listings_project
  ON public.listings (project_id);


-- ─────────────────────────────────────────────────────────────────
-- 2. price_history — hot path for engine + project chart
-- ─────────────────────────────────────────────────────────────────
-- Discovery found ZERO indexes on price_history. Every read of:
--   • v_project_monthly_rise            (sector cap gate)
--   • get_project_yearly_rise()         (yearly cap)
--   • the project chart on /project/[id]
-- does a full sequential scan + sort. With one project that's
-- tolerable; once you have many projects + a year of history it gets
-- expensive fast.
CREATE INDEX IF NOT EXISTS idx_price_history_project_recent
  ON public.price_history (project_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────
-- 3. projects — discover, dashboard, holdings join
-- ─────────────────────────────────────────────────────────────────
-- Partial index covers the "anyone can view" RLS clause + the
-- discover-feed filter. Tiny because draft projects are excluded.
CREATE INDEX IF NOT EXISTS idx_projects_status_published
  ON public.projects (status)
  WHERE status <> 'draft';

-- created_by is hit by the RLS policy: "Anyone can view published
-- projects" uses `status <> 'draft' OR created_by = auth.uid()`.
-- An index on created_by makes the OR-branch cheap.
CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON public.projects (created_by);


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- 1. Confirm all 5 indexes were created in this round.
SELECT indexname, tablename
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN (
     'idx_listings_active_recent',
     'idx_listings_seller',
     'idx_listings_project',
     'idx_price_history_project_recent',
     'idx_projects_status_published',
     'idx_projects_created_by'
   )
 ORDER BY indexname;

-- 2. Benchmark /exchange feed query — should be < 50 ms cold,
--    sub-millisecond once cached.
EXPLAIN ANALYZE
SELECT id, seller_id, project_id, shares_offered, price_per_share,
       status, type, created_at
  FROM public.listings
 WHERE status = 'active'
 ORDER BY created_at DESC
 LIMIT 50;

-- 3. Benchmark price_history per-project lookup.
EXPLAIN ANALYZE
SELECT created_at, old_price, new_price, change_pct
  FROM public.price_history
 WHERE project_id = (SELECT id FROM public.projects LIMIT 1)
 ORDER BY created_at DESC
 LIMIT 100;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.2 Step 2e — More speed indexes added.';
  RAISE NOTICE '  ✓ listings.created_at DESC  (active partial)';
  RAISE NOTICE '  ✓ listings.seller_id        (FK embed)';
  RAISE NOTICE '  ✓ listings.project_id       (FK embed)';
  RAISE NOTICE '  ✓ price_history (project_id, created_at DESC)';
  RAISE NOTICE '  ✓ projects.status           (non-draft partial)';
  RAISE NOTICE '  ✓ projects.created_by       (RLS or-branch)';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected impact:';
  RAISE NOTICE '  /exchange         → faster cold load + JOINs';
  RAISE NOTICE '  /project/[id]     → instant price chart';
  RAISE NOTICE '  engine cron       → faster yearly/monthly caps';
  RAISE NOTICE '  discover/dashboard→ faster project lists';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
