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
 * — Plays a notification sound when a NEW row is inserted (Phase 10.72).
 * — Returns a memoized `refresh()` for manual reloads.
 *
 * Safe to call from multiple components concurrently — each instance
 * keeps its own Supabase channel.
 */

// Lazy-loaded singleton so we don't construct an Audio object on
// every render. Browsers also block playback before any user gesture,
// so first call may silently no-op.
let _notifAudio: HTMLAudioElement | null = null

function playNotifSound() {
  if (typeof window === "undefined") return
  try {
    if (!_notifAudio) {
      _notifAudio = new Audio("/sounds/notification.mp3")
      _notifAudio.volume = 0.5
      _notifAudio.preload = "auto"
    }
    // Reset to start so rapid-fire notifications still play.
    _notifAudio.currentTime = 0
    void _notifAudio.play().catch(() => {
      // Browser blocked autoplay (no user gesture yet) — silent no-op.
    })
  } catch {
    /* ignore */
  }
}

export function useNotifications(limit: number = 20) {
  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const mountedRef = useRef(true)
  // Track whether we've completed the initial fetch — we only want to
  // play the sound for INSERTs that happen after that, not for the
  // existing notifications loaded on mount.
  const initialLoadedRef = useRef(false)

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
    refresh().then(() => { initialLoadedRef.current = true })

    const supabase = createClient()
    let channelHandle: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mountedRef.current) return

      channelHandle = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Phase 10.72 — play sound only for fresh INSERTs after
            // the initial load. Avoids triggering on hydration.
            if (initialLoadedRef.current) {
              const row = (payload?.new ?? {}) as { is_read?: boolean }
              // Only chime for unread (skip notifications that arrive
              // already-read, e.g. system mass-marks).
              if (row.is_read !== true) playNotifSound()
            }
            refresh()
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
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
