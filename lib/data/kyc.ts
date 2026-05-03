"use client"

/**
 * KYC submission data layer (Phase 5.5).
 *
 * `submitKycRequest()` writes to two tables atomically (best-effort):
 *   1. INSERT into `kyc_submissions` with all NOT-NULL fields
 *   2. UPDATE `profiles.kyc_status = 'pending'`
 *
 * If step 2 fails after step 1 succeeds, we still report success —
 * the row is in the queue, the status update is a UI hint only.
 *
 * The schema's `kyc_status` enum is set to `'pending'` automatically
 * via the column DEFAULT, but we update profiles too so the user sees
 * the new state immediately.
 */

import { createClient } from "@/lib/supabase/client"

/** Maps the page's friendly type to the DB enum. */
export type KycDocTypeApi = "national_id" | "passport" | "driver_license"

export interface SubmitKycParams {
  // Personal info — all NOT NULL in DB
  full_name: string
  /** YYYY-MM-DD */
  date_of_birth: string
  address: string
  city: string
  phone: string

  // Document
  document_type: KycDocTypeApi
  document_number: string

  // Storage paths (from `lib/storage/upload.ts`).
  // The DB columns are named `*_url` historically but we store relative
  // paths since the bucket is private (signed URLs are generated on demand).
  selfie_url: string
  document_front_url: string
  document_back_url?: string
}

export interface SubmitKycResult {
  success: boolean
  id?: string
  error?: string
}

/** Quick client-side sanity check before hitting the network. */
function validate(p: SubmitKycParams): string | null {
  if (!p.full_name || p.full_name.trim().length < 2) return "اكتب اسمك الكامل"
  if (!p.date_of_birth) return "أدخل تاريخ الميلاد"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_of_birth)) return "تاريخ الميلاد بصيغة YYYY-MM-DD"
  if (!p.address || p.address.trim().length < 5) return "أدخل عنواناً مفصّلاً"
  if (!p.city || p.city.trim().length < 2) return "أدخل المدينة"
  if (!p.phone || p.phone.trim().length < 8) return "أدخل رقم هاتف صحيح"
  if (!p.document_number || p.document_number.trim().length < 4) {
    return "أدخل رقم الوثيقة"
  }
  if (!p.selfie_url) return "صورة السيلفي مفقودة"
  if (!p.document_front_url) return "صورة الوثيقة مفقودة"
  return null
}

export async function submitKycRequest(
  p: SubmitKycParams,
): Promise<SubmitKycResult> {
  const err = validate(p)
  if (err) return { success: false, error: err }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }

    // INSERT submission
    const { data, error } = await supabase
      .from("kyc_submissions")
      .insert({
        user_id: user.id,
        full_name: p.full_name.trim(),
        date_of_birth: p.date_of_birth,
        address: p.address.trim(),
        city: p.city.trim(),
        phone: p.phone.trim(),
        document_type: p.document_type,
        document_number: p.document_number.trim(),
        document_front_url: p.document_front_url,
        document_back_url: p.document_back_url ?? null,
        selfie_url: p.selfie_url,
        // status defaults to 'pending' via DB column default
      })
      .select("id")
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[kyc] insert error:", error.message)
      return { success: false, error: "تعذّر إرسال الطلب — حاول مرّة أخرى" }
    }

    // Best-effort: bump profiles.kyc_status to 'pending' so the UI
    // reflects the new state on the next read. RLS lets the user
    // update their own profile.
    try {
      await supabase
        .from("profiles")
        .update({ kyc_status: "pending" })
        .eq("id", user.id)
    } catch {
      /* non-fatal — submission row is already in the queue */
    }

    return {
      success: true,
      id: (data as { id: string } | null)?.id,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[kyc] submitKycRequest threw:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}
