import { createClient } from "@/lib/supabase/client"

export interface HoldingPerformance {
  holding_id: string
  project_id: string
  project_name: string
  project_sector: string
  shares: number
  frozen_shares: number
  buy_price: number
  live_price: number
  cost: number
  current_value: number
  profit: number
  profit_percent: number
}

export interface SectorBreakdown {
  sector: string
  value: number
  percent: number
}

export interface PortfolioAnalytics {
  success: boolean
  error?: string
  total_cost: number
  total_value: number
  total_profit: number
  total_profit_percent: number
  total_shares: number
  holdings_count: number
  projects_count: number
  sector_breakdown: SectorBreakdown[]
  performance: HoldingPerformance[]
  best_performer: HoldingPerformance | null
  worst_performer: HoldingPerformance | null
}

/** Resilient: returns null on error so callers can fall back to mock. */
export async function getMyPortfolioAnalytics(): Promise<PortfolioAnalytics | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_my_portfolio_analytics")
    if (error || !data) return null
    const result = data as PortfolioAnalytics
    if (!result.success) return null
    return result
  } catch {
    return null
  }
}

export interface CreateListingResult {
  success: boolean
  reason?: string
  error?: string
  listing_id?: string
  available?: number
}

export async function createListingDB(
  projectId: string,
  sharesOffered: number,
  pricePerShare: number,
  notes?: string,
  isQuickSell = false,
): Promise<CreateListingResult> {
  if (!projectId) return { success: false, reason: "missing_project" }
  if (!Number.isFinite(sharesOffered) || sharesOffered <= 0) {
    return { success: false, reason: "invalid_shares" }
  }
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
    return { success: false, reason: "invalid_price" }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("create_listing", {
      p_project_id: projectId,
      p_shares_offered: sharesOffered,
      p_price_per_share: pricePerShare,
      p_notes: notes ?? null,
      p_is_quick_sell: isQuickSell,
    })
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as CreateListingResult
    if (!result.success) {
      return {
        success: false,
        reason: result.reason ?? result.error ?? "unknown",
        available: result.available,
      }
    }
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
