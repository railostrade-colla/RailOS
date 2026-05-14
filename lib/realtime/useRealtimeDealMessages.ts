"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createResilientSubscription } from "./_resilientChannel"

/**
 * useRealtimeDealMessages — Phase 14.10 B.
 *
 * Subscribes to all INSERT/UPDATE/DELETE events on the
 * `deal_messages` table for a single deal so the deal-chat surface
 * inside `/deals/[id]` reflects new messages instantly without
 * polling.
 *
 * Returned `tick` is a counter the caller uses as a useEffect
 * dependency to re-fetch the message list. Each row event bumps
 * the tick once; the resilient subscription also bumps on every
 * (re)SUBSCRIBED so messages received during a brief disconnect
 * still surface as soon as the channel is back.
 *
 * Requires `deal_messages` in the supabase_realtime publication.
 * (Add it via Supabase dashboard if it isn't already — Phase 14.10 B
 * does NOT touch the DB.)
 */
export function useRealtimeDealMessages(dealId: string | null) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    const supabase = createClient()

    const bump = () => {
      if (!cancelled) setTick((t) => t + 1)
    }

    const handle = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`deal-messages:${dealId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "deal_messages",
              filter: `deal_id=eq.${dealId}`,
            },
            bump,
          ),
      onReconnect: bump,
    })

    return () => {
      cancelled = true
      handle.teardown()
    }
  }, [dealId])

  return { tick }
}
