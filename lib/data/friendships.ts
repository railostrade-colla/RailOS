"use client"

/**
 * Friendships — DB-backed data layer (Phase 6.3).
 *
 * Wraps friend_requests + friendships tables created by
 * 20260503_phase6_friendships_schema.sql. Mutations go through
 * SECURITY DEFINER RPCs:
 *   - send_friend_request
 *   - respond_to_friend_request
 *   - cancel_friend_request
 *   - unfriend
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface DBFriendRequest {
  id: string
  sender_id: string
  recipient_id: string
  other_user_id: string
  other_user_name: string
  other_user_avatar: string
  direction: "incoming" | "outgoing"
  status: "pending" | "accepted" | "declined" | "cancelled"
  message?: string | null
  created_at: string
}

export interface DBFriend {
  id: string // friendship row id
  user_id: string // the OTHER user
  user_name: string
  avatar_initial: string
  level: "basic" | "advanced" | "pro"
  is_verified: boolean
  total_trades: number
  success_rate: number
  trust_score: number
  since: string // friendship.created_at
}

interface ProfileRef {
  id?: string | null
  full_name?: string | null
  username?: string | null
  level?: string | null
  kyc_status?: string | null
  total_trades?: number | null
  successful_trades?: number | null
  rating_average?: number | string | null
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function levelKind(s: string | null | undefined): "basic" | "advanced" | "pro" {
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function avatarInitial(name: string | null | undefined): string {
  return (name?.trim().charAt(0) || "?").toUpperCase()
}

function profileToFriend(
  friendshipId: string,
  since: string,
  p: ProfileRef | null,
): DBFriend {
  const name =
    p?.full_name?.trim() || p?.username?.trim() || "—"
  const totalTrades = num(p?.total_trades)
  const successful = num(p?.successful_trades)
  const rate =
    totalTrades > 0 ? Math.round((successful / totalTrades) * 100) : 0
  return {
    id: friendshipId,
    user_id: p?.id ?? "",
    user_name: name,
    avatar_initial: avatarInitial(name),
    level: levelKind(p?.level),
    is_verified: p?.kyc_status === "approved",
    total_trades: totalTrades,
    success_rate: rate,
    trust_score: Math.round(num(p?.rating_average) * 20),
    since,
  }
}

// ─── Reads ───────────────────────────────────────────────────

export async function getMyFriends(): Promise<DBFriend[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // Phase 13.52 — split the FK embed into a two-query pattern.
    // PostgREST's `profiles!user_id_a` embed reads the underlying
    // `profiles` table, which is now strict-RLS (Phase 13.50). For
    // a regular user, that returns NULL for the OTHER user's row,
    // so names/levels came back as "—". The fix: fetch friendships
    // first, then batch-fetch the safe profile fields from
    // `profiles_public` for all peer user_ids in one round-trip.
    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("id, user_id_a, user_id_b, created_at")
      .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`)
      .order("created_at", { ascending: false })

    if (error || !friendships || friendships.length === 0) return []

    interface FriendshipRow {
      id: string
      user_id_a: string
      user_id_b: string
      created_at: string
    }
    const rows = friendships as FriendshipRow[]

    const peerIds = Array.from(new Set(
      rows.map((r) => r.user_id_a === user.id ? r.user_id_b : r.user_id_a)
        .filter(Boolean)
    ))

    const profileMap = new Map<string, ProfileRef>()
    if (peerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, full_name, username, level, kyc_status, total_trades, successful_trades, rating_average")
        .in("id", peerIds)
      for (const p of (profiles ?? []) as ProfileRef[]) {
        if (p.id) profileMap.set(p.id, p)
      }
    }

    return rows.map((r) => {
      const otherId = r.user_id_a === user.id ? r.user_id_b : r.user_id_a
      const other = profileMap.get(otherId) ?? null
      return profileToFriend(r.id, r.created_at, other)
    })
  } catch {
    return []
  }
}

export interface FriendRequestsBucket {
  incoming: DBFriendRequest[]
  outgoing: DBFriendRequest[]
}

export async function getMyFriendRequests(): Promise<FriendRequestsBucket> {
  const empty: FriendRequestsBucket = { incoming: [], outgoing: [] }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return empty

    // Phase 13.52 — same split-pattern as getMyFriends. The previous
    // `sender:profiles!sender_id (...)` embed silently returned NULL
    // for the OTHER party under strict RLS, so the requests card
    // showed "—" with no avatar. Switching to a two-step
    // friend_requests → profiles_public batch lookup fixes both
    // sides (incoming + outgoing).
    const { data, error } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status, message, created_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error || !data) return empty

    interface Row {
      id: string
      sender_id: string
      recipient_id: string
      status: "pending" | "accepted" | "declined" | "cancelled"
      message?: string | null
      created_at: string
    }
    const rows = data as Row[]
    if (rows.length === 0) return empty

    // Collect every peer id, batch-fetch their public profile.
    const peerIds = Array.from(new Set(
      rows.flatMap((r) =>
        [r.sender_id, r.recipient_id].filter((id) => id && id !== user.id)
      )
    ))

    const profileMap = new Map<string, ProfileRef>()
    if (peerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, full_name, username, level, kyc_status")
        .in("id", peerIds)
      for (const p of (profiles ?? []) as ProfileRef[]) {
        if (p.id) profileMap.set(p.id, p)
      }
    }

    const incoming: DBFriendRequest[] = []
    const outgoing: DBFriendRequest[] = []

    for (const r of rows) {
      const isIncoming = r.recipient_id === user.id
      const otherId = isIncoming ? r.sender_id : r.recipient_id
      const other = profileMap.get(otherId) ?? null
      const name =
        other?.full_name?.trim() || other?.username?.trim() || "—"
      const entry: DBFriendRequest = {
        id: r.id,
        sender_id: r.sender_id,
        recipient_id: r.recipient_id,
        other_user_id: other?.id ?? otherId,
        other_user_name: name,
        other_user_avatar: avatarInitial(name),
        direction: isIncoming ? "incoming" : "outgoing",
        status: r.status,
        message: r.message ?? null,
        created_at: r.created_at,
      }
      if (isIncoming) incoming.push(entry)
      else outgoing.push(entry)
    }
    return { incoming, outgoing }
  } catch {
    return empty
  }
}

/** Fast lookup of "is the current user friends with X?" for the
 *  community list. Returns a Set of `other_user_id`s. */
export async function getFriendIdSet(): Promise<Set<string>> {
  const friends = await getMyFriends()
  return new Set(friends.map((f) => f.user_id).filter(Boolean))
}

/** Set of users I have a pending OUTGOING request to. */
export async function getOutgoingPendingSet(): Promise<Set<string>> {
  const { outgoing } = await getMyFriendRequests()
  return new Set(outgoing.map((r) => r.recipient_id))
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface FriendsRpcResult {
  success: boolean
  reason?: string
  error?: string
  request_id?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<FriendsRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg) ||
        /relation .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      request_id?: string
    }
    if (!result.success) {
      return { success: false, reason: result.error ?? "unknown" }
    }
    return { success: true, request_id: result.request_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function sendFriendRequest(
  recipientId: string,
  message?: string,
): Promise<FriendsRpcResult> {
  return callRpc("send_friend_request", {
    p_recipient_id: recipientId,
    p_message: message ?? null,
  })
}

export async function respondToFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<FriendsRpcResult> {
  return callRpc("respond_to_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  })
}

export async function cancelFriendRequest(
  requestId: string,
): Promise<FriendsRpcResult> {
  return callRpc("cancel_friend_request", {
    p_request_id: requestId,
  })
}

export async function unfriend(
  otherUserId: string,
): Promise<FriendsRpcResult> {
  return callRpc("unfriend", {
    p_other_user_id: otherUserId,
  })
}
