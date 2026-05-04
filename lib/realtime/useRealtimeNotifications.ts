"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * useRealtimeNotifications — subscribes to INSERTs on the
 * `notifications` table for the current user via Supabase Realtime.
 *
 * Returns a counter (`newCount`) that increments on every new
 * notification, plus the latest payload for callers that want to
 * surface a toast / popup. Idle by default — channel is created on
 * mount and cleaned up on unmount.
 *
 * Requires the `notifications` table to be added to the Supabase
 * Realtime publication (see 20260502_notifications_realtime.sql).
 */

export interface RealtimeNotificationPayload {
  id: string
  user_id: string
  type: string
  title: string | null
  body: string | null
  priority: string | null
  is_read: boolean
  created_at: string
  meta?: Record<string, unknown> | null
}

export function useRealtimeNotifications(userId: string | null) {
  const [newCount, setNewCount] = useState(0)
  const [latest, setLatest] = useState<RealtimeNotificationPayload | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const supabase = createClient()

    // Subscribe to inserts where user_id matches
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return
          const row = payload.new as RealtimeNotificationPayload
          setLatest(row)
          setNewCount((c) => c + 1)
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {})
        channelRef.current = null
      }
    }
  }, [userId])

  return { newCount, latest, reset: () => setNewCount(0) }
}
