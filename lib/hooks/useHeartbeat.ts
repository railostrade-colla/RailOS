"use client"

/**
 * useHeartbeat — Phase 12.8.
 *
 * Bumps profiles.last_seen_at every 30s while the user has the tab
 * visible. Pauses on hidden tabs (battery), pings immediately when
 * the tab becomes visible again, and pings on focus.
 *
 * Mount once in AppLayout. The hook does nothing until the user is
 * authenticated, then takes over silently.
 */

import { useEffect } from "react"
import { touchMyLastSeen } from "@/lib/data/presence"
import { createClient } from "@/lib/supabase/client"

const HEARTBEAT_INTERVAL_MS = 30_000

export function useHeartbeat() {
  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let signedIn = false

    const supabase = createClient()

    const startBeating = () => {
      if (intervalId) return
      // Immediate first ping so the column reflects "online" without
      // waiting 30s.
      void touchMyLastSeen()
      intervalId = setInterval(() => {
        if (document.visibilityState !== "visible") return
        void touchMyLastSeen()
      }, HEARTBEAT_INTERVAL_MS)
    }

    const stopBeating = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const onVisibility = () => {
      if (!signedIn) return
      if (document.visibilityState === "visible") {
        void touchMyLastSeen()
      }
    }

    const onFocus = () => {
      if (signedIn) void touchMyLastSeen()
    }

    // 1. Initial check — only beat if signed in.
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data?.user?.id) {
        signedIn = true
        startBeating()
      }
    })

    // 2. React to auth state changes (login/logout in same tab).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (session?.user) {
        signedIn = true
        startBeating()
      } else {
        signedIn = false
        stopBeating()
      }
    })

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      stopBeating()
      sub.subscription.unsubscribe()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
    }
  }, [])
}
