"use client"

/**
 * Monthly investment limit helper (Phase 12.12).
 *
 * Computes the IQD value the current user has spent on completed
 * deals (as buyer) since the first day of the current calendar
 * month. Used by /portfolio (display) + /exchange QuantityModal
 * (enforcement before placing a new deal).
 *
 * Returns 0 on failure / unauthenticated.
 */

import { createClient } from "@/lib/supabase/client"

export async function getMyMonthlySpent(): Promise<number> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return 0

    // First moment of the current month, ISO.
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("deals")
      .select("total_amount")
      .eq("buyer_id", uid)
      .eq("status", "completed")
      .gte("completed_at", start.toISOString())

    if (error || !data) return 0
    let sum = 0
    for (const d of data as Array<{ total_amount: number | string | null }>) {
      const v = d.total_amount
      if (v == null) continue
      const n = typeof v === "string" ? Number(v) : v
      if (Number.isFinite(n)) sum += n
    }
    return Math.floor(sum)
  } catch {
    return 0
  }
}
