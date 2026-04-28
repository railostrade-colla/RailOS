/**
 * Deals data layer (the table is named `deals` in DB; aliases: trades).
 * Schema: id, buyer_id, seller_id, project_id, listing_id, deal_type,
 *         shares, price_per_share, total_amount, fee_*, status, ...
 */

import { createClient } from "@/lib/supabase/client"

export interface DBDeal {
  id: string
  buyer_id: string
  seller_id: string
  project_id: string
  listing_id?: string
  deal_type: string
  shares: number
  price_per_share: number
  total_amount?: number
  status: string
  created_at?: string
  completed_at?: string
}

export async function getMyDeals(userId: string, role: "buyer" | "seller" | "any" = "any"): Promise<DBDeal[]> {
  try {
    const supabase = createClient()
    let q = supabase.from("deals").select("*")
    if (role === "buyer") q = q.eq("buyer_id", userId)
    else if (role === "seller") q = q.eq("seller_id", userId)
    else q = q.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getDealById(id: string): Promise<DBDeal | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

export async function getRecentDealsByProject(projectId: string, limit = 10): Promise<DBDeal[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
