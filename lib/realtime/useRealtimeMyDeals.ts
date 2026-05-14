"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createResilientSubscription } from "./_resilientChannel"

/**
 * useRealtimeMyDeals — subscribes to all `deals` row events where the
 * current user is buyer or seller.
 *
 * The Supabase Realtime filter syntax doesn't support OR, so we open
 * two channels (one per role) and merge their tick counters. Callers
 * use `tick` as a useEffect dependency to re-fetch the list. Each
 * channel firing increments the tick.
 *
 * Phase 14.10 B — routes each channel through `createResilientSubscription`
 * so network blips no longer silently kill the subscription. On every
 * successful (re)SUBSCRIBED the tick bumps so the caller refreshes its
 * cached list, catching any deals that changed while we were offline.
 *
 * Requires `deals` in `supabase_realtime` publication
 * (added by 20260504_phase10_portfolio_history.sql).
 */
export function useRealtimeMyDeals(userId: string | null) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const supabase = createClient()

    const bump = () => {
      if (!cancelled) setTick((t) => t + 1)
    }

    const buyer = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`my-deals-buyer:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "deals",
              filter: `buyer_id=eq.${userId}`,
            },
            bump,
          ),
      onReconnect: bump,
    })

    const seller = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`my-deals-seller:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "deals",
              filter: `seller_id=eq.${userId}`,
            },
            bump,
          ),
      onReconnect: bump,
    })

    return () => {
      cancelled = true
      buyer.teardown()
      seller.teardown()
    }
  }, [userId])

  return { tick }
}
