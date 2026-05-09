"use client"

/**
 * Accurate user P&L summary (Phase 12.10).
 *
 * Reads the user's full deals history (both as buyer and seller) plus
 * current holdings, and returns commission-adjusted profit numbers
 * suitable for the portfolio "نسبة الربح" badge.
 *
 * Formula (server-side, see migration):
 *   cost     = Σ (buy_value + buyer_commission)
 *   revenue  = Σ (sell_value − seller_commission)
 *   holdings = Σ shares × current_market_price
 *   profit   = revenue + holdings − cost
 *   pct      = profit / cost × 100
 */

import { createClient } from "@/lib/supabase/client"

export interface UserPnLSummary {
  total_buy_value: number
  total_sell_value: number
  total_buyer_commissions: number
  total_seller_commissions: number
  /** What the user actually paid out (buys + buyer commissions). */
  total_cost: number
  /** What the user actually received from sales (after seller commissions). */
  total_revenue: number
  /** Σ holdings.total_invested — legacy figure, may double-count after sells. */
  total_invested: number
  /** Σ shares × current_market_price on currently held shares. */
  holdings_value: number
  total_shares: number
  /** revenue + holdings_value − cost. Can be negative. */
  net_profit: number
  /** profit / cost × 100, rounded to 2 decimals. */
  profit_pct: number
}

const ZERO_PNL: UserPnLSummary = {
  total_buy_value: 0,
  total_sell_value: 0,
  total_buyer_commissions: 0,
  total_seller_commissions: 0,
  total_cost: 0,
  total_revenue: 0,
  total_invested: 0,
  holdings_value: 0,
  total_shares: 0,
  net_profit: 0,
  profit_pct: 0,
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

export async function getUserPnLSummary(): Promise<UserPnLSummary> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_user_pnl_summary")
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[user-pnl] read failed:", error.message)
      return ZERO_PNL
    }
    if (!data) return ZERO_PNL
    const r = data as Record<string, unknown> & { success?: boolean }
    if (!r.success) return ZERO_PNL
    return {
      total_buy_value: num(r.total_buy_value),
      total_sell_value: num(r.total_sell_value),
      total_buyer_commissions: num(r.total_buyer_commissions),
      total_seller_commissions: num(r.total_seller_commissions),
      total_cost: num(r.total_cost),
      total_revenue: num(r.total_revenue),
      total_invested: num(r.total_invested),
      holdings_value: num(r.holdings_value),
      total_shares: Math.floor(num(r.total_shares)),
      net_profit: num(r.net_profit),
      profit_pct: num(r.profit_pct),
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[user-pnl] threw:", err)
    return ZERO_PNL
  }
}
