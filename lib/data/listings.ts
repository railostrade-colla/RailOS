import { createClient } from "@/lib/supabase/client"

export interface DBListing {
  id: string
  seller_id: string
  project_id: string
  shares_offered: number
  shares_sold?: number
  price_per_share: number
  notes?: string
  is_quick_sell: boolean
  status: string
  created_at?: string
  expires_at?: string
}

export async function getActiveListings(): Promise<DBListing[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getMyListings(userId: string): Promise<DBListing[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getListingById(id: string): Promise<DBListing | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}
