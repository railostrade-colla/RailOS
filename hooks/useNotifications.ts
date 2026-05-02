"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getNotifications,
  getUnreadCountForCurrentUser,
  type DBNotification,
} from "@/lib/data/notifications"

/**
 * useNotifications
 * — Fetches the current user's notifications + unread counter.
 * — Subscribes to realtime changes on the `notifications` table so the
 *   bell counter and dropdown stay live without polling.
 * — Returns a memoized `refresh()` for manual reloads (e.g. after
 *   marking-all-read).
 *
 * Safe to call from multiple components concurrently — each instance
 * keeps its own Supabase channel.
 */
export function useNotifications(limit: number = 20) {
  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(limit),
        getUnreadCountForCurrentUser(),
      ])
      if (!mountedRef.current) return
      setNotifications(list)
      setUnreadCount(count)
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("useNotifications.refresh failed:", err)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    mountedRef.current = true
    refresh()

    const supabase = createClient()
    let channelHandle: ReturnType<typeof supabase.channel> | null = null

    // Bind realtime channel only once the auth user is known so we can
    // scope the filter to that user_id.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mountedRef.current) return

      channelHandle = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => refresh(),
        )
        .subscribe()
    })

    return () => {
      mountedRef.current = false
      if (channelHandle) {
        const supabase = createClient()
        supabase.removeChannel(channelHandle)
      }
    }
  }, [refresh])

  return { notifications, unreadCount, loading, refresh }
}
