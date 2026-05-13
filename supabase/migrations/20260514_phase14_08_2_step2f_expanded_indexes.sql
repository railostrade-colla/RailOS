-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2f: Expanded performance indexes (HIGH + MED)
-- Date: 2026-05-14
-- Idempotent. Schema-tolerant. Safe to re-run.
--
-- This is the third and final pass of the Phase 14.08.2 performance
-- audit. Step 2c (5 indexes) fixed the >60s holdings RPC. Step 2e
-- (6 indexes) covered the /exchange feed, /project chart, and the
-- engine cron's caps reads.
--
-- This pass — Step 2f — addresses every HIGH and MED gap surfaced in
-- the full 20-table audit. 25 indexes across 13 tables.
--
-- Design rules followed for every entry:
--   • CREATE INDEX IF NOT EXISTS — re-runnable.
--   • Wrapped in a DO block that checks both the TABLE and the
--     COLUMN exist via information_schema before issuing the DDL.
--     Lets the migration run cleanly even on a partially-migrated
--     DB where one of these tables hasn't been created yet.
--   • Composite ordering chosen to match the most common WHERE +
--     ORDER BY together (so the planner can do index-only scans
--     and skip the sort).
--   • Partial indexes used where the WHERE clause is constant
--     (e.g. WHERE status='active') so the index is small on disk.
--
-- Trade-off note on CONCURRENTLY:
--   CREATE INDEX CONCURRENTLY cannot run inside a DO block or a
--   transaction. Since our migration is wrapped in BEGIN/COMMIT and
--   uses DO blocks for schema tolerance, we use the plain form. On
--   a Supabase production DB with active writes, the brief table
--   lock per index is acceptable; each one finishes in milliseconds
--   to seconds depending on row count. If you ever need to add an
--   index on a huge multi-million-row table later, run it standalone
--   outside any transaction with CONCURRENTLY.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Helper: a tiny DO-block macro replacement. For every index below
-- we copy the same pattern: verify table + column exist, then issue
-- the CREATE INDEX. Verbose but bullet-proof on partial schemas.


-- ═══════════════════════════════════════════════════════════════════
-- HIGH PRIORITY — 12 indexes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. profiles.kyc_status — KYC flow gate on every page ────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='kyc_status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status
             ON public.profiles (kyc_status)';
  END IF;
END $$;

-- ─── 2. notifications: bell list — (user_id, created_at DESC) ────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
             ON public.notifications (user_id, created_at DESC)';
  END IF;
END $$;

-- ─── 3. notifications: unread badge — partial on is_read=false ────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='is_read') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
             ON public.notifications (user_id)
             WHERE is_read = FALSE';
  END IF;
END $$;

-- ─── 4. news: public feed — partial on published=true ────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='news'
               AND column_name='published') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_published_recent
             ON public.news (published_at DESC)
             WHERE published = TRUE';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='news'
                  AND column_name='is_published') THEN
    -- Schema variant where the flag is named is_published.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_published_recent
             ON public.news (published_at DESC)
             WHERE is_published = TRUE';
  END IF;
END $$;

-- ─── 5. news: per-project feed ────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='news'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_project_recent
             ON public.news (project_id, published_at DESC)';
  END IF;
END $$;

-- ─── 6. wallets.user_id — session startup ─────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='wallets'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallets_user
             ON public.wallets (user_id)';
  END IF;
END $$;

-- ─── 7. wallets: typed balance lookup ─────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='wallets'
               AND column_name='wallet_type') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallets_user_type
             ON public.wallets (user_id, wallet_type)';
  END IF;
END $$;

-- ─── 8/9/10. transactions / fund_transactions — pick whichever exists
-- The codebase references both names. Build indexes on whichever
-- table actually exists in this DB.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  -- Pick the canonical user-transactions table.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='transactions') THEN
    v_table := 'transactions';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='fee_transactions') THEN
    v_table := 'fee_transactions';
  ELSE
    v_table := NULL;
  END IF;

  IF v_table IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=v_table
                 AND column_name='user_id') THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_user_recent ON public.%I (user_id, created_at DESC)',
        v_table, v_table
      );
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=v_table
                 AND column_name='type') THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_user_type_recent ON public.%I (user_id, type, created_at DESC)',
        v_table, v_table
      );
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=v_table
                 AND column_name='status') THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%I_status_recent ON public.%I (status, created_at DESC)',
        v_table, v_table
      );
    END IF;
  END IF;
END $$;

-- ─── 11. profiles.is_active — admin counts + sessions ─────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_is_active
             ON public.profiles (is_active)
             WHERE is_active = TRUE';
  END IF;
END $$;

-- ─── 12. profiles.level — leaderboards + level-gates ──────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='level') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_level
             ON public.profiles (level)';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- MEDIUM PRIORITY — 13 indexes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 13. holdings.project_id — for project-scoped aggregations ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='holdings'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_holdings_project
             ON public.holdings (project_id)';
  END IF;
END $$;

-- ─── 14. deals.status — generic status filter ─────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deals'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_status
             ON public.deals (status)';
  END IF;
END $$;

-- ─── 15. deals: project + status composite ────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deals'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_project_status
             ON public.deals (project_id, status)';
  END IF;
END $$;

-- ─── 16. notifications.expires_at — cleanup/archival ──────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='expires_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_expires
             ON public.notifications (expires_at)
             WHERE expires_at IS NOT NULL';
  END IF;
END $$;

-- ─── 17. audit_log.user_id + recency — per-user audit trail ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_log') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='audit_log'
                 AND column_name='user_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_user_recent
               ON public.audit_log (user_id, created_at DESC)';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='audit_log'
                    AND column_name='actor_id') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_actor_recent
               ON public.audit_log (actor_id, created_at DESC)';
    END IF;
  END IF;
END $$;

-- ─── 18. share_transfers: outbound pending ────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='share_transfers'
               AND column_name='sender_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_share_transfers_sender_pending
             ON public.share_transfers (sender_id)
             WHERE status = ''pending''';
  END IF;
END $$;

-- ─── 19. project_wallets.project_id alone ─────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_wallets'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_project_wallets_project
             ON public.project_wallets (project_id)';
  END IF;
END $$;

-- ─── 20. contract_members: user_id + status ───────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='contract_members'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contract_members_user_status
             ON public.contract_members (user_id, status)';
  END IF;
END $$;

-- ─── 21. support_tickets: user_id + status + recency ──────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status_recent
             ON public.support_tickets (user_id, status, created_at DESC)';
  END IF;
END $$;

-- ─── 22. support_tickets: admin queue (status + priority) ─────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='priority') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority
             ON public.support_tickets (status, priority DESC, created_at DESC)';
  END IF;
END $$;

-- ─── 23. listings: my-listings-by-status ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='seller_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_seller_status_recent
             ON public.listings (seller_id, status, created_at DESC)';
  END IF;
END $$;

-- ─── 24. listings: project-marketplace pagination ─────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_project_status_recent
             ON public.listings (project_id, status, created_at DESC)';
  END IF;
END $$;

-- ─── 25. council_proposal_votes.voter_id ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='council_proposal_votes'
               AND column_name='voter_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_council_proposal_votes_voter
             ON public.council_proposal_votes (voter_id)';
  END IF;
END $$;


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER the COMMIT above
-- ═══════════════════════════════════════════════════════════════════

-- 1. List every index created in this round.
SELECT indexname, tablename
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN (
     -- HIGH
     'idx_profiles_kyc_status',
     'idx_notifications_user_recent',
     'idx_notifications_user_unread',
     'idx_news_published_recent',
     'idx_news_project_recent',
     'idx_wallets_user',
     'idx_wallets_user_type',
     'idx_transactions_user_recent',
     'idx_transactions_user_type_recent',
     'idx_transactions_status_recent',
     'idx_fee_transactions_user_recent',
     'idx_fee_transactions_user_type_recent',
     'idx_fee_transactions_status_recent',
     'idx_profiles_is_active',
     'idx_profiles_level',
     -- MED
     'idx_holdings_project',
     'idx_deals_status',
     'idx_deals_project_status',
     'idx_notifications_expires',
     'idx_audit_log_user_recent',
     'idx_audit_log_actor_recent',
     'idx_share_transfers_sender_pending',
     'idx_project_wallets_project',
     'idx_contract_members_user_status',
     'idx_support_tickets_user_status_recent',
     'idx_support_tickets_status_priority',
     'idx_listings_seller_status_recent',
     'idx_listings_project_status_recent',
     'idx_council_proposal_votes_voter'
   )
 ORDER BY tablename, indexname;

-- 2. Run-time sanity. Each EXPLAIN ANALYZE should now show an
--    "Index Scan" (not "Seq Scan") for these patterns:
EXPLAIN ANALYZE
SELECT id, message, created_at FROM public.notifications
 WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
 ORDER BY created_at DESC LIMIT 20;

EXPLAIN ANALYZE
SELECT id, kyc_status FROM public.profiles
 WHERE kyc_status = 'verified' LIMIT 50;


-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK PLAN (only if you want to undo a specific index)
-- ═══════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS public.idx_profiles_kyc_status;
-- DROP INDEX IF EXISTS public.idx_notifications_user_recent;
-- DROP INDEX IF EXISTS public.idx_notifications_user_unread;
-- DROP INDEX IF EXISTS public.idx_news_published_recent;
-- DROP INDEX IF EXISTS public.idx_news_project_recent;
-- DROP INDEX IF EXISTS public.idx_wallets_user;
-- DROP INDEX IF EXISTS public.idx_wallets_user_type;
-- DROP INDEX IF EXISTS public.idx_transactions_user_recent;
-- DROP INDEX IF EXISTS public.idx_transactions_user_type_recent;
-- DROP INDEX IF EXISTS public.idx_transactions_status_recent;
-- DROP INDEX IF EXISTS public.idx_fee_transactions_user_recent;
-- DROP INDEX IF EXISTS public.idx_fee_transactions_user_type_recent;
-- DROP INDEX IF EXISTS public.idx_fee_transactions_status_recent;
-- DROP INDEX IF EXISTS public.idx_profiles_is_active;
-- DROP INDEX IF EXISTS public.idx_profiles_level;
-- DROP INDEX IF EXISTS public.idx_holdings_project;
-- DROP INDEX IF EXISTS public.idx_deals_status;
-- DROP INDEX IF EXISTS public.idx_deals_project_status;
-- DROP INDEX IF EXISTS public.idx_notifications_expires;
-- DROP INDEX IF EXISTS public.idx_audit_log_user_recent;
-- DROP INDEX IF EXISTS public.idx_audit_log_actor_recent;
-- DROP INDEX IF EXISTS public.idx_share_transfers_sender_pending;
-- DROP INDEX IF EXISTS public.idx_project_wallets_project;
-- DROP INDEX IF EXISTS public.idx_contract_members_user_status;
-- DROP INDEX IF EXISTS public.idx_support_tickets_user_status_recent;
-- DROP INDEX IF EXISTS public.idx_support_tickets_status_priority;
-- DROP INDEX IF EXISTS public.idx_listings_seller_status_recent;
-- DROP INDEX IF EXISTS public.idx_listings_project_status_recent;
-- DROP INDEX IF EXISTS public.idx_council_proposal_votes_voter;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.2 Step 2f — Expanded index pass complete.';
  RAISE NOTICE '';
  RAISE NOTICE '  HIGH priority: 12 indexes (profiles × 3, notifications × 2,';
  RAISE NOTICE '                 news × 2, wallets × 2, transactions × 3)';
  RAISE NOTICE '  MED  priority: 13 indexes (deals × 2, holdings, audit_log,';
  RAISE NOTICE '                 share_transfers, project_wallets, contracts,';
  RAISE NOTICE '                 support × 2, listings × 2, council, notif.expires)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run the SELECT in section 1 above to see exactly which';
  RAISE NOTICE 'indexes landed — entries skipped (because their table';
  RAISE NOTICE 'or column does not exist in this DB) will be absent.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
