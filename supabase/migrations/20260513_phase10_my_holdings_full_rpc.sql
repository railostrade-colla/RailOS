-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.71 — get_my_holdings_full
-- Date: 2026-05-13
-- Idempotent: safe to re-run.
--
-- One-shot RPC for the /portfolio holdings list. Bundles:
--   • holdings row (id, shares, avg_buy_price, total_invested, …)
--   • project metadata (name, sector, share_price, symbol)
--   • current market_price from public.market_state (engine output)
--   • funded_pct = sold_shares / total_shares of the offering wallet
--   • shares_bought_from_project, total_bought_amount   (cumulative)
--   • shares_sold_from_project, total_sold_amount       (cumulative)
--
-- Why a single RPC: the previous embedded-join read sometimes returned
-- null for the project (PostgREST FK inference quirk + RLS), and we
-- now want sell-side aggregates that the frontend would otherwise
-- need 3 follow-up queries to compute. SECURITY DEFINER bypasses RLS.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_my_holdings_full();

CREATE OR REPLACE FUNCTION public.get_my_holdings_full()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.last_acquired_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      h.id,
      h.project_id,
      h.shares,
      h.frozen_shares,
      h.average_buy_price,
      h.total_invested,
      h.first_acquired_at,
      h.last_acquired_at,
      proj.name           AS project_name,
      proj.sector::TEXT   AS project_sector,
      proj.share_price    AS project_share_price,
      COALESCE(
        (SELECT current_price FROM public.market_state WHERE project_id = proj.id LIMIT 1),
        proj.share_price
      ) AS market_price,
      proj.total_shares   AS project_total_shares,
      proj.symbol         AS project_symbol,
      COALESCE(
        (SELECT
           CASE WHEN total_shares > 0
                THEN ROUND((sold_shares::NUMERIC / total_shares::NUMERIC) * 100, 1)
                ELSE 0 END
         FROM public.project_wallets
         WHERE project_id = proj.id AND wallet_type = 'offering'
         LIMIT 1),
        0
      ) AS funded_pct,
      COALESCE((
        SELECT SUM(shares) FROM public.deals
        WHERE buyer_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS shares_bought_from_project,
      COALESCE((
        SELECT SUM(shares) FROM public.deals
        WHERE seller_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS shares_sold_from_project,
      COALESCE((
        SELECT SUM(total_amount) FROM public.deals
        WHERE seller_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS total_sold_amount,
      COALESCE((
        SELECT SUM(total_amount) FROM public.deals
        WHERE buyer_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS total_bought_amount
    FROM public.holdings h
    LEFT JOIN public.projects proj ON proj.id = h.project_id
    WHERE h.user_id = v_uid AND h.shares > 0
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END
$$;

GRANT EXECUTE ON FUNCTION public.get_my_holdings_full() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.71 applied:';
  RAISE NOTICE '  ✓ get_my_holdings_full — bundles holdings + project + market_price + funded_pct + buy/sell aggregates';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
