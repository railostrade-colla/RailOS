"use client"

/**
 * Read the most recent payment-proof attached to a deal so the
 * seller can review it before releasing shares (Phase 12.7).
 *
 * Read access is controlled by the existing `payment_proofs` RLS
 * which lets each deal participant SELECT proofs that belong to a
 * deal they're a party of.
 */

import { createClient } from "@/lib/supabase/client"

export interface DealPaymentProof {
  id: string
  deal_id: string
  payment_method: string
  amount_paid: number
  transaction_reference: string | null
  proof_image_url: string | null
  notes: string | null
  submitted_at: string
}

export async function getLatestDealProof(
  dealId: string,
): Promise<DealPaymentProof | null> {
  if (!dealId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("payment_proofs")
      .select(
        "id, deal_id, payment_method, amount_paid, transaction_reference, proof_image_url, notes, submitted_at",
      )
      .eq("deal_id", dealId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[deal-proof] read failed:", error.code, error.message)
      return null
    }
    if (!data) return null
    return {
      id: data.id,
      deal_id: data.deal_id,
      payment_method: data.payment_method,
      amount_paid: Number(data.amount_paid ?? 0),
      transaction_reference: data.transaction_reference,
      proof_image_url: data.proof_image_url,
      notes: data.notes,
      submitted_at: data.submitted_at,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deal-proof] threw:", err)
    return null
  }
}
