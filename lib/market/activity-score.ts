"use client"

/** Phase 12 — User activity scores (for the dual-pricing system). */

import { createClient } from "@/lib/supabase/client"

export interface ActivityScore {
  user_id: string
  project_id: string
  month: string
  trade_count: number
  qualified_trades: number
  unique_partners: number
  total_volume: number
  a_i: number
  bai: number
  cluster_penalty: number
  final_score: number
  profit_rate: number
  category: "idle" | "weak" | "medium" | "active" | "professional" | "elite"
}

export async function getMyActivityScore(
  projectId: string,
): Promise<ActivityScore | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const month = new Date().toISOString().slice(0, 7) + "-01"
    const { data, error } = await supabase
      .from("user_activity_scores")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("month", month)
      .maybeSingle()
    if (error || !data) return null
    return data as ActivityScore
  } catch {
    return null
  }
}
