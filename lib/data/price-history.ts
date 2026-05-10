"use client"

/**
 * price-history — surfaces the orphan `price_history` table.
 * Powers the project price chart + admin historical view.
 *
 * Phase 13.19 — `getProjectPriceTimeline()` builds a richer chart
 * timeline by merging four sources:
 *   1. Project creation anchor at the original offering price.
 *   2. Each completed deal (price = total_amount / shares).
 *   3. Admin-set price changes from price_history.
 *   4. "Now" anchor at the current market price.
 *
 * That guarantees the chart has at least 2 points for any active
 * project, so the "لا يوجد سجل" empty state is reached only when
 * the project itself doesn't exist (or RLS blocks the read).
 */

import { createClient } from "@/lib/supabase/client"

export interface PriceHistoryPoint {
  id: string
  project_id: string
  old_price: number
  new_price: number
  change_pct: number
  recorded_at: string
  phase: string
  trigger: string | null
}

export async function getPriceHistory(
  projectId: string,
  limit: number = 100,
): Promise<PriceHistoryPoint[]> {
  if (!projectId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_price_history", {
      p_project_id: projectId,
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return []
    return (data as PriceHistoryPoint[]).map((p) => ({
      ...p,
      old_price: Number(p.old_price ?? 0),
      new_price: Number(p.new_price ?? 0),
      change_pct: Number(p.change_pct ?? 0),
    }))
  } catch {
    return []
  }
}

/**
 * Phase 13.19 — full project price timeline for the /investment chart.
 *
 * Merges price_history (admin-set changes), deals (organic market
 * prices), the project creation anchor (original offering price),
 * and the "now" anchor (current market price) into a single sorted
 * ascending list of PriceHistoryPoint-shaped rows.
 *
 * Returns an empty array only when:
 *   • the project doesn't exist
 *   • or RLS blocks every read for the caller
 *
 * Otherwise returns at least 2 points (creation + now) so the chart
 * always has something to draw, even for projects that have never
 * had a price change OR a completed deal.
 */
export async function getProjectPriceTimeline(
  projectId: string,
  limit: number = 200,
): Promise<PriceHistoryPoint[]> {
  if (!projectId) return []
  const supabase = createClient()

  // ── 1. project metadata for the anchor points ─────────────────
  // Phase 13.20 — projects.share_price is MUTABLE: admin price-rises
  // and dynamic-pricing triggers update it over time, so it doesn't
  // represent the original offering price. We need a stable
  // "original" price for the creation anchor. Strategy:
  //   1. Derive from total_value / total_shares (the founder spec is
  //      that total_value is set once at creation, so the ratio
  //      gives the original per-share price).
  //   2. Fallback: first price_history.old_price (when an admin has
  //      ever changed the price, the very first old_price IS the
  //      original).
  //   3. Last-ditch: current share_price (chart will be flat but at
  //      least it renders).
  let createdAt: string | null = null
  let originalPrice = 0
  let currentPrice = 0
  let totalShares = 0
  let totalValue = 0
  try {
    const { data } = await supabase
      .from("projects")
      .select("created_at, share_price, current_market_price, total_shares, total_value")
      .eq("id", projectId)
      .maybeSingle()
    if (data) {
      const row = data as {
        created_at?: string | null
        share_price?: number | string | null
        current_market_price?: number | string | null
        total_shares?: number | string | null
        total_value?: number | string | null
      }
      createdAt = row.created_at ?? null
      const sharePrice = Number(row.share_price ?? 0)
      currentPrice = Number(row.current_market_price ?? sharePrice)
      totalShares = Number(row.total_shares ?? 0)
      totalValue = Number(row.total_value ?? 0)

      // Derive original price from total_value / total_shares.
      // Both are set at creation; total_value is generated/immutable
      // for the offering math, so the ratio is reliable.
      if (totalShares > 0 && totalValue > 0) {
        const derived = Math.round(totalValue / totalShares)
        if (derived > 0) originalPrice = derived
      }
      // If still unset, fall back to current share price (the chart
      // will still render, just flat).
      if (!originalPrice) originalPrice = sharePrice
    }
  } catch { /* best-effort */ }

  // If the project itself can't be read, return empty so the chart
  // shows the "doesn't exist" empty state (a project must exist for
  // a chart to be meaningful).
  if (!createdAt) return []

  // ── 2. price_history (admin-set changes) ──────────────────────
  const history = await getPriceHistory(projectId, limit)

  // Phase 13.20 — second-chance derivation of the original price:
  // if total_value/total_shares was not set up correctly but
  // price_history has at least one row, the very first old_price
  // is the original offering price (the price BEFORE the first
  // change). This catches projects that pre-date the immutable
  // total_value contract.
  if (history.length > 0) {
    const firstOldPrice = history
      .slice()
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime(),
      )[0]?.old_price ?? 0
    if (firstOldPrice > 0 && (originalPrice === 0 || originalPrice === currentPrice)) {
      originalPrice = firstOldPrice
    }
  }

  // ── 3. completed deals — each one is a real-market data point ─
  type DealRow = {
    id: string
    total_amount: number | string | null
    shares: number | string | null
    completed_at: string | null
    created_at: string | null
  }
  let deals: DealRow[] = []
  try {
    const { data } = await supabase
      .from("deals")
      .select("id, total_amount, shares, completed_at, created_at")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .limit(limit)
    deals = (data as DealRow[]) ?? []
  } catch { /* best-effort */ }

  // ── 4. merge ──────────────────────────────────────────────────
  const points: PriceHistoryPoint[] = []

  // Anchor: project creation at the original offering price
  // (derived above from total_value/total_shares, with fallbacks).
  points.push({
    id: `anchor-create-${projectId}`,
    project_id: projectId,
    old_price: originalPrice,
    new_price: originalPrice,
    change_pct: 0,
    recorded_at: createdAt,
    phase: "offering",
    trigger: "creation",
  })

  // Deals → derive per-share price
  for (const d of deals) {
    const shares = Number(d.shares ?? 0)
    const total = Number(d.total_amount ?? 0)
    if (shares <= 0 || total <= 0) continue
    const price = total / shares
    const ts = d.completed_at ?? d.created_at
    if (!ts) continue
    points.push({
      id: `deal-${d.id}`,
      project_id: projectId,
      old_price: price,
      new_price: price,
      change_pct: 0,
      recorded_at: ts,
      phase: "trading",
      trigger: "deal_completed",
    })
  }

  // Admin price changes
  for (const h of history) {
    points.push(h)
  }

  // Anchor: "now" at the current market price
  if (currentPrice > 0) {
    points.push({
      id: `anchor-now-${projectId}`,
      project_id: projectId,
      old_price: currentPrice,
      new_price: currentPrice,
      change_pct: 0,
      recorded_at: new Date().toISOString(),
      phase: "live",
      trigger: "snapshot",
    })
  }

  // Sort ascending by recorded_at
  points.sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  )

  return points
}
