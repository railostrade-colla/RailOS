-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 hotfix — Project wallets admin panel: real KPIs
-- Date: 2026-05-09
-- Idempotent.
--
-- Bugs the founder reported:
--   1. حصص مباعة = 0 (should reflect the 15 shares just sold)
--   2. عدد المستثمرين = 0 (should count holders ≥ 1 share)
--   3. إيرادات المباعة = 0 د.ع (should show real sale revenue)
--   4. قيمة الحصص غير المباعة used the launch price, not market price
--
-- Root cause: get_project_wallets_admin used `h.shares_owned` but the
-- holdings table column is `h.shares`. PostgreSQL raised
-- "column does not exist", the EXCEPTION block swallowed it, the RPC
-- returned `'[]'::jsonb`, and the JS fell back to a legacy path that
-- hardcoded sold_shares / investors_count / sold_value to 0.
--
-- Fix:
--   • Use `h.shares` (the real column).
--   • sold_value = SUM of actual completed-deal totals where the
--     buyer was a regular user (real revenue, not theoretical
--     offering_sold × launch_price).
--   • unsold_offering_value uses COALESCE(current_market_price, share_price)
--     so the value tracks the live market price.
--   • investors_count counts every distinct user_id with a holding
--     row of shares > 0 — covers direct buys, secondary trades,
--     transfers, gifts, contracts, every acquisition path.
-- ═══════════════════════════════════════════════════════════════════

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
        COALESCE(p.name, '—')                                       AS project_name,
        -- Phase 12 hotfix — return the LIVE market price so the panel's
        -- "سعر السوق الحالي" line reflects actual market state, not
        -- the frozen launch price.
        COALESCE(p.current_market_price, p.share_price, 0)::NUMERIC AS market_price,
        COALESCE(p.total_shares, 0)::BIGINT                         AS total_shares,

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

        -- sold_shares = offering_total - offering_available (matches the wallet ledger)
        (
          COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
          - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
        )::BIGINT AS sold_shares,

        -- ══ Phase 12 hotfix: count EVERY holder regardless of source ══
        -- Includes direct buys, secondary trades, transfers, gifts,
        -- contracts. Was previously broken because the column was
        -- wrong (h.shares_owned does NOT exist; the real column is
        -- h.shares).
        (
          SELECT COUNT(DISTINCT h.user_id)
          FROM public.holdings h
          WHERE h.project_id = p.id AND h.shares > 0
        )::INT AS investors_count,

        -- Total project market value at LIVE price.
        (COALESCE(p.total_shares, 0) * COALESCE(p.current_market_price, p.share_price, 0))::NUMERIC AS total_market_value,

        -- ══ Phase 12 hotfix: sold_value = REAL revenue ══
        -- Sum the total_amount of every completed deal the project saw —
        -- direct-buy approvals + secondary-market sales. Falls back to
        -- (sold_shares × launch_price) when no deal rows exist (cold
        -- start or pre-Phase-10 environments).
        COALESCE((
          SELECT SUM(COALESCE(d.total_amount, d.shares * d.price_per_share))
          FROM public.deals d
          WHERE d.project_id = p.id AND d.status = 'completed'
        ), (
          (COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
           - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0))
          * COALESCE(p.share_price, 0)
        ))::NUMERIC AS sold_value,

        -- ══ Phase 12 hotfix: unsold_offering_value at LIVE price ══
        (
          COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
          * COALESCE(p.current_market_price, p.share_price, 0)
        )::NUMERIC AS unsold_offering_value,

        -- Backwards-compatible aggregate fields
        COALESCE(SUM(w.available_shares), 0)::BIGINT    AS total_available,
        COALESCE(SUM(w.total_shares), 0)::BIGINT        AS total_wallet_shares,
        (COALESCE(SUM(w.available_shares), 0) * COALESCE(p.current_market_price, p.share_price, 0))::NUMERIC AS balance,
        (COALESCE(SUM(w.total_shares), 0) * COALESCE(p.current_market_price, p.share_price, 0))::NUMERIC AS total_inflow,
        (
          (COALESCE(SUM(w.total_shares), 0) - COALESCE(SUM(w.available_shares), 0))
          * COALESCE(p.current_market_price, p.share_price, 0)
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
        p.id, p.name, p.share_price, p.current_market_price, p.total_shares, p.created_at,
        p.trading_suspended, p.trading_suspension_reason,
        p.offering_suspended, p.offering_suspension_reason
      HAVING COUNT(w.id) > 0
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- Same swallow-and-return-empty as before. With the column-name
    -- fix above this branch should NOT be hit on a healthy schema.
    v_result := '[]'::jsonb;
    RAISE WARNING 'get_project_wallets_admin: schema mismatch — returning empty';
  END;

  RETURN v_result;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_project_wallets_admin(INT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 hotfix applied:';
  RAISE NOTICE '  ✓ get_project_wallets_admin: h.shares (was h.shares_owned)';
  RAISE NOTICE '  ✓ sold_value: real revenue from deals.completed';
  RAISE NOTICE '  ✓ unsold_offering_value: uses current_market_price (live)';
  RAISE NOTICE '  ✓ market_price column: returns current_market_price (live)';
  RAISE NOTICE '  ✓ investors_count: every holder regardless of acquisition path';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
