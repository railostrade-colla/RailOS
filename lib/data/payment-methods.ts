"use client"

/**
 * Payment-methods data layer (Phase 12.7).
 *
 * Each profile carries an array of payment methods on
 * `profiles.payment_methods` (JSONB). The user edits them in their
 * profile settings; the deal page reads the counter-party's methods
 * via a gated RPC so the buyer can transfer funds off-platform.
 */

import { createClient } from "@/lib/supabase/client"

export type PaymentMethodType = "phone" | "bank" | "mastercard" | "other"

export interface PaymentMethod {
  /** Stable type — drives the icon + validation rules in the UI. */
  type: PaymentMethodType
  /** Human label, e.g. "زين كاش" / "TBI" / "ماستركارد". */
  label: string
  /** The actual number / IBAN / card number. */
  value: string
  /** Optional hint shown in the deal card (e.g. "اسم الحساب: علي محمد"). */
  holder_name?: string
  /** Marks the preferred method (only one should be primary). */
  is_primary?: boolean
}

export const PAYMENT_METHOD_META: Record<
  PaymentMethodType,
  { label: string; icon: string; placeholder: string }
> = {
  phone: { label: "هاتف / محفظة", icon: "📱", placeholder: "07xxxxxxxxx" },
  bank: { label: "حساب بنكي", icon: "🏦", placeholder: "IQ.. / 0123456789" },
  mastercard: { label: "ماستركارد", icon: "💳", placeholder: "1234 5678 9012 3456" },
  other: { label: "أخرى", icon: "🔗", placeholder: "تفاصيل الطريقة" },
}

// ───────────────────────────────────────────────────────────────────
// Read — own methods
// ───────────────────────────────────────────────────────────────────

export async function getMyPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_my_payment_methods")
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[payment-methods] get_my failed:", error.message)
      return []
    }
    if (!Array.isArray(data)) return []
    return data as PaymentMethod[]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[payment-methods] get_my threw:", err)
    return []
  }
}

// ───────────────────────────────────────────────────────────────────
// Write — replace whole array (server validates shape + count)
// ───────────────────────────────────────────────────────────────────

export interface SaveResult {
  success: boolean
  error?: string
}

const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول أولاً",
  must_be_array: "صيغة غير صحيحة",
  too_many: "الحد الأقصى ١٠ طرق دفع",
  bad_type: "نوع طريقة دفع غير معروف",
  empty_value: "أحد الحقول فارغ",
  value_too_long: "القيمة طويلة جدّاً (الحد ٦٠ حرف)",
}

export async function saveMyPaymentMethods(
  methods: PaymentMethod[]
): Promise<SaveResult> {
  try {
    const supabase = createClient()
    // Sanitise on the client too — strip empty/whitespace, dedupe primary.
    const cleaned: PaymentMethod[] = []
    let primarySeen = false
    for (const m of methods) {
      const value = (m.value ?? "").trim()
      if (!value) continue
      const next: PaymentMethod = {
        type: m.type,
        label: (m.label ?? "").trim() || PAYMENT_METHOD_META[m.type].label,
        value,
      }
      if (m.holder_name && m.holder_name.trim()) {
        next.holder_name = m.holder_name.trim()
      }
      if (m.is_primary && !primarySeen) {
        next.is_primary = true
        primarySeen = true
      }
      cleaned.push(next)
    }
    // Default primary = first if none marked
    if (cleaned.length > 0 && !primarySeen) cleaned[0].is_primary = true

    const { data, error } = await supabase.rpc("set_my_payment_methods", {
      p_methods: cleaned,
    })
    if (error) {
      return { success: false, error: error.message }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) {
      return { success: false, error: ARABIC_ERROR[result.error ?? ""] ?? result.error ?? "خطأ غير معروف" }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Read — counter-party's methods (deal page)
// ───────────────────────────────────────────────────────────────────

/**
 * Returns the OTHER party's payment methods for an active deal.
 * Empty array if not a participant or deal not in a payment-eligible
 * state. The RPC handles authorisation server-side.
 */
export async function getCounterpartyPaymentMethods(
  dealId: string
): Promise<PaymentMethod[]> {
  if (!dealId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(
      "get_counterparty_payment_methods",
      { p_deal_id: dealId }
    )
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[payment-methods] counterparty failed:", error.message)
      return []
    }
    if (!Array.isArray(data)) return []
    return data as PaymentMethod[]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[payment-methods] counterparty threw:", err)
    return []
  }
}
