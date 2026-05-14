"use client"

/**
 * Resilient realtime channel helper (Phase 14.10 B).
 *
 * Wraps the Supabase Realtime `.subscribe()` callback with the same
 * health-tracking + exponential-backoff reconnect pattern Phase 14.09
 * introduced in `hooks/useNotifications.ts`. Every realtime hook in
 * `lib/realtime/*` should route its channel subscription through this
 * helper so:
 *
 *   • Channel close / timeout / error → schedule a reconnect with
 *     backoff (2s, 4s, 8s, 16s, capped at 30s).
 *   • On a successful re-SUBSCRIBED → reset the backoff and fire an
 *     optional `onReconnect()` callback so the caller can refresh
 *     any cached data that may have changed while we were offline.
 *   • CLOSED is treated as the expected unmount path — no reconnect
 *     is scheduled.
 *
 * The helper returns a stable handle:
 *
 *   const { teardown } = createResilientSubscription(...)
 *
 * Call `teardown()` from the useEffect cleanup. It cancels any
 * pending reconnect timer and removes the channel.
 *
 * Usage:
 *
 *   useEffect(() => {
 *     const supabase = createClient()
 *     const handle = createResilientSubscription({
 *       supabase,
 *       buildChannel: () =>
 *         supabase
 *           .channel("my-channel")
 *           .on("postgres_changes", { ... }, (payload) => { ... }),
 *       onReconnect: () => void refreshSomething(),
 *     })
 *     return () => handle.teardown()
 *   }, [...])
 */

import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js"

interface CreateResilientSubscriptionInput {
  supabase: SupabaseClient
  /** Build (but don't yet subscribe to) a channel each time we
   *  (re)connect. Receives no args; should call `.channel(name)` +
   *  `.on(...)` and return the resulting channel. The helper calls
   *  `.subscribe(status => ...)` itself. */
  buildChannel: () => RealtimeChannel
  /** Optional: called after a successful (re)SUBSCRIBED. The first
   *  ever subscribe also triggers this — useful for catching events
   *  that arrived between mount and the WS handshake. Pass `null` /
   *  omit if not needed. */
  onReconnect?: () => void | Promise<void>
}

export interface ResilientSubscriptionHandle {
  /** Tear down the current channel + cancel any pending reconnect.
   *  Safe to call multiple times. */
  teardown: () => void
}

export function createResilientSubscription(
  input: CreateResilientSubscriptionInput,
): ResilientSubscriptionHandle {
  const { supabase, buildChannel, onReconnect } = input

  let currentChannel: RealtimeChannel | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let cancelled = false

  const closeCurrent = () => {
    if (currentChannel) {
      try {
        supabase.removeChannel(currentChannel)
      } catch {
        /* ignore */
      }
      currentChannel = null
    }
  }

  const open = () => {
    if (cancelled) return
    closeCurrent()
    const ch = buildChannel()
    currentChannel = ch
    ch.subscribe((status) => {
      if (cancelled) return
      if (status === "SUBSCRIBED") {
        reconnectAttempt = 0
        if (onReconnect) {
          try {
            void onReconnect()
          } catch {
            /* ignore */
          }
        }
        return
      }
      if (status === "CLOSED") {
        // Expected — usually our own teardown.
        return
      }
      // CHANNEL_ERROR / TIMED_OUT — schedule a reconnect.
      closeCurrent()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      const delay = Math.min(30_000, 2_000 * Math.pow(2, reconnectAttempt))
      reconnectAttempt += 1
      reconnectTimer = setTimeout(() => {
        if (!cancelled) open()
      }, delay)
    })
  }

  open()

  return {
    teardown: () => {
      cancelled = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      closeCurrent()
    },
  }
}
