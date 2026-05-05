"use client"

/**
 * direct-buy — user-side data layer for direct purchase from system.
 * Phase 10.67 wires the previously-mocked CreateDealModal to real
 * RPCs that write to the deals + payment_proofs tables, so admin
 * panels see the requests immediately.
 */

import { createClient } from "@/lib/supabase/client"

export interface DirectBuyResult {
  success: boolean
  deal_id?: string
  total_amount?: number
  expires_at?: string
  error?: string
}

export async function submitDirectBuyRequest(
  projectId: string,
  sharesAmount: number,
): Promise<DirectBuyResult> {
  if (!projectId) return { success: false, error: "missing_project" }
  if (!sharesAmount || sharesAmount <= 0) {
    return { success: false, error: "invalid_amount" }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("submit_direct_buy_request", {
      p_project_id: projectId,
      p_shares_amount: sharesAmount,
    })
    if (error) return { success: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown> & { success?: boolean; error?: string }
    if (!r.success) return { success: false, error: String(r.error ?? "unknown") }
    return {
      success: true,
      deal_id: String(r.deal_id),
      total_amount: Number(r.total_amount ?? 0),
      expires_at: r.expires_at ? String(r.expires_at) : undefined,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}

export type PaymentMethod =
  | "zain_cash"
  | "master_card"
  | "bank_transfer"
  | "asia_hawala"
  | "ki_card"
  | "other"

export interface SubmitProofResult {
  success: boolean
  deal_id?: string
  proof_id?: string
  error?: string
}

export async function submitPaymentProof(params: {
  deal_id: string
  payment_method: PaymentMethod
  amount_paid: number
  transaction_reference?: string | null
  proof_image_url: string
  notes?: string | null
}): Promise<SubmitProofResult> {
  if (!params.deal_id) return { success: false, error: "missing_deal" }
  if (!params.proof_image_url) return { success: false, error: "missing_image" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("submit_payment_proof", {
      p_deal_id: params.deal_id,
      p_payment_method: params.payment_method,
      p_amount_paid: params.amount_paid,
      p_transaction_reference: params.transaction_reference ?? null,
      p_proof_image_url: params.proof_image_url,
      p_notes: params.notes ?? null,
    })
    if (error) return { success: false, error: error.message }
    const r = (data ?? {}) as Record<string, unknown> & { success?: boolean; error?: string }
    if (!r.success) return { success: false, error: String(r.error ?? "unknown") }
    return {
      success: true,
      deal_id: String(r.deal_id),
      proof_id: String(r.proof_id),
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
