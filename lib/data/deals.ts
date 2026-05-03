/**
 * Deals data layer (the table is named `deals` in DB; aliases: trades).
 * Schema: id, buyer_id, seller_id, project_id, listing_id, deal_type,
 *         shares, price_per_share, total_amount, fee_*, status, ...
 *
 * Two API tiers:
 *   1. Legacy (DBDeal + getMyDeals/getDealById/getRecentDealsByProject)
 *      — flat selects, used by some older callers.
 *   2. Phase 4.4 (MyDealEnriched + getMyDealsEnriched)
 *      — joined with `projects.name` and `profiles.full_name` for both
 *        sides of the deal so the /deals list can render counterparty
 *        labels without extra round-trips.
 */

import { createClient } from "@/lib/supabase/client"

// ════════════════════════════════════════════════════════════════════
// Legacy tier
// ════════════════════════════════════════════════════════════════════

export interface DBDeal {
  id: string
  buyer_id: string
  seller_id: string
  project_id: string
  listing_id?: string
  deal_type: string
  shares: number
  price_per_share: number
  total_amount?: number
  status: string
  created_at?: string
  completed_at?: string
}

export async function getMyDeals(userId: string, role: "buyer" | "seller" | "any" = "any"): Promise<DBDeal[]> {
  try {
    const supabase = createClient()
    let q = supabase.from("deals").select("*")
    if (role === "buyer") q = q.eq("buyer_id", userId)
    else if (role === "seller") q = q.eq("seller_id", userId)
    else q = q.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getDealById(id: string): Promise<DBDeal | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

export async function getRecentDealsByProject(projectId: string, limit = 10): Promise<DBDeal[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

// ════════════════════════════════════════════════════════════════════
// Phase 4.4 tier — enriched query for the /deals list page
// ════════════════════════════════════════════════════════════════════

/** All possible values of the DB `deal_status` enum. */
export type DBDealStatus =
  | "pending_seller_approval"
  | "rejected"
  | "accepted"
  | "payment_submitted"
  | "completed"
  | "cancelled"
  | "disputed"
  | "expired"

/** Status meta for the /deals list (label + Badge color). */
export const STATUS_META_DB: Record<
  DBDealStatus,
  { label: string; color: "blue" | "green" | "yellow" | "red" | "purple" | "neutral" }
> = {
  pending_seller_approval: { label: "بانتظار البائع", color: "yellow" },
  accepted:                { label: "مقبولة",         color: "blue"   },
  payment_submitted:       { label: "تأكيد الدفع",    color: "purple" },
  completed:               { label: "مكتملة",         color: "green"  },
  rejected:                { label: "مرفوضة",         color: "red"    },
  cancelled:               { label: "ملغاة",          color: "neutral"},
  expired:                 { label: "منتهية",         color: "neutral"},
  disputed:                { label: "نزاع",           color: "red"    },
}

/** Joined deal shape used by the /deals list page. */
export interface MyDealEnriched {
  id: string
  // Project
  project_id: string
  project_name: string
  // Parties
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string
  // Trade details
  deal_type: string
  shares: number
  price_per_share: number
  total_amount: number
  fee_amount: number
  // Status
  status: DBDealStatus
  // Timing
  created_at: string
  updated_at: string
  expires_at: string
  accepted_at: string | null
  payment_submitted_at: string | null
  completed_at: string | null
}

interface DealRowEnriched {
  id: string
  project_id: string
  buyer_id: string
  seller_id: string
  deal_type: string | null
  shares: number | null
  price_per_share: number | null
  total_amount: number | null
  fee_amount: number | null
  status: string | null
  created_at: string
  updated_at: string | null
  expires_at: string
  accepted_at: string | null
  payment_submitted_at: string | null
  completed_at: string | null
  project?: { name?: string | null } | { name?: string | null }[] | null
  buyer?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
  seller?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
}

function unwrapJoined<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function n(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

/**
 * Returns every deal where the signed-in user is buyer or seller, joined
 * with the project's name and both counterparties' display names.
 *
 * Returns `[]` on any auth/query failure (logs to console). Never throws.
 */
export async function getMyDealsEnriched(): Promise<MyDealEnriched[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // PostgREST disambiguates the two FKs to `profiles` via the explicit
    // FK constraint name. Default Postgres name is `<table>_<col>_fkey`.
    const { data, error } = await supabase
      .from("deals")
      .select(
        `
        id, project_id, buyer_id, seller_id,
        deal_type, shares, price_per_share, total_amount, fee_amount,
        status, created_at, updated_at, expires_at,
        accepted_at, payment_submitted_at, completed_at,
        project:projects(name),
        buyer:profiles!deals_buyer_id_fkey(full_name, username),
        seller:profiles!deals_seller_id_fkey(full_name, username)
      `,
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[deals] getMyDealsEnriched error:", error.message)
      return []
    }
    if (!data) return []

    const out: MyDealEnriched[] = []
    for (const row of data as DealRowEnriched[]) {
      const project = unwrapJoined(row.project)
      const buyer = unwrapJoined(row.buyer)
      const seller = unwrapJoined(row.seller)

      out.push({
        id: row.id,
        project_id: row.project_id,
        project_name: project?.name ?? "—",
        buyer_id: row.buyer_id,
        buyer_name: buyer?.full_name ?? buyer?.username ?? "مستخدم",
        seller_id: row.seller_id,
        seller_name: seller?.full_name ?? seller?.username ?? "مستخدم",
        deal_type: row.deal_type ?? "secondary",
        shares: n(row.shares),
        price_per_share: n(row.price_per_share),
        total_amount: n(row.total_amount),
        fee_amount: n(row.fee_amount),
        status: (row.status ?? "pending_seller_approval") as DBDealStatus,
        created_at: row.created_at,
        updated_at: row.updated_at ?? row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at,
        payment_submitted_at: row.payment_submitted_at,
        completed_at: row.completed_at,
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deals] getMyDealsEnriched threw:", err)
    return []
  }
}
