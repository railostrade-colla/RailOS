import { createClient } from "@/lib/supabase/client"

export interface DBNotification {
  id: string
  user_id: string
  notification_type: string
  title: string
  message: string
  priority: string
  link_url?: string
  metadata?: Record<string, unknown>
  icon_name?: string
  is_read: boolean
  read_at?: string
  created_at: string
  expires_at?: string
}

export async function getMyNotifications(userId: string, limit = 30): Promise<DBNotification[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
    return count ?? 0
  } catch {
    return 0
  }
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
    return !error
  } catch {
    return false
  }
}
