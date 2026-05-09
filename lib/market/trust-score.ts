"use client"

/** Phase 12 — Account trust scores + protection telemetry. */

import { createClient } from "@/lib/supabase/client"

export interface TrustScoreRow {
  user_id: string
  account_age_days: number
  kyc_complete: boolean
  trust_score: number
  has_alerts: boolean
  last_computed_at: string
}

export async function getMyTrustScore(): Promise<TrustScoreRow | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from("account_trust_score")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
    if (error || !data) return null
    return data as TrustScoreRow
  } catch {
    return null
  }
}

export async function getAccountAgeDays(userId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_account_age_days", { p_user_id: userId })
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  }
}

export interface CircularLineageRow {
  id: string
  project_id: string
  from_user_id: string
  to_user_id: string
  shares_count: number
  source_type: string
  is_circular: boolean
  detected_at: string | null
  created_at: string
}

export async function listRecentCircularTrades(
  limit = 50,
): Promise<CircularLineageRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("share_lineage")
      .select("*")
      .eq("is_circular", true)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as CircularLineageRow[]
  } catch {
    return []
  }
}
