"use client"

/**
 * Auctions admin — DB-backed data layer (Phase 7).
 *
 * Admin reads use the same auctions/auction_bids tables. RLS allows
 * admins to see ALL auctions regardless of status.
 */

import { createClient } from "@/lib/supabase/client"
import type { AuctionDetails, AuctionStatus, AuctionType } from "@/lib/mock-data/auctions"

interface ProjectRef { id?: string | null; name?: string | null }

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function asStatus(s: string): AuctionStatus {
  if (s === "upcoming" || s === "active" || s === "ended") return s
  return "ended"
}

function asType(s: string): AuctionType {
  return s === "dutch" ? "dutch" : "english"
}

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
  project?: ProjectRef | ProjectRef[] | null
}

function rowToAuction(r: AuctionRow): AuctionDetails {
  const project = unwrap(r.project)
  const name = project?.name?.trim() || "—"
  return {
    id: r.id,
    project_id: r.project_id,
    project_name: name,
    company_name: name,
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

export async function getAllAuctions(): Promise<AuctionDetails[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auctions")
      .select(
        `id, project_id, title, type, starting_price,
         current_highest_bid, min_increment, shares_offered,
         bid_count, starts_at, ends_at, status,
         project:projects!project_id ( id, name )`,
      )
      .order("starts_at", { ascending: false })

    if (error || !data) return []
    return (data as AuctionRow[]).map(rowToAuction)
  } catch {
    return []
  }
}

export interface AdminProjectOption {
  id: string
  name: string
}

export async function getAllProjectsForSelect(): Promise<AdminProjectOption[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true })

    if (error || !data) return []
    return (data as Array<{ id: string; name: string }>).map((p) => ({
      id: p.id,
      name: p.name,
    }))
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
  auction_id?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<AdminRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" ||
          /function .* does not exist/i.test(msg) ||
          /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string; auction_id?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return { success: true, auction_id: result.auction_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCreateAuction(input: {
  project_id: string
  title: string
  starting_price: number
  shares_offered: number
  min_increment: number
  starts_at: string
  ends_at: string
  type?: "english" | "dutch"
}): Promise<AdminRpcResult> {
  return callRpc("admin_create_auction", {
    p_project_id: input.project_id,
    p_title: input.title,
    p_starting_price: input.starting_price,
    p_shares_offered: input.shares_offered,
    p_min_increment: input.min_increment,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_type: input.type ?? "english",
  })
}

export async function adminCancelAuction(
  auctionId: string,
  reason?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_cancel_auction", {
    p_auction_id: auctionId,
    p_reason: reason ?? null,
  })
}

export async function adminEndAuctionEarly(
  auctionId: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_end_auction_early", {
    p_auction_id: auctionId,
  })
}
