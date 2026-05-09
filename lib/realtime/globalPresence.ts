"use client"

/**
 * Global presence tracker — Phase 12.8 v2.
 *
 * Replaces the polling-based presence (which had 30-60s latency) with
 * a Supabase Realtime Presence channel. Every signed-in user `track()`s
 * themselves on the same global channel; every other client gets a
 * sync/join/leave event within ~500 ms — so the green dot flips
 * instantly on any device.
 *
 * Components subscribe via `useIsOnline(uid)` which returns a boolean
 * that updates as soon as someone joins or leaves. The DB column
 * `profiles.last_seen_at` is still bumped by the heartbeat hook so
 * the "آخر اتصال منذ X" text remains accurate for OFFLINE users.
 *
 * One singleton serves the whole app: AppLayout calls
 * `globalPresence.start(uid)` on auth and `.stop()` on logout.
 */

import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface PresenceMeta {
  user_id: string
  online_at: string
}

class GlobalPresence {
  private channel: RealtimeChannel | null = null
  private state = new Map<string, PresenceMeta>()
  private listeners = new Set<() => void>()
  private myUid: string | null = null

  /**
   * Subscribe to changes. Returns an unsubscribe function. Listeners
   * fire whenever a user joins, leaves, or after the initial `sync`.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Cheap O(1) check used inside React renders. */
  isOnline(userId: string | null | undefined): boolean {
    if (!userId) return false
    return this.state.has(userId)
  }

  /** Number of distinct users currently broadcasting on the channel. */
  get count(): number {
    return this.state.size
  }

  /**
   * Start broadcasting + listening as `uid`. Idempotent — calling
   * twice with the same uid does nothing.
   */
  async start(uid: string): Promise<void> {
    if (!uid) return
    if (this.myUid === uid && this.channel) return
    // Replacing current connection (different user signed in).
    await this.stop()
    this.myUid = uid

    const supabase = createClient()
    const channel = supabase.channel("presence:global", {
      config: { presence: { key: uid } },
    })

    // Supabase ships its presence event payloads with a generic
    // `Presence<{ [key: string]: any }>` shape that doesn't statically
    // claim our custom fields (user_id, online_at). We cast through
    // `unknown` to a local interface so TS stops complaining about
    // "may be a mistake because neither type sufficiently overlaps".
    interface JoinPayload {
      key: string
      newPresences: Array<{ user_id?: string; online_at?: string }>
    }
    interface LeavePayload {
      key: string
    }

    channel
      .on("presence", { event: "sync" }, () => {
        // Full snapshot — rebuild the map.
        const raw = channel.presenceState() as unknown as Record<
          string,
          Array<{ user_id?: string; online_at?: string }>
        >
        this.state.clear()
        for (const [key, presences] of Object.entries(raw)) {
          if (presences && presences.length > 0) {
            const p = presences[0]
            this.state.set(key, {
              user_id: p.user_id ?? key,
              online_at: p.online_at ?? new Date().toISOString(),
            })
          }
        }
        this.notify()
      })
      .on("presence", { event: "join" }, (payload) => {
        const { key, newPresences } = payload as unknown as JoinPayload
        if (newPresences && newPresences.length > 0) {
          const p = newPresences[0]
          this.state.set(key, {
            user_id: p.user_id ?? key,
            online_at: p.online_at ?? new Date().toISOString(),
          })
          this.notify()
        }
      })
      .on("presence", { event: "leave" }, (payload) => {
        const { key } = payload as unknown as LeavePayload
        if (this.state.has(key)) {
          this.state.delete(key)
          this.notify()
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({
              user_id: uid,
              online_at: new Date().toISOString(),
            })
          } catch {
            /* best-effort */
          }
        }
      })

    this.channel = channel
  }

  /** Untrack + remove channel. Safe to call when not started. */
  async stop(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.untrack()
      } catch { /* ignore */ }
      try {
        const supabase = createClient()
        await supabase.removeChannel(this.channel)
      } catch { /* ignore */ }
      this.channel = null
    }
    this.state.clear()
    this.myUid = null
    this.notify()
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l()
      } catch { /* ignore */ }
    }
  }
}

/** App-wide singleton — only one channel for the whole shell. */
export const globalPresence = new GlobalPresence()
