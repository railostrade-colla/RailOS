"use client"

/**
 * Phase 10.97 — Payment settings (master card / transfer phone / instructions).
 * Single-row config the platform admin publishes. The buy + fee-units
 * modals read these to show users how to pay; super_admin edits them
 * from the System → "إعدادات الدفع" panel.
 */

import { createClient } from "@/lib/supabase/client"

export interface PaymentSettings {
  master_card_number: string | null
  master_card_holder: string | null
  transfer_phone: string | null
  support_phone: string | null
  payment_instructions: string | null
  updated_at?: string | null
}

export const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  master_card_number: null,
  master_card_holder: null,
  transfer_phone: null,
  support_phone: null,
  payment_instructions: null,
}

/** Read the single payment_settings row. Returns empty object on error. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_payment_settings")
    if (error || !data) return EMPTY_PAYMENT_SETTINGS
    const r = data as Record<string, unknown>
    return {
      master_card_number:   (r.master_card_number   as string | null) ?? null,
      master_card_holder:   (r.master_card_holder   as string | null) ?? null,
      transfer_phone:       (r.transfer_phone       as string | null) ?? null,
      support_phone:        (r.support_phone        as string | null) ?? null,
      payment_instructions: (r.payment_instructions as string | null) ?? null,
      updated_at:           (r.updated_at           as string | null) ?? null,
    }
  } catch {
    return EMPTY_PAYMENT_SETTINGS
  }
}

export interface AdminSetPaymentSettingsResult {
  success: boolean
  error?: string
  reason?: string
}

/** Super-admin only. Pass any subset; null fields are kept as-is. */
export async function adminSetPaymentSettings(
  input: Partial<Omit<PaymentSettings, "updated_at">>,
): Promise<AdminSetPaymentSettingsResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_set_payment_settings", {
      p_master_card_number:   input.master_card_number   ?? null,
      p_master_card_holder:   input.master_card_holder   ?? null,
      p_transfer_phone:       input.transfer_phone       ?? null,
      p_support_phone:        input.support_phone        ?? null,
      p_payment_instructions: input.payment_instructions ?? null,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    const r = (data ?? {}) as { success?: boolean; error?: string }
    if (!r.success) {
      return { success: false, reason: r.error ?? "unknown", error: r.error }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
