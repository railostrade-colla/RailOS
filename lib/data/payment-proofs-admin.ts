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
    const { data, error } = await supabase
      .from("payment_proofs")
      .select(
        `
        id, deal_id, payment_method, amount_paid, transaction_reference,
        proof_image_url, notes, submitted_at,
        deal:deals!deal_id (
          id, status, total_amount, buyer_id,
          buyer:profiles!buyer_id ( full_name, username ),
          project:projects!project_id ( name )
        )
        `,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[payment-proofs-admin] select:", error.message)
      return []
    }

    return (data as ProofRow[]).map((p) => {
      const deal = unwrap(p.deal)
      const buyer = unwrap(deal?.buyer ?? null)
      const project = unwrap(deal?.project ?? null)
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
        project_name: project?.name?.trim() || "—",
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
