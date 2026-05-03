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

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
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

    // friendships are canonicalized (user_a < user_b); pull both columns
    // and select the OTHER profile from each row.
    const { data, error } = await supabase
      .from("friendships")
      .select(
        `id, user_id_a, user_id_b, created_at,
         a:profiles!user_id_a (
           id, full_name, username, level, kyc_status,
           total_trades, successful_trades, rating_average
         ),
         b:profiles!user_id_b (
           id, full_name, username, level, kyc_status,
           total_trades, successful_trades, rating_average
         )`,
      )
      .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      user_id_a: string
      user_id_b: string
      created_at: string
      a?: ProfileRef | ProfileRef[] | null
      b?: ProfileRef | ProfileRef[] | null
    }

    return (data as Row[]).map((r) => {
      const other = r.user_id_a === user.id ? unwrap(r.b) : unwrap(r.a)
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

    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        `id, sender_id, recipient_id, status, message, created_at,
         sender:profiles!sender_id ( id, full_name, username ),
         recipient:profiles!recipient_id ( id, full_name, username )`,
      )
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
      sender?: ProfileRef | ProfileRef[] | null
      recipient?: ProfileRef | ProfileRef[] | null
    }

    const incoming: DBFriendRequest[] = []
    const outgoing: DBFriendRequest[] = []

    for (const r of data as Row[]) {
      const isIncoming = r.recipient_id === user.id
      const other = unwrap(isIncoming ? r.sender : r.recipient)
      const name =
        other?.full_name?.trim() || other?.username?.trim() || "—"
      const entry: DBFriendRequest = {
        id: r.id,
        sender_id: r.sender_id,
        recipient_id: r.recipient_id,
        other_user_id: other?.id ?? "",
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
