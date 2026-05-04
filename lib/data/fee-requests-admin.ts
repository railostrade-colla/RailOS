"use client"

/**
 * Admin-side fee-unit request data layer (Phase BB).
 *
 * Reads from `fee_unit_requests` (with profiles JOIN for the user
 * panel display + balance JOIN for the running balance) and calls
 * the Phase-BB approval RPCs for the multi-table approve/reject
 * flow (so client-side can't end up with a half-credited request).
 */

import { createClient } from "@/lib/supabase/client"
import type {
  FeeUnitRequest,
  FeeRequestPaymentMethod,
  FeeRequestStatus,
  UserLevel,
} from "@/lib/mock-data/feeUnits"

interface ProfileRow {
  full_name?: string | null
  username?: string | null
  level?: string | null
}

interface BalanceRow {
  balance?: number | string | null
}

interface RequestRow {
  id: string
  user_id: string
  amount_requested: number | string | null
  amount_approved: number | string | null
  payment_method: string | null
  transaction_reference: string | null
  proof_image_url: string | null
  status: string | null
  admin_notes: string | null
  rejection_reason: string | null
  submitted_at: string | null
  profile?: ProfileRow | ProfileRow[] | null
  balance?: BalanceRow | BalanceRow[] | null
}

// ─── Mappers ─────────────────────────────────────────────────

/** Map DB payment_method enum → mock-side enum. */
function mapPaymentMethod(s: string | null): FeeRequestPaymentMethod {
  if (s === "zain_cash") return "zain_cash"
  if (s === "bank_transfer") return "bank_transfer"
  // master_card / other → bank_transfer for display.
  return "bank_transfer"
}

function mapStatus(s: string | null): FeeRequestStatus {
  if (s === "approved") return "approved"
  if (s === "rejected") return "rejected"
  // 'cancelled' from DB has no mock equivalent — collapse to rejected
  // so the row still renders in the right tab.
  if (s === "cancelled") return "rejected"
  return "pending"
}

function mapLevel(s: string | null | undefined): UserLevel {
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
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

// ─── Reads ───────────────────────────────────────────────────

/**
 * Fetch the fee-request review queue, newest-first. RLS gates
 * SELECT to admins via Phase BB; non-admins get an empty array.
 */
export async function getFeeRequestsAdmin(
  limit: number = 200,
): Promise<FeeUnitRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("fee_unit_requests")
      .select(
        `
        id, user_id, amount_requested, amount_approved,
        payment_method, transaction_reference, proof_image_url,
        status, admin_notes, rejection_reason, submitted_at,
        profile:profiles!user_id ( full_name, username, level ),
        balance:fee_unit_balances!user_id ( balance )
        `,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          "[fee-admin] getFeeRequestsAdmin failed:",
          error.message,
          error.code,
          "— check that 20260503_fee_units_admin.sql migration is applied on Supabase",
        )
      }
      return []
    }

    return (data as RequestRow[]).map((r) => {
      const profile = unwrap(r.profile)
      const balance = unwrap(r.balance)
      const requested = num(r.amount_requested)
      const approved = num(r.amount_approved)
      // The mock fields `requested_units` and `amount_paid` look the
      // same in the panel — the DB only stores `amount_requested`,
      // so we surface that as both. Admins can see the proof image
      // for the actual transferred amount.
      return {
        id: r.id,
        user_id: r.user_id,
        user_name:
          profile?.full_name?.trim() ||
          profile?.username?.trim() ||
          "—",
        user_email: profile?.username?.trim()
          ? `@${profile.username.trim()}`
          : "—",
        user_level: mapLevel(profile?.level),
        current_balance: num(balance?.balance),
        requested_units: requested,
        amount_paid: requested,
        payment_method: mapPaymentMethod(r.payment_method),
        reference_number: r.transaction_reference ?? "—",
        proof_image_url: r.proof_image_url ?? "",
        status: mapStatus(r.status),
        approved_units: approved > 0 ? approved : undefined,
        rejection_reason: r.rejection_reason ?? undefined,
        admin_notes: r.admin_notes ?? undefined,
        submitted_at: dateOnly(r.submitted_at),
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fee-admin] getFeeRequestsAdmin threw:", err)
    return []
  }
}

// ─── Writes (via RPC) ────────────────────────────────────────

export interface ReviewFeeRequestResult {
  success: boolean
  /** When approved: the amount actually credited (in case admin modified). */
  amount_credited?: number
  /** The user's new balance after the credit. */
  new_balance?: number
  /** Stable error code so the UI can branch. */
  reason?:
    | "unauthenticated"
    | "rls"
    | "missing_table"
    | "not_admin"
    | "not_found"
    | "not_pending"
    | "invalid_amount"
    | "reason_required"
    | "unknown"
  error?: string
}

/**
 * Approve a fee-unit recharge request via the
 * admin_approve_fee_request RPC. The RPC runs all three writes
 * (request UPDATE, balance UPSERT, transaction INSERT) atomically.
 *
 * `amountOverride` lets the admin credit a different amount than
 * was requested (e.g. partial verification). null = use requested.
 */
export async function approveFeeRequest(
  requestId: string,
  amountOverride?: number,
): Promise<ReviewFeeRequestResult> {
  if (!requestId) {
    return { success: false, reason: "not_found", error: "missing requestId" }
  }
  if (amountOverride != null && amountOverride <= 0) {
    return { success: false, reason: "invalid_amount" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase.rpc("admin_approve_fee_request", {
      p_request_id: requestId,
      p_amount_approved: amountOverride ?? null,
      p_admin_notes: null,
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" || /function .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[fee-admin] approveFeeRequest:", msg)
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      amount_credited?: number
      new_balance?: number
    }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as ReviewFeeRequestResult["reason"]) ?? "unknown",
        error: result.error,
      }
    }
    return {
      success: true,
      amount_credited: result.amount_credited,
      new_balance: result.new_balance,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fee-admin] approveFeeRequest threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Reject a pending fee-unit recharge request with a required reason. */
export async function rejectFeeRequest(
  requestId: string,
  reason: string,
): Promise<ReviewFeeRequestResult> {
  if (!requestId) {
    return { success: false, reason: "not_found", error: "missing requestId" }
  }
  if (!reason.trim()) {
    return { success: false, reason: "reason_required" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase.rpc("admin_reject_fee_request", {
      p_request_id: requestId,
      p_reason: reason.trim(),
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" || /function .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[fee-admin] rejectFeeRequest:", msg)
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as ReviewFeeRequestResult["reason"]) ?? "unknown",
        error: result.error,
      }
    }
    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fee-admin] rejectFeeRequest threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
