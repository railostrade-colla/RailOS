"use client"

/**
 * useGlobalPresenceTracker — Phase 12.8 v2.
 *
 * Boots `globalPresence` for the signed-in user, replays on auth
 * changes, and tears down on logout / unmount. Mount once in
 * AppLayout. Components consume the channel state via `useIsOnline`.
 */

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { globalPresence } from "@/lib/realtime/globalPresence"

export function useGlobalPresenceTracker() {
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const start = async (uid: string | null) => {
      if (cancelled) return
      if (uid) {
        await globalPresence.start(uid)
      } else {
        await globalPresence.stop()
      }
    }

    // 1. Initial sign-in check.
    supabase.auth.getUser().then(({ data }) => {
      void start(data?.user?.id ?? null)
    })

    // 2. React to login/logout in the same tab.
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void start(session?.user?.id ?? null)
      },
    )

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      void globalPresence.stop()
    }
  }, [])
}
