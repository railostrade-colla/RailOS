"use client"

/**
 * price-history — surfaces the orphan `price_history` table.
 * Powers the project price chart + admin historical view.
 */

import { createClient } from "@/lib/supabase/client"

export interface PriceHistoryPoint {
  id: string
  project_id: string
  old_price: number
  new_price: number
  change_pct: number
  recorded_at: string
  phase: string
  trigger: string | null
}

export async function getPriceHistory(
  projectId: string,
  limit: number = 100,
): Promise<PriceHistoryPoint[]> {
  if (!projectId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_price_history", {
      p_project_id: projectId,
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return []
    return (data as PriceHistoryPoint[]).map((p) => ({
      ...p,
      old_price: Number(p.old_price ?? 0),
      new_price: Number(p.new_price ?? 0),
      change_pct: Number(p.change_pct ?? 0),
    }))
  } catch {
    return []
  }
}
