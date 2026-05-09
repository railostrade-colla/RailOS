"use client"

/**
 * Admin market-monitor data layer (Phase 12.9).
 *
 * Powers `/admin?tab=monitor` with real data from the deals + projects
 * tables. Everything is a single SELECT — no RPC dependency — so the
 * panel works on any DB even before the Phase 12 engine migrations.
 */

import { createClient } from "@/lib/supabase/client"

export interface MonitorOverview {
  total_volume_24h: number
  trades_24h: number
  avg_trade_size: number
  /** Pct change vs the previous 24h window. */
  change_pct: number
  top_movers: TopMoverRow[]
  recent_deals: RecentDealRow[]
}

export interface TopMoverRow {
  project_id: string
  project_name: string
  project_symbol: string | null
  current_price: number
  share_price: number
  change_pct: number
  volume_24h: number
  trades_count: number
}

export interface RecentDealRow {
  id: string
  project_id: string
  project_name: string
  shares: number
  price_per_share: number
  total_amount: number
  buyer_name: string
  seller_name: string
  status: string
  created_at: string
}

interface ProjectRef {
  id: string
  name: string | null
  symbol: string | null
  share_price: number | string | null
  current_market_price: number | string | null
}

interface ProfileRef {
  id: string
  full_name: string | null
  username: string | null
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

function nameOf(p: ProfileRef | null | undefined, fallbackId: string): string {
  if (!p) return fallbackId.slice(0, 8) + "…"
  return p.full_name?.trim() || p.username?.trim() || fallbackId.slice(0, 8) + "…"
}

const ZERO_OVERVIEW: MonitorOverview = {
  total_volume_24h: 0,
  trades_24h: 0,
  avg_trade_size: 0,
  change_pct: 0,
  top_movers: [],
  recent_deals: [],
}

/**
 * Pulls everything the monitor panel needs in 3 round-trips:
 *   1. completed deals in the last 48h (for 24h volume + previous-window change)
 *   2. projects metadata for the deal rows + change_pct calc
 *   3. profiles for buyer/seller names on recent deals
 */
export async function getMonitorOverview(
  scopeProjectId: string | null = null,
  recentLimit = 10,
): Promise<MonitorOverview> {
  try {
    const supabase = createClient()
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    let dealsQuery = supabase
      .from("deals")
      .select(
        "id, project_id, buyer_id, seller_id, shares, price_per_share, total_amount, status, created_at, completed_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })

    if (scopeProjectId) dealsQuery = dealsQuery.eq("project_id", scopeProjectId)

    const { data: dealsRaw, error } = await dealsQuery
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[admin-monitor] deals read failed:", error.message)
      return ZERO_OVERVIEW
    }
    const deals = (dealsRaw ?? []) as Array<{
      id: string
      project_id: string | null
      buyer_id: string | null
      seller_id: string | null
      shares: number | string | null
      price_per_share: number | string | null
      total_amount: number | string | null
      status: string | null
      created_at: string | null
      completed_at: string | null
    }>

    if (deals.length === 0) return ZERO_OVERVIEW

    // Window split: 24h ago and 48h ago.
    const now = Date.now()
    const cutoff24h = now - 24 * 60 * 60 * 1000
    const last24h: typeof deals = []
    const prev24h: typeof deals = []
    for (const d of deals) {
      const ts = d.created_at ? new Date(d.created_at).getTime() : 0
      if (ts >= cutoff24h) last24h.push(d)
      else prev24h.push(d)
    }

    const completedLast = last24h.filter((d) => d.status === "completed")
    const completedPrev = prev24h.filter((d) => d.status === "completed")

    const totalVol24h = completedLast.reduce((s, d) => s + num(d.total_amount), 0)
    const totalVolPrev = completedPrev.reduce((s, d) => s + num(d.total_amount), 0)
    const changePct =
      totalVolPrev > 0
        ? ((totalVol24h - totalVolPrev) / totalVolPrev) * 100
        : 0

    // Aggregate by project for top-movers.
    const moverMap = new Map<string, {
      volume: number
      trades: number
    }>()
    for (const d of completedLast) {
      const pid = d.project_id ?? ""
      if (!pid) continue
      const m = moverMap.get(pid) ?? { volume: 0, trades: 0 }
      m.volume += num(d.total_amount)
      m.trades += 1
      moverMap.set(pid, m)
    }

    // Resolve project metadata (top movers + recent deals).
    const projectIds = Array.from(
      new Set([
        ...moverMap.keys(),
        ...deals.slice(0, recentLimit).map((d) => d.project_id ?? ""),
      ]),
    ).filter(Boolean)

    const projectMap = new Map<string, ProjectRef>()
    if (projectIds.length > 0) {
      try {
        const { data: projs } = await supabase
          .from("projects")
          .select("id, name, symbol, share_price, current_market_price")
          .in("id", projectIds)
        for (const p of (projs ?? []) as ProjectRef[]) {
          projectMap.set(p.id, p)
        }
      } catch { /* ignore */ }
    }

    // Resolve profiles for recent deals.
    const userIds = Array.from(
      new Set(
        deals
          .slice(0, recentLimit)
          .flatMap((d) => [d.buyer_id, d.seller_id])
          .filter((x): x is string => Boolean(x)),
      ),
    )
    const profileMap = new Map<string, ProfileRef>()
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds)
        for (const p of (profs ?? []) as ProfileRef[]) {
          profileMap.set(p.id, p)
        }
      } catch { /* ignore */ }
    }

    // Build top-movers.
    const top_movers: TopMoverRow[] = Array.from(moverMap.entries())
      .map(([pid, agg]) => {
        const proj = projectMap.get(pid)
        const sharePrice = num(proj?.share_price)
        const marketPrice = num(proj?.current_market_price) || sharePrice
        const pct = sharePrice > 0
          ? ((marketPrice - sharePrice) / sharePrice) * 100
          : 0
        return {
          project_id: pid,
          project_name: proj?.name?.trim() || "—",
          project_symbol: proj?.symbol?.trim() ?? null,
          current_price: marketPrice,
          share_price: sharePrice,
          change_pct: pct,
          volume_24h: agg.volume,
          trades_count: agg.trades,
        }
      })
      .sort((a, b) => b.volume_24h - a.volume_24h)
      .slice(0, 5)

    // Build recent deals.
    const recent_deals: RecentDealRow[] = deals
      .slice(0, recentLimit)
      .map((d) => {
        const proj = d.project_id ? projectMap.get(d.project_id) : null
        const buyer = d.buyer_id ? profileMap.get(d.buyer_id) : null
        const seller = d.seller_id ? profileMap.get(d.seller_id) : null
        return {
          id: d.id,
          project_id: d.project_id ?? "",
          project_name: proj?.name?.trim() || "—",
          shares: num(d.shares),
          price_per_share: num(d.price_per_share),
          total_amount: num(d.total_amount),
          buyer_name: nameOf(buyer, d.buyer_id ?? ""),
          seller_name: nameOf(seller, d.seller_id ?? ""),
          status: d.status ?? "—",
          created_at: d.created_at ?? "",
        }
      })

    return {
      total_volume_24h: totalVol24h,
      trades_24h: completedLast.length,
      avg_trade_size:
        completedLast.length > 0
          ? Math.round(totalVol24h / completedLast.length)
          : 0,
      change_pct: changePct,
      top_movers,
      recent_deals,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-monitor] threw:", err)
    return ZERO_OVERVIEW
  }
}

// ─── Market health summary ────────────────────────────────────────

export interface MarketHealthSummary {
  health_score: number     // 0..100
  health_level: "healthy" | "watch" | "critical"
  current_deals: number
  required_deals: number
  liquidity: "high" | "medium" | "low"
  turnover_rate: number    // percentage
  volatility_pct: number   // percentage
}

export function computeHealth(
  overview: MonitorOverview,
  totalProjects: number,
): MarketHealthSummary {
  // Required deals threshold: 1 deal per project per 24h (rough proxy).
  const required = Math.max(1, totalProjects)
  const deals = overview.trades_24h
  const ratio = required > 0 ? deals / required : 0

  // Health score: weighted blend of activity + change variance.
  const activityScore = Math.min(100, Math.round(ratio * 100))
  const change = Math.abs(overview.change_pct)
  const changePenalty = change > 50 ? 20 : change > 25 ? 10 : 0
  const score = Math.max(0, activityScore - changePenalty)

  const level: MarketHealthSummary["health_level"] =
    score >= 70 ? "healthy" : score >= 40 ? "watch" : "critical"

  const liquidity: MarketHealthSummary["liquidity"] =
    deals >= required * 2 ? "high" : deals >= required ? "medium" : "low"

  // Turnover: trades / projects * 10 (so 1 trade per project = 10%).
  const turnover = required > 0 ? Math.round((deals / required) * 10) : 0

  return {
    health_score: score,
    health_level: level,
    current_deals: deals,
    required_deals: required,
    liquidity,
    turnover_rate: turnover,
    volatility_pct: change,
  }
}
