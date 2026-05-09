"use client"

/**
 * useIsOnline — Phase 12.8 v2.
 *
 * Returns true iff the given user is currently broadcasting on the
 * global presence channel. Re-renders whenever a sync/join/leave
 * event flips that bit. Latency from "تابع متصل" → "نقطة خضراء" is
 * typically < 500 ms.
 *
 * The hook only triggers a render when the relevant user's bit
 * actually changes (it doesn't re-render on every join of every
 * other random user) thanks to the `prev !== next` guard.
 */

import { useEffect, useState, useRef } from "react"
import { globalPresence } from "@/lib/realtime/globalPresence"

export function useIsOnline(userId: string | null | undefined): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    globalPresence.isOnline(userId),
  )
  // Avoid stale closure: keep the last value to compare against.
  const lastRef = useRef<boolean>(isOnline)

  useEffect(() => {
    if (!userId) {
      setIsOnline(false)
      lastRef.current = false
      return
    }

    const refresh = () => {
      const next = globalPresence.isOnline(userId)
      if (next !== lastRef.current) {
        lastRef.current = next
        setIsOnline(next)
      }
    }

    // Initial sync (in case the channel state already has them).
    refresh()
    const unsub = globalPresence.subscribe(refresh)
    return unsub
  }, [userId])

  return isOnline
}
