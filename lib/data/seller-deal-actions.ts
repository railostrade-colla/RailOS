"use client"

/**
 * Seller-side deal actions for the global request notifier (Phase 12.8).
 *
 * - listPendingDealRequestsForMe(): every deal where I'm the seller and
 *   the buyer is waiting for my approval. Used by the popup on first
 *   mount + when realtime fires for an INSERT we may have missed.
 * - acceptDealRequest(dealId): wraps `seller_accept_deal` RPC.
 * - rejectDealRequest(dealId, reason): wraps `seller_reject_deal` RPC.
 *
 * All three are SECURITY DEFINER on the DB side and gated to caller=seller.
 */

import { createClient } from "@/lib/supabase/client"

export interface PendingDealRequest {
  id: string
  buyer_id: string
  buyer_name: string
  /** profiles.username if no full_name. */
  buyer_handle: string | null
  project_id: string
  project_name: string
  project_symbol: string | null
  shares: number
  price_per_share: number
  total_amount: number
  buyer_commission: number
  created_at: string
  expires_at: string | null
}

interface RawDealRow {
  id: string
  buyer_id: string | null
  project_id: string | null
  shares: number | string | null
  price_per_share: number | string | null
  total_amount: number | string | null
  buyer_commission: number | string | null
  created_at: string | null
  expires_at: string | null
  status: string
}

interface ProfileRef {
  id: string
  full_name: string | null
  username: string | null
}

interface ProjectRef {
  id: string
  name: string | null
  symbol: string | null
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

/**
 * Returns all my pending-approval deals. Caller must be authenticated;
 * an empty array is returned otherwise (no throw).
 */
export async function listPendingDealRequestsForMe(): Promise<
  PendingDealRequest[]
> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return []

    // Step 1: pull pending deals where I'm the seller.
    const { data: deals, error } = await supabase
      .from("deals")
      .select(
        "id, buyer_id, project_id, shares, price_per_share, total_amount, buyer_commission, created_at, expires_at, status",
      )
      .eq("seller_id", uid)
      .eq("status", "pending_seller_approval")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !deals) {
      // eslint-disable-next-line no-console
      if (error) console.warn("[deal-requests] read failed:", error.message)
      return []
    }
    if (deals.length === 0) return []

    // Step 2: batch lookup profiles + projects.
    const buyerIds = Array.from(
      new Set(
        (deals as RawDealRow[])
          .map((d) => d.buyer_id)
          .filter((x): x is string => Boolean(x)),
      ),
    )
    const projectIds = Array.from(
      new Set(
        (deals as RawDealRow[])
          .map((d) => d.project_id)
          .filter((x): x is string => Boolean(x)),
      ),
    )

    const profileMap = new Map<string, ProfileRef>()
    if (buyerIds.length > 0) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", buyerIds)
        for (const p of (data ?? []) as ProfileRef[]) {
          profileMap.set(p.id, p)
        }
      } catch {
        /* ignore */
      }
    }

    const projectMap = new Map<string, ProjectRef>()
    if (projectIds.length > 0) {
      try {
        const { data } = await supabase
          .from("projects")
          .select("id, name, symbol")
          .in("id", projectIds)
        for (const p of (data ?? []) as ProjectRef[]) {
          projectMap.set(p.id, p)
        }
      } catch {
        /* ignore */
      }
    }

    return (deals as RawDealRow[]).map((d): PendingDealRequest => {
      const profile = d.buyer_id ? profileMap.get(d.buyer_id) ?? null : null
      const project = d.project_id ? projectMap.get(d.project_id) ?? null : null
      const name =
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "مستخدم"
      return {
        id: d.id,
        buyer_id: d.buyer_id ?? "",
        buyer_name: name,
        buyer_handle: profile?.username?.trim() ?? null,
        project_id: d.project_id ?? "",
        project_name: project?.name?.trim() || "—",
        project_symbol: project?.symbol?.trim() ?? null,
        shares: num(d.shares),
        price_per_share: num(d.price_per_share),
        total_amount: num(d.total_amount),
        buyer_commission: num(d.buyer_commission),
        created_at: d.created_at ?? "",
        expires_at: d.expires_at ?? null,
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deal-requests] threw:", err)
    return []
  }
}

/** Hydrate ONE pending request (used after a realtime INSERT). */
export async function getPendingDealRequest(
  dealId: string,
): Promise<PendingDealRequest | null> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return null

    const { data: deal, error } = await supabase
      .from("deals")
      .select(
        "id, buyer_id, seller_id, project_id, shares, price_per_share, total_amount, buyer_commission, created_at, expires_at, status",
      )
      .eq("id", dealId)
      .maybeSingle()

    if (error || !deal) return null
    if (deal.seller_id !== uid) return null
    if (deal.status !== "pending_seller_approval") return null

    let buyerName = "مستخدم"
    let buyerHandle: string | null = null
    if (deal.buyer_id) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", deal.buyer_id)
          .maybeSingle()
        if (prof) {
          buyerName =
            prof.full_name?.trim() || prof.username?.trim() || "مستخدم"
          buyerHandle = prof.username?.trim() ?? null
        }
      } catch {
        /* ignore */
      }
    }

    let projectName = "—"
    let projectSymbol: string | null = null
    if (deal.project_id) {
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("name, symbol")
          .eq("id", deal.project_id)
          .maybeSingle()
        if (proj) {
          projectName = proj.name?.trim() || "—"
          projectSymbol = proj.symbol?.trim() ?? null
        }
      } catch {
        /* ignore */
      }
    }

    return {
      id: deal.id,
      buyer_id: deal.buyer_id ?? "",
      buyer_name: buyerName,
      buyer_handle: buyerHandle,
      project_id: deal.project_id ?? "",
      project_name: projectName,
      project_symbol: projectSymbol,
      shares: num(deal.shares),
      price_per_share: num(deal.price_per_share),
      total_amount: num(deal.total_amount),
      buyer_commission: num(deal.buyer_commission),
      created_at: deal.created_at ?? "",
      expires_at: deal.expires_at ?? null,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deal-requests] hydrate threw:", err)
    return null
  }
}

// ─── Mutations ────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
  reason?: string
}

const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول",
  not_seller: "لست البائع في هذه الصفقة",
  deal_not_found: "الصفقة غير موجودة",
  wrong_status: "تم الردّ على هذه الصفقة بالفعل",
}

export async function acceptDealRequest(dealId: string): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("seller_accept_deal", {
      p_deal_id: dealId,
    })
    if (error) {
      return { success: false, error: error.message, reason: "rpc_error" }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) {
      const code = result.error ?? "unknown"
      return {
        success: false,
        reason: code,
        error: ARABIC_ERROR[code] ?? `تعذّر الموافقة (${code})`,
      }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
      reason: "exception",
    }
  }
}

export async function rejectDealRequest(
  dealId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("seller_reject_deal", {
      p_deal_id: dealId,
      p_reason: reason,
    })
    if (error) {
      return { success: false, error: error.message, reason: "rpc_error" }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) {
      const code = result.error ?? "unknown"
      return {
        success: false,
        reason: code,
        error: ARABIC_ERROR[code] ?? `تعذّر الرفض (${code})`,
      }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
      reason: "exception",
    }
  }
}
