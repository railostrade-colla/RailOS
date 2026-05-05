-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.62 — comprehensive admin dashboard overview RPC
-- Date: 2026-05-07
-- Idempotent: safe to re-run.
--
-- The original `get_dashboard_stats` returns 10 counters (users, deals,
-- KYC, …) which the founder asked to expand:
--   • عدد المستخدمين المشتركين
--   • عدد النشطين (آخر 7 أيام)
--   • عدد المسجلين هذا الأسبوع
--   • عدد المستثمرين (مستخدمون يملكون حصص > 0)
--   • قيمة استثمار المستخدمين الإجمالية
-- + extras for monitoring (KYC verified, daily volume, today's signups,
--   today's deals, dispute rate, etc).
--
-- We ship this as a NEW RPC `get_dashboard_overview()` so the old
-- `get_dashboard_stats` keeps working for any callers we didn't update.
--
-- Defensive reads: every block in EXCEPTION so a missing source table
-- only zeroes its sub-counter rather than collapsing the whole call.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_dashboard_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Users
  v_users_total          INT := 0;
  v_users_active_7d      INT := 0;
  v_users_active_30d     INT := 0;
  v_users_new_this_week  INT := 0;
  v_users_new_today      INT := 0;
  v_users_verified       INT := 0;
  v_users_pending_kyc    INT := 0;
  v_users_banned         INT := 0;

  -- Investors
  v_investors_count      INT := 0;
  v_investors_value      BIGINT := 0;

  -- Deals / trading
  v_deals_total          INT := 0;
  v_deals_completed      INT := 0;
  v_deals_pending        INT := 0;
  v_deals_disputed       INT := 0;
  v_deals_today          INT := 0;
  v_deals_volume_total   BIGINT := 0;
  v_deals_volume_today   BIGINT := 0;

  -- Projects
  v_projects_total       INT := 0;
  v_projects_active      INT := 0;
  v_projects_pending     INT := 0;
  v_projects_value       BIGINT := 0;

  -- Marketplace
  v_listings_active      INT := 0;
  v_auctions_active      INT := 0;

  -- Operations / inbox
  v_disputes_open        INT := 0;
  v_kyc_pending          INT := 0;
  v_fee_requests_pending INT := 0;
  v_ambassador_pending   INT := 0;
  v_support_open         INT := 0;
  v_share_mods_pending   INT := 0;

  -- Shares
  v_shares_total         BIGINT := 0;
  v_shares_traded        BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  -- ════ Users ════
  BEGIN
    SELECT COUNT(*) INTO v_users_total
    FROM public.profiles WHERE COALESCE(is_banned, FALSE) = FALSE;
  EXCEPTION WHEN OTHERS THEN v_users_total := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_active_7d
    FROM public.profiles
    WHERE last_seen_at IS NOT NULL
      AND last_seen_at > NOW() - INTERVAL '7 days';
  EXCEPTION WHEN OTHERS THEN v_users_active_7d := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_active_30d
    FROM public.profiles
    WHERE last_seen_at IS NOT NULL
      AND last_seen_at > NOW() - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN v_users_active_30d := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_new_this_week
    FROM public.profiles
    WHERE created_at > NOW() - INTERVAL '7 days';
  EXCEPTION WHEN OTHERS THEN v_users_new_this_week := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_new_today
    FROM public.profiles
    WHERE created_at >= date_trunc('day', NOW());
  EXCEPTION WHEN OTHERS THEN v_users_new_today := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_verified
    FROM public.profiles WHERE kyc_status = 'approved';
  EXCEPTION WHEN OTHERS THEN v_users_verified := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_pending_kyc
    FROM public.profiles WHERE kyc_status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_users_pending_kyc := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_users_banned
    FROM public.profiles WHERE COALESCE(is_banned, FALSE) = TRUE;
  EXCEPTION WHEN OTHERS THEN v_users_banned := 0; END;

  -- ════ Investors (distinct users with > 0 shares) ════
  -- Source of truth: `holdings` table (02_projects.sql).
  BEGIN
    SELECT COUNT(DISTINCT user_id)
    INTO v_investors_count
    FROM public.holdings
    WHERE shares > 0;
  EXCEPTION WHEN OTHERS THEN v_investors_count := 0; END;

  -- ════ Investors total invested value ════
  -- Prefer `total_invested` (the actual amount each user paid). Falls
  -- back to (shares × current project.share_price) for environments
  -- where total_invested wasn't backfilled.
  BEGIN
    SELECT COALESCE(SUM(total_invested), 0)
    INTO v_investors_value
    FROM public.holdings
    WHERE shares > 0;
    IF v_investors_value = 0 THEN
      SELECT COALESCE(SUM(h.shares * COALESCE(p.share_price, 0)), 0)
      INTO v_investors_value
      FROM public.holdings h
      LEFT JOIN public.projects p ON p.id = h.project_id
      WHERE h.shares > 0;
    END IF;
  EXCEPTION WHEN OTHERS THEN v_investors_value := 0; END;

  -- ════ Deals ════
  BEGIN
    SELECT COUNT(*) INTO v_deals_total FROM public.deals;
    SELECT COUNT(*) INTO v_deals_completed FROM public.deals WHERE status = 'completed';
    SELECT COUNT(*) INTO v_deals_pending FROM public.deals WHERE status = 'pending';
    SELECT COUNT(*) INTO v_deals_disputed FROM public.deals WHERE status IN ('in_dispute', 'disputed');
    SELECT COUNT(*) INTO v_deals_today
      FROM public.deals WHERE created_at >= date_trunc('day', NOW());
    SELECT COALESCE(SUM(total_amount), 0) INTO v_deals_volume_total
      FROM public.deals WHERE status = 'completed';
    SELECT COALESCE(SUM(total_amount), 0) INTO v_deals_volume_today
      FROM public.deals WHERE status = 'completed' AND created_at >= date_trunc('day', NOW());
  EXCEPTION WHEN OTHERS THEN
    -- Leave zeros
    NULL;
  END;

  -- ════ Projects ════
  BEGIN
    SELECT COUNT(*) INTO v_projects_total FROM public.projects;
    SELECT COUNT(*) INTO v_projects_active FROM public.projects WHERE status = 'active';
    SELECT COUNT(*) INTO v_projects_pending
      FROM public.projects
      WHERE status IN ('pending', 'pending_review', 'draft', 'under_review');
    BEGIN
      SELECT COALESCE(SUM(total_value), 0) INTO v_projects_value FROM public.projects;
    EXCEPTION WHEN undefined_column THEN
      SELECT COALESCE(SUM(share_price * total_shares), 0)
      INTO v_projects_value FROM public.projects;
    END;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ════ Marketplace ════
  BEGIN
    SELECT COUNT(*) INTO v_listings_active FROM public.listings WHERE status = 'active';
  EXCEPTION WHEN OTHERS THEN v_listings_active := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_auctions_active FROM public.auctions WHERE status = 'active';
  EXCEPTION WHEN OTHERS THEN v_auctions_active := 0; END;

  -- ════ Operations queue ════
  BEGIN
    SELECT COUNT(*) INTO v_disputes_open FROM public.disputes WHERE status = 'open';
  EXCEPTION WHEN OTHERS THEN v_disputes_open := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_kyc_pending FROM public.kyc_submissions WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_kyc_pending := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_fee_requests_pending FROM public.fee_unit_requests WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_fee_requests_pending := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_ambassador_pending FROM public.ambassadors WHERE application_status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_ambassador_pending := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_support_open FROM public.support_tickets WHERE status IN ('new', 'open');
  EXCEPTION WHEN OTHERS THEN v_support_open := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_share_mods_pending
    FROM public.share_modification_requests
    WHERE status IN ('pending', 'pending_super_admin');
  EXCEPTION WHEN OTHERS THEN v_share_mods_pending := 0; END;

  -- ════ Shares ════
  BEGIN
    SELECT COALESCE(SUM(total_shares), 0) INTO v_shares_total FROM public.projects;
  EXCEPTION WHEN OTHERS THEN v_shares_total := 0; END;

  BEGIN
    SELECT COALESCE(SUM(shares_amount), 0) INTO v_shares_traded
    FROM public.deals WHERE status = 'completed';
  EXCEPTION WHEN OTHERS THEN v_shares_traded := 0; END;

  -- ════ Build response ════
  RETURN jsonb_build_object(
    -- Users
    'users_total',           v_users_total,
    'users_active_7d',       v_users_active_7d,
    'users_active_30d',      v_users_active_30d,
    'users_new_this_week',   v_users_new_this_week,
    'users_new_today',       v_users_new_today,
    'users_verified',        v_users_verified,
    'users_pending_kyc',     v_users_pending_kyc,
    'users_banned',          v_users_banned,
    -- Investors
    'investors_count',       v_investors_count,
    'investors_value',       v_investors_value,
    -- Deals
    'deals_total',           v_deals_total,
    'deals_completed',       v_deals_completed,
    'deals_pending',         v_deals_pending,
    'deals_disputed',        v_deals_disputed,
    'deals_today',           v_deals_today,
    'deals_volume_total',    v_deals_volume_total,
    'deals_volume_today',    v_deals_volume_today,
    -- Projects
    'projects_total',        v_projects_total,
    'projects_active',       v_projects_active,
    'projects_pending',      v_projects_pending,
    'projects_value',        v_projects_value,
    -- Marketplace
    'listings_active',       v_listings_active,
    'auctions_active',       v_auctions_active,
    -- Ops queue
    'disputes_open',         v_disputes_open,
    'kyc_pending',           v_kyc_pending,
    'fee_requests_pending',  v_fee_requests_pending,
    'ambassador_pending',    v_ambassador_pending,
    'support_open',          v_support_open,
    'share_mods_pending',    v_share_mods_pending,
    -- Shares
    'shares_total',          v_shares_total,
    'shares_traded',         v_shares_traded,
    -- Health (computed)
    'completion_rate',
      CASE WHEN v_deals_total > 0
        THEN ROUND((v_deals_completed::NUMERIC / v_deals_total::NUMERIC) * 100, 1)
        ELSE 0 END,
    'dispute_rate',
      CASE WHEN v_deals_total > 0
        THEN ROUND((v_deals_disputed::NUMERIC / v_deals_total::NUMERIC) * 100, 1)
        ELSE 0 END,
    'kyc_rate',
      CASE WHEN v_users_total > 0
        THEN ROUND((v_users_verified::NUMERIC / v_users_total::NUMERIC) * 100, 1)
        ELSE 0 END,
    'snapshot_at', NOW()
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_overview() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.62 applied:';
  RAISE NOTICE '  ✓ get_dashboard_overview — 30+ KPIs in one round-trip';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
