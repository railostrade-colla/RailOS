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
import { dedupCache } from "./cache"
import { iqd } from "@/lib/utils/money"

// ─── Types ─────────────────────────────────────────────────────

export interface PortfolioHoldingProject {
  id: string
  name: string
  sector: string
  share_price: number
  current_market_price: number | null
  total_shares: number
  available_shares: number
  /** Project ticker symbol (e.g. "AGRI-01") for the logo placeholder. */
  symbol?: string | null
  /** Optional logo URL — falls back to a generated initial. */
  logo_url?: string | null
  /** Phase 11.26 — cover image URL surfaced via get_my_holdings_full. */
  cover_url?: string | null
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
  // ─── Phase 10.71 fields (from get_my_holdings_full RPC) ─────
  /** % of project offering wallet that's been sold (funding %). */
  funded_pct?: number
  /** Total shares user has bought from this project (cumulative). */
  shares_bought?: number
  /** Total shares user has sold from this project (cumulative). */
  shares_sold?: number
  /** Sum of total_amount on completed deals where user was seller. */
  total_sold_amount?: number
  /** Sum of total_amount on completed deals where user was buyer. */
  total_bought_amount?: number
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

/** Phase 11.13 — enrich holdings with fresh project metadata.
 *
 * Both the RPC and legacy join paths sometimes return holdings with
 * missing project_name / null logo_url / null current_market_price
 * (RLS edge cases, schema drift, RPC version skew). We do a single
 * batched fetch on the projects table after the fact and overlay any
 * missing fields. This guarantees the portfolio "الحصص" tab always
 * shows the real project name, logo, and live market price. */
async function enrichHoldingsWithProjects(
  supabase: SupabaseClient,
  rows: PortfolioHolding[],
): Promise<PortfolioHolding[]> {
  if (rows.length === 0) return rows
  const ids = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)))
  if (ids.length === 0) return rows

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, sector, share_price, current_market_price, total_shares, symbol, logo_url, cover_url, offering_percentage")
      .in("id", ids)
    if (error || !data) return rows

    const map = new Map<string, {
      id: string; name: string | null; sector: string | null
      share_price: number | string | null; current_market_price: number | string | null
      total_shares: number | string | null; symbol: string | null
      logo_url: string | null; cover_url: string | null
      offering_percentage: number | string | null
    }>()
    for (const p of data as Array<typeof map extends Map<string, infer V> ? V : never>) {
      map.set(p.id, p)
    }

    return rows.map((r) => {
      const p = map.get(r.project_id)
      if (!p) return r
      // Phase 11.25 — iqd() for all dinar amounts (see fetchHoldings).
      const sharePrice = iqd(p.share_price ?? r.project?.share_price ?? 0)
      const marketRaw = p.current_market_price != null ? iqd(p.current_market_price) : 0
      const avgBuy = iqd(r.average_buy_price)
      const livePrice =
        (marketRaw > 0 ? marketRaw : 0) ||
        (sharePrice > 0 ? sharePrice : 0) ||
        (avgBuy > 0 ? avgBuy : 0)

      return {
        ...r,
        // Recalculate value with the LIVE market price now that we
        // know it for sure.
        current_value: r.shares * livePrice,
        project: {
          ...r.project,
          id: p.id,
          name: p.name ?? r.project?.name ?? "—",
          sector: p.sector ?? r.project?.sector ?? "",
          share_price: sharePrice,
          current_market_price: marketRaw > 0 ? marketRaw : null,
          total_shares: n(p.total_shares ?? r.project?.total_shares ?? 0),
          available_shares: r.project?.available_shares ?? 0,
          symbol: p.symbol ?? r.project?.symbol ?? null,
          logo_url: p.logo_url ?? null,
          cover_url: p.cover_url ?? null,
        },
      }
    })
  } catch {
    return rows
  }
}

async function fetchHoldings(
  supabase: SupabaseClient,
  userId: string,
): Promise<PortfolioHolding[]> {
  // Phase 10.71 — preferred path: get_my_holdings_full RPC bundles
  // holdings + project info + funded_pct + buy/sell aggregates in
  // one round-trip (SECURITY DEFINER bypasses any RLS quirks).
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "get_my_holdings_full",
    )
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      // Phase 11.26 — RPC now bundles logo_url, cover_url, status,
      // current_market_price, and available_shares so the holdings
      // card has everything it needs in a single SECURITY DEFINER
      // round-trip. The follow-up enrichHoldingsWithProjects pass is
      // still run as defense-in-depth — it can update fields that
      // moved since the RPC executed (e.g. brand assets uploaded
      // mid-session).
      interface RpcRow {
        id: string
        project_id: string
        shares: number | string | null
        frozen_shares: number | string | null
        average_buy_price: number | string | null
        total_invested: number | string | null
        project_name: string | null
        project_sector: string | null
        project_share_price: number | string | null
        // Phase 11.26 additions ↓
        project_logo_url: string | null
        project_cover_url: string | null
        project_status: string | null
        project_current_market_price: number | string | null
        project_available_shares: number | string | null
        // ↑
        market_price: number | string | null
        project_total_shares: number | string | null
        project_symbol: string | null
        funded_pct: number | string | null
        shares_bought_from_project: number | string | null
        shares_sold_from_project: number | string | null
        total_sold_amount: number | string | null
        total_bought_amount: number | string | null
      }
      const mapped = (rpcData as RpcRow[]).map((r): PortfolioHolding => {
        const shares = n(r.shares)
        // Phase 11.25 — every dinar amount goes through iqd() so a
        // fractional value in the DB (legacy / float-drift) can never
        // bleed into the price-cap input handler downstream. n() is
        // still used for non-dinar counts (shares, frozen_shares,
        // funded_pct).
        const sharePrice = iqd(r.project_share_price)
        // Phase 11.11 — cascading fallback so the portfolio total never
        // reads zero when market_price + share_price are both missing
        // (e.g. project join under RLS, brand-new market state). The
        // average buy price is the user's actual cost basis and is
        // always populated when shares > 0, so it's the safest
        // last-resort price for the calculation.
        const avgBuy = iqd(r.average_buy_price)
        const marketRaw = r.market_price != null ? iqd(r.market_price) : 0
        const marketPrice =
          (marketRaw > 0 ? marketRaw : 0) ||
          (sharePrice > 0 ? sharePrice : 0) ||
          (avgBuy > 0 ? avgBuy : 0)
        // Phase 11.26 — surface the live current_market_price (set by
        // the deal-completion trigger) directly in the project payload,
        // and prefer it for the holding card's "سعر السوق" line.
        const liveMarketPrice = r.project_current_market_price != null
          ? iqd(r.project_current_market_price)
          : null
        return {
          id: r.id,
          project_id: r.project_id,
          user_id: userId,
          shares,
          shares_owned: shares,
          frozen_shares: n(r.frozen_shares),
          average_buy_price: avgBuy,
          buy_price: avgBuy,
          total_invested: iqd(r.total_invested),
          current_value: shares * marketPrice,
          project: {
            id: r.project_id,
            name: r.project_name ?? "—",
            sector: r.project_sector ?? "",
            share_price: sharePrice,
            current_market_price:
              liveMarketPrice != null && liveMarketPrice > 0
                ? liveMarketPrice
                : (marketRaw > 0 ? marketRaw : null),
            total_shares: n(r.project_total_shares),
            available_shares: n(r.project_available_shares),
            symbol: r.project_symbol ?? null,
            // Phase 11.26 — real brand assets from the RPC.
            logo_url: r.project_logo_url ?? null,
            cover_url: r.project_cover_url ?? null,
          },
          funded_pct: n(r.funded_pct),
          shares_bought: n(r.shares_bought_from_project),
          shares_sold: n(r.shares_sold_from_project),
          total_sold_amount: iqd(r.total_sold_amount),
          total_bought_amount: iqd(r.total_bought_amount),
        }
      })
      // Phase 11.13 — overlay fresh project metadata (name, logo,
      // current_market_price) so the holdings tab never reads
      // "مشروع غير معروف" with a 0 IQD market price.
      return await enrichHoldingsWithProjects(supabase, mapped)
    }
    if (rpcErr) {
      // eslint-disable-next-line no-console
      console.warn("[portfolio] get_my_holdings_full RPC:", rpcErr.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[portfolio] RPC threw, falling back:", err)
  }

  try {
    // Fallback (Phase 10.70) — two-step manual join.
    const { data: holdingRows, error } = await supabase
      .from("holdings")
      .select(
        "id, project_id, user_id, shares, frozen_shares, average_buy_price, total_invested",
      )
      .eq("user_id", userId)
      .order("last_acquired_at", { ascending: false })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[portfolio] holdings query error:", error.message)
      return []
    }
    if (!holdingRows || holdingRows.length === 0) return []

    interface RawHolding {
      id: string
      project_id: string
      user_id: string
      shares: number | string | null
      frozen_shares: number | string | null
      average_buy_price: number | string | null
      total_invested: number | string | null
    }

    const rows = holdingRows as RawHolding[]
    const projectIds = Array.from(
      new Set(rows.map((r) => r.project_id).filter(Boolean)),
    )

    interface RawProject {
      id: string
      name: string | null
      sector: string | null
      share_price: number | string | null
      current_market_price: number | string | null
      total_shares: number | string | null
      available_shares: number | string | null
      // Phase 11.26 — surface brand assets in the legacy fallback too.
      logo_url: string | null
      cover_url: string | null
      symbol: string | null
    }

    const projectMap = new Map<string, RawProject>()
    if (projectIds.length > 0) {
      try {
        const { data: projs } = await supabase
          .from("projects")
          .select(
            "id, name, sector, share_price, current_market_price, total_shares, available_shares, logo_url, cover_url, symbol",
          )
          .in("id", projectIds)
        for (const p of (projs ?? []) as RawProject[]) {
          projectMap.set(p.id, p)
        }
      } catch {
        // Non-fatal — render the holdings with placeholder project info.
      }
    }

    const out: PortfolioHolding[] = []
    for (const row of rows) {
      const project = projectMap.get(row.project_id)
      const shares = n(row.shares)
      // Phase 11.25 — iqd() for all dinar amounts (see RPC branch).
      const sharePrice = project ? iqd(project.share_price) : 0
      const avgBuy = iqd(row.average_buy_price)
      // Phase 11.11 — same cascading fallback as the RPC branch above:
      // current_market_price → share_price → user's avg_buy_price.
      const marketPriceRaw =
        project && project.current_market_price != null
          ? iqd(project.current_market_price)
          : 0
      const marketPrice =
        (marketPriceRaw > 0 ? marketPriceRaw : 0) ||
        (sharePrice > 0 ? sharePrice : 0) ||
        (avgBuy > 0 ? avgBuy : 0)
      const currentValue = shares * marketPrice

      out.push({
        id: row.id,
        project_id: row.project_id,
        user_id: row.user_id,
        shares,
        shares_owned: shares,
        frozen_shares: n(row.frozen_shares),
        average_buy_price: avgBuy,
        buy_price: avgBuy,
        total_invested: iqd(row.total_invested),
        current_value: currentValue,
        // If the project lookup failed (RLS / deleted), still surface
        // the holding with placeholders so the founder sees the row
        // and can investigate, instead of silently dropping it.
        project: {
          id: project?.id ?? row.project_id,
          name: project?.name ?? "— مشروع غير معروف —",
          sector: project?.sector ?? "",
          share_price: sharePrice,
          current_market_price: marketPriceRaw > 0 ? marketPriceRaw : null,
          total_shares: project ? n(project.total_shares) : 0,
          available_shares: project ? n(project.available_shares) : 0,
          symbol: project?.symbol ?? null,
          // Phase 11.26 — brand assets in the legacy fallback.
          logo_url: project?.logo_url ?? null,
          cover_url: project?.cover_url ?? null,
        },
      })
    }
    // Phase 11.13 — same enrichment pass for the legacy join path.
    return await enrichHoldingsWithProjects(supabase, out)
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
  // Phase 11.18 — wrap in dedupCache so the result is persisted to
  // localStorage between page reloads. Components also call
  // readPersistedSync("portfolio:data") at mount to render
  // immediately from the last-known values. 15s TTL keeps it fresh
  // enough for real trading without spamming Supabase.
  return dedupCache("portfolio:data", () => fetchPortfolioDataInner(), 15_000)
}

async function fetchPortfolioDataInner(): Promise<PortfolioData | null> {
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
