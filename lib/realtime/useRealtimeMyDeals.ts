"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * useRealtimeMyDeals — subscribes to all `deals` row events where the
 * current user is buyer or seller.
 *
 * The Supabase Realtime filter syntax doesn't support OR, so we open
 * two channels (one per role) and merge their tick counters. Callers
 * use `tick` as a useEffect dependency to re-fetch the list. Each
 * channel firing increments the tick.
 *
 * Requires `deals` to be in `supabase_realtime` publication
 * (added by 20260504_phase10_portfolio_history.sql).
 */
export function useRealtimeMyDeals(userId: string | null) {
  const [tick, setTick] = useState(0)
  const channelsRef = useRef<RealtimeChannel[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const supabase = createClient()

    const bump = () => {
      if (!cancelled) setTick((t) => t + 1)
    }

    const buyerChan = supabase
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
      )
      .subscribe()

    const sellerChan = supabase
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
      )
      .subscribe()

    channelsRef.current = [buyerChan, sellerChan]

    return () => {
      cancelled = true
      channelsRef.current.forEach((c) => {
        supabase.removeChannel(c).catch(() => {})
      })
      channelsRef.current = []
    }
  }, [userId])

  return { tick }
}
