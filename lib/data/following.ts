import { createClient } from "@/lib/supabase/client"

export interface DBFollowing {
  id: string
  user_id: string
  type: string
  item_id: string
  followed_at: string
}

export async function getMyFollowing(userId: string): Promise<DBFollowing[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("following")
      .select("*")
      .eq("user_id", userId)
      .order("followed_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function isFollowing(userId: string, type: string, itemId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("following")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("item_id", itemId)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}
