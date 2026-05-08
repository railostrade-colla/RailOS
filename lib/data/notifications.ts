import { createClient } from "@/lib/supabase/client"
import { dedupCache, invalidateCache } from "./cache"

// Phase 11.31 — drop the cached lists/counts after any write so the
// bell badge + dropdown reflect the new state immediately. Called by
// markAsRead, markAllAsRead, deleteNotification.
function invalidateNotificationCaches(): void {
  invalidateCache("notif:unreadCount")
  // Common limit values used across the app.
  for (const lim of [10, 20, 30, 50, 100]) {
    invalidateCache(`notif:list:${lim}`)
  }
}

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
    // Phase 11.22 — exclude admin-targeted notifications (link_url
    // starts with /admin). The admin shell has its own bell that
    // surfaces those; the user app should never show them.
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .or("link_url.is.null,link_url.not.like./admin%")
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
    // Phase 11.22 — exclude admin-targeted notifications from the
    // user app's unread counter (mirror of getMyNotifications).
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .or("link_url.is.null,link_url.not.like./admin%")
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
    if (!error) invalidateNotificationCaches()
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
    if (!error) invalidateNotificationCaches()
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
 *
 * Phase 11.31 — wrapped in dedupCache so the global preloader can warm
 * it and pages can hydrate via readPersistedSync(`notif:list:${limit}`).
 */
export async function getNotifications(limit = 20): Promise<DBNotification[]> {
  return dedupCache(`notif:list:${limit}`, async () => {
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
  }, 15_000)
}

/**
 * Auth-aware unread counter. Prefers the `get_unread_count` RPC (added
 * in migration 20260502); falls back to a COUNT(*) query if the RPC is
 * unavailable.
 *
 * Phase 11.31 — wrapped in dedupCache (key `notif:unreadCount`) so the
 * bell badge can hydrate synchronously on first paint via
 * readPersistedSync. 10s TTL keeps it fresh enough for active use.
 */
export async function getUnreadCountForCurrentUser(): Promise<number> {
  return dedupCache("notif:unreadCount", async () => {
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
  }, 10_000)
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
    if (!rpcErr) {
      invalidateNotificationCaches()
      return true
    }

    // Fallback for envs without the RPC.
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false)
    if (!error) invalidateNotificationCaches()
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
