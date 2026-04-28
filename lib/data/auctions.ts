import { createClient } from "@/lib/supabase/client"

export interface DBAuction {
  id: string
  project_id: string
  company_id?: string
  title: string
  type: string
  starting_price: number
  current_highest_bid: number
  min_increment: number
  shares_offered: number
  bid_count: number
  status: string
  starts_at: string
  ends_at: string
  winner_id?: string
}

export async function getActiveAuctions(): Promise<DBAuction[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .in("status", ["active", "upcoming"])
      .order("ends_at", { ascending: true })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getAuctionById(id: string): Promise<DBAuction | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}

export async function getAuctionBids(auctionId: string, limit = 20) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("auction_bids")
      .select("*")
      .eq("auction_id", auctionId)
      .order("amount", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
