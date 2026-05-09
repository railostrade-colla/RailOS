"use client"

/**
 * User-presence data layer (Phase 12.8).
 *
 * Each authenticated client calls touchMyLastSeen() every ~30s while
 * the tab is visible. Reading another user's presence returns:
 *   { last_seen_at, is_online, seconds_ago }
 *
 * is_online is server-computed (last_seen within 90s) so clock skew
 * between devices doesn't muddy the UX.
 */

import { createClient } from "@/lib/supabase/client"

export interface UserPresence {
  last_seen_at: string | null
  is_online: boolean
  seconds_ago: number | null
}

const ZERO: UserPresence = {
  last_seen_at: null,
  is_online: false,
  seconds_ago: null,
}

// ─── Heartbeat ────────────────────────────────────────────────────

export async function touchMyLastSeen(): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.rpc("touch_my_last_seen")
  } catch {
    // best-effort — never block UI
  }
}

// ─── Single-user read ─────────────────────────────────────────────

export async function getUserPresence(
  userId: string,
): Promise<UserPresence> {
  if (!userId) return ZERO
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_user_presence", {
      p_user_id: userId,
    })
    if (error || !data) return ZERO
    const result = data as UserPresence
    return {
      last_seen_at: result.last_seen_at ?? null,
      is_online: !!result.is_online,
      seconds_ago:
        result.seconds_ago != null ? Number(result.seconds_ago) : null,
    }
  } catch {
    return ZERO
  }
}

// ─── Batch read ───────────────────────────────────────────────────

export async function getUsersPresence(
  userIds: string[],
): Promise<Record<string, UserPresence>> {
  if (!userIds || userIds.length === 0) return {}
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_users_presence", {
      p_user_ids: userIds,
    })
    if (error || !data) return {}
    return data as Record<string, UserPresence>
  } catch {
    return {}
  }
}

// ─── Format helpers ──────────────────────────────────────────────

/**
 * Returns a short Arabic phrase like "متّصل الآن" / "منذ ٣ د" /
 * "منذ ٢ س" / "أمس" / "غير متصل" for use in the presence chip.
 */
export function formatPresence(p: UserPresence | null | undefined): string {
  if (!p) return "غير متصل"
  if (p.is_online) return "متّصل الآن"
  const sec = p.seconds_ago
  if (sec == null) return "غير متصل"
  if (sec < 60) return "قبل لحظات"
  if (sec < 60 * 60) {
    const m = Math.floor(sec / 60)
    return `قبل ${m} د`
  }
  if (sec < 60 * 60 * 24) {
    const h = Math.floor(sec / 3600)
    return `قبل ${h} س`
  }
  if (sec < 60 * 60 * 24 * 2) return "أمس"
  const d = Math.floor(sec / 86400)
  if (d < 7) return `قبل ${d} أيّام`
  return "غير متصل"
}
