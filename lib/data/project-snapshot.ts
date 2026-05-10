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
 * Fetch a single project's live snapshot.
 *
 * Phase 13.31 — dual-path resolution. The RPC is the canonical
 * source (single round-trip, server-side aggregation), but if it
 * fails OR isn't deployed yet on this DB, we fall back to a
 * stitched-together snapshot built from public reads:
 *   • projects.* (RLS lets users read active projects)
 *   • get_public_investor_counts RPC (Phase 13.12)
 *   • dividends sum (best-effort, table may not exist)
 *
 * Owner_shares is derived in the fallback via offering_percentage,
 * which works for new projects but degrades gracefully for legacy
 * rows by falling back to the share_price field.
 */
export async function getProjectLiveSnapshot(
  projectId: string,
): Promise<ProjectLiveSnapshot | null> {
  if (!projectId) return null
  const supabase = createClient()

  // ─── 1. Try the RPC (authoritative) ─────────────────────────
  try {
    const { data, error } = await supabase.rpc("get_project_live_snapshot", {
      p_project_id: projectId,
    })
    if (!error && Array.isArray(data) && data.length > 0) {
      return rowToSnapshot(data[0] as RawSnapshotRow)
    }
  } catch {
    /* fall through */
  }

  // ─── 2. Fallback: stitch the snapshot from public reads ──────
  return await buildFallbackSnapshot(supabase, projectId)
}

async function buildFallbackSnapshot(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<ProjectLiveSnapshot | null> {
  try {
    // Project row — every column the snapshot type needs.
    // Use `select("*")` to avoid PostgREST's GenericStringError union
    // when listing many columns inline; the response is a plain object
    // we cast directly.
    const { data: pRaw, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle()

    if (pErr || !pRaw) return null
    const p = pRaw as unknown as Record<string, unknown>
    // Local helper to coerce unknown column values into numbers.
    const N = (v: unknown): number => {
      if (v == null) return 0
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0
      return Number.isFinite(n) ? n : 0
    }

    // Investor count via public RPC (Phase 13.12 — always available
    // on production, exposes only counts).
    let investorCount = 0
    try {
      const { data: ic } = await supabase.rpc("get_public_investor_counts", {
        p_project_ids: [projectId],
      })
      if (Array.isArray(ic) && ic.length > 0) {
        const row = ic[0] as { investor_count?: number | string }
        investorCount = num(row.investor_count)
      }
    } catch { /* keep 0 */ }

    // Dividends total — best-effort; table may not exist.
    let dividendsTotal = -1
    try {
      const { data: divs, error: divErr } = await supabase
        .from("dividends")
        .select("amount")
        .eq("project_id", projectId)
      if (!divErr && Array.isArray(divs)) {
        type DivRow = { amount?: number | string | null }
        dividendsTotal = (divs as DivRow[]).reduce(
          (s, r) => s + num(r.amount),
          0,
        )
      }
    } catch { /* -1 */ }

    // Derive ratios. offering_total = total_shares × offering_pct/100
    // (or full total_shares if no offering_pct set, treating the
    // whole project as offered). offering_available comes off the
    // projects column when wallets aren't readable.
    const totalShares = N(p.total_shares)
    const offeringPct = N(p.offering_percentage)
    const offeringTotal = offeringPct > 0
      ? Math.round(totalShares * offeringPct / 100)
      : totalShares
    // available_shares on projects mirrors the wallet's available;
    // when missing, treat as fully unsold (offeringTotal).
    const availableRaw = p.available_shares
    const offeringAvailable = availableRaw == null ? offeringTotal : N(availableRaw)
    const offeringSold = Math.max(0, offeringTotal - offeringAvailable)
    const fundingPct = offeringTotal > 0
      ? Math.round((offeringSold / offeringTotal) * 100 * 100) / 100
      : 0

    const ownerShares = Math.max(0, totalShares - offeringTotal)
    const sharePrice = N(p.share_price)
    const currentPrice = p.current_market_price == null ? sharePrice : N(p.current_market_price)
    const totalValue = N(p.total_value)
    const originalPrice = totalShares > 0 && totalValue > 0
      ? Math.round(totalValue / totalShares)
      : sharePrice

    const tag = p.discover_tag as string | null

    return {
      // Form fields
      id: String(p.id),
      name: String(p.name ?? ""),
      short_description: (p.short_description as string | null) ?? null,
      description: (p.description as string | null) ?? null,
      project_type: (p.project_type as string | null) ?? null,
      symbol: (p.symbol as string | null) ?? null,
      logo_url: (p.logo_url as string | null) ?? null,
      cover_url: (p.cover_url as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      risk_level: (p.risk_level as string | null) ?? null,
      distribution_type: (p.distribution_type as string | null) ?? null,
      expected_return_min: N(p.expected_return_min),
      expected_return_max: N(p.expected_return_max),
      duration_open: (p.duration_open as boolean | null) ?? null,
      duration_months: (p.duration_months as number | null) ?? null,
      offering_start_date: (p.offering_start_date as string | null) ?? null,
      offering_end_date: (p.offering_end_date as string | null) ?? null,
      created_at: String(p.created_at ?? new Date().toISOString()),

      // Dynamic ratios
      total_shares: totalShares,
      offering_total: offeringTotal,
      offering_available: offeringAvailable,
      owner_shares: ownerShares,
      offering_sold: offeringSold,
      funding_pct: fundingPct,

      // Market
      original_price: originalPrice,
      share_price: sharePrice,
      current_market_price: currentPrice,
      total_value: totalValue,
      investor_count: investorCount,
      dividends_total: dividendsTotal,

      // Suspension
      trading_suspended: !!p.trading_suspended,
      trading_suspension_reason: (p.trading_suspension_reason as string | null) ?? null,
      offering_suspended: !!p.offering_suspended,
      offering_suspension_reason: (p.offering_suspension_reason as string | null) ?? null,
      discover_tag:
        tag === "trending" || tag === "coming_soon" || tag === "new"
          ? tag
          : null,
    }
  } catch {
    return null
  }
}
