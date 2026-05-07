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

// Phase 10.96 — Generate notification chime programmatically via Web
// Audio API. This avoids shipping a binary mp3 in /public and works
// offline. The two-tone "ding" sounds like a typical message alert.
//
// AudioContext can only be constructed/resumed in response to a user
// gesture; we create it lazily on the first call to playNotifSound.
let _audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (_audioCtx) return _audioCtx
  try {
    type WindowAC = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = window.AudioContext || (window as WindowAC).webkitAudioContext
    if (!Ctx) return null
    _audioCtx = new Ctx()
    return _audioCtx
  } catch {
    return null
  }
}

function playNotifSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined)
    }
    const now = ctx.currentTime
    // Two-tone chime: 880Hz (A5) → 1320Hz (E6), each ~150ms with a
    // soft attack-release envelope so it doesn't click.
    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }
    tone(880, now, 0.15)
    tone(1320, now + 0.12, 0.20)
  } catch {
    /* ignore — audio playback is best-effort */
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
