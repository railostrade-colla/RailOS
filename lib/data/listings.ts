import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"
import { iqd } from "@/lib/utils/money"
import { dedupCache, invalidateCache } from "./cache"

// Phase 11.31 — drop the cached exchange feed + my-listings list after
// any write so the next read hits the network and the UI reflects the
// new state immediately. Called by cancelMyListing.
function invalidateListingCaches(): void {
  invalidateCache("listings:exchange:active")
  invalidateCache("listings:mine:all")
}

/**
 * DBListing is now a type alias on the Supabase-generated Row shape.
 * The shape is identical to what the table returns, so callers don't
 * need to change. New columns (type, frozen_fee_units, etc.) are
 * automatically picked up next time we re-run `npm run types:db`.
 */
export type DBListing = Database["public"]["Tables"]["listings"]["Row"]

export async function getActiveListings(): Promise<DBListing[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getMyListings(userId: string): Promise<DBListing[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getListingById(id: string): Promise<DBListing | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

// ─── Phase 10 — rich listings + place_deal RPC ─────────────

export interface ExchangeListingRow {
  id: string
  seller_id: string
  seller_name: string
  project_id: string
  project_name: string
  project_sector: string | null
  project_share_price: number
  shares_offered: number
  shares_sold: number
  shares_remaining: number
  price_per_share: number
  notes: string | null
  is_quick_sell: boolean
  status: string
  /** sell = holder offering shares; buy = wanter signaling demand. */
  type: "sell" | "buy"
  created_at: string
  expires_at: string | null
}

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}

interface ProjectRef {
  name?: string | null
  sector?: string | null
  share_price?: number | string | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

/**
 * Phase 11.30 — fetch the SIGNED-IN user's own listings, regardless of
 * status (active / cancelled / completed / paused). Drives the
 * "السجل" (log) tab in /exchange so the founder can see what they've
 * posted, what got fulfilled, and what got cancelled — with the
 * timestamps + remaining-shares info needed to investigate any
 * discrepancy.
 *
 * Returns rows with the same ExchangeListingRow shape as
 * getExchangeListings so the UI can reuse the existing card formatter.
 */
export async function getMyExchangeListings(): Promise<ExchangeListingRow[]> {
  return dedupCache("listings:mine:all", async () => {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("listings")
      .select(
        `id, seller_id, project_id, shares_offered, shares_sold,
         price_per_share, notes, is_quick_sell, status, type, created_at,
         expires_at,
         seller:profiles!seller_id ( full_name, username ),
         project:projects!project_id ( name, sector, share_price )`,
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
    if (error || !data) return []

    interface Row {
      id: string
      seller_id: string
      project_id: string
      shares_offered: number | string
      shares_sold: number | string | null
      price_per_share: number | string
      notes: string | null
      is_quick_sell: boolean
      status: string
      type: string | null
      created_at: string
      expires_at: string | null
      seller?: ProfileRef | ProfileRef[] | null
      project?: ProjectRef | ProjectRef[] | null
    }

    return (data as Row[]).map((r): ExchangeListingRow => {
      const seller = unwrap(r.seller)
      const project = unwrap(r.project)
      const offered = num(r.shares_offered)
      const sold = num(r.shares_sold)
      return {
        id: r.id,
        seller_id: r.seller_id,
        seller_name:
          seller?.full_name?.trim() ||
          seller?.username?.trim() ||
          "أنا",
        project_id: r.project_id,
        project_name: project?.name?.trim() || "—",
        project_sector: project?.sector ?? null,
        project_share_price: iqd(project?.share_price),
        shares_offered: offered,
        shares_sold: sold,
        shares_remaining: Math.max(0, offered - sold),
        price_per_share: iqd(r.price_per_share),
        notes: r.notes,
        is_quick_sell: r.is_quick_sell,
        status: r.status,
        type: r.type === "buy" ? "buy" : "sell",
        created_at: r.created_at,
        expires_at: r.expires_at,
      }
    })
  } catch {
    return []
  }
  }, 15_000)
}

/**
 * Phase 11.30 — cancel one of the signed-in user's own listings. RLS
 * policy "Sellers can update own listings" allows this. Returns true
 * on success, false on auth/db failure.
 */
export async function cancelMyListing(listingId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("listings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", listingId)
    if (!error) invalidateListingCaches()
    return !error
  } catch {
    return false
  }
}

/** Active listings + JOIN seller name + project metadata in one shot. */
export async function getExchangeListings(): Promise<ExchangeListingRow[]> {
  return dedupCache("listings:exchange:active", async () => {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select(
        `id, seller_id, project_id, shares_offered, shares_sold,
         price_per_share, notes, is_quick_sell, status, type, created_at,
         expires_at,
         seller:profiles!seller_id ( full_name, username ),
         project:projects!project_id ( name, sector, share_price )`,
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      seller_id: string
      project_id: string
      shares_offered: number | string
      shares_sold: number | string | null
      price_per_share: number | string
      notes: string | null
      is_quick_sell: boolean
      status: string
      type: string | null
      created_at: string
      expires_at: string | null
      seller?: ProfileRef | ProfileRef[] | null
      project?: ProjectRef | ProjectRef[] | null
    }

    return (data as Row[]).map((r): ExchangeListingRow => {
      const seller = unwrap(r.seller)
      const project = unwrap(r.project)
      const offered = num(r.shares_offered)
      const sold = num(r.shares_sold)
      return {
        id: r.id,
        seller_id: r.seller_id,
        seller_name:
          seller?.full_name?.trim() ||
          seller?.username?.trim() ||
          "—",
        project_id: r.project_id,
        project_name: project?.name?.trim() || "—",
        project_sector: project?.sector ?? null,
        // Phase 11.25 — iqd() rounds dinar values to integer so
        // fractional drift can never reach the price-cap UI.
        project_share_price: iqd(project?.share_price),
        shares_offered: offered,
        shares_sold: sold,
        shares_remaining: Math.max(0, offered - sold),
        price_per_share: iqd(r.price_per_share),
        notes: r.notes,
        is_quick_sell: r.is_quick_sell,
        status: r.status,
        type: r.type === "buy" ? "buy" : "sell",
        created_at: r.created_at,
        expires_at: r.expires_at,
      }
    })
  } catch {
    return []
  }
  }, 10_000)
}

/** Accept a buy-listing. Symmetric to placeDealFromListing for sell-side. */
export async function acceptBuyListing(
  listingId: string,
  quantity: number,
  durationHours: 24 | 48 | 72 = 24,
): Promise<PlaceDealResult> {
  if (!listingId) return { success: false, reason: "listing_not_found" }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, reason: "invalid_quantity" }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("accept_buy_listing", {
      p_listing_id: listingId,
      p_quantity: quantity,
      p_duration_hours: durationHours,
    })
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as PlaceDealResult & { error?: string }
    if (!result.success) {
      return {
        success: false,
        reason: result.reason ?? result.error ?? "unknown",
        available: result.available,
        unfrozen: result.unfrozen,
        current_status: result.current_status,
      }
    }
    invalidateListingCaches()
    invalidateCache("deals:my:enriched")
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface PlaceDealResult {
  success: boolean
  reason?: string
  error?: string
  deal_id?: string
  total_amount?: number
  buyer_commission?: number
  /** Echo from RPC when capacity / unfrozen check fails. */
  available?: number
  unfrozen?: number
  current_status?: string
}

export async function placeDealFromListing(
  listingId: string,
  quantity: number,
  durationHours: 24 | 48 | 72 = 24,
): Promise<PlaceDealResult> {
  if (!listingId) return { success: false, reason: "listing_not_found" }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, reason: "invalid_quantity" }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("place_deal_from_listing", {
      p_listing_id: listingId,
      p_quantity: quantity,
      p_duration_hours: durationHours,
    })
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as PlaceDealResult & { error?: string }
    if (!result.success) {
      return {
        success: false,
        reason: result.reason ?? result.error ?? "unknown",
        available: result.available,
        unfrozen: result.unfrozen,
        current_status: result.current_status,
      }
    }
    invalidateListingCaches()
    invalidateCache("deals:my:enriched")
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
