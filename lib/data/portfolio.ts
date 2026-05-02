"use client"

/**
 * Real portfolio data layer for /portfolio page.
 *
 * Composes (in parallel, each with its own try/catch):
 *   • profiles.level (optional)              → user level
 *   • holdings + projects (JOIN)             → holdings list
 *   • fee_unit_balances OR profiles fallback → fee balance
 *   • fee_unit_requests                      → recharge requests
 *   • fee_unit_transactions                  → fee ledger
 *
 * UI compatibility shim:
 *   The legacy mock shape used `shares_owned` / `buy_price` / `current_value`
 *   on each holding. The DB stores `shares` / `average_buy_price` / total_invested.
 *   We expose BOTH names on every PortfolioHolding so the page can render
 *   without further refactoring its internals.
 *
 * Phase 4.2 — Portfolio data only. The history-tab list now comes from
 * fee_unit_transactions (per the agreed plan); shares-movement history
 * (deal_buy / deal_sell / shares_*) will be wired in Phase 4.4 (/deals).
 *
 * USED_THIS_MONTH and the user contracts list are intentionally NOT
 * resolved here — the page still hardcodes them for this phase.
 */

import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ─────────────────────────────────────────────────────

export interface PortfolioHoldingProject {
  id: string
  name: string
  sector: string
  share_price: number
  current_market_price: number | null
  total_shares: number
  available_shares: number
}

export interface PortfolioHolding {
  id: string
  project_id: string
  user_id: string
  shares: number
  /** Alias of `shares` — kept for UI shape compatibility. */
  shares_owned: number
  frozen_shares: number
  average_buy_price: number
  /** Alias of `average_buy_price` — kept for UI shape compatibility. */
  buy_price: number
  total_invested: number
  /** Computed: `shares × (current_market_price ?? share_price)`. */
  current_value: number
  project: PortfolioHoldingProject
}

export interface PortfolioSummary {
  holdingsCount: number
  totalShares: number
  totalValue: number
  totalInvested: number
  /** Alias of `totalInvested`. */
  totalCost: number
  totalProfit: number
  /** Alias of `totalProfit`. */
  netProfit: number
  profitPct: number
  isUp: boolean
  bestPerformerPct: number
  bestPerformerHolding: PortfolioHolding | null
  sectorsCount: number
}

export interface FeeBalance {
  balance: number
  reserved_balance: number
  total_deposited: number
  total_withdrawn: number
  total_bonus_received: number
}

export type FeeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"

export interface FeeRequest {
  id: string
  amount_requested: number
  amount_approved: number | null
  payment_method: string
  status: FeeRequestStatus
  notes: string | null
  rejection_reason: string | null
  reviewed_at: string | null
  submitted_at: string
  created_at: string
}

export interface FeeTransactionEntry {
  id: string
  amount: number
  /** Raw transaction_type enum: deposit | withdrawal | subscription | bonus | refund | adjustment. */
  type: string
  /** UI-compat alias of `type`. */
  op_type: string
  /** UI-compat alias of `type` (used by the fee-units ledger). */
  reason: string
  /** UI-compat field — uses `description` from DB when present. */
  project_name: string
  created_at: string
}

export interface PortfolioData {
  /** Raw level from profiles.level (e.g. 'basic' | 'advanced' | 'pro' | 'elite'). */
  level: string
  holdings: PortfolioHolding[]
  summary: PortfolioSummary
  feeBalance: FeeBalance
  feeRequests: FeeRequest[]
  feeTransactions: FeeTransactionEntry[]
}

// ─── Empty defaults ─────────────────────────────────────────────

const EMPTY_SUMMARY: PortfolioSummary = {
  holdingsCount: 0,
  totalShares: 0,
  totalValue: 0,
  totalInvested: 0,
  totalCost: 0,
  totalProfit: 0,
  netProfit: 0,
  profitPct: 0,
  isUp: true,
  bestPerformerPct: 0,
  bestPerformerHolding: null,
  sectorsCount: 0,
}

const EMPTY_FEE_BALANCE: FeeBalance = {
  balance: 0,
  reserved_balance: 0,
  total_deposited: 0,
  total_withdrawn: 0,
  total_bonus_received: 0,
}

// ─── Internal types for DB rows ─────────────────────────────────

interface HoldingRow {
  id: string
  project_id: string
  user_id: string
  shares?: number | null
  frozen_shares?: number | null
  average_buy_price?: number | null
  total_invested?: number | null
  project?: HoldingProjectRow | HoldingProjectRow[] | null
}

interface HoldingProjectRow {
  id?: string
  name?: string | null
  sector?: string | null
  share_price?: number | null
  current_market_price?: number | null
  total_shares?: number | null
  available_shares?: number | null
}

interface FeeBalanceRow {
  balance?: number | null
  reserved_balance?: number | null
  total_deposited?: number | null
  total_withdrawn?: number | null
  total_bonus_received?: number | null
}

interface FeeUnitsBalanceFallbackRow {
  fee_units_balance?: number | null
}

interface FeeRequestRow {
  id: string
  amount_requested: number
  amount_approved: number | null
  payment_method: string
  status: FeeRequestStatus
  notes: string | null
  rejection_reason: string | null
  reviewed_at: string | null
  submitted_at: string
  created_at: string
}

interface FeeTransactionRow {
  id: string
  amount?: number | null
  type?: string | null
  description?: string | null
  created_at: string
}

interface ProfileLevelRow {
  level?: string | null
}

// ─── Helpers ────────────────────────────────────────────────────

function n(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function unwrapJoined<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ─── Fetchers (each isolated by try/catch — never throws to caller) ───

async function fetchUserLevel(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("level")
      .eq("id", userId)
      .maybeSingle()
    if (error) return "basic"
    const row = data as ProfileLevelRow | null
    return typeof row?.level === "string" ? row.level : "basic"
  } catch {
    return "basic"
  }
}

async function fetchHoldings(
  supabase: SupabaseClient,
  userId: string,
): Promise<PortfolioHolding[]> {
  try {
    const { data, error } = await supabase
      .from("holdings")
      .select(
        `
        id, project_id, user_id, shares, frozen_shares,
        average_buy_price, total_invested,
        project:projects(
          id, name, sector, share_price, current_market_price,
          total_shares, available_shares
        )
      `,
      )
      .eq("user_id", userId)
      .order("last_acquired_at", { ascending: false })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[portfolio] holdings query error:", error.message)
      return []
    }
    if (!data) return []

    const out: PortfolioHolding[] = []
    for (const row of data as HoldingRow[]) {
      const project = unwrapJoined(row.project)
      // Skip orphaned holdings (project deleted) — render-safe.
      if (!project || !project.id) continue

      const shares = n(row.shares)
      const sharePrice = n(project.share_price)
      const marketPrice = project.current_market_price != null
        ? n(project.current_market_price)
        : sharePrice
      const currentValue = shares * marketPrice

      out.push({
        id: row.id,
        project_id: row.project_id,
        user_id: row.user_id,
        shares,
        shares_owned: shares,
        frozen_shares: n(row.frozen_shares),
        average_buy_price: n(row.average_buy_price),
        buy_price: n(row.average_buy_price),
        total_invested: n(row.total_invested),
        current_value: currentValue,
        project: {
          id: project.id,
          name: project.name ?? "",
          sector: project.sector ?? "",
          share_price: sharePrice,
          current_market_price:
            project.current_market_price != null
              ? n(project.current_market_price)
              : null,
          total_shares: n(project.total_shares),
          available_shares: n(project.available_shares),
        },
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[portfolio] holdings query threw:", err)
    return []
  }
}

function computeSummary(holdings: PortfolioHolding[]): PortfolioSummary {
  if (holdings.length === 0) return EMPTY_SUMMARY

  let totalShares = 0
  let totalValue = 0
  let totalInvested = 0
  let bestPct = -Infinity
  let bestHolding: PortfolioHolding | null = null
  const sectors = new Set<string>()

  for (const h of holdings) {
    totalShares += h.shares
    totalValue += h.current_value
    totalInvested += h.total_invested
    if (h.project.sector) sectors.add(h.project.sector)

    if (h.total_invested > 0) {
      const pct =
        ((h.current_value - h.total_invested) / h.total_invested) * 100
      if (pct > bestPct) {
        bestPct = pct
        bestHolding = h
      }
    }
  }

  const totalProfit = totalValue - totalInvested
  const profitPct =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

  return {
    holdingsCount: holdings.length,
    totalShares,
    totalValue,
    totalInvested,
    totalCost: totalInvested,
    totalProfit,
    netProfit: totalProfit,
    profitPct,
    isUp: totalProfit >= 0,
    bestPerformerPct: Number.isFinite(bestPct) ? bestPct : 0,
    bestPerformerHolding: bestHolding,
    sectorsCount: sectors.size,
  }
}

async function fetchFeeBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeeBalance> {
  // Primary: fee_unit_balances table
  try {
    const { data, error } = await supabase
      .from("fee_unit_balances")
      .select(
        "balance, reserved_balance, total_deposited, total_withdrawn, total_bonus_received",
      )
      .eq("user_id", userId)
      .maybeSingle()

    if (!error && data) {
      const row = data as FeeBalanceRow
      return {
        balance: n(row.balance),
        reserved_balance: n(row.reserved_balance),
        total_deposited: n(row.total_deposited),
        total_withdrawn: n(row.total_withdrawn),
        total_bonus_received: n(row.total_bonus_received),
      }
    }
  } catch {
    /* fall through */
  }

  // Fallback: profiles.fee_units_balance (if quick-sale migration ran)
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("fee_units_balance")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) {
      const row = data as FeeUnitsBalanceFallbackRow
      const bal = n(row.fee_units_balance)
      if (bal > 0) return { ...EMPTY_FEE_BALANCE, balance: bal }
    }
  } catch {
    /* fall through */
  }

  return EMPTY_FEE_BALANCE
}

async function fetchFeeRequests(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeeRequest[]> {
  try {
    const { data, error } = await supabase
      .from("fee_unit_requests")
      .select(
        "id, amount_requested, amount_approved, payment_method, status, notes, rejection_reason, reviewed_at, submitted_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return []
    return data as FeeRequestRow[]
  } catch {
    return []
  }
}

async function fetchFeeTransactions(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeeTransactionEntry[]> {
  try {
    const { data, error } = await supabase
      .from("fee_unit_transactions")
      .select("id, amount, type, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error || !data) return []
    return (data as FeeTransactionRow[]).map((t) => ({
      id: t.id,
      amount: n(t.amount),
      type: t.type ?? "adjustment",
      op_type: t.type ?? "adjustment",
      reason: t.type ?? "adjustment",
      project_name: t.description ?? "",
      created_at: t.created_at,
    }))
  } catch {
    return []
  }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Loads everything the /portfolio page needs in a single round-trip
 * (parallelised). Returns `null` only when there's no signed-in user.
 *
 * Each individual sub-fetch is isolated — a single failure (e.g. a
 * missing table on a partially-migrated DB) returns sane defaults
 * for that section without affecting the rest.
 */
export async function getPortfolioData(): Promise<PortfolioData | null> {
  const supabase = createClient()

  let userId: string
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    userId = user.id
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[portfolio] auth.getUser failed:", err)
    return null
  }

  const [level, holdings, feeBalance, feeRequests, feeTransactions] =
    await Promise.all([
      fetchUserLevel(supabase, userId),
      fetchHoldings(supabase, userId),
      fetchFeeBalance(supabase, userId),
      fetchFeeRequests(supabase, userId),
      fetchFeeTransactions(supabase, userId),
    ])

  return {
    level,
    holdings,
    summary: computeSummary(holdings),
    feeBalance,
    feeRequests,
    feeTransactions,
  }
}

/**
 * Submit a fee-units recharge request. Returns the newly-created row id
 * on success, or `null` on failure (logs to console).
 *
 * Note: `proof_image_url` is required by the table; until Storage is
 * wired in Phase 4.X, callers can pass an empty string (the page
 * currently bypasses it for now).
 */
export async function submitFeeRequest(params: {
  amount_requested: number
  payment_method: "zaincash" | "mastercard" | "bank"
  notes?: string
  proof_image_url?: string
}): Promise<string | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // DB stores payment_method as `zain_cash | master_card | bank_transfer | other`.
    const methodMap: Record<string, string> = {
      zaincash: "zain_cash",
      mastercard: "master_card",
      bank: "bank_transfer",
    }

    const { data, error } = await supabase
      .from("fee_unit_requests")
      .insert({
        user_id: user.id,
        amount_requested: params.amount_requested,
        payment_method: methodMap[params.payment_method] ?? "other",
        notes: params.notes ?? null,
        proof_image_url: params.proof_image_url ?? "",
      })
      .select("id")
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[portfolio] submitFeeRequest error:", error.message)
      return null
    }
    return (data as { id: string } | null)?.id ?? null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[portfolio] submitFeeRequest threw:", err)
    return null
  }
}
