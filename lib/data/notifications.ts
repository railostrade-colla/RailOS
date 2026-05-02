import { createClient } from "@/lib/supabase/client"

export interface DBNotification {
  id: string
  user_id: string
  notification_type: string
  title: string
  message: string
  priority: string
  link_url?: string
  /** Optional CTA label rendered next to the message (added 2026-05-02). */
  action_label?: string
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

/**
 * Permanently deletes a notification. RLS restricts this to the row's owner.
 * Returns true on success, false on auth/db failure.
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
    return !error
  } catch {
    return false
  }
}

// ════════════════════════════════════════════════════════════════════
// Bell-icon helpers (added 2026-05-02 for in-app dropdown system).
// These do NOT replace the legacy helpers above — they wrap them with
// auth-aware variants that read the current user from supabase.auth.
// ════════════════════════════════════════════════════════════════════

/**
 * Fetches the current user's notifications without requiring the caller
 * to pass `userId`. Returns empty array if not signed in or on error.
 */
export async function getNotifications(limit = 20): Promise<DBNotification[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    return await getMyNotifications(user.id, limit)
  } catch {
    return []
  }
}

/**
 * Auth-aware unread counter. Prefers the `get_unread_count` RPC (added
 * in migration 20260502); falls back to a COUNT(*) query if the RPC is
 * unavailable.
 */
export async function getUnreadCountForCurrentUser(): Promise<number> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    // Prefer RPC for speed; gracefully fall back if it doesn't exist yet.
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_unread_count", {
      p_user_id: user.id,
    })
    if (!rpcErr && typeof rpcData === "number") return rpcData

    return await getUnreadCount(user.id)
  } catch {
    return 0
  }
}

/**
 * Marks every unread notification for the current user as read. Uses the
 * `mark_all_notifications_read` RPC when present, falling back to a
 * direct UPDATE.
 */
export async function markAllAsRead(): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { error: rpcErr } = await supabase.rpc("mark_all_notifications_read", {
      p_user_id: user.id,
    })
    if (!rpcErr) return true

    // Fallback for envs without the RPC.
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false)
    return !error
  } catch {
    return false
  }
}

export interface CreateNotificationParams {
  user_id: string
  notification_type: string
  title: string
  message: string
  link_url?: string
  action_label?: string
  priority?: "low" | "normal" | "high" | "urgent"
  metadata?: Record<string, unknown>
}

/**
 * Insert a notification for a user. Subject to RLS — typically called
 * by SECURITY DEFINER triggers / service-role contexts. From the
 * client side, only succeeds if RLS allows the current user to insert
 * for the given `user_id` (e.g. self-notifications).
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("notifications").insert({
      ...params,
      priority: params.priority ?? "normal",
    })
    return !error
  } catch {
    return false
  }
}
