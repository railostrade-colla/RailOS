"use client"

/**
 * share-purchase-requests — admin data layer for the redesigned
 * "طلبات الحصص" tab (Phase 10.66).
 *
 * One RPC fetches deals + payment_proofs + buyer/seller profiles +
 * project name, so the admin panel can show every relevant detail
 * in a single row with no follow-up queries.
 */

import { createClient } from "@/lib/supabase/client"

export interface PaymentProofPart {
  id: string
  payment_method: string
  amount_paid: number
  transaction_reference: string | null
  proof_image_url: string
  notes: string | null
  submitted_at: string
}

export interface SharePurchaseRequestRow {
  id: string  // deal_id
  created_at: string
  shares_amount: number
  total_amount: number
  status: string
  buyer_id: string | null
  seller_id: string | null
  project_id: string | null
  buyer_name: string
  buyer_username: string | null
  buyer_email: string | null
  seller_name: string
  seller_username: string | null
  project_name: string | null
  payment_proof: PaymentProofPart | null
  has_dispute: boolean
}

export type RequestStatusFilter =
  | "all"
  | "pending"
  | "submitted"
  | "disputed"
  | "completed"
  | "cancelled"

export async function getSharePurchaseRequestsAdmin(
  status: RequestStatusFilter = "all",
  limit = 200,
): Promise<SharePurchaseRequestRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(
      "get_share_purchase_requests_admin",
      { p_status: status, p_limit: limit },
    )
    if (error || !Array.isArray(data)) return []
    return (data as SharePurchaseRequestRow[]).map((r) => ({
      ...r,
      shares_amount: Number(r.shares_amount ?? 0),
      total_amount: Number(r.total_amount ?? 0),
      payment_proof: r.payment_proof
        ? {
            ...r.payment_proof,
            amount_paid: Number(r.payment_proof.amount_paid ?? 0),
          }
        : null,
    }))
  } catch {
    return []
  }
}

export interface ActionResult {
  success: boolean
  reason?: string
  error?: string
}

export async function adminConfirmDealPayment(dealId: string): Promise<ActionResult> {
  if (!dealId) return { success: false, reason: "missing_id" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_confirm_deal_payment", {
      p_deal_id: dealId,
    })
    if (error) return { success: false, reason: "rpc_error", error: error.message }
    const r = (data ?? {}) as { success?: boolean; error?: string }
    if (!r.success) return { success: false, reason: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "exception",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCancelDeal(
  dealId: string,
  reason: string | null,
): Promise<ActionResult> {
  if (!dealId) return { success: false, reason: "missing_id" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_cancel_deal", {
      p_deal_id: dealId,
      p_reason: reason,
    })
    if (error) return { success: false, reason: "rpc_error", error: error.message }
    const r = (data ?? {}) as { success?: boolean; error?: string }
    if (!r.success) return { success: false, reason: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "exception",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
