"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createResilientSubscription } from "./_resilientChannel"

/**
 * useRealtimeShareTransfers — Phase 14.10 B.
 *
 * Subscribes to all `share_transfers` rows where the current user is
 * either the sender or the recipient. Used on `/portfolio` so an
 * incoming transfer surfaces immediately — without this hook, the
 * recipient had to manually refresh to see new shares arrive.
 *
 * Like `useRealtimeMyDeals`, Supabase Realtime's filter grammar
 * doesn't support OR, so we open two channels and merge their tick
 * counters.
 *
 * Channels are routed through `createResilientSubscription` so a
 * network blip auto-reconnects with exponential backoff and the tick
 * bumps once on each (re)SUBSCRIBED to force a refresh.
 *
 * Requires `share_transfers` in the supabase_realtime publication.
 */
export function useRealtimeShareTransfers(userId: string | null) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const supabase = createClient()

    const bump = () => {
      if (!cancelled) setTick((t) => t + 1)
    }

    const sender = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`share-transfers-sender:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "share_transfers",
              filter: `sender_id=eq.${userId}`,
            },
            bump,
          ),
      onReconnect: bump,
    })

    const recipient = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`share-transfers-recipient:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "share_transfers",
              filter: `recipient_id=eq.${userId}`,
            },
            bump,
          ),
      onReconnect: bump,
    })

    return () => {
      cancelled = true
      sender.teardown()
      recipient.teardown()
    }
  }, [userId])

  return { tick }
}
