-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.64 — comprehensive user-management RPCs for admin Users tab
-- Date: 2026-05-09
-- Idempotent: safe to re-run.
--
-- The admin Users page needs:
--   • View full user details (profile + holdings + deals + ratings +
--     ambassador status + KYC info).
--   • Toggle ambassador status (super_admin only).
--   • Ban or temporarily suspend (with optional `until` timestamp).
--   • Unban.
--
-- This migration ships:
--   1. profiles columns: banned_until, suspended_at, suspended_by
--   2. get_user_full_details(p_user_id)  — single round-trip with
--      everything the details modal needs.
--   3. admin_ban_user(p_user_id, p_reason, p_until)
--   4. admin_unban_user(p_user_id)
--   5. admin_set_ambassador(p_user_id, p_enable)
--
-- All RPCs are SECURITY DEFINER + admin-gated.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Schema additions on profiles (safe / additive) ──────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ─── 2. get_user_full_details ──────────────────────────────────
DROP FUNCTION IF EXISTS public.get_user_full_details(UUID);

CREATE OR REPLACE FUNCTION public.get_user_full_details(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile        JSONB := '{}'::jsonb;
  v_email          TEXT;
  v_holdings_total BIGINT := 0;
  v_holdings_value BIGINT := 0;
  v_deals_total    INT := 0;
  v_deals_done     INT := 0;
  v_ambassador_row JSONB := NULL;
  v_kyc_row        JSONB := NULL;
  v_avg_rating     NUMERIC := 0;
  v_rating_count   INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  -- profile
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
        rating_average, rating_count, trades_completed, total_invested,
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

  -- holdings
  BEGIN
    SELECT
      COALESCE(SUM(shares), 0),
      COALESCE(SUM(total_invested), 0)
    INTO v_holdings_total, v_holdings_value
    FROM public.holdings WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_holdings_total := 0; v_holdings_value := 0;
  END;

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
    'profile',        v_profile,
    'email',          v_email,
    'holdings_total', v_holdings_total,
    'holdings_value', v_holdings_value,
    'deals_total',    v_deals_total,
    'deals_completed', v_deals_done,
    'ambassador',     v_ambassador_row,
    'kyc',            v_kyc_row,
    'avg_rating',     v_avg_rating,
    'rating_count',   v_rating_count,
    'fetched_at',     NOW()
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_user_full_details(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_full_details(UUID) TO authenticated;


-- ─── 3. admin_ban_user ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_ban_user(UUID, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL,
  p_until   TIMESTAMPTZ DEFAULT NULL  -- NULL = permanent ban
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_target_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_user_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_ban_self');
  END IF;

  -- Don't allow banning admins/super_admins from this RPC.
  SELECT role::TEXT INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_target_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_ban_admin');
  END IF;

  UPDATE public.profiles
     SET is_banned     = TRUE,
         is_active     = FALSE,
         ban_reason    = COALESCE(p_reason, ban_reason),
         banned_until  = p_until,
         suspended_at  = NOW(),
         suspended_by  = v_uid
   WHERE id = p_user_id;

  -- Audit
  BEGIN
    PERFORM public.log_admin_action(
      'ban_user', 'profile', p_user_id,
      jsonb_build_object(
        'reason',  p_reason,
        'until',   p_until,
        'permanent', p_until IS NULL
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'permanent', p_until IS NULL,
    'until', p_until
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_ban_user(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, TEXT, TIMESTAMPTZ) TO authenticated;


-- ─── 4. admin_unban_user ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_unban_user(UUID);

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.profiles
     SET is_banned    = FALSE,
         is_active    = TRUE,
         ban_reason   = NULL,
         banned_until = NULL,
         suspended_at = NULL,
         suspended_by = NULL
   WHERE id = p_user_id;

  BEGIN
    PERFORM public.log_admin_action(
      'unban_user', 'profile', p_user_id, '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END
$$;

REVOKE ALL ON FUNCTION public.admin_unban_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(UUID) TO authenticated;


-- ─── 5. admin_set_ambassador ──────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_set_ambassador(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_set_ambassador(
  p_user_id UUID,
  p_enable  BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  -- Only super_admin sets ambassadors (gives a 2% reward stream).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_super_admin');
  END IF;

  IF p_enable THEN
    -- Mirror to profiles
    UPDATE public.profiles
       SET is_ambassador = TRUE,
           role = CASE WHEN role = 'user' THEN 'ambassador'::user_role ELSE role END
     WHERE id = p_user_id;

    -- Upsert into ambassadors with active status
    INSERT INTO public.ambassadors (
      user_id, application_status, is_active,
      reward_percentage, approved_by, approved_at
    )
    VALUES (
      p_user_id, 'approved'::ambassador_application_status, TRUE,
      1.00, v_uid, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET application_status = 'approved'::ambassador_application_status,
          is_active = TRUE,
          approved_by = v_uid,
          approved_at = NOW(),
          revoked_by = NULL,
          revoked_at = NULL;

    BEGIN
      PERFORM public.log_admin_action(
        'enable_ambassador', 'profile', p_user_id, '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSE
    UPDATE public.profiles
       SET is_ambassador = FALSE,
           role = CASE WHEN role = 'ambassador' THEN 'user'::user_role ELSE role END
     WHERE id = p_user_id;

    UPDATE public.ambassadors
       SET is_active = FALSE,
           revoked_by = v_uid,
           revoked_at = NOW()
     WHERE user_id = p_user_id;

    BEGIN
      PERFORM public.log_admin_action(
        'disable_ambassador', 'profile', p_user_id, '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'is_ambassador', p_enable);
END
$$;

REVOKE ALL ON FUNCTION public.admin_set_ambassador(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_ambassador(UUID, BOOLEAN) TO authenticated;


-- ─── 6. Update get_all_users_for_admin to include new fields ──
DROP FUNCTION IF EXISTS public.get_all_users_for_admin(INT);

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin(p_limit INT DEFAULT 500)
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
      p.trades_completed,
      p.total_invested,
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


-- ─── Done ──────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.64 applied:';
  RAISE NOTICE '  ✓ profiles.banned_until / suspended_at / suspended_by';
  RAISE NOTICE '  ✓ get_user_full_details';
  RAISE NOTICE '  ✓ admin_ban_user / admin_unban_user';
  RAISE NOTICE '  ✓ admin_set_ambassador';
  RAISE NOTICE '  ✓ get_all_users_for_admin (now includes ambassador + ban status)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
