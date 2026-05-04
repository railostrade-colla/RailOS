-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.32 — user_stats RPC + profile auto-creation + audit retention
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Three independent hardenings bundled into one migration:
--
--   1. get_user_stats(p_user_id UUID)
--      Powers the admin UserStatsPanel. Returns trade counts, dispute
--      counts, rating average, KYC status, account age, and level
--      override flags for one user. Defensive: any missing source
--      table degrades gracefully to zero counts (so the panel shows
--      zeros instead of throwing on a fresh DB).
--
--   2. handle_new_user() + on_auth_user_created trigger
--      Auto-creates a profiles row whenever auth.users gets a new
--      member. Without this, isSuperAdminDB() and getMyRole() return
--      null for any newly-signed-up user until an admin manually
--      backfills profiles — which means new users hit the admin
--      panel's access denied screen even when they're allowed in.
--      The trigger is INSERT-only (we never overwrite an existing
--      row).
--
--   3. cleanup_audit_log_old(p_days INT DEFAULT 90)
--      Deletes audit_log rows older than N days. Admin-only RPC.
--      Pair this with a scheduled task (pg_cron or a Supabase Edge
--      Function) to run nightly — without retention the audit_log
--      grows unbounded.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. get_user_stats ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_total_trades INT := 0;
  v_successful_trades INT := 0;
  v_failed_trades INT := 0;
  v_cancelled_trades INT := 0;
  v_total_volume NUMERIC := 0;
  v_disputes_total INT := 0;
  v_disputes_won INT := 0;
  v_disputes_lost INT := 0;
  v_reports_received INT := 0;
  v_reports_against_others INT := 0;
  v_rating_avg NUMERIC := 0;
  v_rating_count INT := 0;
  v_first_trade TIMESTAMPTZ;
  v_last_trade TIMESTAMPTZ;
  v_account_age_days INT := 0;
  v_days_active INT := 0;
  v_success_rate NUMERIC := 0;
  v_dispute_rate NUMERIC := 0;
BEGIN
  -- ─── auth ───
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_user');
  END IF;

  -- ─── profile ───
  SELECT
    id,
    full_name,
    username,
    role,
    level,
    kyc_status,
    created_at,
    last_seen_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  -- ─── account age ───
  v_account_age_days := GREATEST(
    0,
    EXTRACT(DAY FROM (now() - v_profile.created_at))::INT
  );

  -- ─── trades (deals) ───
  BEGIN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'failed' OR status = 'rejected'),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0),
      MIN(created_at) FILTER (WHERE status = 'completed'),
      MAX(created_at) FILTER (WHERE status = 'completed')
    INTO
      v_total_trades,
      v_successful_trades,
      v_failed_trades,
      v_cancelled_trades,
      v_total_volume,
      v_first_trade,
      v_last_trade
    FROM public.deals
    WHERE buyer_id = p_user_id OR seller_id = p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- deals table or expected columns not present — leave zeros.
    NULL;
  END;

  -- ─── disputes ───
  BEGIN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE outcome = 'in_favor_of_filer' AND filer_id = p_user_id),
      COUNT(*) FILTER (WHERE outcome = 'against_filer' AND filer_id = p_user_id)
    INTO
      v_disputes_total,
      v_disputes_won,
      v_disputes_lost
    FROM public.disputes
    WHERE filer_id = p_user_id OR respondent_id = p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- ─── reports ───
  BEGIN
    SELECT COUNT(*) INTO v_reports_received
    FROM public.user_reports
    WHERE reported_user_id = p_user_id;

    SELECT COUNT(*) INTO v_reports_against_others
    FROM public.user_reports
    WHERE reporter_id = p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- ─── ratings ───
  BEGIN
    SELECT
      COALESCE(AVG(stars), 0),
      COUNT(*)
    INTO v_rating_avg, v_rating_count
    FROM public.user_ratings
    WHERE rated_user_id = p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- ─── derived rates ───
  IF v_total_trades > 0 THEN
    v_success_rate := ROUND(
      (v_successful_trades::NUMERIC / v_total_trades::NUMERIC) * 100,
      1
    );
    v_dispute_rate := ROUND(
      (v_disputes_total::NUMERIC / v_total_trades::NUMERIC) * 100,
      2
    );
  END IF;

  -- ─── days active (rough: distinct days with a deal) ───
  BEGIN
    SELECT COUNT(DISTINCT date_trunc('day', created_at))
    INTO v_days_active
    FROM public.deals
    WHERE (buyer_id = p_user_id OR seller_id = p_user_id);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_days_active := 0;
  END;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'display_name', COALESCE(v_profile.full_name, v_profile.username, 'User'),
    'level', COALESCE(v_profile.level, 'basic'),
    'kyc_status', COALESCE(v_profile.kyc_status, 'basic'),
    'role', COALESCE(v_profile.role, 'user'),
    'total_trades', v_total_trades,
    'successful_trades', v_successful_trades,
    'failed_trades', v_failed_trades,
    'cancelled_trades', v_cancelled_trades,
    'total_trade_volume', v_total_volume,
    'success_rate', v_success_rate,
    'disputes_total', v_disputes_total,
    'disputes_won', v_disputes_won,
    'disputes_lost', v_disputes_lost,
    'dispute_rate', v_dispute_rate,
    'reports_received', v_reports_received,
    'reports_against_others', v_reports_against_others,
    'rating_average', v_rating_avg,
    'rating_count', v_rating_count,
    'days_active', v_days_active,
    'account_age_days', v_account_age_days,
    'first_trade_at', v_first_trade,
    'last_trade_at', v_last_trade,
    'created_at', v_profile.created_at,
    'last_seen_at', v_profile.last_seen_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_user_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO authenticated;


-- ─── 2. Auto-create profile on signup ──────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a minimal profile row. Skip if a row already exists (the
  -- profile may have been pre-created by an admin invite flow).
  INSERT INTO public.profiles (id, full_name, username, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    'user',
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  -- Never block signup if the profile insert fails (missing columns,
  -- RLS quirks, anything). The user can still authenticate; an admin
  -- can backfill the row later if needed.
  WHEN OTHERS THEN
    RAISE NOTICE 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- ─── 3. Audit log retention ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_audit_log_old(p_days INT DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT := 0;
  v_cutoff TIMESTAMPTZ;
BEGIN
  -- ─── auth ───
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  IF p_days IS NULL OR p_days < 7 THEN
    -- Refuse aggressive deletion. 7-day floor protects against typos.
    RETURN jsonb_build_object('success', FALSE, 'error', 'min_7_days');
  END IF;

  v_cutoff := now() - (p_days || ' days')::INTERVAL;

  BEGIN
    DELETE FROM public.audit_log WHERE created_at < v_cutoff;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'audit_log_missing');
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted', v_deleted,
    'cutoff', v_cutoff,
    'retention_days', p_days
  );
END
$$;

REVOKE ALL ON FUNCTION public.cleanup_audit_log_old(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_log_old(INT) TO authenticated;


-- ─── Done ──────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.32 applied: get_user_stats + on_auth_user_created + cleanup_audit_log_old.';
END $$;
