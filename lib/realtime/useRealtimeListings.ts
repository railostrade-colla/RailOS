"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * useRealtimeListings — subscribes to *all* row events on the
 * `listings` table. The /exchange page uses this to refresh the
 * board whenever a listing is created, accepted (capacity drops),
 * or completed.
 *
 * Cheaper than fetching on every tick because we just bump a
 * counter; the page debounces its refetch via useEffect deps.
 *
 * Requires `listings` to be in `supabase_realtime` publication
 * (added by 20260504_phase10_portfolio_history.sql).
 */
export function useRealtimeListings() {
  const [tick, setTick] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const channel = supabase
      .channel("listings:all")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
        },
        () => {
          if (!cancelled) setTick((t) => t + 1)
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
  }, [])

  return { tick }
}
