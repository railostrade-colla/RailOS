"use client"

/**
 * portfolio-change-metrics — Phase 13.48.
 *
 * Wraps the `get_portfolio_change_metrics` RPC powering the
 * dashboard hero card's three-line indicator under the wallet
 * total: reference delta (IQD), daily %, and weekly %.
 *
 * The RPC reads the signed-in user's holdings + price_history
 * and returns weighted aggregates. "Today" anchors at the most
 * recent 06:00 UTC that has already passed; "week" is rolling 7d.
 */

import { createClient } from "@/lib/supabase/client"

export interface PortfolioChangeMetrics {
  reference_delta_iqd: number
  daily_change_iqd: number
  daily_change_pct: number
  weekly_change_iqd: number
  weekly_change_pct: number
  total_value: number
  reference_total: number
}

export const EMPTY_PORTFOLIO_CHANGE_METRICS: PortfolioChangeMetrics = {
  reference_delta_iqd: 0,
  daily_change_iqd: 0,
  daily_change_pct: 0,
  weekly_change_iqd: 0,
  weekly_change_pct: 0,
  total_value: 0,
  reference_total: 0,
}

export async function getPortfolioChangeMetrics(): Promise<PortfolioChangeMetrics> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_portfolio_change_metrics")
    if (error || data == null) return EMPTY_PORTFOLIO_CHANGE_METRICS
    type Raw = Partial<Record<keyof PortfolioChangeMetrics, number | string>>
    const r = data as Raw
    const num = (k: keyof PortfolioChangeMetrics, fallback = 0): number => {
      const v = r[k]
      return v === undefined || v === null ? fallback : Number(v)
    }
    return {
      reference_delta_iqd: num("reference_delta_iqd"),
      daily_change_iqd: num("daily_change_iqd"),
      daily_change_pct: num("daily_change_pct"),
      weekly_change_iqd: num("weekly_change_iqd"),
      weekly_change_pct: num("weekly_change_pct"),
      total_value: num("total_value"),
      reference_total: num("reference_total"),
    }
  } catch {
    return EMPTY_PORTFOLIO_CHANGE_METRICS
  }
}
