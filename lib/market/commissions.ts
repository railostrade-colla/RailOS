"use client"

/**
 * Phase 12 — Dynamic commissions data layer.
 *
 * THE single source of truth for every commission rate the app
 * deducts. Pages MUST call `getCommissionRate(type)` (or fetch the
 * full list via `listCommissionSettings`) instead of hard-coding
 * any percentage. The DB function `get_commission_rate(type)` handles
 * the auto-restore-after-paused-until logic.
 */

import { createClient } from "@/lib/supabase/client"
import { dedupCache, invalidateCache } from "@/lib/data/cache"
import type { CommissionSetting, CommissionType } from "./phase12-types"

const CACHE_KEY = "phase12:commissions:list"

/** Read every commission row (cached 30 s — admin writes invalidate). */
export async function listCommissionSettings(): Promise<CommissionSetting[]> {
  return dedupCache(CACHE_KEY, async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("commission_settings")
        .select("*")
        .order("commission_type")
      if (error || !data) return []
      return data as CommissionSetting[]
    } catch {
      return []
    }
  }, 30_000)
}

/**
 * Resolve the live rate for a single commission type via the
 * SECURITY DEFINER `get_commission_rate(type)` RPC, which also
 * auto-restores the default after `paused_until` expires.
 *
 * Returns 0 if the commission is disabled.
 */
export async function getCommissionRate(type: CommissionType): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_commission_rate", { p_type: type })
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  }
}

/**
 * Admin: update one commission. Wraps `admin_update_commission`.
 *
 * @param paused_until — optional future date; when reached, the next
 *   call to get_commission_rate will silently restore default_rate.
 */
export async function adminUpdateCommission(params: {
  type: CommissionType
  is_enabled: boolean
  rate: number
  paused_until?: string | null
  notes?: string | null
}): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("admin_update_commission", {
      p_type: params.type,
      p_is_enabled: params.is_enabled,
      p_new_rate: params.rate,
      p_paused_until: params.paused_until ?? null,
      p_notes: params.notes ?? null,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache(CACHE_KEY)
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Admin: restore a single commission to its default_rate (no-op
 * helper around adminUpdateCommission). Useful for the "استعادة
 * الافتراضي" button next to each row.
 */
export async function adminRestoreCommissionDefault(
  type: CommissionType,
): Promise<{ success: boolean; reason?: string }> {
  const all = await listCommissionSettings()
  const row = all.find((r) => r.commission_type === type)
  if (!row) return { success: false, reason: "unknown_type" }
  return adminUpdateCommission({
    type,
    is_enabled: true,
    rate: row.default_rate,
    paused_until: null,
    notes: "استعادة الافتراضي",
  })
}
