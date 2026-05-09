"use client"

/** Phase 12 — Admin market decisions log readout. */

import { createClient } from "@/lib/supabase/client"
import type { AdminDecisionRow } from "./phase12-types"

export async function listAdminDecisions(filter?: {
  decisionType?: string
  limit?: number
}): Promise<AdminDecisionRow[]> {
  try {
    const supabase = createClient()
    let q = supabase
      .from("admin_market_decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filter?.limit ?? 100)
    if (filter?.decisionType) {
      q = q.eq("decision_type", filter.decisionType)
    }
    const { data, error } = await q
    if (error || !data) return []
    return data as AdminDecisionRow[]
  } catch {
    return []
  }
}
