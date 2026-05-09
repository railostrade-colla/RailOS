"use client"

/**
 * Admin-side deal-fees data layer (Phase 12.5).
 *
 * Reads the commission ledger from `deals` (buyer_commission +
 * seller_commission columns added by 20260509_phase12_deals_columns_safety.sql).
 * Each completed deal contributes ONE row; status maps to:
 *   • completed → collected
 *   • pending / payment_submitted / paid → pending
 *   • cancelled / rejected / expired → refunded
 *   • disputed → pending (until the dispute resolves)
 *
 * Reads are tolerant of partial schemas: if `buyer_commission` is
 * missing on the live DB, we synthesise the 2% commission from
 * total_amount so the panel still shows reasonable numbers instead
 * of zeros.
 */

import { createClient } from "@/lib/supabase/client"

export type DealFeeStatus = "collected" | "pending" | "refunded"

export interface DealFeeRow {
  id: string
  deal_id: string
  project_id: string
  project_name: string
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string
  shares: number
  /** Total deal value in IQD (informational — money is moved off-platform). */
  deal_total: number
  /** Effective commission rate as a percentage of deal_total. Currently 2%. */
  fee_percent: number
  /** Total fee units collected (buyer_commission + seller_commission). */
  fee_amount: number
  buyer_commission: number
  seller_commission: number
  status: DealFeeStatus
  created_at: string
  completed_at: string | null
}

const COMMISSION_RATE = 0.02

interface RawDeal {
  id: string
  project_id: string | null
  buyer_id: string | null
  seller_id: string | null
  // Phase 13.6 — actual column on `deals` is `shares` (BIGINT). The
  // earlier `shares_amount` here was a copy-paste from an older draft
  // of the table that never made it to production; the SELECT was
  // failing with 42703 silently and the panel was showing zeros.
  shares: number | string | null
  total_amount: number | string | null
  buyer_commission?: number | string | null
  seller_commission?: number | string | null
  status: string | null
  created_at: string | null
  completed_at?: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
}

interface ProjectRow {
  id: string
  name: string | null
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

function mapStatus(s: string | null): DealFeeStatus {
  if (!s) return "pending"
  if (s === "completed") return "collected"
  if (s === "cancelled" || s === "rejected" || s === "expired") return "refunded"
  return "pending" // pending / payment_submitted / paid / disputed
}

function displayName(p: ProfileRow | null | undefined, fallbackId: string | null): string {
  const name = p?.full_name?.trim() || p?.username?.trim()
  if (name) return name
  if (!fallbackId) return "—"
  return fallbackId.slice(0, 8) + "…"
}

/**
 * Fetch the deal-fees ledger for the admin panel. Pulls completed +
 * pending + refunded deals (everything that has a commission row). The
 * default limit is generous — admins typically scope via the panel
 * filters rather than pagination.
 */
export async function getDealFeesAdmin(limit = 500): Promise<DealFeeRow[]> {
  const supabase = createClient()

  // Step 1: pull deals. We try with the commission columns first; if
  // the columns are missing on this DB, fall back to a select that
  // omits them (we'll synthesise the fee from total_amount).
  let dealsRaw: RawDeal[] = []
  let hasCommissionColumns = true

  try {
    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, project_id, buyer_id, seller_id, shares, total_amount, buyer_commission, seller_commission, status, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      // 42703 = undefined column
      if (error.code === "42703" || /column .* does not exist/i.test(error.message)) {
        hasCommissionColumns = false
      } else {
        // eslint-disable-next-line no-console
        console.warn("[deal-fees-admin] read failed:", error.code, error.message)
        return []
      }
    } else {
      dealsRaw = (data as RawDeal[]) ?? []
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deal-fees-admin] threw on select:", err)
    return []
  }

  if (!hasCommissionColumns) {
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("id, project_id, buyer_id, seller_id, shares, total_amount, status, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[deal-fees-admin] fallback read failed:", error.code, error.message)
        return []
      }
      dealsRaw = (data as RawDeal[]) ?? []
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[deal-fees-admin] fallback threw:", err)
      return []
    }
  }

  if (dealsRaw.length === 0) return []

  // Step 2: collect unique user + project ids and batch-fetch their
  // display names. Tolerate any single lookup failing (returns empty
  // map → display fallback IDs).
  const userIds = new Set<string>()
  const projectIds = new Set<string>()
  for (const d of dealsRaw) {
    if (d.buyer_id) userIds.add(d.buyer_id)
    if (d.seller_id) userIds.add(d.seller_id)
    if (d.project_id) projectIds.add(d.project_id)
  }

  const profileMap = new Map<string, ProfileRow>()
  if (userIds.size > 0) {
    try {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", Array.from(userIds))
      for (const p of (profs ?? []) as ProfileRow[]) profileMap.set(p.id, p)
    } catch { /* leave empty */ }
  }

  const projectMap = new Map<string, ProjectRow>()
  if (projectIds.size > 0) {
    try {
      const { data: projs } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", Array.from(projectIds))
      for (const p of (projs ?? []) as ProjectRow[]) projectMap.set(p.id, p)
    } catch { /* leave empty */ }
  }

  // Step 3: shape rows for the panel.
  return dealsRaw.map((d): DealFeeRow => {
    const total = num(d.total_amount)
    let buyerCom = num(d.buyer_commission)
    let sellerCom = num(d.seller_commission)

    // Synthesise commissions for old / partial rows so the ledger is
    // always informative. The real values land in the columns once
    // place_deal_from_listing runs with the new schema.
    if (hasCommissionColumns === false || (buyerCom === 0 && sellerCom === 0 && total > 0)) {
      const synth = Math.floor(total * COMMISSION_RATE)
      buyerCom = synth
      sellerCom = synth
    }

    const feeAmount = buyerCom + sellerCom
    const buyer = d.buyer_id ? profileMap.get(d.buyer_id) ?? null : null
    const seller = d.seller_id ? profileMap.get(d.seller_id) ?? null : null
    const project = d.project_id ? projectMap.get(d.project_id) ?? null : null

    return {
      id: d.id,
      deal_id: d.id,
      project_id: d.project_id ?? "",
      project_name: project?.name?.trim() || "—",
      buyer_id: d.buyer_id ?? "",
      buyer_name: displayName(buyer, d.buyer_id),
      seller_id: d.seller_id ?? "",
      seller_name: displayName(seller, d.seller_id),
      shares: num(d.shares),
      deal_total: total,
      fee_percent: COMMISSION_RATE * 100,
      fee_amount: feeAmount,
      buyer_commission: buyerCom,
      seller_commission: sellerCom,
      status: mapStatus(d.status),
      created_at: d.created_at ?? "",
      completed_at: d.completed_at ?? null,
    }
  })
}

export interface DealFeeStats {
  total_deals: number
  total_collected: number
  total_pending: number
  total_refunded: number
}

export function computeDealFeeStats(rows: DealFeeRow[]): DealFeeStats {
  let collected = 0
  let pending = 0
  let refunded = 0
  for (const r of rows) {
    if (r.status === "collected") collected += r.fee_amount
    else if (r.status === "pending") pending += r.fee_amount
    else refunded += r.fee_amount
  }
  return {
    total_deals: rows.length,
    total_collected: collected,
    total_pending: pending,
    total_refunded: refunded,
  }
}

/**
 * Phase 13.6 — cheap aggregate for the dashboard KPI strip.
 * Returns the total commission units collected across every completed
 * deal. Failures (missing column / RLS / network) silently return 0.
 */
export async function getTotalCollectedFees(): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select("buyer_commission, seller_commission, total_amount")
      .eq("status", "completed")
    if (error || !data) return 0

    type CompletedDeal = {
      buyer_commission?: number | string | null
      seller_commission?: number | string | null
      total_amount?: number | string | null
    }
    return (data as CompletedDeal[]).reduce((sum, d) => {
      const buyer = num(d.buyer_commission)
      const seller = num(d.seller_commission)
      // Synthesise from total_amount @ 2% if commissions are zeroed
      // (legacy rows pre-Phase-12 column rollout).
      if (buyer === 0 && seller === 0) {
        const synth = Math.floor(num(d.total_amount) * COMMISSION_RATE)
        return sum + synth * 2
      }
      return sum + buyer + seller
    }, 0)
  } catch {
    return 0
  }
}
