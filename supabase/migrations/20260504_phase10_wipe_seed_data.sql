-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.13 — wipe seed/default data (DESTRUCTIVE — read first!)
-- Date: 2026-05-04
--
-- ⚠⚠⚠ THIS MIGRATION DELETES DATA. It is INTENTIONALLY destructive.
-- ⚠⚠⚠ Run ONCE on staging, verify, then run on production.
-- ⚠⚠⚠ It is NOT idempotent in the "no-op" sense — it always deletes
-- ⚠⚠⚠ rows on the listed tables. Re-running just deletes any new
-- ⚠⚠⚠ data in those tables, so be careful after first launch.
--
-- What this DELETES (in dependency order):
--   • All transactional/business data: deals, listings, holdings,
--     market_state, price_history, follows, contracts, auctions,
--     bids, audit_log, notifications, etc.
--   • Seed entities: projects, companies, news, ads, council_*
--   • All user-generated content (since it's all default/test now)
--
-- What this PRESERVES:
--   • auth.users — user accounts stay (the founder + any test logins)
--   • profiles — user profile rows stay (so role=super_admin is
--     preserved). However we do clear non-essential profile fields.
--   • All schemas, tables, functions, indexes, enums (DDL untouched)
--   • RLS policies
--   • migration_history (this migration logs itself just fine)
--   • fee_unit_balances structure — only resets balances to zero
--     for non-admin users (admins keep their balance for ops).
--
-- After running:
--   1. The platform is a blank slate.
--   2. The first project the founder creates becomes "project #1".
--   3. All hooks/RPCs continue to work — they just operate on
--      empty tables until data is added through the UI.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Transactional / business data ─────────────────────────────
-- TRUNCATE … CASCADE handles FK chains automatically. Each block
-- wraps in EXCEPTION so missing tables don't abort the whole script.

DO $$ BEGIN TRUNCATE TABLE public.deal_messages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deal_disputes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.disputes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deal_ratings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deals CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.quick_sale_listings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.quick_sale_subscriptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.listings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.share_transfers CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_modifications CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_codes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.holdings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.contract_holdings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.contracts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.auction_bids CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.auctions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.invoices CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.fee_unit_transactions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.fee_unit_requests CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.payment_proofs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.user_gifts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.referrals CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ambassador_referrals CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ambassadors CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.healthcare_donations CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.healthcare_applications CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.healthcare_cases CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.orphan_donations CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.orphan_sponsorships CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.orphan_children CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.discount_redemptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.discounts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.support_messages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.support_tickets CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.friendships CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.follows CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.notifications CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.audit_log CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.notification_locks CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 2. Market engine state ───────────────────────────────────────
DO $$ BEGIN TRUNCATE TABLE public.price_history CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.development_index CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.market_state CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 3. Council ───────────────────────────────────────────────────
DO $$ BEGIN TRUNCATE TABLE public.council_votes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_proposals CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_members CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 4. Content (news/ads/legal) ──────────────────────────────────
DO $$ BEGIN TRUNCATE TABLE public.news_views CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.news_reactions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.news CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.ad_clicks CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ads CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.legal_pages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 5. Core entities (projects + companies) ──────────────────────
DO $$ BEGIN TRUNCATE TABLE public.project_updates CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.project_wallets CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.projects CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.companies CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 6. KYC + onboarding extras ───────────────────────────────────
DO $$ BEGIN TRUNCATE TABLE public.kyc_submissions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.user_profile_extras CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.push_subscriptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.notification_preferences CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 7. Reset fee_unit_balances for NON-admin users ───────────────
-- Admins keep their balance because they may need it for ops.
DO $$ BEGIN
  UPDATE public.fee_unit_balances
  SET balance = 0,
      frozen_balance = 0,
      total_deposited = 0,
      total_withdrawn = 0,
      last_transaction_at = NULL
  WHERE user_id NOT IN (
    SELECT id FROM public.profiles
    WHERE role IN ('admin', 'super_admin')
  );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 8. Clear non-essential profile fields (preserve role + auth) ──
-- We KEEP id, role, full_name, username, email, phone, created_at.
-- We CLEAR things like avatar_url, bio, custom links, KYC status,
-- etc. so the founder's profile starts clean too.
DO $$ BEGIN
  UPDATE public.profiles
  SET
    avatar_url = NULL,
    bio = NULL,
    kyc_status = COALESCE(kyc_status, 'pending'),
    last_login_at = NULL
  WHERE TRUE;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Post-wipe sanity check (run separately after this script):
--
--   SELECT
--     (SELECT COUNT(*) FROM public.projects)  AS projects,
--     (SELECT COUNT(*) FROM public.companies) AS companies,
--     (SELECT COUNT(*) FROM public.deals)     AS deals,
--     (SELECT COUNT(*) FROM public.listings)  AS listings,
--     (SELECT COUNT(*) FROM public.holdings)  AS holdings,
--     (SELECT COUNT(*) FROM public.news)      AS news,
--     (SELECT COUNT(*) FROM public.profiles
--        WHERE role IN ('admin','super_admin')) AS admin_profiles_kept;
--
-- Expected: all zeros except admin_profiles_kept ≥ 1.
-- ═══════════════════════════════════════════════════════════════════
