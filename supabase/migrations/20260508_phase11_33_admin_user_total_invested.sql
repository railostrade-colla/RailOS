-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.33 — admin users table: live total_invested from holdings
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Problem:
--   /admin → قائمة المستخدمين shows "—" in the "الاستثمار" column for
--   every user, even when they hold shares worth real dinars (e.g.
--   tareq holds 20 shares × 25,000 IQD = 500,000 IQD).
--
--   Root cause: the get_all_users_for_admin RPC reads
--   p.total_invested directly from the profiles table — but no
--   trigger keeps that column in sync with the actual holdings rows.
--   It stays at 0 for every brand-new account, so the UI shows "—"
--   (`u.total_invested > 0 ? fmtNum : "—"`).
--
-- Fix: re-create get_all_users_for_admin so total_invested is computed
-- LIVE from SUM(holdings.total_invested) per user. One subquery per
-- row is fine — the user list has a hard cap of 1000 rows.
--
-- Also patches get_user_full_details for the same drift in the
-- profile.total_invested field surfaced inside the user-details modal.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Re-create get_all_users_for_admin ────────────────────────
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin(
  p_limit INT DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      p.id,
      COALESCE(p.full_name, p.username, '—') AS full_name,
      p.username,
      p.phone,
      u.email,
      COALESCE(p.role::TEXT, 'user') AS role,
      COALESCE(p.level::TEXT, 'basic') AS level,
      COALESCE(p.kyc_status::TEXT, 'not_submitted') AS kyc_status,
      COALESCE(p.is_ambassador, FALSE) AS is_ambassador,
      COALESCE(p.is_banned, FALSE)     AS is_banned,
      p.ban_reason,
      p.banned_until,
      p.created_at,
      p.last_seen_at,
      -- Phase 11.33 — completed-deals count from the deals table.
      -- profiles.trades_completed is also out-of-sync for older rows;
      -- compute live so the column actually means something.
      COALESCE((
        SELECT COUNT(*) FROM public.deals d
        WHERE (d.buyer_id = p.id OR d.seller_id = p.id)
          AND d.status = 'completed'
      ), 0) AS trades_completed,
      -- Phase 11.33 — total_invested = SUM of holdings.total_invested.
      -- Falls back to shares * average_buy_price for older holdings
      -- rows where total_invested wasn't populated at insert time.
      COALESCE((
        SELECT SUM(
          COALESCE(
            h.total_invested,
            COALESCE(h.shares, 0) * COALESCE(h.average_buy_price, 0)
          )
        )
        FROM public.holdings h
        WHERE h.user_id = p.id AND COALESCE(h.shares, 0) > 0
      ), 0) AS total_invested,
      p.rating_average,
      p.rating_count
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT GREATEST(0, LEAST(p_limit, 1000))
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin(INT) TO authenticated;


-- ─── 2. Patch get_user_full_details (single user view) ────────────
-- The user-details modal also shows total_invested + trades_completed.
-- Same fix: compute from holdings + deals instead of trusting the
-- denormalized profile columns.
CREATE OR REPLACE FUNCTION public.get_user_full_details(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_caller_role   TEXT;
  v_profile       JSONB;
  v_email         TEXT;
  v_holdings_total NUMERIC := 0;
  v_holdings_value NUMERIC := 0;
  v_invested_live  NUMERIC := 0;
  v_trades_live    INT     := 0;
  v_deals_total    INT     := 0;
  v_deals_done     INT     := 0;
  v_ambassador_row JSONB;
  v_kyc_row        JSONB;
  v_avg_rating     NUMERIC := 0;
  v_rating_count   INT     := 0;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  -- holdings aggregates (LIVE)
  BEGIN
    SELECT
      COALESCE(SUM(shares), 0),
      COALESCE(SUM(total_invested), 0),
      COALESCE(SUM(
        COALESCE(
          total_invested,
          COALESCE(shares, 0) * COALESCE(average_buy_price, 0)
        )
      ), 0)
    INTO v_holdings_total, v_holdings_value, v_invested_live
    FROM public.holdings WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_holdings_total := 0; v_holdings_value := 0; v_invested_live := 0;
  END;

  -- profile (with total_invested + trades_completed REPLACED by live values)
  BEGIN
    SELECT row_to_json(p)::jsonb
    INTO v_profile
    FROM (
      SELECT
        id, full_name, username, phone, avatar_url,
        role::TEXT AS role,
        kyc_status::TEXT AS kyc_status,
        is_active, is_banned, ban_reason,
        banned_until, suspended_at, suspended_by,
        is_ambassador,
        rating_average, rating_count,
        -- Phase 11.33 — overwrite the stale columns with live counts.
        v_invested_live AS total_invested,
        created_at, updated_at, last_seen_at,
        COALESCE(
          (SELECT level::TEXT FROM public.profiles WHERE id = p_user_id),
          'basic'
        ) AS level
      FROM public.profiles p
      WHERE id = p_user_id
    ) p;
  EXCEPTION WHEN OTHERS THEN v_profile := '{}'::jsonb; END;

  IF v_profile = '{}'::jsonb OR v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- email
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  -- deals
  BEGIN
    SELECT COUNT(*) INTO v_deals_total
    FROM public.deals
    WHERE buyer_id = p_user_id OR seller_id = p_user_id;
    SELECT COUNT(*) INTO v_deals_done
    FROM public.deals
    WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
      AND status = 'completed';
  EXCEPTION WHEN OTHERS THEN
    v_deals_total := 0; v_deals_done := 0;
  END;
  v_trades_live := v_deals_done;
  -- Inject the live trades_completed into the profile JSON (overwrite
  -- whatever stale value was there).
  v_profile := jsonb_set(v_profile, '{trades_completed}', to_jsonb(v_trades_live));

  -- ambassador
  BEGIN
    SELECT row_to_json(a)::jsonb
    INTO v_ambassador_row
    FROM (
      SELECT
        id, application_status::TEXT AS application_status,
        is_active, reward_percentage,
        application_reason, approved_at, revoked_at
      FROM public.ambassadors WHERE user_id = p_user_id
    ) a;
  EXCEPTION WHEN OTHERS THEN v_ambassador_row := NULL; END;

  -- KYC (latest submission)
  BEGIN
    SELECT row_to_json(k)::jsonb
    INTO v_kyc_row
    FROM (
      SELECT
        id, status::TEXT AS status,
        document_type::TEXT AS document_type,
        city, submitted_at, reviewed_at, review_notes
      FROM public.kyc_submissions
      WHERE user_id = p_user_id
      ORDER BY submitted_at DESC
      LIMIT 1
    ) k;
  EXCEPTION WHEN OTHERS THEN v_kyc_row := NULL; END;

  -- ratings (received as rated_user_id)
  BEGIN
    SELECT
      COALESCE(AVG(rating), 0)::NUMERIC(3,2),
      COUNT(*)
    INTO v_avg_rating, v_rating_count
    FROM public.ratings
    WHERE rated_user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_avg_rating := 0; v_rating_count := 0;
  END;

  RETURN jsonb_build_object(
    'profile',         v_profile,
    'email',           v_email,
    'holdings_total',  v_holdings_total,
    'holdings_value',  v_holdings_value,
    'deals_total',     v_deals_total,
    'deals_completed', v_deals_done,
    'ambassador',      v_ambassador_row,
    'kyc',             v_kyc_row,
    'avg_rating',      v_avg_rating,
    'rating_count',    v_rating_count,
    'fetched_at',      NOW()::TEXT
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_user_full_details(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_full_details(UUID) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.33 applied:';
  RAISE NOTICE '  ✓ get_all_users_for_admin: total_invested + trades_completed now LIVE from holdings + deals';
  RAISE NOTICE '  ✓ get_user_full_details: same fix for the per-user modal';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
