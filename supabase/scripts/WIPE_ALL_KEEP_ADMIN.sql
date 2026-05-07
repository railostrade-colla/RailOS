-- ═══════════════════════════════════════════════════════════════════
-- ⚠⚠⚠  DESTRUCTIVE — Wipe ALL data, keep ONLY admins.  ⚠⚠⚠
-- File:  supabase/scripts/WIPE_ALL_KEEP_ADMIN.sql
-- Run from: Supabase SQL Editor (logged in as postgres role).
-- NOT a migration — sits OUTSIDE supabase/migrations/ so it never
-- auto-runs. Copy/paste manually when you want a clean slate.
--
-- What this DELETES:
--   • Every transactional row across all data tables
--     (deals, holdings, listings, auctions, contracts, gifts,
--      referrals, commissions, friendships, follows, notifications,
--      audit_log, news, ads, coupons, KYC, drafts, market state,
--      price history, healthcare/orphans/council/support, etc.)
--   • Every project, company, project_wallet, project_update.
--   • Every NON-admin user — both their `profiles` row AND the
--     underlying `auth.users` row, so they can no longer log in.
--   • The `referral_links` rows (since their owners are gone).
--
-- What this PRESERVES:
--   • `auth.users` rows whose linked profile.role IS in
--      ('admin','super_admin').
--   • The matching `profiles` rows — id, role, email, full_name,
--      username, phone, created_at all kept; cosmetic fields like
--      avatar_url / bio / last_login_at get cleared so the founder
--      starts visually clean too.
--   • The admin's `fee_unit_balances` row (if any).
--   • All schemas, tables, functions, indexes, enums, triggers,
--      RLS policies — DDL is untouched.
--   • Storage buckets — see the SEPARATE block at the bottom of
--      this file if you also want to clear uploaded files.
--
-- After running:
--   1. Sign in with your admin account → you land on a blank app.
--   2. The first project/company you create becomes "#1".
--   3. All RPCs continue to work; they just operate on empty tables.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. Safety pin: snapshot the admins we're about to keep ──────
-- Stored in a temp table so every later DELETE can reference it.
DROP TABLE IF EXISTS _admins_to_keep;
CREATE TEMP TABLE _admins_to_keep AS
SELECT id
  FROM public.profiles
 WHERE role IN ('admin', 'super_admin');

-- Sanity: refuse to run if there are zero admins (would lock you out).
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _admins_to_keep;
  IF v_count = 0 THEN
    RAISE EXCEPTION
      '❌ ABORT: no rows found in profiles with role IN (admin, super_admin). '
      'Refusing to wipe — you would lose access to the platform. '
      'Set your role to super_admin first, then re-run this script.';
  END IF;
  RAISE NOTICE '✓ Will preserve % admin account(s).', v_count;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 1. Transactional / business data — TRUNCATE … CASCADE
-- ═══════════════════════════════════════════════════════════════════

-- Deals + disputes + ratings
DO $$ BEGIN TRUNCATE TABLE public.deal_messages         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deal_disputes         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.disputes             CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deal_ratings         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.deals                CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Listings + quick-sale
DO $$ BEGIN TRUNCATE TABLE public.quick_sale_listings      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.quick_sale_subscriptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.listings                 CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_purchase_requests  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Share transfers / gifts / modifications
DO $$ BEGIN TRUNCATE TABLE public.share_transfers              CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_modifications          CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_modification_codes     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_modification_requests  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.share_codes                  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Holdings (cascades into anything tied to a holding row)
DO $$ BEGIN TRUNCATE TABLE public.holdings CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Contracts (Phase 6 + Phase 9 v2)
DO $$ BEGIN TRUNCATE TABLE public.contract_holdings      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.contract_transactions  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.contract_members       CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.partnership_contracts  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.contracts              CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Auctions
DO $$ BEGIN TRUNCATE TABLE public.auction_bids CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.auctions     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Money / fee units
DO $$ BEGIN TRUNCATE TABLE public.invoices               CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.fee_unit_transactions  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.fee_unit_requests      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.payment_proofs         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Gifts
DO $$ BEGIN TRUNCATE TABLE public.user_gifts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Ambassadors + commissions + referrals
DO $$ BEGIN TRUNCATE TABLE public.ambassador_commissions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ambassador_referrals   CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.referrals              CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.referral_links         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ambassadors            CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Healthcare
DO $$ BEGIN TRUNCATE TABLE public.healthcare_donations    CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.healthcare_applications CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.insurance_subscriptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.healthcare_cases        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Orphans
DO $$ BEGIN TRUNCATE TABLE public.orphan_donations    CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.orphan_sponsorships CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.orphan_reports      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.sponsorships        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.orphan_children     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Discounts / coupons
DO $$ BEGIN TRUNCATE TABLE public.discount_redemptions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.user_coupons         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.discount_brands      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.discounts            CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Support
DO $$ BEGIN TRUNCATE TABLE public.ticket_messages   CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.support_messages  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.support_tickets   CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Friendships / follows
DO $$ BEGIN TRUNCATE TABLE public.friendships     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.friend_requests CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.follows         CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Notifications + audit
DO $$ BEGIN TRUNCATE TABLE public.notifications        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.audit_log            CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.notification_locks   CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 2. Market engine state
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN TRUNCATE TABLE public.price_history       CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.development_index   CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.market_state        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.system_market_state CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 3. Council
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN TRUNCATE TABLE public.council_proposal_votes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_proposals      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_election_votes CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_candidates     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_elections      CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_votes          CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.council_members        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. Content (news / ads / legal)
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN TRUNCATE TABLE public.news_views     CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.news_reactions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.news           CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.ad_clicks  CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.ads        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN TRUNCATE TABLE public.legal_pages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. Drafts + entity admin scratch space
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN TRUNCATE TABLE public.entity_drafts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. Core entities (projects + companies + their wallets)
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN TRUNCATE TABLE public.project_updates CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.project_wallets CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.projects        CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN TRUNCATE TABLE public.companies       CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 7. KYC + onboarding extras (per-user side data)
-- ═══════════════════════════════════════════════════════════════════
-- These will be re-truncated implicitly by the auth.users CASCADE, but
-- we do them up-front so admin rows aren't accidentally affected.
DO $$ BEGIN
  DELETE FROM public.kyc_submissions
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DELETE FROM public.user_profile_extras
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DELETE FROM public.push_subscriptions
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DELETE FROM public.notification_preferences
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Level history (per-user XP/level changes)
DO $$ BEGIN
  DELETE FROM public.level_history
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 8. Per-user tables — wipe everything except admin rows
-- ═══════════════════════════════════════════════════════════════════
-- fee_unit_balances: zero out admin balance too (clean slate). If you
-- want to keep the admin's balance, change the WHERE clause.
DO $$ BEGIN
  DELETE FROM public.fee_unit_balances
   WHERE user_id NOT IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.fee_unit_balances
     SET balance = 0,
         frozen_balance = 0,
         total_deposited = 0,
         total_withdrawn = 0,
         last_transaction_at = NULL
   WHERE user_id IN (SELECT id FROM _admins_to_keep);
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 9. Profiles — delete non-admins, scrub admin cosmetic fields
-- ═══════════════════════════════════════════════════════════════════
-- Delete non-admin profile rows. (auth.users delete in step 10 will
-- take care of any we missed via FK CASCADE.)
DELETE FROM public.profiles
 WHERE id NOT IN (SELECT id FROM _admins_to_keep);

-- Reset admin's cosmetic / activity fields. Keep id / role / email /
-- full_name / username / phone / created_at intact.
DO $$ BEGIN
  UPDATE public.profiles
     SET avatar_url      = NULL,
         bio             = NULL,
         kyc_status      = COALESCE(kyc_status, 'pending'),
         last_login_at   = NULL,
         total_invested  = 0,
         trades_completed = 0,
         last_trade_at   = NULL,
         referred_by     = NULL
   WHERE id IN (SELECT id FROM _admins_to_keep);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table  THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 10. auth.users — delete every non-admin so they can no longer log in
-- ═══════════════════════════════════════════════════════════════════
-- Requires running as the postgres role (Supabase SQL Editor uses it).
-- ON DELETE CASCADE on profiles_id_fkey takes care of any straggler
-- profile rows we might have missed.
DELETE FROM auth.users
 WHERE id NOT IN (SELECT id FROM _admins_to_keep);


COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- Post-wipe sanity check — run this AFTER the COMMIT above:
-- ═══════════════════════════════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM public.projects)              AS projects,
  (SELECT COUNT(*) FROM public.companies)             AS companies,
  (SELECT COUNT(*) FROM public.deals)                 AS deals,
  (SELECT COUNT(*) FROM public.holdings)              AS holdings,
  (SELECT COUNT(*) FROM public.project_wallets)       AS project_wallets,
  (SELECT COUNT(*) FROM public.ambassador_commissions) AS amb_commissions,
  (SELECT COUNT(*) FROM public.referrals)             AS referrals,
  (SELECT COUNT(*) FROM public.notifications)         AS notifications,
  (SELECT COUNT(*) FROM public.audit_log)             AS audit_log,
  (SELECT COUNT(*) FROM public.profiles)              AS profiles_total,
  (SELECT COUNT(*) FROM public.profiles
     WHERE role IN ('admin','super_admin'))           AS admins_kept,
  (SELECT COUNT(*) FROM auth.users)                   AS auth_users_total;

-- Expected: every count is 0 except `profiles_total`, `admins_kept`,
-- and `auth_users_total` — all of which equal the number of admin
-- accounts you wanted to preserve.


-- ═══════════════════════════════════════════════════════════════════
-- OPTIONAL — Storage cleanup (uploaded files)
-- ═══════════════════════════════════════════════════════════════════
-- The DB wipe above does NOT touch Supabase Storage. To also empty
-- every bucket, paste each line below ONE AT A TIME (replace the
-- bucket name as needed). Or run them all in a single transaction.
--
--   DELETE FROM storage.objects WHERE bucket_id = 'avatars';
--   DELETE FROM storage.objects WHERE bucket_id = 'project-logos';
--   DELETE FROM storage.objects WHERE bucket_id = 'project-covers';
--   DELETE FROM storage.objects WHERE bucket_id = 'kyc-documents';
--   DELETE FROM storage.objects WHERE bucket_id = 'project-documents';
--   DELETE FROM storage.objects WHERE bucket_id = 'payment-proofs';
--
-- (Only delete buckets you actually have. Run
--  `SELECT name FROM storage.buckets;` first to list them.)
-- ═══════════════════════════════════════════════════════════════════
