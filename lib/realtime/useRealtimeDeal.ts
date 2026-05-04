"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * useRealtimeDeal — subscribes to UPDATEs on a single deal row so
 * /deals/[id] can react to status changes (accepted / rejected /
 * expired / completed) without polling.
 *
 * Returns the latest payload + a counter that ticks on every update,
 * which callers can use as a key/dep to refresh derived data.
 *
 * Requires `deals` to be in the Supabase Realtime publication (see
 * 20260504_phase10_portfolio_history.sql).
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

export function useRealtimeDeal(dealId: string | null) {
  const [updateCount, setUpdateCount] = useState(0)
  const [latest, setLatest] = useState<DealUpdatePayload | null>(null)
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
          event: "UPDATE",
          schema: "public",
          table: "deals",
          filter: `id=eq.${dealId}`,
        },
        (payload) => {
          if (cancelled) return
          setLatest(payload.new as DealUpdatePayload)
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

  return { latest, updateCount }
}
