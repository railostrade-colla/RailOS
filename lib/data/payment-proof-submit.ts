"use client"

/**
 * Payment-proof submission for exchange deals (Phase 12.7).
 *
 * Buyer uploads an image of the off-platform transfer, then this
 * helper:
 *   1. uploads the image to the payment-proofs bucket
 *   2. calls submit_payment_proof RPC with the resulting URL
 *
 * On success the deal flips from 'accepted' → 'payment_submitted'
 * and the seller is notified to verify + release shares.
 */

import { createClient } from "@/lib/supabase/client"
import { uploadDealPaymentProof } from "@/lib/storage/upload"

export type ExchangePaymentMethod =
  | "zain_cash"
  | "master_card"
  | "bank_transfer"
  | "other"

export interface SubmitProofInput {
  dealId: string
  paymentMethod: ExchangePaymentMethod
  amountPaid: number
  /** Optional reference (transaction id from the bank/wallet). */
  transactionReference?: string
  /** Free-form note shown to the seller. */
  notes?: string
  /** The actual image file. Required. */
  proofImage: File
}

export interface SubmitProofResult {
  success: boolean
  dealId?: string
  proofId?: string
  error?: string
  /** Stable code for branching in the UI ("not_buyer" / "invalid_status" / ...). */
  reason?: string
}

const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول أولاً",
  invalid_amount: "المبلغ غير صحيح",
  proof_required: "صورة الإثبات مطلوبة",
  deal_not_found: "الصفقة غير موجودة",
  not_buyer: "أنت لست المشتري في هذه الصفقة",
  invalid_status: "حالة الصفقة لا تسمح برفع الإثبات الآن",
}

export async function submitDealPaymentProof(
  input: SubmitProofInput,
): Promise<SubmitProofResult> {
  if (!input.dealId) {
    return { success: false, error: "معرّف الصفقة مفقود", reason: "missing_deal" }
  }
  if (!input.proofImage) {
    return { success: false, error: "صورة الإثبات مطلوبة", reason: "proof_required" }
  }
  if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
    return { success: false, error: "المبلغ غير صحيح", reason: "invalid_amount" }
  }

  // 1. Upload the image to the payment-proofs bucket.
  const upload = await uploadDealPaymentProof(input.proofImage, input.dealId)
  if (!upload.success) {
    return {
      success: false,
      error: upload.error || "فشل رفع الصورة",
      reason: "upload_failed",
    }
  }
  const proofUrl = upload.publicUrl
  if (!proofUrl) {
    return {
      success: false,
      error: "تعذّر الحصول على رابط الصورة",
      reason: "no_url",
    }
  }

  // 2. Call the RPC.
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("submit_payment_proof", {
      p_deal_id: input.dealId,
      p_payment_method: input.paymentMethod,
      p_amount_paid: Math.floor(input.amountPaid),
      p_transaction_reference: input.transactionReference ?? null,
      p_proof_image_url: proofUrl,
      p_notes: input.notes ?? null,
    })

    if (error) {
      return {
        success: false,
        error: error.message,
        reason: "rpc_error",
      }
    }

    const result = (data ?? {}) as {
      success?: boolean
      deal_id?: string
      proof_id?: string
      error?: string
      current?: string
    }

    if (!result.success) {
      const code = result.error ?? "unknown"
      return {
        success: false,
        error: ARABIC_ERROR[code] ?? `تعذّر إرسال الإثبات (${code})`,
        reason: code,
      }
    }

    return {
      success: true,
      dealId: result.deal_id,
      proofId: result.proof_id,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
      reason: "exception",
    }
  }
}
