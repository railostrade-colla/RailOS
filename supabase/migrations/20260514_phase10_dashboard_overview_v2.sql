-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.74 — extend get_dashboard_overview with Task-2 fields
-- Date: 2026-05-14
-- Idempotent: safe to re-run.
--
-- Per the Task-2 spec, the admin Dashboard needs additional KPIs the
-- previous overview RPC didn't surface:
--
--   • shares_invested        — Σ holdings.shares (distinct from
--                              shares_traded which is from completed
--                              deals only)
--   • users_suspended        — temporary bans (banned_until > NOW())
--   • companies_total / _active / _pending — companies don't have a
--                              status field, so:
--                                active  = is_verified = TRUE
--                                pending = is_verified = FALSE
--                              "Closed" is N/A for companies.
--   • combined_total / _pending — projects + companies merged
--   • projects_closed         — status IN sold_out, completed, cancelled
--   • combined_value          — Σ project_value across active projects
--                              (companies don't carry a project_value
--                              field — share_price × shareholders_count
--                              is used as proxy)
--   • shares_unsold           — Σ project_wallets.available_shares
--   • auctions_won            — status='ended' AND winner_id IS NOT NULL
--   • auctions_unwon          — status IN cancelled, OR
--                              (status='ended' AND winner_id IS NULL)
--   • disputes_total          — all-time disputes count
--
-- Companies status field is missing — bound to is_verified flag instead.
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
  v_users_suspended      INT := 0;

  -- Investors
  v_investors_count      INT := 0;
  v_investors_value      BIGINT := 0;
  v_shares_invested      BIGINT := 0;

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
  v_projects_closed      INT := 0;
  v_projects_value       BIGINT := 0;

  -- Companies
  v_companies_total      INT := 0;
  v_companies_active     INT := 0;
  v_companies_pending    INT := 0;

  -- Marketplace
  v_listings_active      INT := 0;
  v_auctions_active      INT := 0;
  v_auctions_won         INT := 0;
  v_auctions_unwon       INT := 0;

  -- Operations / inbox
  v_disputes_open        INT := 0;
  v_disputes_total       INT := 0;
  v_kyc_pending          INT := 0;
  v_fee_requests_pending INT := 0;
  v_ambassador_pending   INT := 0;
  v_support_open         INT := 0;
  v_share_mods_pending   INT := 0;

  -- Shares
  v_shares_total         BIGINT := 0;
  v_shares_traded        BIGINT := 0;
  v_shares_unsold        BIGINT := 0;
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

  -- Phase 10.74 — temporary suspensions (banned_until in the future)
  BEGIN
    SELECT COUNT(*) INTO v_users_suspended
    FROM public.profiles
    WHERE banned_until IS NOT NULL AND banned_until > NOW();
  EXCEPTION WHEN OTHERS THEN v_users_suspended := 0; END;

  -- ════ Investors ════
  BEGIN
    SELECT COUNT(DISTINCT user_id), COALESCE(SUM(shares), 0)
    INTO v_investors_count, v_shares_invested
    FROM public.holdings WHERE shares > 0;
  EXCEPTION WHEN OTHERS THEN
    v_investors_count := 0; v_shares_invested := 0;
  END;

  BEGIN
    SELECT COALESCE(SUM(total_invested), 0)
    INTO v_investors_value
    FROM public.holdings WHERE shares > 0;
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
    SELECT COUNT(*) INTO v_deals_pending FROM public.deals
      WHERE status IN ('pending_seller_approval', 'accepted', 'payment_submitted');
    SELECT COUNT(*) INTO v_deals_disputed FROM public.deals
      WHERE status IN ('in_dispute', 'disputed');
    SELECT COUNT(*) INTO v_deals_today
      FROM public.deals WHERE created_at >= date_trunc('day', NOW());
    SELECT COALESCE(SUM(total_amount), 0) INTO v_deals_volume_total
      FROM public.deals WHERE status = 'completed';
    SELECT COALESCE(SUM(total_amount), 0) INTO v_deals_volume_today
      FROM public.deals WHERE status = 'completed'
        AND COALESCE(completed_at, created_at) >= date_trunc('day', NOW());
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ════ Projects ════
  BEGIN
    SELECT COUNT(*) INTO v_projects_total FROM public.projects;
    SELECT COUNT(*) INTO v_projects_active FROM public.projects WHERE status = 'active';
    SELECT COUNT(*) INTO v_projects_pending
      FROM public.projects WHERE status IN ('draft', 'coming_soon');
    SELECT COUNT(*) INTO v_projects_closed
      FROM public.projects WHERE status IN ('sold_out', 'completed', 'cancelled');
    BEGIN
      SELECT COALESCE(SUM(total_value), 0) INTO v_projects_value
      FROM public.projects WHERE status = 'active';
    EXCEPTION WHEN undefined_column THEN
      SELECT COALESCE(SUM(share_price * total_shares), 0)
      INTO v_projects_value FROM public.projects WHERE status = 'active';
    END;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ════ Companies (no status field — use is_verified as proxy) ════
  BEGIN
    SELECT COUNT(*) INTO v_companies_total FROM public.companies;
    SELECT COUNT(*) INTO v_companies_active
      FROM public.companies WHERE COALESCE(is_verified, FALSE) = TRUE;
    SELECT COUNT(*) INTO v_companies_pending
      FROM public.companies WHERE COALESCE(is_verified, FALSE) = FALSE;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ════ Marketplace ════
  BEGIN
    SELECT COUNT(*) INTO v_listings_active
    FROM public.listings WHERE status = 'active';
  EXCEPTION WHEN OTHERS THEN v_listings_active := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_auctions_active FROM public.auctions WHERE status = 'active';
    SELECT COUNT(*) INTO v_auctions_won
      FROM public.auctions
      WHERE status = 'ended' AND winner_id IS NOT NULL;
    SELECT COUNT(*) INTO v_auctions_unwon
      FROM public.auctions
      WHERE status = 'cancelled'
         OR (status = 'ended' AND winner_id IS NULL);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ════ Operations queue ════
  BEGIN
    SELECT COUNT(*) INTO v_disputes_open FROM public.disputes WHERE status = 'open';
    SELECT COUNT(*) INTO v_disputes_total FROM public.disputes;
  EXCEPTION WHEN OTHERS THEN NULL; END;

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
    SELECT COUNT(*) INTO v_support_open FROM public.support_tickets
      WHERE status IN ('new', 'open', 'in_progress');
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
  EXCEPTION WHEN undefined_column THEN
    -- Fallback if shares_amount doesn't exist (column is `shares` in current schema)
    BEGIN
      SELECT COALESCE(SUM(shares), 0) INTO v_shares_traded
      FROM public.deals WHERE status = 'completed';
    EXCEPTION WHEN OTHERS THEN v_shares_traded := 0; END;
  WHEN OTHERS THEN v_shares_traded := 0; END;

  BEGIN
    SELECT COALESCE(SUM(available_shares), 0) INTO v_shares_unsold
    FROM public.project_wallets;
  EXCEPTION WHEN OTHERS THEN v_shares_unsold := 0; END;

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
    'users_suspended',       v_users_suspended,
    -- Investors
    'investors_count',       v_investors_count,
    'investors_value',       v_investors_value,
    'shares_invested',       v_shares_invested,
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
    'projects_closed',       v_projects_closed,
    'projects_value',        v_projects_value,
    -- Companies
    'companies_total',       v_companies_total,
    'companies_active',      v_companies_active,
    'companies_pending',     v_companies_pending,
    -- Combined (projects + companies)
    'combined_total',        v_projects_total + v_companies_total,
    'combined_pending',      v_projects_pending + v_companies_pending,
    'combined_value',        v_projects_value,  -- companies have no "project_value"
    -- Marketplace
    'listings_active',       v_listings_active,
    'auctions_active',       v_auctions_active,
    'auctions_won',          v_auctions_won,
    'auctions_unwon',        v_auctions_unwon,
    -- Ops queue
    'disputes_open',         v_disputes_open,
    'disputes_total',        v_disputes_total,
    'kyc_pending',           v_kyc_pending,
    'fee_requests_pending',  v_fee_requests_pending,
    'ambassador_pending',    v_ambassador_pending,
    'support_open',          v_support_open,
    'share_mods_pending',    v_share_mods_pending,
    -- Shares
    'shares_total',          v_shares_total,
    'shares_traded',         v_shares_traded,
    'shares_unsold',         v_shares_unsold,
    -- Health rates
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
  RAISE NOTICE 'Phase 10.74 applied:';
  RAISE NOTICE '  ✓ get_dashboard_overview extended with:';
  RAISE NOTICE '    • shares_invested, users_suspended';
  RAISE NOTICE '    • companies_total/active/pending';
  RAISE NOTICE '    • projects_closed';
  RAISE NOTICE '    • combined_total/pending/value';
  RAISE NOTICE '    • shares_unsold';
  RAISE NOTICE '    • auctions_won/unwon';
  RAISE NOTICE '    • disputes_total';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
