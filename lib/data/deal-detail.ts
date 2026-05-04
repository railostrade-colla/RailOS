import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"
import type { EscrowDeal, EscrowDealStatus } from "@/lib/escrow/types"

/**
 * Hybrid /deals/[id] loader.
 *
 * Fetches a deal by UUID + JOINs project + buyer + seller profiles,
 * then maps it into the in-memory `EscrowDeal` shape so the existing
 * /deals/[id] page can render without a UI rewrite. Mutations still
 * route through the DB action wrappers (`lib/data/deal-actions`).
 *
 * For non-UUID ids the page should fall back to `getDealById` from
 * `lib/escrow` (mock store).
 */

type DealRow = Database["public"]["Tables"]["deals"]["Row"]

/** Maps the DB enum → the mock-page enum. */
function mapStatus(
  dbStatus: Database["public"]["Enums"]["deal_status"],
  cancellationRequestedBy: string | null,
): EscrowDealStatus {
  // Treat a pending cancellation request as the legacy
  // 'cancellation_requested' status, regardless of underlying status.
  if (cancellationRequestedBy && dbStatus !== "completed" && dbStatus !== "cancelled") {
    return "cancellation_requested"
  }
  switch (dbStatus) {
    case "pending_seller_approval":
    case "accepted":
      return "pending"
    case "payment_submitted":
      return "payment_confirmed"
    case "completed":
      return "completed"
    case "disputed":
      return "disputed"
    case "expired":
      return "cancelled_expired"
    case "cancelled":
    case "rejected":
    default:
      return "cancelled_mutual"
  }
}

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}
interface ProjectRef {
  name?: string | null
}
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

/** Returns null if the deal isn't found or the user has no access. */
export async function getDealDetailDB(dealId: string): Promise<EscrowDeal | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select(
        `*,
         project:projects(name),
         buyer:profiles!deals_buyer_id_fkey(full_name, username),
         seller:profiles!deals_seller_id_fkey(full_name, username)`,
      )
      .eq("id", dealId)
      .maybeSingle()

    if (error || !data) return null

    const row = data as DealRow & {
      project?: ProjectRef | ProjectRef[] | null
      buyer?: ProfileRef | ProfileRef[] | null
      seller?: ProfileRef | ProfileRef[] | null
      cancellation_requested_by?: string | null
    }

    const project = unwrap(row.project)
    const buyer = unwrap(row.buyer)
    const seller = unwrap(row.seller)

    const total =
      Number(row.total_amount ?? row.shares * row.price_per_share) || 0

    return {
      // Identifiers
      id: row.id,
      listing_id: row.listing_id ?? "",
      project_id: row.project_id,
      project_name: project?.name?.trim() || "—",

      // Parties
      buyer_id: row.buyer_id,
      buyer_name: buyer?.full_name?.trim() || buyer?.username?.trim() || "مشتري",
      seller_id: row.seller_id,
      seller_name: seller?.full_name?.trim() || seller?.username?.trim() || "بائع",

      // Quantity / price
      shares_amount: Number(row.shares) || 0,
      price_per_share: Number(row.price_per_share) || 0,
      total_amount: total,

      // Status — mapped from DB enum
      status: mapStatus(row.status, row.cancellation_requested_by ?? null),
      shares_locked: row.status !== "completed" && row.status !== "cancelled",
      locked_at: row.created_at,
      expires_at: row.expires_at,

      // Confirmations
      buyer_confirmed_payment: row.payment_submitted_at != null,
      buyer_confirmed_at: row.payment_submitted_at ?? undefined,
      seller_released_shares: row.completed_at != null,
      seller_released_at: row.completed_at ?? undefined,

      // Cancellation flags (mock-shape) — convert UUID actor to role.
      cancellation_requested_by:
        row.cancellation_requested_by == null
          ? undefined
          : row.cancellation_requested_by === row.buyer_id
            ? "buyer"
            : "seller",
      cancellation_reason: row.cancellation_reason ?? undefined,
      cancellation_requested_at: row.cancellation_requested_by
        ? row.updated_at ?? row.created_at
        : undefined,

      // Misc
      created_at: row.created_at,
      completed_at: row.completed_at ?? undefined,
    }
  } catch {
    return null
  }
}

/** Returns the auth user id of the current viewer, or null. */
export async function getCurrentAuthUserId(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/** UUID heuristic — DB rows are 36-char with dashes. */
export function isDbDealId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
