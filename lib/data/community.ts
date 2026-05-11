"use client"

/**
 * Community data layer (Phase H).
 *
 * Drives the user-discovery list on /community. Reads from
 * `user_stats_view` (created in migration 10-levels-system) when
 * available, falling back to a plain `profiles` query on databases
 * where that migration hasn't been applied.
 *
 * Out of scope for this phase:
 *   • friendships / follows between users — no table exists yet, the
 *     page keeps a client-side Set so the "+إضافة" button still works.
 *   • chat threads — no `chats` table either.
 */

import { createClient } from "@/lib/supabase/client"

/** Shape consumed by the /community page (mirrors the legacy mock). */
export interface CommunityUserRow {
  id: string
  name: string
  level: "basic" | "advanced" | "pro"
  total_trades: number
  success_rate: number
  trust_score: number
  is_verified: boolean
}

interface ViewRow {
  id: string
  display_name: string | null
  level: string | null
  kyc_status: string | null
  total_trades: number | null
  success_rate: number | string | null
  rating_average: number | string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
  level: string | null
  kyc_status: string | null
  total_trades: number | null
  successful_trades: number | null
  rating_average: number | string | null
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function levelKind(s: string | null): "basic" | "advanced" | "pro" {
  // The DB enum has 4 values (basic|advanced|pro|elite); the community
  // page only renders 3 — collapse `elite` to `pro` for display purposes.
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function viewRowToCommunity(row: ViewRow): CommunityUserRow {
  const rating = num(row.rating_average)
  return {
    id: row.id,
    name: (row.display_name ?? "—").trim() || "—",
    level: levelKind(row.level),
    total_trades: num(row.total_trades),
    success_rate: Math.round(num(row.success_rate)),
    // Same naive 5★→100 mapping used in lib/data/profile.ts.
    trust_score: Math.round(rating * 20),
    is_verified: row.kyc_status === "approved",
  }
}

function profileRowToCommunity(row: ProfileRow): CommunityUserRow {
  const totalTrades = num(row.total_trades)
  const successful = num(row.successful_trades)
  const rate = totalTrades > 0 ? Math.round((successful / totalTrades) * 100) : 0
  const rating = num(row.rating_average)
  return {
    id: row.id,
    name:
      row.full_name?.trim() ||
      row.username?.trim() ||
      "—",
    level: levelKind(row.level),
    total_trades: totalTrades,
    success_rate: rate,
    trust_score: Math.round(rating * 20),
    is_verified: row.kyc_status === "approved",
  }
}

/**
 * Fetch up to `limit` registered users for the community discovery list.
 *
 * Phase 13.51 — primary path is the `get_community_users` RPC which:
 *   • bypasses RLS via SECURITY DEFINER (works under the strict
 *     profiles policy added in 13.50)
 *   • adapts to schema drift (returns stable shape regardless of
 *     which optional columns the DB has)
 *   • filters banned + inactive accounts + the caller themselves
 *   • orders by created_at DESC (newest sign-ups first)
 *
 * Two fallbacks for legacy DBs (no Phase 13.50/13.51 yet):
 *   1. `profiles_public` view (Phase 13.50 only)
 *   2. `user_stats_view` (pre-13.50)
 *
 * Each path logs to console on failure so the founder can diagnose.
 */
export async function getCommunityUsers(
  limit: number = 500,
): Promise<CommunityUserRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const myId = user?.id ?? null

    // ─── Primary: SECURITY DEFINER RPC ────────────────────────────
    try {
      const { data, error } = await supabase.rpc("get_community_users", {
        p_limit: limit,
      })
      if (!error && Array.isArray(data)) {
        return (data as ProfileRow[]).map(profileRowToCommunity)
      }
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[community] get_community_users RPC:", error.message)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[community] RPC threw:", err)
    }

    // ─── Fallback 1: profiles_public view (Phase 13.50) ───────────
    try {
      let q = supabase
        .from("profiles_public")
        .select(
          "id, full_name, username, level, kyc_status, total_trades, successful_trades, rating_average, created_at",
        )
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(limit)
      if (myId) q = q.neq("id", myId)
      const { data, error } = await q

      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as ProfileRow[]).map(profileRowToCommunity)
      }
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[community] profiles_public read:", error.message)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[community] profiles_public threw:", err)
    }

    // ─── Fallback 2: legacy user_stats_view ───────────────────────
    try {
      let q = supabase
        .from("user_stats_view")
        .select(
          "id, display_name, level, kyc_status, total_trades, success_rate, rating_average",
        )
        .order("rating_average", { ascending: false, nullsFirst: false })
        .limit(limit)
      if (myId) q = q.neq("id", myId)
      const { data, error } = await q

      if (!error && data) {
        return (data as ViewRow[]).map(viewRowToCommunity)
      }
    } catch {
      /* falls through — return empty */
    }

    return []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[community] getCommunityUsers threw:", err)
    return []
  }
}
