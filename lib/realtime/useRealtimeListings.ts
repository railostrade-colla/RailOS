"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createResilientSubscription } from "./_resilientChannel"

/**
 * useRealtimeListings — subscribes to *all* row events on the
 * `listings` table. The /exchange page uses this to refresh the
 * board whenever a listing is created, accepted (capacity drops),
 * or completed.
 *
 * Cheaper than fetching on every tick because we just bump a
 * counter; the page debounces its refetch via useEffect deps.
 *
 * Phase 14.10 B — routed through `createResilientSubscription` so the
 * channel auto-reconnects with exponential backoff after a network
 * blip and the tick bumps once on every successful (re)SUBSCRIBED,
 * forcing the page to re-fetch and catch anything that changed while
 * we were offline.
 *
 * Requires `listings` in `supabase_realtime` publication
 * (added by 20260504_phase10_portfolio_history.sql).
 */
export function useRealtimeListings() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const bump = () => {
      if (!cancelled) setTick((t) => t + 1)
    }

    const handle = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel("listings:all")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "listings",
            },
            bump,
          ),
      onReconnect: bump,
    })

    return () => {
      cancelled = true
      handle.teardown()
    }
  }, [])

  return { tick }
}
