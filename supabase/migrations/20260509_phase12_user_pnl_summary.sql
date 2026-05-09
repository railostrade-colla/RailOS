-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.10 — accurate user P&L summary (commissions-aware)
-- Date: 2026-05-09
-- Idempotent.
--
-- Founder: the percentage next to "القيمة الإجمالية للمحفظة" should
-- represent the actual profit (sell - buy - commissions). The old
-- calculation was just `(current_value - total_invested) / total_invested`
-- which ignored commissions and didn't differentiate between realized
-- profit (from completed sales) and unrealized profit (from held shares).
--
-- This RPC walks the user's completed deals (both as buyer and seller),
-- adds buyer-commissions to the cost basis, subtracts seller-commissions
-- from the revenue, and finally adds the current market value of
-- shares still held. The final percentage is:
--
--   total_cost     = Σ deal.total_amount (buys)  + Σ buyer_commissions
--   total_revenue  = Σ deal.total_amount (sells) − Σ seller_commissions
--   holdings_value = Σ shares × current_market_price
--   net_profit     = total_revenue + holdings_value − total_cost
--   profit_pct     = (net_profit / total_cost) × 100
--
-- This number reflects EXACTLY what the founder asked for:
--   "اشتريت بـ 25,000 وبعت بـ 30,000 — اطرح العمولة من الفرق"
-- ═══════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.get_user_pnl_summary(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_total_buy_value NUMERIC := 0;
  v_total_sell_value NUMERIC := 0;
  v_total_buyer_commissions NUMERIC := 0;
  v_total_seller_commissions NUMERIC := 0;
  v_total_invested NUMERIC := 0;        -- Σ holdings.total_invested
  v_holdings_value NUMERIC := 0;        -- Σ shares × current_market_price
  v_total_shares BIGINT := 0;
  v_total_cost NUMERIC := 0;
  v_total_revenue NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_profit_pct NUMERIC := 0;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Buyer-side completed deals (what I paid for shares).
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(buyer_commission), 0)
  INTO v_total_buy_value, v_total_buyer_commissions
  FROM deals
  WHERE buyer_id = v_uid AND status = 'completed';

  -- Seller-side completed deals (what I received from sales).
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(seller_commission), 0)
  INTO v_total_sell_value, v_total_seller_commissions
  FROM deals
  WHERE seller_id = v_uid AND status = 'completed';

  -- Currently held shares: invested cost basis + market value.
  SELECT
    COALESCE(SUM(h.total_invested), 0),
    COALESCE(SUM(h.shares * COALESCE(p.current_market_price, p.share_price, 0)), 0),
    COALESCE(SUM(h.shares), 0)
  INTO v_total_invested, v_holdings_value, v_total_shares
  FROM holdings h
  JOIN projects p ON p.id = h.project_id
  WHERE h.user_id = v_uid;

  -- ── The headline numbers ────────────────────────────────────────
  -- Total cost includes buyer commissions (these are real outflows).
  v_total_cost := v_total_buy_value + v_total_buyer_commissions;

  -- Net revenue from sales = revenue − seller commissions paid.
  v_total_revenue := v_total_sell_value - v_total_seller_commissions;

  -- Net profit = revenue from sales + value of remaining holdings − cost.
  v_net_profit := v_total_revenue + v_holdings_value - v_total_cost;

  -- Percentage anchored on what the user actually paid.
  IF v_total_cost > 0 THEN
    v_profit_pct := (v_net_profit / v_total_cost) * 100;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'total_buy_value', v_total_buy_value,
    'total_sell_value', v_total_sell_value,
    'total_buyer_commissions', v_total_buyer_commissions,
    'total_seller_commissions', v_total_seller_commissions,
    'total_cost', v_total_cost,
    'total_revenue', v_total_revenue,
    'total_invested', v_total_invested,
    'holdings_value', v_holdings_value,
    'total_shares', v_total_shares,
    'net_profit', ROUND(v_net_profit),
    'profit_pct', ROUND(v_profit_pct::NUMERIC, 2)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_user_pnl_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_pnl_summary(UUID) TO authenticated;


DO $$ BEGIN
  RAISE NOTICE '✅ Phase 12.10: get_user_pnl_summary ready';
  RAISE NOTICE 'الصيغة:';
  RAISE NOTICE '  cost     = Σ (buy_value + buyer_commission)';
  RAISE NOTICE '  revenue  = Σ (sell_value − seller_commission)';
  RAISE NOTICE '  holdings = Σ shares × current_market_price';
  RAISE NOTICE '  profit   = revenue + holdings − cost';
  RAISE NOTICE '  pct      = profit / cost × 100';
END $$;
