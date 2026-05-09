-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Project wallets: real revenue vs real expenses
-- Date: 2026-05-09
-- Idempotent.
--
-- The previous version of get_project_wallets_admin computed:
--   • total_inflow  = total_wallet_shares × market_price (THEORETICAL)
--   • total_outflow = (total - available)  × market_price (THEORETICAL)
-- which gave the founder a meaningless "expenses = -375,000" line for
-- a project with one 15-share sale.
--
-- Founder spec: the columns should reflect REAL cash flow:
--
--   الإيرادات  (revenue)  = every completed sale of project shares
--                          (deals.total_amount where status='completed')
--   المصروفات (expenses) = shares the project paid out as gifts:
--                          1. ambassador first-investment rewards
--                             (Phase 12 ambassador trigger writes these)
--                          2. user gifts of type 'shares' / 'bonus_shares'
--                             (user_gifts table, gift_value JSONB)
--                          Both valued at the launch share_price for
--                          stability across price changes.
--
-- This migration re-creates get_project_wallets_admin with those two
-- correct sums. Everything else (offering counts, sold_shares,
-- investors_count) stays the same as the Phase 12 hotfix.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_project_wallets_admin(p_limit INT DEFAULT 200)
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

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id              AS project_id,
        p.id              AS id,
        COALESCE(p.name, '—')                                       AS project_name,
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

        -- sold_shares = offering_total - offering_available
        (
          COALESCE(SUM(w.total_shares)     FILTER (WHERE w.wallet_type = 'offering'), 0)
          - COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
        )::BIGINT AS sold_shares,

        -- Phase 11.26 column-name fix preserved: holdings.shares (not shares_owned).
        (
          SELECT COUNT(DISTINCT h.user_id)
          FROM public.holdings h
          WHERE h.project_id = p.id AND h.shares > 0
        )::INT AS investors_count,

        (COALESCE(p.total_shares, 0) * COALESCE(p.current_market_price, p.share_price, 0))::NUMERIC AS total_market_value,

        -- sold_value = real revenue from completed deals (kept for the modal).
        COALESCE((
          SELECT SUM(COALESCE(d.total_amount, d.shares * d.price_per_share))
          FROM public.deals d
          WHERE d.project_id = p.id AND d.status = 'completed'
        ), 0)::NUMERIC AS sold_value,

        (
          COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
          * COALESCE(p.current_market_price, p.share_price, 0)
        )::NUMERIC AS unsold_offering_value,

        -- Backwards-compatible aggregate fields
        COALESCE(SUM(w.available_shares), 0)::BIGINT    AS total_available,
        COALESCE(SUM(w.total_shares), 0)::BIGINT        AS total_wallet_shares,

        -- ══ Phase 12 fix — REAL cash flow columns ══
        --
        -- balance: idle value still in the project (offering's unsold shares
        -- at live market price + the IQD already collected from sales that
        -- hasn't been recorded as an expense). Conservative: just use
        -- offering_available × market_price as the project's "live" balance.
        (
          COALESCE(SUM(w.available_shares) FILTER (WHERE w.wallet_type = 'offering'), 0)
          * COALESCE(p.current_market_price, p.share_price, 0)
        )::NUMERIC AS balance,

        -- الإيرادات: real revenue from every completed sale of the
        -- project's shares (direct buys + secondary deals when the
        -- offering wallet is the seller).
        COALESCE((
          SELECT SUM(COALESCE(d.total_amount, d.shares * d.price_per_share))
          FROM public.deals d
          WHERE d.project_id = p.id AND d.status = 'completed'
        ), 0)::NUMERIC AS total_inflow,

        -- المصروفات: shares the project gave away.
        --   1. Ambassador first-investment rewards (granted only).
        --   2. User gifts whose type is shares-related.
        -- Both valued at the LAUNCH price for stability so the founder
        -- sees the cost-basis (not a moving target).
        COALESCE((
          SELECT SUM(ar.reward_shares * COALESCE(p.share_price, 0))
          FROM public.ambassador_rewards ar
          WHERE ar.project_id = p.id AND ar.status = 'granted'
        ), 0)::NUMERIC
        + COALESCE((
          -- user_gifts.gift_value JSONB → expect { project_id, shares, value? }
          -- We accept any of: gift_value->>'shares', gift_value->>'amount_shares'.
          SELECT SUM(
            COALESCE(
              NULLIF(ug.gift_value->>'value', '')::NUMERIC,
              (
                COALESCE(NULLIF(ug.gift_value->>'shares', '')::NUMERIC,
                         NULLIF(ug.gift_value->>'amount_shares', '')::NUMERIC,
                         0)
                * COALESCE(p.share_price, 0)
              )
            )
          )
          FROM public.user_gifts ug
          WHERE (ug.gift_value->>'project_id')::UUID = p.id
            AND ug.gift_type IN ('shares','bonus_shares','free_shares','share_gift')
        ), 0)::NUMERIC
        AS total_outflow,

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
  RAISE NOTICE 'Phase 12 revenue/expenses fix applied:';
  RAISE NOTICE '  ✓ الإيرادات (total_inflow) = real revenue from completed deals';
  RAISE NOTICE '  ✓ المصروفات (total_outflow) = ambassador rewards + share gifts at launch price';
  RAISE NOTICE '  ✓ الرصيد (balance) = offering_available × current market price';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
