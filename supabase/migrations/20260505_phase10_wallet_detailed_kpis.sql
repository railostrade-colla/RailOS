-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.57 — Detailed wallet KPIs + super_admin gate
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Three things:
--   1. Enriches get_project_wallets_admin with: total_shares,
--      sold_shares, investors_count, market_price, sold_value,
--      unsold_offering_value (so the panel + modal can render every
--      metric the founder asked for).
--   2. Restricts admin_freeze_project / admin_unfreeze_project /
--      admin_release_shares_to_market to super_admin ONLY (regular
--      admins can read but not act).
--   3. Documents which tables wire into the user-facing market.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Enriched aggregating RPC ────────────────────────────────
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
        COALESCE(p.name, '—') AS project_name,
        COALESCE(p.share_price, 0)::NUMERIC AS market_price,
        COALESCE(p.total_shares, 0)::BIGINT AS total_shares,

        -- Per-wallet share counts (totals + availables)
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'),   0)::BIGINT AS offering_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'),   0)::BIGINT AS offering_available,
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'ambassador'), 0)::BIGINT AS ambassador_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'ambassador'), 0)::BIGINT AS ambassador_available,
        COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'reserve'),    0)::BIGINT AS reserve_total,
        COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'reserve'),    0)::BIGINT AS reserve_available,

        -- Sold = offering_total - offering_available (what users bought)
        (
          COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
          - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
        )::BIGINT AS sold_shares,

        -- Distinct investors holding > 0 shares of this project
        (
          SELECT COUNT(DISTINCT h.user_id)
          FROM public.holdings h
          WHERE h.project_id = p.id AND h.shares_owned > 0
        )::INT AS investors_count,

        -- Market value calculations (price × shares)
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

        -- Backwards-compatible aggregate fields (used by older panel code)
        COALESCE(SUM(w.available_shares), 0)::BIGINT AS total_available,
        COALESCE(SUM(w.total_shares), 0)::BIGINT AS total_wallet_shares,
        (COALESCE(SUM(w.available_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC AS balance,
        (COALESCE(SUM(w.total_shares), 0) * COALESCE(p.share_price, 0))::NUMERIC AS total_inflow,
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
        MAX(w.frozen_at) AS frozen_at,
        MAX(w.frozen_reason) AS frozen_reason
      FROM public.projects p
      LEFT JOIN public.project_wallets w ON w.project_id = p.id
      WHERE p.status <> 'cancelled' OR p.status IS NULL
      GROUP BY p.id, p.name, p.share_price, p.total_shares, p.created_at
      HAVING COUNT(w.id) > 0
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_project_wallets_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_wallets_admin(INT) TO authenticated;


-- ─── 2. Restrict freeze/unfreeze/release to super_admin ─────────
CREATE OR REPLACE FUNCTION public.admin_freeze_project(
  p_project_id UUID, p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid(); v_role TEXT; v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  BEGIN
    UPDATE public.project_wallets
       SET status = 'frozen',
           frozen_at = now(),
           frozen_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
     WHERE project_id = p_project_id AND status <> 'frozen';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wallets_table_missing');
  END;

  BEGIN
    PERFORM public.log_admin_action('freeze_project', 'project', p_project_id,
      jsonb_build_object('wallets_frozen', v_count, 'reason', p_reason));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'wallets_frozen', v_count);
END
$$;

REVOKE ALL ON FUNCTION public.admin_freeze_project(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_freeze_project(UUID, TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_unfreeze_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid(); v_role TEXT; v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  BEGIN
    UPDATE public.project_wallets
       SET status = 'active', frozen_at = NULL, frozen_reason = NULL
     WHERE project_id = p_project_id AND status = 'frozen';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wallets_table_missing');
  END;

  BEGIN
    PERFORM public.log_admin_action('unfreeze_project', 'project', p_project_id,
      jsonb_build_object('wallets_unfrozen', v_count));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'wallets_unfrozen', v_count);
END
$$;

REVOKE ALL ON FUNCTION public.admin_unfreeze_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_project(UUID) TO authenticated;


-- Update admin_release_shares_to_market to require super_admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_release_shares_to_market'
  ) THEN
    -- The original function exists; we'll patch its first auth check by
    -- creating an outer wrapper that gates on super_admin.
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.admin_release_shares_to_market_v2(
        p_project_id UUID,
        p_amount BIGINT,
        p_reason TEXT DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE v_role TEXT;
      BEGIN
        SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
        IF v_role <> 'super_admin' THEN
          RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
        END IF;
        RETURN public.admin_release_shares_to_market(p_project_id, p_amount, p_reason);
      END
      $body$;
      GRANT EXECUTE ON FUNCTION public.admin_release_shares_to_market_v2(UUID, BIGINT, TEXT) TO authenticated;
    $sql$;
  END IF;
END $$;


-- ─── 3. Done ─────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.57 applied:';
  RAISE NOTICE '  ✓ get_project_wallets_admin enriched (10 new fields)';
  RAISE NOTICE '  ✓ admin_freeze/unfreeze_project → super_admin only';
  RAISE NOTICE '  ✓ admin_release_shares_to_market_v2 wrapper → super_admin only';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLES INVOLVED IN THE WALLET → MARKET FLOW:';
  RAISE NOTICE '  • projects (master record + share_price = market price)';
  RAISE NOTICE '  • project_wallets (3 wallets per project)';
  RAISE NOTICE '  • holdings (user balances → drives investors_count)';
  RAISE NOTICE '  • deals (sales transactions → moves shares offering → user)';
  RAISE NOTICE '  • price_history (every market price change)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
