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

// ─── Release shares to market (Phase 10.17) ────────────────────

export interface ReleaseSharesResult {
  success: boolean
  reason?: string
  error?: string
  amount?: number
  available?: number
  reserve_remaining?: number
  offering_total?: number
}

/** Move shares from a project's reserve wallet to its offering wallet. */
export async function adminReleaseSharesToMarket(
  projectId: string,
  amount: number,
  reason?: string,
): Promise<ReleaseSharesResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, reason: "invalid_amount" }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_release_shares_to_market", {
      p_project_id: projectId,
      p_amount: amount,
      p_reason: reason ?? null,
    })
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
    const result = (data ?? {}) as ReleaseSharesResult
    if (!result.success) {
      return {
        success: false,
        reason: result.reason ?? result.error ?? "unknown",
        available: result.available,
      }
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

// ─── User stats (Phase 10.32) ───────────────────────────────────

/**
 * Shape returned by the `get_user_stats(user_id)` RPC.
 * Defensive against missing source tables — every count defaults to 0
 * server-side, so the consumer can rely on every field being present.
 */
export interface UserStatsRpc {
  id: string
  display_name: string
  level: string
  kyc_status: string
  role: string
  total_trades: number
  successful_trades: number
  failed_trades: number
  cancelled_trades: number
  total_trade_volume: number
  success_rate: number
  disputes_total: number
  disputes_won: number
  disputes_lost: number
  dispute_rate: number
  reports_received: number
  reports_against_others: number
  rating_average: number
  rating_count: number
  days_active: number
  account_age_days: number
  first_trade_at: string | null
  last_trade_at: string | null
  created_at: string
  last_seen_at: string | null
}

/**
 * Calls the `get_user_stats(p_user_id)` RPC. Returns null on any
 * failure (missing migration, RLS denial, user-not-found, …).
 * The UserStatsPanel falls back to a zero-state from the community
 * row when this returns null.
 */
export async function getUserStats(userId: string): Promise<UserStatsRpc | null> {
  if (!userId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_user_stats", { p_user_id: userId })
    if (error || !data) return null
    const r = data as Partial<UserStatsRpc> & { error?: string }
    if (r.error) return null
    if (!r.id) return null
    return {
      id: r.id,
      display_name: r.display_name ?? "User",
      level: r.level ?? "basic",
      kyc_status: r.kyc_status ?? "basic",
      role: r.role ?? "user",
      total_trades: r.total_trades ?? 0,
      successful_trades: r.successful_trades ?? 0,
      failed_trades: r.failed_trades ?? 0,
      cancelled_trades: r.cancelled_trades ?? 0,
      total_trade_volume: Number(r.total_trade_volume ?? 0),
      success_rate: Number(r.success_rate ?? 0),
      disputes_total: r.disputes_total ?? 0,
      disputes_won: r.disputes_won ?? 0,
      disputes_lost: r.disputes_lost ?? 0,
      dispute_rate: Number(r.dispute_rate ?? 0),
      reports_received: r.reports_received ?? 0,
      reports_against_others: r.reports_against_others ?? 0,
      rating_average: Number(r.rating_average ?? 0),
      rating_count: r.rating_count ?? 0,
      days_active: r.days_active ?? 0,
      account_age_days: r.account_age_days ?? 0,
      first_trade_at: r.first_trade_at ?? null,
      last_trade_at: r.last_trade_at ?? null,
      created_at: r.created_at ?? new Date().toISOString(),
      last_seen_at: r.last_seen_at ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Calls `cleanup_audit_log_old(p_days)`. Default 90 days.
 * Returns the deleted-row count or an error reason.
 */
export async function cleanupAuditLogOld(days = 90): Promise<UtilityRpcResult> {
  return callRpc("cleanup_audit_log_old", { p_days: days })
}
