"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

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
 * Returns:
 *   • latest      — newest row payload (NEW for INSERT/UPDATE,
 *                   OLD for DELETE — matches what UI needs to react)
 *   • eventType   — last event type ("INSERT" | "UPDATE" | "DELETE")
 *   • updateCount — counter that ticks on every event; useful as a
 *                   useEffect dep to re-fetch derived data
 *
 * Requires `deals` in the supabase_realtime publication. Cleans up
 * its channel on unmount, so leaving the page releases the socket.
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
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    const supabase = createClient()

    const channel = supabase
      .channel(`deal:${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT / UPDATE / DELETE
          schema: "public",
          table: "deals",
          filter: `id=eq.${dealId}`,
        },
        (payload) => {
          if (cancelled) return
          // For DELETE, payload.new is empty — fall back to OLD so
          // callers always get a non-null row to work with.
          const row =
            payload.eventType === "DELETE"
              ? (payload.old as DealUpdatePayload)
              : (payload.new as DealUpdatePayload)
          setLatest(row)
          setEventType(payload.eventType as DealEventType)
          setUpdateCount((c) => c + 1)
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
  }, [dealId])

  return { latest, eventType, updateCount }
}
