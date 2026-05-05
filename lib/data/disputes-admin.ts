"use client"

/**
 * Admin-side disputes data layer (Phase EE).
 *
 * Reads from `disputes` joined with `deals` (for the deal context,
 * buyer + seller, project, amounts) and `profiles` (for the names).
 * Resolution writes go through a single update() helper that maps
 * the panel's UI verbs (buyer_favor / seller_favor / split /
 * request_evidence) onto the DB enum (resolved_buyer /
 * resolved_seller / under_review).
 *
 * Out of scope:
 *   • Dispute messages — there's no separate dispute_messages table
 *     yet. The panel renders an empty array; future phase can add
 *     it on top of `deal_messages` filtered by message_type or a
 *     new dispute_messages table.
 *   • Fee/share mutation on resolve — the actual escrow refund/
 *     release flow needs deeper integration with `holdings` and
 *     `fee_unit_balances`. We update the dispute status; the
 *     downstream fund movement is a separate phase.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  Dispute,
  DisputeReason,
  DisputeStatus,
  DisputePriority,
  DisputeResolution,
} from "@/lib/mock-data/disputes"

// ─── Types ───────────────────────────────────────────────────

interface DisputeRow {
  id: string
  deal_id: string
  opened_by: string | null
  reason: string | null
  evidence_urls: string[] | null
  status: string | null
  admin_notes: string | null
  resolution_notes: string | null
  resolved_by: string | null
  opened_at: string | null
  resolved_at: string | null
  deal?: DealRow | DealRow[] | null
}

interface DealRow {
  buyer_id?: string | null
  seller_id?: string | null
  shares_amount?: number | null
  total_amount?: number | string | null
  buyer?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
  seller?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
  project?: { name?: string | null } | { name?: string | null }[] | null
}

// ─── Mappers ─────────────────────────────────────────────────

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function dbStatusToUi(s: string | null): DisputeStatus {
  if (s === "under_review") return "in_review"
  if (s === "resolved_buyer" || s === "resolved_seller") return "resolved"
  if (s === "closed") return "closed"
  return "open"
}

function dbStatusToResolution(s: string | null): DisputeResolution | undefined {
  if (s === "resolved_buyer") return "buyer_favor"
  if (s === "resolved_seller") return "seller_favor"
  return undefined
}

/**
 * Free-text DB reasons → mock's enum. Real reasons are admin-written
 * sentences; we pattern-match keywords so the panel's filter still
 * has something to bucket on. Fallback to 'other'.
 */
function classifyReason(s: string | null): DisputeReason {
  if (!s) return "other"
  const text = s.toLowerCase()
  if (text.includes("paid") || text.includes("payment") || text.includes("دفع"))
    return "payment_issue"
  if (text.includes("deliver") || text.includes("ship") || text.includes("تسليم"))
    return "delivery"
  if (text.includes("fraud") || text.includes("scam") || text.includes("احتيال"))
    return "fraud_suspicion"
  if (text.includes("communication") || text.includes("تواصل"))
    return "communication"
  return "other"
}

/**
 * Priority isn't a column on disputes — derive a hint from age +
 * status so the UI's filter still shows useful gradients.
 */
function derivePriority(openedAt: string | null, status: DisputeStatus): DisputePriority {
  if (status === "closed" || status === "resolved") return "low"
  if (!openedAt) return "medium"
  const t = new Date(openedAt).getTime()
  if (!Number.isFinite(t)) return "medium"
  const ageDays = (Date.now() - t) / 86_400_000
  if (ageDays > 7) return "high"
  if (ageDays < 1) return "low"
  return "medium"
}

function nameFromProfile(
  p: { full_name?: string | null; username?: string | null } | null,
): string {
  return p?.full_name?.trim() || p?.username?.trim() || "—"
}

// ─── Reads ───────────────────────────────────────────────────

/**
 * Fetch the disputes queue for the admin. Empty array on RLS
 * denial (non-admin) or missing migration.
 */
export async function getDisputesAdmin(
  limit: number = 200,
): Promise<Dispute[]> {
  try {
    const supabase = createClient()

    // Step 1: Plain disputes rows — no PostgREST FK joins.
    const { data: disputes, error } = await supabase
      .from("disputes")
      .select(
        `id, deal_id, opened_by, reason, evidence_urls,
         status, admin_notes, resolution_notes, resolved_by,
         opened_at, resolved_at`,
      )
      .order("opened_at", { ascending: false })
      .limit(limit)

    if (error || !disputes) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[disputes-admin] select:", error.message)
      return []
    }

    // Step 2: Pull related deals separately. A missing FK constraint
    // on disputes.deal_id can't break this — we filter by .in() on
    // collected ids.
    const dealIds = Array.from(
      new Set(
        disputes
          .map((d) => (d as { deal_id: string | null }).deal_id)
          .filter((x): x is string => Boolean(x)),
      ),
    )

    interface DealMin {
      id: string
      buyer_id: string | null
      seller_id: string | null
      project_id: string | null
      shares_amount: number | string | null
      total_amount: number | string | null
    }
    const dealMap = new Map<string, DealMin>()
    if (dealIds.length > 0) {
      try {
        const { data: deals } = await supabase
          .from("deals")
          .select("id, buyer_id, seller_id, project_id, shares_amount, total_amount")
          .in("id", dealIds)
        for (const d of (deals ?? []) as DealMin[]) dealMap.set(d.id, d)
      } catch { /* leave empty */ }
    }

    // Step 3: profiles (for buyer/seller display name) + projects.
    const userIds: string[] = []
    const projectIds: string[] = []
    for (const d of dealMap.values()) {
      if (d.buyer_id) userIds.push(d.buyer_id)
      if (d.seller_id) userIds.push(d.seller_id)
      if (d.project_id) projectIds.push(d.project_id)
    }

    const { fetchProfilesByIds } = await import("./admin-join-helper")
    const profileMap = await fetchProfilesByIds(userIds, supabase)

    const projectMap = new Map<string, string>()
    if (projectIds.length > 0) {
      try {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", Array.from(new Set(projectIds)))
        for (const p of (projects ?? []) as Array<{ id: string; name: string | null }>) {
          projectMap.set(p.id, p.name ?? "—")
        }
      } catch { /* leave empty */ }
    }

    return (disputes as DisputeRow[]).map((d) => {
      const deal = d.deal_id ? dealMap.get(d.deal_id) ?? null : null
      const buyer = deal?.buyer_id ? profileMap.get(deal.buyer_id) ?? null : null
      const seller = deal?.seller_id ? profileMap.get(deal.seller_id) ?? null : null
      const projectName = deal?.project_id ? projectMap.get(deal.project_id) ?? "—" : "—"
      const status = dbStatusToUi(d.status)
      const resolution = dbStatusToResolution(d.status)
      return {
        id: d.id,
        deal_id: d.deal_id,
        buyer_id: deal?.buyer_id ?? "",
        buyer_name: nameFromProfile(buyer),
        seller_id: deal?.seller_id ?? "",
        seller_name: nameFromProfile(seller),
        project_name: projectName.trim() || "—",
        reason: classifyReason(d.reason),
        description: d.reason ?? "",
        evidence_urls: Array.isArray(d.evidence_urls)
          ? d.evidence_urls.filter((u): u is string => typeof u === "string")
          : [],
        status,
        priority: derivePriority(d.opened_at, status),
        resolution,
        resolution_notes: d.resolution_notes ?? d.admin_notes ?? undefined,
        opened_at: (d.opened_at ?? "").slice(0, 10),
        resolved_at: d.resolved_at ? d.resolved_at.slice(0, 10) : undefined,
        amount: num(deal?.total_amount),
        shares: num(deal?.shares_amount),
        messages: [],
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[disputes-admin] threw:", err)
    return []
  }
}

// ─── Writes ──────────────────────────────────────────────────

export interface ResolveDisputeResult {
  success: boolean
  reason?: "unauthenticated" | "rls" | "missing_table" | "unknown"
  error?: string
}

async function update(
  disputeId: string,
  patch: Record<string, unknown>,
): Promise<ResolveDisputeResult> {
  if (!disputeId)
    return { success: false, reason: "unknown", error: "disputeId missing" }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { error } = await supabase
      .from("disputes")
      .update({
        ...patch,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", disputeId)

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[disputes-admin] update:", msg)
      return { success: false, reason: "unknown", error: msg }
    }
    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[disputes-admin] update threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function resolveDisputeBuyerFavor(
  disputeId: string,
  notes: string,
): Promise<ResolveDisputeResult> {
  if (!notes.trim())
    return Promise.resolve({ success: false, reason: "unknown", error: "notes_required" })
  return update(disputeId, {
    status: "resolved_buyer",
    resolution_notes: notes.trim(),
    admin_notes: notes.trim(),
  })
}

export function resolveDisputeSellerFavor(
  disputeId: string,
  notes: string,
): Promise<ResolveDisputeResult> {
  if (!notes.trim())
    return Promise.resolve({ success: false, reason: "unknown", error: "notes_required" })
  return update(disputeId, {
    status: "resolved_seller",
    resolution_notes: notes.trim(),
    admin_notes: notes.trim(),
  })
}

/** "Split" doesn't have a DB enum value — record it via notes. */
export function resolveDisputeSplit(
  disputeId: string,
  notes: string,
): Promise<ResolveDisputeResult> {
  if (!notes.trim())
    return Promise.resolve({ success: false, reason: "unknown", error: "notes_required" })
  return update(disputeId, {
    status: "resolved_buyer",
    resolution_notes: `[split 50/50] ${notes.trim()}`,
    admin_notes: `[split 50/50] ${notes.trim()}`,
  })
}

/**
 * Move the dispute into 'under_review' and ask both parties for
 * more evidence. Doesn't set resolved_by / resolved_at since the
 * dispute is still open.
 */
export async function requestDisputeEvidence(
  disputeId: string,
  notes: string,
): Promise<ResolveDisputeResult> {
  if (!disputeId)
    return { success: false, reason: "unknown", error: "disputeId missing" }
  if (!notes.trim())
    return { success: false, reason: "unknown", error: "notes_required" }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { error } = await supabase
      .from("disputes")
      .update({
        status: "under_review",
        admin_notes: notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", disputeId)

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[disputes-admin] request_evidence:", msg)
      return { success: false, reason: "unknown", error: msg }
    }
    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[disputes-admin] request_evidence threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
