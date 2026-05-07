-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.93 — Trading & Offering Suspension per Project
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- New capabilities:
--   1. Two new boolean flags on `projects`:
--        trading_suspended  — blocks ALL buy/sell for the project
--        offering_suspended — blocks NEW direct-buy requests only
--                             (secondary-market trades still pass)
--      Each has a companion *_reason TEXT column.
--
--   2. Four new admin RPCs (super_admin only):
--        admin_suspend_trading   / admin_resume_trading
--        admin_suspend_offering  / admin_resume_offering
--
--   3. submit_direct_buy_request updated to check both flags.
--      Returns:
--        error='trading_suspended'  + reason  → "التداول معلق"
--        error='offering_suspended' + reason  → "الشراء المباشر معلق"
--
--   4. get_project_wallets_admin updated to expose the 4 new fields
--      so the admin panel and EntityDetailsView can read them.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Add columns to projects ───────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS trading_suspended         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trading_suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS offering_suspended        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS offering_suspension_reason TEXT;

-- Index for fast look-up in submit_direct_buy_request
CREATE INDEX IF NOT EXISTS idx_projects_trading_suspended
  ON public.projects (trading_suspended) WHERE trading_suspended = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_offering_suspended
  ON public.projects (offering_suspended) WHERE offering_suspended = TRUE;


-- ─── 2. admin_suspend_trading ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_suspend_trading(
  p_project_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  UPDATE public.projects
     SET trading_suspended         = TRUE,
         trading_suspension_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
   WHERE id = p_project_id;

  -- Audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'suspend_trading', 'project', p_project_id,
            jsonb_build_object('reason', p_reason));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'project_id', p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_suspend_trading(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_trading(UUID, TEXT) TO authenticated;


-- ─── 3. admin_resume_trading ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resume_trading(
  p_project_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  UPDATE public.projects
     SET trading_suspended         = FALSE,
         trading_suspension_reason = NULL
   WHERE id = p_project_id;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'resume_trading', 'project', p_project_id, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'project_id', p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_resume_trading(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resume_trading(UUID) TO authenticated;


-- ─── 4. admin_suspend_offering ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_suspend_offering(
  p_project_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  UPDATE public.projects
     SET offering_suspended         = TRUE,
         offering_suspension_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
   WHERE id = p_project_id;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'suspend_offering', 'project', p_project_id,
            jsonb_build_object('reason', p_reason));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'project_id', p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_suspend_offering(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_offering(UUID, TEXT) TO authenticated;


-- ─── 5. admin_resume_offering ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_resume_offering(
  p_project_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  UPDATE public.projects
     SET offering_suspended         = FALSE,
         offering_suspension_reason = NULL
   WHERE id = p_project_id;

  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'resume_offering', 'project', p_project_id, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'project_id', p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_resume_offering(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resume_offering(UUID) TO authenticated;


-- ─── 6. Update submit_direct_buy_request to check suspension ──────
DROP FUNCTION IF EXISTS public.submit_direct_buy_request(UUID, BIGINT);
CREATE OR REPLACE FUNCTION public.submit_direct_buy_request(
  p_project_id    UUID,
  p_shares_amount BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_project        RECORD;
  v_seller_id      UUID;
  v_total_amount   BIGINT;
  v_deal_id        UUID;
  v_offering_avail BIGINT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_shares_amount IS NULL OR p_shares_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- Load project with suspension flags
  SELECT
    p.id, p.name, p.share_price, p.created_by,
    p.status::TEXT                  AS status,
    p.trading_suspended,
    p.trading_suspension_reason,
    p.offering_suspended,
    p.offering_suspension_reason
  INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_project.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- Check trading suspension first (blocks everything)
  IF v_project.trading_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',  'trading_suspended',
      'reason', COALESCE(v_project.trading_suspension_reason, 'التداول معلق مؤقتاً')
    );
  END IF;

  IF v_project.status NOT IN ('active', 'launching', 'open') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_active');
  END IF;

  -- Check offering suspension (blocks new direct purchases)
  IF v_project.offering_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',  'offering_suspended',
      'reason', COALESCE(v_project.offering_suspension_reason, 'شراء الحصص الجديدة معلق مؤقتاً')
    );
  END IF;

  -- Verify the offering wallet has enough shares
  BEGIN
    SELECT COALESCE(available_shares, 0) INTO v_offering_avail
    FROM public.project_wallets
    WHERE project_id = p_project_id AND wallet_type = 'offering'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_offering_avail := 0;
  END;

  IF v_offering_avail < p_shares_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'insufficient_offering_shares',
      'available', v_offering_avail
    );
  END IF;

  v_seller_id := COALESCE(v_project.created_by, v_uid);

  IF v_seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_buy_own_project');
  END IF;

  v_total_amount := p_shares_amount * COALESCE(v_project.share_price, 0);

  -- Insert the deal row
  BEGIN
    INSERT INTO public.deals (
      project_id, buyer_id, seller_id, shares, deal_type, status
    ) VALUES (
      p_project_id, v_uid, v_seller_id, p_shares_amount, 'primary', 'pending_payment'
    ) RETURNING id INTO v_deal_id;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: try with price column if schema differs
    BEGIN
      INSERT INTO public.deals (
        project_id, buyer_id, seller_id, shares, price_per_share, deal_type, status
      ) VALUES (
        p_project_id, v_uid, v_seller_id, p_shares_amount,
        COALESCE(v_project.share_price, 0), 'primary', 'pending_payment'
      ) RETURNING id INTO v_deal_id;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'deal_insert_failed',
                                'detail', SQLERRM);
    END;
  END;

  -- Notify admins
  BEGIN
    INSERT INTO public.notifications (user_id, title, body, type, metadata)
    SELECT
      pr.id,
      'طلب شراء مباشر جديد',
      format('طلب شراء %s حصة من مشروع %s', p_shares_amount, v_project.name),
      'deal_request',
      jsonb_build_object('deal_id', v_deal_id, 'project_id', p_project_id)
    FROM public.profiles pr
    WHERE pr.role IN ('admin', 'super_admin');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'deal_id',      v_deal_id,
    'total_amount', v_total_amount,
    'expires_at',   (NOW() + INTERVAL '48 hours')::TEXT
  );
END $$;

GRANT EXECUTE ON FUNCTION public.submit_direct_buy_request(UUID, BIGINT) TO authenticated;


-- ─── 7. Update get_project_wallets_admin to expose suspension fields ──
CREATE OR REPLACE FUNCTION public.get_project_wallets_admin(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id              AS project_id,
        p.id              AS id,
        COALESCE(p.name, '—')                    AS project_name,
        COALESCE(p.share_price, 0)::NUMERIC      AS market_price,
        COALESCE(p.total_shares, 0)::BIGINT      AS total_shares,

        -- Suspension flags (Phase 10.93)
        COALESCE(p.trading_suspended, FALSE)           AS trading_suspended,
        p.trading_suspension_reason                    AS trading_suspension_reason,
        COALESCE(p.offering_suspended, FALSE)          AS offering_suspended,
        p.offering_suspension_reason                   AS offering_suspension_reason,

        -- Per-wallet share counts
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'),   0)::BIGINT AS offering_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'),   0)::BIGINT AS offering_available,
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'ambassador'), 0)::BIGINT AS ambassador_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'ambassador'), 0)::BIGINT AS ambassador_available,
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'reserve'),    0)::BIGINT AS reserve_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'reserve'),    0)::BIGINT AS reserve_available,

        -- Sold = offering_total - offering_available
        (
          COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
          - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
        )::BIGINT AS sold_shares,

        (
          SELECT COUNT(DISTINCT h.user_id)
          FROM public.holdings h
          WHERE h.project_id = p.id AND h.shares_owned > 0
        )::INT AS investors_count,

        -- Market value calculations
        (COALESCE(p.total_shares, 0) * COALESCE(p.share_price, 0))::NUMERIC AS total_market_value,
        (
          (
            COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
            - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
          ) * COALESCE(p.share_price, 0)
        )::NUMERIC AS sold_value,
        (
          COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
          * COALESCE(p.share_price, 0)
        )::NUMERIC AS unsold_offering_value,

        -- Backwards-compatible aggregate fields
        COALESCE(SUM(w.available_shares), 0)::BIGINT    AS total_available,
        COALESCE(SUM(w.total_shares), 0)::BIGINT        AS total_wallet_shares,
        (COALESCE(SUM(w.available_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC AS balance,
        (COALESCE(SUM(w.total_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC     AS total_inflow,
        (
          (COALESCE(SUM(w.total_shares), 0) - COALESCE(SUM(w.available_shares), 0))
          * COALESCE(p.share_price, 0)
        )::NUMERIC AS total_outflow,

        COUNT(w.id)::INT AS wallet_count,
        CASE
          WHEN COUNT(w.id) FILTER (WHERE w.status = 'frozen') > 0 THEN 'frozen'
          WHEN COUNT(w.id) = 0 THEN 'closed'
          ELSE 'active'
        END AS status,
        TO_CHAR(p.created_at, 'YYYY-MM-DD') AS created_at,
        MAX(w.frozen_at)     AS frozen_at,
        MAX(w.frozen_reason) AS frozen_reason
      FROM public.projects p
      LEFT JOIN public.project_wallets w ON w.project_id = p.id
      WHERE p.status <> 'cancelled' OR p.status IS NULL
      GROUP BY
        p.id, p.name, p.share_price, p.total_shares, p.created_at,
        p.trading_suspended, p.trading_suspension_reason,
        p.offering_suspended, p.offering_suspension_reason
      HAVING COUNT(w.id) > 0
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.get_project_wallets_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_wallets_admin(INT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.93 applied:';
  RAISE NOTICE '  ✓ projects.trading_suspended + trading_suspension_reason';
  RAISE NOTICE '  ✓ projects.offering_suspended + offering_suspension_reason';
  RAISE NOTICE '  ✓ admin_suspend_trading / admin_resume_trading';
  RAISE NOTICE '  ✓ admin_suspend_offering / admin_resume_offering';
  RAISE NOTICE '  ✓ submit_direct_buy_request: checks trading_suspended → offering_suspended';
  RAISE NOTICE '  ✓ get_project_wallets_admin: exposes all 4 suspension fields';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
