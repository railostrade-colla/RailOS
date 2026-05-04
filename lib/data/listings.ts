import { createClient } from "@/lib/supabase/client"

export interface DBListing {
  id: string
  seller_id: string
  project_id: string
  shares_offered: number
  shares_sold?: number
  price_per_share: number
  notes?: string
  is_quick_sell: boolean
  status: string
  created_at?: string
  expires_at?: string
}

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

/** Active listings + JOIN seller name + project metadata in one shot. */
export async function getExchangeListings(): Promise<ExchangeListingRow[]> {
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
        project_share_price: num(project?.share_price),
        shares_offered: offered,
        shares_sold: sold,
        shares_remaining: Math.max(0, offered - sold),
        price_per_share: num(r.price_per_share),
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
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
