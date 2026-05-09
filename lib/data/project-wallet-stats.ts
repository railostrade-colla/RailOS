"use client"

/**
 * Project wallet stats (Phase 12.11).
 *
 * Reads `project_wallets.offering` for a single project so the
 * project-detail page can display **live** numbers instead of the
 * static `projects.available_shares` snapshot:
 *
 *   • offering_total — original offering size
 *   • offering_available — what's still on the market today
 *   • offering_sold — what users actually bought (= total − available − reserved)
 *   • funded_amount = offering_sold × share_price (IQD)
 *   • remaining_amount = offering_available × share_price (IQD)
 *   • funding_pct = sold / total × 100
 */

import { createClient } from "@/lib/supabase/client"

export interface ProjectWalletStats {
  offering_total: number
  offering_available: number
  offering_sold: number
  offering_reserved: number
  /** sold × share_price */
  funded_amount: number
  /** available × share_price */
  remaining_amount: number
  /** sold / total × 100 */
  funding_pct: number
}

const ZERO_STATS: ProjectWalletStats = {
  offering_total: 0,
  offering_available: 0,
  offering_sold: 0,
  offering_reserved: 0,
  funded_amount: 0,
  remaining_amount: 0,
  funding_pct: 0,
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

export async function getProjectWalletStats(
  projectId: string,
  sharePrice: number,
): Promise<ProjectWalletStats> {
  if (!projectId) return ZERO_STATS
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("project_wallets")
      .select("total_shares, available_shares, sold_shares, reserved_shares")
      .eq("project_id", projectId)
      .eq("wallet_type", "offering")
      .maybeSingle()

    if (error || !data) {
      // eslint-disable-next-line no-console
      if (error) console.warn("[project-wallet-stats] read failed:", error.message)
      return ZERO_STATS
    }

    const total = num(data.total_shares)
    const available = num(data.available_shares)
    const sold = num(data.sold_shares)
    const reserved = num(data.reserved_shares)
    const fundingPct = total > 0 ? Math.min(100, (sold / total) * 100) : 0

    return {
      offering_total: total,
      offering_available: available,
      offering_sold: sold,
      offering_reserved: reserved,
      funded_amount: sold * Math.max(0, sharePrice),
      remaining_amount: available * Math.max(0, sharePrice),
      funding_pct: Math.round(fundingPct * 100) / 100,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[project-wallet-stats] threw:", err)
    return ZERO_STATS
  }
}
