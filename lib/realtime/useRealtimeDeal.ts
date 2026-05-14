"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createResilientSubscription } from "./_resilientChannel"

/**
 * useRealtimeDeal — subscribes to ALL row events (INSERT, UPDATE,
 * DELETE) on a single deal so /deals/[id] reacts to lifecycle
 * changes — accepted / rejected / expired / completed / cancelled —
 * without polling.
 *
 * Phase 13.14: upgraded from event=UPDATE to event="*" per founder
 * spec. INSERT is rare (the deal already exists when we subscribe)
 * but DELETE matters for admin force-cancel flows; covering all
 * three is future-proof and costs nothing extra.
 *
 * Phase 14.10 B — routed through `createResilientSubscription` so the
 * channel auto-reconnects with exponential backoff after a network
 * blip. The `updateCount` ticker also bumps on every successful
 * (re)SUBSCRIBED so the page re-fetches the latest deal state and
 * doesn't drift.
 *
 * Returns:
 *   • latest      — newest row payload (NEW for INSERT/UPDATE,
 *                   OLD for DELETE — matches what UI needs to react)
 *   • eventType   — last event type ("INSERT" | "UPDATE" | "DELETE")
 *   • updateCount — counter that ticks on every event; useful as a
 *                   useEffect dep to re-fetch derived data
 *
 * Requires `deals` in the supabase_realtime publication.
 */

export interface DealUpdatePayload {
  id: string
  status: string | null
  buyer_id: string | null
  seller_id: string | null
  shares_amount: number | null
  total_amount: number | null
  price_per_share: number | null
  expires_at: string | null
  updated_at: string | null
}

type DealEventType = "INSERT" | "UPDATE" | "DELETE"

export function useRealtimeDeal(dealId: string | null) {
  const [updateCount, setUpdateCount] = useState(0)
  const [latest, setLatest] = useState<DealUpdatePayload | null>(null)
  const [eventType, setEventType] = useState<DealEventType | null>(null)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    const supabase = createClient()

    const handle = createResilientSubscription({
      supabase,
      buildChannel: () =>
        supabase
          .channel(`deal:${dealId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "deals",
              filter: `id=eq.${dealId}`,
            },
            (payload) => {
              if (cancelled) return
              const row =
                payload.eventType === "DELETE"
                  ? (payload.old as DealUpdatePayload)
                  : (payload.new as DealUpdatePayload)
              setLatest(row)
              setEventType(payload.eventType as DealEventType)
              setUpdateCount((c) => c + 1)
            },
          ),
      onReconnect: () => {
        // On reconnect, bump the counter so the caller refetches the
        // deal once. Avoids drift if the row changed during the gap.
        if (!cancelled) setUpdateCount((c) => c + 1)
      },
    })

    return () => {
      cancelled = true
      handle.teardown()
    }
  }, [dealId])

  return { latest, eventType, updateCount }
}
