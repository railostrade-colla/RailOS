"use client"

/**
 * Manual-join helpers used by every admin data layer (Phase 10.41).
 *
 * Why: PostgREST's `profiles!user_id (...)` syntax fails closed when
 * the FK constraint isn't declared on the source table — it returns
 * an error and the SELECT collapses to an empty array. That's the bug
 * behind "I submitted a request but the admin panel can't see it".
 *
 * These helpers do the join client-side via two queries:
 *   1. Fetch rows from the source table (no joins).
 *   2. Fetch profiles for the unique user_ids in one batch.
 *   3. Stitch them together via Map.
 *
 * Tolerant of every failure mode — every step's error is swallowed
 * and produces an empty map rather than collapsing the whole query.
 */

import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface MinimalProfile {
  full_name: string | null
  username: string | null
  level: string | null
}

const EMPTY_PROFILE: MinimalProfile = {
  full_name: null,
  username: null,
  level: null,
}

/**
 * Fetches profiles for the given uids in one batch. Returns a Map
 * keyed by id. Missing uids → entry not in map (caller falls back to
 * EMPTY_PROFILE).
 */
export async function fetchProfilesByIds(
  uids: ReadonlyArray<string | null | undefined>,
  client?: SupabaseClient,
): Promise<Map<string, MinimalProfile>> {
  const ids = Array.from(
    new Set(uids.filter((u): u is string => Boolean(u))),
  )
  const map = new Map<string, MinimalProfile>()
  if (ids.length === 0) return map
  try {
    const sb = client ?? createClient()
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, username, level")
      .in("id", ids)
    if (error || !data) return map
    for (const p of data as Array<
      { id: string } & MinimalProfile
    >) {
      map.set(p.id, {
        full_name: p.full_name ?? null,
        username: p.username ?? null,
        level: p.level ?? null,
      })
    }
  } catch {
    // leave empty
  }
  return map
}

/** Picks a display name from a profile row, with sane fallbacks. */
export function profileDisplayName(p: MinimalProfile | null | undefined): string {
  return (
    p?.full_name?.trim() ||
    p?.username?.trim() ||
    "—"
  )
}

/** "@handle" or em-dash if no username. */
export function profileHandle(p: MinimalProfile | null | undefined): string {
  const u = p?.username?.trim()
  return u ? `@${u}` : "—"
}

/** Re-export EMPTY_PROFILE for callers that need to handle missing keys. */
export { EMPTY_PROFILE }
