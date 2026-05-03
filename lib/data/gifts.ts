"use client"

/**
 * Gifts data layer (Phase 9.6).
 *
 * Generic admin-granted gift system. Currently only `free_contract`
 * is wired through end-to-end (waives the 10% end-fee on a
 * partnership contract).
 *
 * Wraps:
 *   - admin_grant_gift (admin only)
 *   - admin_revoke_gift (admin only)
 *   - redeem_free_contract_gift (user)
 *
 * Plus simple SELECTs for the user's gift inbox + the admin list.
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export type GiftType = "free_contract"
// Future: | "fee_units" | "fee_discount" | ...

export interface UserGiftRow {
  id: string
  user_id: string
  user_name: string
  gift_type: GiftType | string
  gift_value: Record<string, unknown> | null
  is_used: boolean
  used_at: string | null
  used_target_id: string | null
  expires_at: string | null
  granted_by: string | null
  granted_by_name: string | null
  granted_reason: string | null
  created_at: string
  status: "active" | "used" | "expired"
}

export interface GiftRpcResult {
  success: boolean
  reason?: string
  error?: string
  gift_id?: string
  contract_id?: string
}

// ─── Helpers ─────────────────────────────────────────────────

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}

function profileName(p: ProfileRef | null | undefined): string {
  return p?.full_name?.trim() || p?.username?.trim() || "—"
}

function computeStatus(row: {
  is_used: boolean
  expires_at: string | null
}): UserGiftRow["status"] {
  if (row.is_used) return "used"
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return "expired"
  }
  return "active"
}

interface RawGiftRow {
  id: string
  user_id: string
  gift_type: string
  gift_value: Record<string, unknown> | null
  is_used: boolean
  used_at: string | null
  used_target_id: string | null
  expires_at: string | null
  granted_by: string | null
  granted_reason: string | null
  created_at: string
  user?: ProfileRef | ProfileRef[] | null
  granter?: ProfileRef | ProfileRef[] | null
}

function mapGiftRow(r: RawGiftRow): UserGiftRow {
  return {
    id: r.id,
    user_id: r.user_id,
    user_name: profileName(unwrap(r.user)),
    gift_type: r.gift_type,
    gift_value: r.gift_value,
    is_used: r.is_used,
    used_at: r.used_at,
    used_target_id: r.used_target_id,
    expires_at: r.expires_at,
    granted_by: r.granted_by,
    granted_by_name: r.granted_by ? profileName(unwrap(r.granter)) : null,
    granted_reason: r.granted_reason,
    created_at: r.created_at,
    status: computeStatus(r),
  }
}

// ─── User-side reads ────────────────────────────────────────

export async function getMyUnusedGifts(
  giftType?: GiftType,
): Promise<UserGiftRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
      .from("user_gifts")
      .select(
        `id, user_id, gift_type, gift_value, is_used, used_at,
         used_target_id, expires_at, granted_by, granted_reason, created_at,
         user:profiles!user_id ( full_name, username ),
         granter:profiles!granted_by ( full_name, username )`,
      )
      .eq("user_id", user.id)
      .eq("is_used", false)
      .order("created_at", { ascending: false })

    if (giftType) query = query.eq("gift_type", giftType)

    const { data, error } = await query
    if (error || !data) return []

    const now = Date.now()
    return (data as RawGiftRow[])
      .map(mapGiftRow)
      .filter(
        (g) =>
          g.expires_at == null || new Date(g.expires_at).getTime() > now,
      )
  } catch {
    return []
  }
}

export async function hasUnusedGift(giftType: GiftType): Promise<boolean> {
  const list = await getMyUnusedGifts(giftType)
  return list.length > 0
}

// ─── Admin-side reads ───────────────────────────────────────

export async function getAllUserGifts(): Promise<UserGiftRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("user_gifts")
      .select(
        `id, user_id, gift_type, gift_value, is_used, used_at,
         used_target_id, expires_at, granted_by, granted_reason, created_at,
         user:profiles!user_id ( full_name, username ),
         granter:profiles!granted_by ( full_name, username )`,
      )
      .order("created_at", { ascending: false })
      .limit(200)

    if (error || !data) return []
    return (data as RawGiftRow[]).map(mapGiftRow)
  } catch {
    return []
  }
}

export interface UserSearchRow {
  id: string
  display_name: string
}

export async function searchUsersForGift(query: string): Promise<UserSearchRow[]> {
  if (!query || query.trim().length < 2) return []
  try {
    const supabase = createClient()
    const q = `%${query.trim()}%`
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .or(`full_name.ilike.${q},username.ilike.${q}`)
      .limit(10)

    if (error || !data) return []
    return (data as Array<{ id: string; full_name: string | null; username: string | null }>)
      .map((p) => ({
        id: p.id,
        display_name: p.full_name?.trim() || p.username?.trim() || p.id.slice(0, 8),
      }))
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<GiftRpcResult> {
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
      gift_id?: string
      contract_id?: string
    }
    if (!result.success) {
      return { success: false, reason: result.error ?? "unknown" }
    }
    return {
      success: true,
      gift_id: result.gift_id,
      contract_id: result.contract_id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminGrantGift(input: {
  user_id: string
  gift_type: string
  reason?: string
  expires_at?: string | null
  gift_value?: Record<string, unknown>
}): Promise<GiftRpcResult> {
  return callRpc("admin_grant_gift", {
    p_user_id: input.user_id,
    p_gift_type: input.gift_type,
    p_reason: input.reason ?? null,
    p_expires_at: input.expires_at ?? null,
    p_gift_value: input.gift_value ?? null,
  })
}

export async function adminRevokeGift(giftId: string): Promise<GiftRpcResult> {
  return callRpc("admin_revoke_gift", { p_gift_id: giftId })
}

export async function redeemFreeContractGift(
  contractId: string,
): Promise<GiftRpcResult> {
  return callRpc("redeem_free_contract_gift", { p_contract_id: contractId })
}
