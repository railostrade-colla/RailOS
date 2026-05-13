-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2f-fix: Isolated, exception-safe index creation
-- Date: 2026-05-14
--
-- Why this fix exists:
--   Step 2f wrapped 25 DO-blocks inside ONE outer BEGIN/COMMIT.
--   Block #20 (contract_members) referenced a column named `status`
--   that does not exist on this schema — the actual column is
--   `invite_status`. The CREATE INDEX failed and Postgres rolled
--   back the entire transaction, undoing every index that had
--   already succeeded.
--
-- What changed in this rewrite:
--   1. NO outer BEGIN/COMMIT — each DO block now runs in its own
--      implicit transaction. A failure in one is isolated.
--   2. Every DO block has its own EXCEPTION WHEN OTHERS THEN handler
--      that converts errors into RAISE NOTICE. Even if my column
--      assumptions are wrong, the rest of the migration still
--      lands the working indexes.
--   3. Block #20 now references the correct `invite_status` column
--      (verified against 20260503_phase6_contracts_schema.sql).
--
-- Idempotent + schema-tolerant. Safe to run on top of a partially
-- successful previous attempt.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- HIGH PRIORITY — 12 indexes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. profiles.kyc_status ───────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='kyc_status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status
             ON public.profiles (kyc_status)';
    RAISE NOTICE '✓ idx_profiles_kyc_status';
  ELSE
    RAISE NOTICE '⊘ profiles.kyc_status missing — skipped';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_profiles_kyc_status failed: %', SQLERRM;
END $$;

-- ─── 2. notifications: bell list ──────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
             ON public.notifications (user_id, created_at DESC)';
    RAISE NOTICE '✓ idx_notifications_user_recent';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_notifications_user_recent failed: %', SQLERRM;
END $$;

-- ─── 3. notifications: unread partial ─────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='is_read') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
             ON public.notifications (user_id)
             WHERE is_read = FALSE';
    RAISE NOTICE '✓ idx_notifications_user_unread';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_notifications_user_unread failed: %', SQLERRM;
END $$;

-- ─── 4. news: published partial ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='news'
               AND column_name='published') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_published_recent
             ON public.news (published_at DESC)
             WHERE published = TRUE';
    RAISE NOTICE '✓ idx_news_published_recent (published)';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='news'
                  AND column_name='is_published') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_published_recent
             ON public.news (published_at DESC)
             WHERE is_published = TRUE';
    RAISE NOTICE '✓ idx_news_published_recent (is_published)';
  ELSE
    RAISE NOTICE '⊘ news.published/is_published missing — skipped';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_news_published_recent failed: %', SQLERRM;
END $$;

-- ─── 5. news: per-project ─────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='news'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_project_recent
             ON public.news (project_id, published_at DESC)';
    RAISE NOTICE '✓ idx_news_project_recent';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_news_project_recent failed: %', SQLERRM;
END $$;

-- ─── 6. wallets.user_id ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='wallets'
               AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallets_user
             ON public.wallets (user_id)';
    RAISE NOTICE '✓ idx_wallets_user';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_wallets_user failed: %', SQLERRM;
END $$;

-- ─── 7. wallets: typed balance ────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='wallets'
               AND column_name='wallet_type') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallets_user_type
             ON public.wallets (user_id, wallet_type)';
    RAISE NOTICE '✓ idx_wallets_user_type';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_wallets_user_type failed: %', SQLERRM;
END $$;

-- ─── 8/9/10. transactions OR fee_transactions (auto-detect) ───
DO $$
DECLARE v_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='transactions') THEN
    v_table := 'transactions';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name='fee_transactions') THEN
    v_table := 'fee_transactions';
  ELSE
    RAISE NOTICE '⊘ neither transactions nor fee_transactions found — skipped';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=v_table AND column_name='user_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=v_table AND column_name='created_at') THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_user_recent ON public.%I (user_id, created_at DESC)',
      v_table, v_table);
    RAISE NOTICE '✓ idx_%_user_recent', v_table;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=v_table AND column_name='type') THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_user_type_recent ON public.%I (user_id, type, created_at DESC)',
      v_table, v_table);
    RAISE NOTICE '✓ idx_%_user_type_recent', v_table;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name=v_table AND column_name='status') THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_status_recent ON public.%I (status, created_at DESC)',
      v_table, v_table);
    RAISE NOTICE '✓ idx_%_status_recent', v_table;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ transactions indexes failed: %', SQLERRM;
END $$;

-- ─── 11. profiles.is_active ───────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='is_active') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_is_active
             ON public.profiles (is_active)
             WHERE is_active = TRUE';
    RAISE NOTICE '✓ idx_profiles_is_active';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_profiles_is_active failed: %', SQLERRM;
END $$;

-- ─── 12. profiles.level ───────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles'
               AND column_name='level') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_level
             ON public.profiles (level)';
    RAISE NOTICE '✓ idx_profiles_level';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_profiles_level failed: %', SQLERRM;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- MEDIUM PRIORITY — 13 indexes
-- ═══════════════════════════════════════════════════════════════════

-- ─── 13. holdings.project_id ──────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='holdings'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_holdings_project
             ON public.holdings (project_id)';
    RAISE NOTICE '✓ idx_holdings_project';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_holdings_project failed: %', SQLERRM;
END $$;

-- ─── 14. deals.status ─────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deals'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_status
             ON public.deals (status)';
    RAISE NOTICE '✓ idx_deals_status';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_deals_status failed: %', SQLERRM;
END $$;

-- ─── 15. deals: project + status composite ────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deals'
               AND column_name='project_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='deals'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_project_status
             ON public.deals (project_id, status)';
    RAISE NOTICE '✓ idx_deals_project_status';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_deals_project_status failed: %', SQLERRM;
END $$;

-- ─── 16. notifications.expires_at ─────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='notifications'
               AND column_name='expires_at') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_expires
             ON public.notifications (expires_at)
             WHERE expires_at IS NOT NULL';
    RAISE NOTICE '✓ idx_notifications_expires';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_notifications_expires failed: %', SQLERRM;
END $$;

-- ─── 17. audit_log.user_id|actor_id + recency ─────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='audit_log') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='audit_log'
                 AND column_name='user_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='audit_log'
                 AND column_name='created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_user_recent
               ON public.audit_log (user_id, created_at DESC)';
      RAISE NOTICE '✓ idx_audit_log_user_recent (user_id)';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='audit_log'
                    AND column_name='actor_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='audit_log'
                    AND column_name='created_at') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_actor_recent
               ON public.audit_log (actor_id, created_at DESC)';
      RAISE NOTICE '✓ idx_audit_log_actor_recent (actor_id)';
    ELSE
      RAISE NOTICE '⊘ audit_log: no user_id/actor_id + created_at columns';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_audit_log_* failed: %', SQLERRM;
END $$;

-- ─── 18. share_transfers: outbound pending ────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='share_transfers'
               AND column_name='sender_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='share_transfers'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_share_transfers_sender_pending
             ON public.share_transfers (sender_id)
             WHERE status = ''pending''';
    RAISE NOTICE '✓ idx_share_transfers_sender_pending';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_share_transfers_sender_pending failed: %', SQLERRM;
END $$;

-- ─── 19. project_wallets.project_id alone ─────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='project_wallets'
               AND column_name='project_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_project_wallets_project
             ON public.project_wallets (project_id)';
    RAISE NOTICE '✓ idx_project_wallets_project';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_project_wallets_project failed: %', SQLERRM;
END $$;

-- ─── 20. contract_members — uses invite_status (NOT status!) ──
-- This is the bug from Step 2f. contract_members has `invite_status`,
-- not `status`. Phase 6 schema column name verified.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='contract_members'
               AND column_name='user_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='contract_members'
               AND column_name='invite_status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contract_members_user_invite_status
             ON public.contract_members (user_id, invite_status)';
    RAISE NOTICE '✓ idx_contract_members_user_invite_status';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_contract_members_user_invite_status failed: %', SQLERRM;
END $$;

-- ─── 21. support_tickets: user + status + recency ─────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='user_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status_recent
             ON public.support_tickets (user_id, status, created_at DESC)';
    RAISE NOTICE '✓ idx_support_tickets_user_status_recent';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_support_tickets_user_status_recent failed: %', SQLERRM;
END $$;

-- ─── 22. support_tickets: admin queue ─────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='status')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='support_tickets'
               AND column_name='priority') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority
             ON public.support_tickets (status, priority DESC, created_at DESC)';
    RAISE NOTICE '✓ idx_support_tickets_status_priority';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_support_tickets_status_priority failed: %', SQLERRM;
END $$;

-- ─── 23. listings: my-listings-by-status ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='seller_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_seller_status_recent
             ON public.listings (seller_id, status, created_at DESC)';
    RAISE NOTICE '✓ idx_listings_seller_status_recent';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_listings_seller_status_recent failed: %', SQLERRM;
END $$;

-- ─── 24. listings: project-marketplace pagination ─────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='project_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='listings'
               AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_listings_project_status_recent
             ON public.listings (project_id, status, created_at DESC)';
    RAISE NOTICE '✓ idx_listings_project_status_recent';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_listings_project_status_recent failed: %', SQLERRM;
END $$;

-- ─── 25. council_proposal_votes.voter_id ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='council_proposal_votes'
               AND column_name='voter_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_council_proposal_votes_voter
             ON public.council_proposal_votes (voter_id)';
    RAISE NOTICE '✓ idx_council_proposal_votes_voter';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ idx_council_proposal_votes_voter failed: %', SQLERRM;
END $$;


-- Reload PostgREST schema cache so any new index immediately
-- participates in planner decisions.
NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER all the DO blocks above
-- ═══════════════════════════════════════════════════════════════════
-- Each DO block emits a NOTICE: ✓ for success, ⊘ for skipped (column
-- absent), ✗ for an exception caught. Read them in the "Messages"
-- panel of the SQL Editor to see exactly what landed.
--
-- This SELECT lists every index we tried to create:
SELECT indexname, tablename
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN (
     'idx_profiles_kyc_status',
     'idx_profiles_is_active',
     'idx_profiles_level',
     'idx_notifications_user_recent',
     'idx_notifications_user_unread',
     'idx_notifications_expires',
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
     'idx_holdings_project',
     'idx_deals_status',
     'idx_deals_project_status',
     'idx_audit_log_user_recent',
     'idx_audit_log_actor_recent',
     'idx_share_transfers_sender_pending',
     'idx_project_wallets_project',
     'idx_contract_members_user_invite_status',
     'idx_support_tickets_user_status_recent',
     'idx_support_tickets_status_priority',
     'idx_listings_seller_status_recent',
     'idx_listings_project_status_recent',
     'idx_council_proposal_votes_voter'
   )
 ORDER BY tablename, indexname;
