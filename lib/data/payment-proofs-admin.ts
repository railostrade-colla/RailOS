"use client"

/**
 * Admin-side payment-proofs data layer (Phase CC) — read-only.
 *
 * Joins `payment_proofs` with `deals` (for status / total_amount /
 * buyer + project), then with `profiles` (for the buyer's display
 * name) and `projects` (for the project name).
 *
 * Why read-only:
 *   The deal-status flow `payment_submitted → completed` is the
 *   seller's call once they've actually verified the bank transfer.
 *   Admin override happens through `disputes` (separate phase). For
 *   now, the panel surfaces the proof queue + comparison so admins
 *   can spot mismatches and intervene via dispute when warranted.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  PaymentProof,
  ProofPaymentMethod,
  PaymentProofStatus,
  MatchStatus,
} from "@/lib/mock-data/payments"

interface ProofRow {
  id: string
  deal_id: string
  payment_method: string | null
  amount_paid: number | string | null
  transaction_reference: string | null
  proof_image_url: string | null
  notes: string | null
  submitted_at: string | null
  deal?: DealRow | DealRow[] | null
}

interface DealRow {
  id?: string
  status?: string | null
  total_amount?: number | string | null
  buyer_id?: string | null
  buyer?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
  project?: { name?: string | null } | { name?: string | null }[] | null
}

function mapPaymentMethod(s: string | null): ProofPaymentMethod {
  // Mock-side enum: bank_transfer | zain_cash | asia_hawala | ki_card.
  // DB enum has master_card / other which the mock can't represent —
  // collapse to bank_transfer so the icon-label lookup stays valid.
  if (s === "zain_cash") return "zain_cash"
  if (s === "bank_transfer") return "bank_transfer"
  return "bank_transfer"
}

function mapDealStatusToProof(dealStatus: string | null): PaymentProofStatus {
  // The mock's PaymentProofStatus is { pending | confirmed | rejected }.
  // Map deal lifecycle accordingly:
  //   payment_submitted → pending  (admin hasn't reviewed yet)
  //   completed         → confirmed
  //   cancelled / rejected / disputed / expired → rejected
  if (dealStatus === "completed") return "confirmed"
  if (
    dealStatus === "cancelled" ||
    dealStatus === "rejected" ||
    dealStatus === "expired"
  ) {
    return "rejected"
  }
  if (dealStatus === "disputed") return "rejected"
  return "pending"
}

function computeMatch(paid: number, required: number): MatchStatus {
  // Mock's MatchStatus: match | mismatch | needs_review.
  if (required <= 0) return "needs_review"
  if (paid === required) return "match"
  // Within ±0.5% — likely fee/rounding, surface as needs_review so
  // an admin glances at it but it's not flagged red.
  const tolerance = required * 0.005
  if (Math.abs(paid - required) <= tolerance) return "needs_review"
  return "mismatch"
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function dateOnly(s: string | null): string {
  return s ? s.slice(0, 10) : "—"
}

/**
 * Fetch payment proofs newest-first with the deal/buyer/project
 * context the admin queue needs. Empty array on RLS denial.
 */
export async function getPaymentProofsAdmin(
  limit: number = 200,
): Promise<PaymentProof[]> {
  try {
    const supabase = createClient()

    // Step 1: payment_proofs alone.
    const { data: proofs, error } = await supabase
      .from("payment_proofs")
      .select(
        `id, deal_id, payment_method, amount_paid, transaction_reference,
         proof_image_url, notes, submitted_at`,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit)

    if (error || !proofs) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[payment-proofs-admin] select:", error.message)
      return []
    }

    // Step 2: deals.
    const dealIds = Array.from(
      new Set(
        proofs
          .map((p) => (p as { deal_id: string | null }).deal_id)
          .filter((x): x is string => Boolean(x)),
      ),
    )
    interface DealMin {
      id: string
      status: string | null
      total_amount: number | string | null
      buyer_id: string | null
      project_id: string | null
    }
    const dealMap = new Map<string, DealMin>()
    if (dealIds.length > 0) {
      try {
        const { data: deals } = await supabase
          .from("deals")
          .select("id, status, total_amount, buyer_id, project_id")
          .in("id", dealIds)
        for (const d of (deals ?? []) as DealMin[]) dealMap.set(d.id, d)
      } catch { /* leave empty */ }
    }

    // Step 3: profiles + projects.
    const userIds: string[] = []
    const projectIds: string[] = []
    for (const d of dealMap.values()) {
      if (d.buyer_id) userIds.push(d.buyer_id)
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
        for (const pr of (projects ?? []) as Array<{ id: string; name: string | null }>) {
          projectMap.set(pr.id, pr.name ?? "—")
        }
      } catch { /* leave empty */ }
    }

    return (proofs as ProofRow[]).map((p) => {
      const deal = p.deal_id ? dealMap.get(p.deal_id) ?? null : null
      const buyer = deal?.buyer_id ? profileMap.get(deal.buyer_id) ?? null : null
      const projectName = deal?.project_id ? projectMap.get(deal.project_id) ?? "—" : "—"
      const amountPaid = num(p.amount_paid)
      const amountRequired = num(deal?.total_amount)
      return {
        id: p.id,
        deal_id: p.deal_id,
        user_id: deal?.buyer_id ?? "",
        user_name:
          buyer?.full_name?.trim() ||
          buyer?.username?.trim() ||
          "—",
        project_name: projectName.trim() || "—",
        amount_required: amountRequired,
        amount_paid: amountPaid,
        match_status: computeMatch(amountPaid, amountRequired),
        payment_method: mapPaymentMethod(p.payment_method),
        reference_number: p.transaction_reference ?? "—",
        proof_image_url: p.proof_image_url ?? "",
        status: mapDealStatusToProof(deal?.status ?? null),
        rejection_reason: undefined,
        submitted_at: dateOnly(p.submitted_at),
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[payment-proofs-admin] threw:", err)
    return []
  }
}
