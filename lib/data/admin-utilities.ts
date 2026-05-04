"use client"

/**
 * Admin utilities data layer (Phase 10.1+).
 *
 * Wraps the cleanup + dashboard + role-management RPCs added in
 * 20260504_phase10_hardening.sql:
 *   - cleanup_expired_share_codes
 *   - expire_stale_share_transfers
 *   - clear_stale_notification_locks
 *   - get_dashboard_stats
 *   - admin_set_user_role
 *   - admin_freeze_project_wallet / admin_unfreeze_project_wallet
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface DashboardStats {
  users: number
  projects: number
  active_projects: number
  total_deals: number
  pending_deals: number
  open_disputes: number
  pending_kyc: number
  pending_fee_requests: number
  active_auctions: number
  active_contracts: number
}

export interface UtilityRpcResult {
  success: boolean
  reason?: string
  error?: string
  deleted?: number
  expired?: number
  cleared?: number
  frozen?: number
  unfrozen?: number
}

async function callRpc(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<UtilityRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as UtilityRpcResult
    if (!result.success) {
      return { success: false, reason: result.reason ?? (result as { error?: string }).error ?? "unknown" }
    }
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Reads ───────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_dashboard_stats")
    if (error || !data) return null
    const r = data as Partial<DashboardStats> & { error?: string }
    if (r.error) return null
    return {
      users: r.users ?? 0,
      projects: r.projects ?? 0,
      active_projects: r.active_projects ?? 0,
      total_deals: r.total_deals ?? 0,
      pending_deals: r.pending_deals ?? 0,
      open_disputes: r.open_disputes ?? 0,
      pending_kyc: r.pending_kyc ?? 0,
      pending_fee_requests: r.pending_fee_requests ?? 0,
      active_auctions: r.active_auctions ?? 0,
      active_contracts: r.active_contracts ?? 0,
    }
  } catch {
    return null
  }
}

// ─── Cleanup RPCs ────────────────────────────────────────────

export async function cleanupExpiredShareCodes(): Promise<UtilityRpcResult> {
  return callRpc("cleanup_expired_share_codes")
}

export async function expireStaleShareTransfers(): Promise<UtilityRpcResult> {
  return callRpc("expire_stale_share_transfers")
}

export async function clearStaleNotificationLocks(): Promise<UtilityRpcResult> {
  return callRpc("clear_stale_notification_locks")
}

// ─── Role management ─────────────────────────────────────────

export async function adminSetUserRole(
  userId: string,
  role: "user" | "admin" | "super_admin" | "ambassador",
): Promise<UtilityRpcResult> {
  return callRpc("admin_set_user_role", { p_user_id: userId, p_role: role })
}

// ─── Project wallet freeze ──────────────────────────────────

export async function adminFreezeProjectWallet(
  walletId: string,
): Promise<UtilityRpcResult> {
  return callRpc("admin_freeze_project_wallet", { p_wallet_id: walletId })
}

export async function adminUnfreezeProjectWallet(
  walletId: string,
): Promise<UtilityRpcResult> {
  return callRpc("admin_unfreeze_project_wallet", { p_wallet_id: walletId })
}

// ─── Admin role checks (Phase 10.12) ────────────────────────────

/** Calls the `is_admin()` SQL helper. Returns false on any failure. */
export async function isAdminDB(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("is_admin")
    if (error || data == null) return false
    return Boolean(data)
  } catch {
    return false
  }
}

export type ProfileRole = "user" | "admin" | "super_admin" | string

/** Reads the caller's profile.role. Returns null if not authenticated. */
export async function getMyRole(): Promise<ProfileRole | null> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user?.id) return null
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle()
    if (error || !data) return null
    return (data as { role: ProfileRole }).role
  } catch {
    return null
  }
}

export async function isSuperAdminDB(): Promise<boolean> {
  const role = await getMyRole()
  return role === "super_admin"
}
