"use client"

/**
 * Auctions — DB-backed data layer (Phase 6.2).
 *
 * Wraps the auctions + auction_bids tables created by
 * 20260503_phase6_auctions_schema.sql. Bid placement goes through
 * the place_bid RPC for atomic validation (window + amount + shares
 * checks under SELECT … FOR UPDATE).
 *
 * Named *-real to avoid colliding with the legacy `lib/data/auctions.ts`
 * which queried a non-existent table; that file's stubs returned
 * empty arrays.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  AuctionDetails,
  AuctionBid,
  AuctionStatus,
  AuctionType,
} from "@/lib/mock-data/auctions"

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function asStatus(s: string): AuctionStatus {
  if (s === "upcoming" || s === "active" || s === "ended") return s
  // 'cancelled' has no UI equivalent — collapse to 'ended'.
  return "ended"
}

function asType(s: string): AuctionType {
  if (s === "dutch") return "dutch"
  return "english"
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// ─── Row types ───────────────────────────────────────────────

interface AuctionRow {
  id: string
  project_id: string
  title: string
  type: string
  starting_price: number | string
  current_highest_bid: number | string
  min_increment: number | string
  shares_offered: number | string
  bid_count: number
  starts_at: string
  ends_at: string
  status: string
  project?:
    | { name?: string | null }
    | { name?: string | null }[]
    | null
}

interface BidRow {
  id: string
  auction_id: string
  bidder_id: string
  amount: number | string
  shares: number | string
  created_at: string
  bidder?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
}

function rowToAuction(r: AuctionRow): AuctionDetails {
  const project = unwrap(r.project)
  return {
    id: r.id,
    project_id: r.project_id,
    project_name: project?.name?.trim() || "—",
    // Mock has company_name; the DB doesn't store it on auctions
    // (would be a separate JOIN with projects.company_id). Use
    // project name as a friendly fallback for the UI.
    company_name: project?.name?.trim() || "—",
    starting_price: num(r.starting_price),
    current_highest_bid: num(r.current_highest_bid),
    bid_count: r.bid_count ?? 0,
    shares_offered: num(r.shares_offered),
    min_increment: num(r.min_increment),
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    status: asStatus(r.status),
    type: asType(r.type),
  }
}

function rowToBid(r: BidRow, currentUserId: string | null): AuctionBid {
  const bidder = unwrap(r.bidder)
  return {
    id: r.id,
    auction_id: r.auction_id,
    bidder_id: r.bidder_id,
    bidder_name:
      bidder?.full_name?.trim() ||
      bidder?.username?.trim() ||
      "—",
    amount: num(r.amount),
    shares: num(r.shares),
    is_current_user: currentUserId === r.bidder_id,
    created_at: r.created_at,
  }
}

// ─── Reads ───────────────────────────────────────────────────

export async function getActiveAuctions(): Promise<AuctionDetails[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auctions")
      .select(
        `
        id, project_id, title, type, starting_price,
        current_highest_bid, min_increment, shares_offered,
        bid_count, starts_at, ends_at, status,
        project:projects!project_id ( name )
        `,
      )
      .in("status", ["active", "upcoming"])
      .order("ends_at", { ascending: true })

    if (error || !data) return []
    return (data as AuctionRow[]).map(rowToAuction)
  } catch {
    return []
  }
}

export async function getAuctionById(
  id: string,
): Promise<AuctionDetails | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auctions")
      .select(
        `
        id, project_id, title, type, starting_price,
        current_highest_bid, min_increment, shares_offered,
        bid_count, starts_at, ends_at, status,
        project:projects!project_id ( name )
        `,
      )
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    return rowToAuction(data as AuctionRow)
  } catch {
    return null
  }
}

export async function getAuctionBids(
  auctionId: string,
  limit: number = 20,
): Promise<AuctionBid[]> {
  if (!auctionId) return []
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const currentUserId = user?.id ?? null

    const { data, error } = await supabase
      .from("auction_bids")
      .select(
        `id, auction_id, bidder_id, amount, shares, created_at,
         bidder:profiles!bidder_id ( full_name, username )`,
      )
      .eq("auction_id", auctionId)
      .order("amount", { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as BidRow[]).map((r) => rowToBid(r, currentUserId))
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface PlaceBidResult {
  success: boolean
  bid_id?: string
  new_highest?: number
  reason?:
    | "unauthenticated"
    | "not_found"
    | "auction_not_active"
    | "not_started"
    | "expired"
    | "shares_exceed_offered"
    | "amount_below_min"
    | "invalid_amount"
    | "invalid_shares"
    | "missing_table"
    | "rls"
    | "unknown"
  min_required?: number
  max_shares?: number
  current_status?: string
  error?: string
}

export async function placeBid(
  auctionId: string,
  amount: number,
  shares: number,
): Promise<PlaceBidResult> {
  if (!auctionId) return { success: false, reason: "not_found" }
  if (!Number.isFinite(amount) || amount <= 0)
    return { success: false, reason: "invalid_amount" }
  if (!Number.isFinite(shares) || shares <= 0)
    return { success: false, reason: "invalid_shares" }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase.rpc("place_bid", {
      p_auction_id: auctionId,
      p_amount: amount,
      p_shares: shares,
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg) ||
        /relation .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      // eslint-disable-next-line no-console
      console.error("[auctions] placeBid:", msg)
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as {
      success?: boolean
      bid_id?: string
      new_highest?: number
      error?: string
      min_required?: number
      max_shares?: number
      current_status?: string
    }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as PlaceBidResult["reason"]) ?? "unknown",
        min_required: result.min_required,
        max_shares: result.max_shares,
        current_status: result.current_status,
      }
    }
    return {
      success: true,
      bid_id: result.bid_id,
      new_highest: result.new_highest,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
