-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2d: DIAGNOSE "listing created but not visible"
-- Date: 2026-05-14
--
-- This is NOT a migration — it's a diagnostic bundle. Run each query
-- separately and tell me the result of each one. We're looking for the
-- reason your fresh listing didn't appear on /exchange after you
-- created it.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Did the listing actually land in the table?
--    Look at the latest 5 listings sorted by created_at DESC.
--    If the one you just created is missing → create_listing RPC
--    failed silently. If it's there → the issue is in the read path.
SELECT id, seller_id, project_id, shares_offered, shares_sold,
       price_per_share, status, type, is_quick_sell,
       created_at, expires_at
  FROM public.listings
 ORDER BY created_at DESC
 LIMIT 5;

-- 2. If it landed: what is its status?
--    Expected: 'active'. Anything else (draft, pending, etc.) means
--    getExchangeListings filters it out.
SELECT id, status, type, expires_at, NOW() AS now_utc,
       (expires_at IS NOT NULL AND expires_at < NOW()) AS already_expired
  FROM public.listings
 ORDER BY created_at DESC
 LIMIT 1;

-- 3. Does it have a real seller_id and project_id (not NULL)?
SELECT id,
       seller_id IS NOT NULL AS has_seller,
       project_id IS NOT NULL AS has_project,
       shares_offered > 0 AS has_shares,
       price_per_share > 0 AS has_price
  FROM public.listings
 ORDER BY created_at DESC
 LIMIT 1;

-- 4. RLS check — what does the listings table policy look like?
--    The most common bug here is a policy that hides the seller's
--    own listing from themselves (e.g. "only OTHER users' listings").
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_clause
  FROM pg_policy
 WHERE polrelid = 'public.listings'::regclass;

-- 5. Is RLS even enabled on listings?
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
  FROM pg_class
 WHERE relname = 'listings' AND relnamespace = 'public'::regnamespace;

-- 6. Confirm the foreign tables the listings select JOINs exist and
--    aren't blocked by RLS at the project level. (RLS on projects
--    could nullify the join.)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_clause
  FROM pg_policy
 WHERE polrelid = 'public.projects'::regclass
   AND polcmd = 'r';  -- SELECT policies only
