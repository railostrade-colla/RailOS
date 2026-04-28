import { createClient } from "@/lib/supabase/client"

export interface DBAd {
  id: string
  title: string
  description?: string
  image_url: string
  link_url: string
  placement: string
  display_order: number
  is_active: boolean
  starts_at?: string
  ends_at?: string
  impressions_count?: number
  clicks_count?: number
}

export async function getActiveAds(placement?: string): Promise<DBAd[]> {
  try {
    const supabase = createClient()
    let q = supabase.from("ads").select("*").eq("is_active", true)
    if (placement) q = q.eq("placement", placement)
    const { data, error } = await q.order("display_order", { ascending: true })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
