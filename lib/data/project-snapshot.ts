"use client"

/**
 * project-snapshot — Phase 13.22.
 *
 * Single source of truth for live project values. Wraps the
 * `get_project_live_snapshot(p_project_id)` RPC, returning a clean
 * typed object with three logical buckets:
 *
 *   1. Form fields  — what the founder typed in the create-project
 *                     form (mutable via admin edit).
 *   2. Dynamic ratios — recomputed every call from project_wallets.
 *                     Owner equity is DERIVED, not stored.
 *   3. Market state — current price, investor count, dividends.
 *
 * Use this wherever a screen needs "the truth" about a project:
 *   • Investment page hero
 *   • Discover cards (when richer data is needed)
 *   • Project detail page
 *   • Portfolio holdings (price column)
 *
 * Failures (RLS / network / missing RPC) return null so callers
 * can fall back to whatever stale data they already have.
 */

import { createClient } from "@/lib/supabase/client"

export interface ProjectLiveSnapshot {
  // ─── 1. Form fields ───────────────────────────────────
  id: string
  name: string
  short_description: string | null
  description: string | null
  project_type: string | null
  symbol: string | null
  logo_url: string | null
  cover_url: string | null
  status: string | null
  risk_level: string | null
  distribution_type: string | null
  expected_return_min: number
  expected_return_max: number
  duration_open: boolean | null
  duration_months: number | null
  offering_start_date: string | null
  offering_end_date: string | null
  created_at: string

  // ─── 2. Dynamic ratios ───────────────────────────────
  total_shares: number
  offering_total: number
  offering_available: number
  owner_shares: number
  offering_sold: number
  /** 0–100, computed as offering_sold / offering_total × 100 */
  funding_pct: number

  // ─── 3. Market state ─────────────────────────────────
  original_price: number
  share_price: number
  current_market_price: number
  total_value: number
  investor_count: number
  /** -1 means "dividends table missing"; otherwise a non-negative IQD total. */
  dividends_total: number

  // ─── Suspension state ────────────────────────────────
  trading_suspended: boolean
  trading_suspension_reason: string | null
  offering_suspended: boolean
  offering_suspension_reason: string | null
  discover_tag: "trending" | "coming_soon" | "new" | null
}

interface RawSnapshotRow {
  id: string
  name: string
  short_description: string | null
  description: string | null
  project_type: string | null
  symbol: string | null
  logo_url: string | null
  cover_url: string | null
  status: string | null
  risk_level: string | null
  distribution_type: string | null
  expected_return_min: number | string | null
  expected_return_max: number | string | null
  duration_open: boolean | null
  duration_months: number | null
  offering_start_date: string | null
  offering_end_date: string | null
  created_at: string
  total_shares: number | string
  offering_total: number | string
  offering_available: number | string
  owner_shares: number | string
  offering_sold: number | string
  funding_pct: number | string
  original_price: number | string
  share_price: number | string
  current_market_price: number | string
  total_value: number | string
  investor_count: number | string
  dividends_total: number | string
  trading_suspended: boolean | null
  trading_suspension_reason: string | null
  offering_suspended: boolean | null
  offering_suspension_reason: string | null
  discover_tag: string | null
}

const num = (v: number | string | null | undefined): number => {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

function rowToSnapshot(r: RawSnapshotRow): ProjectLiveSnapshot {
  const tag = r.discover_tag
  return {
    // Form fields
    id: r.id,
    name: r.name,
    short_description: r.short_description,
    description: r.description,
    project_type: r.project_type,
    symbol: r.symbol,
    logo_url: r.logo_url,
    cover_url: r.cover_url,
    status: r.status,
    risk_level: r.risk_level,
    distribution_type: r.distribution_type,
    expected_return_min: num(r.expected_return_min),
    expected_return_max: num(r.expected_return_max),
    duration_open: r.duration_open,
    duration_months: r.duration_months,
    offering_start_date: r.offering_start_date,
    offering_end_date: r.offering_end_date,
    created_at: r.created_at,

    // Dynamic ratios
    total_shares: num(r.total_shares),
    offering_total: num(r.offering_total),
    offering_available: num(r.offering_available),
    owner_shares: num(r.owner_shares),
    offering_sold: num(r.offering_sold),
    funding_pct: num(r.funding_pct),

    // Market state
    original_price: num(r.original_price),
    share_price: num(r.share_price),
    current_market_price: num(r.current_market_price),
    total_value: num(r.total_value),
    investor_count: num(r.investor_count),
    dividends_total: num(r.dividends_total),

    // Suspension
    trading_suspended: !!r.trading_suspended,
    trading_suspension_reason: r.trading_suspension_reason,
    offering_suspended: !!r.offering_suspended,
    offering_suspension_reason: r.offering_suspension_reason,
    discover_tag:
      tag === "trending" || tag === "coming_soon" || tag === "new"
        ? tag
        : null,
  }
}

/**
 * Fetch a single project's live snapshot. Uses the RPC for
 * authoritative numbers; returns null on any failure so callers
 * can fall back to local/cached data.
 */
export async function getProjectLiveSnapshot(
  projectId: string,
): Promise<ProjectLiveSnapshot | null> {
  if (!projectId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_project_live_snapshot", {
      p_project_id: projectId,
    })
    if (error || !Array.isArray(data) || data.length === 0) return null
    return rowToSnapshot(data[0] as RawSnapshotRow)
  } catch {
    return null
  }
}
