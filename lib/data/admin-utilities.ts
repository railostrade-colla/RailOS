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

// ─── Project-level actions (Phase 10.54) ──────────────────────

/** Hard-deletes a project (soft-cancels if it has active holdings). */
export async function adminDeleteProject(projectId: string): Promise<UtilityRpcResult & { mode?: string }> {
  return callRpc("admin_delete_project", { p_project_id: projectId }) as Promise<UtilityRpcResult & { mode?: string }>
}

/** Freezes ALL of a project's wallets in one call. */
export async function adminFreezeProject(
  projectId: string,
  reason?: string,
): Promise<UtilityRpcResult & { wallets_frozen?: number }> {
  return callRpc("admin_freeze_project", {
    p_project_id: projectId,
    p_reason: reason ?? null,
  }) as Promise<UtilityRpcResult & { wallets_frozen?: number }>
}

/** Unfreezes ALL of a project's wallets in one call. */
export async function adminUnfreezeProject(
  projectId: string,
): Promise<UtilityRpcResult & { wallets_unfrozen?: number }> {
  return callRpc("admin_unfreeze_project", {
    p_project_id: projectId,
  }) as Promise<UtilityRpcResult & { wallets_unfrozen?: number }>
}

// ─── User picker for gifts (Phase 10.54) ──────────────────────

export type UserPickerFilter = "all" | "new" | "active" | "inactive"

export interface UserPickerRow {
  id: string
  name: string
  username: string | null
  level: string
  created_at: string
  last_seen_at: string | null
  days_old: number
  days_since_seen: number | null
}

export async function getUsersForAdminPicker(
  filter: UserPickerFilter = "all",
  search = "",
  limit = 50,
): Promise<UserPickerRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_users_for_admin_picker", {
      p_filter: filter,
      p_search: search || null,
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return []
    return data as UserPickerRow[]
  } catch {
    return []
  }
}

// ─── List all project wallets (Phase 10.51) ────────────────────

export interface ProjectWalletAdminRow {
  id: string
  project_id: string
  project_name: string
  /** Used as "balance" in the UI — the project's total IQD value of available offering shares. */
  balance: number
  total_inflow: number
  total_outflow: number
  status: "active" | "frozen" | "closed"
  created_at: string
  frozen_at?: string
  frozen_reason?: string
}

/**
 * Fetches all project wallets across the platform, aggregated per
 * project. The DB stores 3 wallets per project (offering / ambassador
 * / reserve) but the admin UI shows ONE row per project.
 *
 * Strategy (Phase 10.55):
 *   • Path 1: get_project_wallets_admin RPC (SECURITY DEFINER —
 *     bypasses RLS, does the aggregation in SQL, single roundtrip).
 *   • Path 2: legacy two-step manual join — runs only if the RPC
 *     hasn't been deployed yet.
 */
export async function getAllProjectWalletsAdmin(
  limit = 200,
): Promise<ProjectWalletAdminRow[]> {
  // ─── Path 1: RPC (preferred) ───
  try {
    const supabase = createClient()
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_project_wallets_admin",
      { p_limit: limit },
    )
    if (!rpcError && Array.isArray(rpcData)) {
      interface RpcRow {
        project_id: string
        id: string
        project_name: string
        balance: number | string
        total_inflow: number | string
        total_outflow: number | string
        status: "active" | "frozen" | "closed"
        created_at: string
        frozen_at: string | null
        frozen_reason: string | null
      }
      return (rpcData as RpcRow[]).map((r) => ({
        id: r.id,
        project_id: r.project_id,
        project_name: r.project_name,
        balance: Number(r.balance),
        total_inflow: Number(r.total_inflow),
        total_outflow: Number(r.total_outflow),
        status: r.status,
        created_at: r.created_at,
        frozen_at: r.frozen_at?.slice(0, 10) ?? undefined,
        frozen_reason: r.frozen_reason ?? undefined,
      }))
    }
    if (rpcError) {
      // eslint-disable-next-line no-console
      console.warn(
        "[admin-utilities] get_project_wallets_admin RPC failed, falling back:",
        rpcError.message,
      )
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[admin-utilities] RPC threw, falling back:", err)
  }

  // ─── Path 2: legacy two-step manual join ───
  try {
    const supabase = createClient()

    // Step 1: All wallet rows (no FK joins).
    const { data: walletsRaw, error: walletsError } = await supabase
      .from("project_wallets")
      .select("id, project_id, wallet_type, total_shares, available_shares, status, created_at, frozen_at, frozen_reason")
      .limit(limit * 5) // 5 wallet types per project max

    if (walletsError || !walletsRaw) {
      // eslint-disable-next-line no-console
      console.warn("[admin-utilities] getAllProjectWalletsAdmin failed:", walletsError?.message)
      return []
    }

    // Step 2: Get project names + share_price separately.
    const projectIds = Array.from(
      new Set(
        walletsRaw
          .map((w) => (w as { project_id: string | null }).project_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    interface ProjectMin {
      id: string
      name: string | null
      share_price: number | string | null
      created_at: string | null
    }
    const projectMap = new Map<string, ProjectMin>()
    if (projectIds.length > 0) {
      try {
        const { data: projs } = await supabase
          .from("projects")
          .select("id, name, share_price, created_at")
          .in("id", projectIds)
        for (const p of (projs ?? []) as ProjectMin[]) projectMap.set(p.id, p)
      } catch { /* leave empty */ }
    }

    // Step 3: Aggregate per project.
    interface Bucket {
      project_id: string
      project_name: string
      created_at: string
      share_price: number
      offering_available: number
      ambassador_available: number
      reserve_available: number
      total_shares: number
      any_frozen: boolean
      frozen_at?: string
      frozen_reason?: string
    }
    const buckets = new Map<string, Bucket>()

    for (const w of walletsRaw as Array<{
      id: string
      project_id: string
      wallet_type: string
      total_shares: number | string | null
      available_shares: number | string | null
      status: string | null
      created_at: string | null
      frozen_at: string | null
      frozen_reason: string | null
    }>) {
      if (!w.project_id) continue
      const proj = projectMap.get(w.project_id)
      let bucket = buckets.get(w.project_id)
      if (!bucket) {
        bucket = {
          project_id: w.project_id,
          project_name: proj?.name ?? "—",
          created_at: (proj?.created_at ?? w.created_at ?? "").slice(0, 10),
          share_price: Number(proj?.share_price ?? 0),
          offering_available: 0,
          ambassador_available: 0,
          reserve_available: 0,
          total_shares: 0,
          any_frozen: false,
        }
        buckets.set(w.project_id, bucket)
      }
      const avail = Number(w.available_shares ?? 0)
      const total = Number(w.total_shares ?? 0)
      bucket.total_shares += total
      if (w.wallet_type === "offering") bucket.offering_available += avail
      else if (w.wallet_type === "ambassador") bucket.ambassador_available += avail
      else if (w.wallet_type === "reserve") bucket.reserve_available += avail
      if (w.status === "frozen") {
        bucket.any_frozen = true
        bucket.frozen_at = w.frozen_at ?? bucket.frozen_at
        bucket.frozen_reason = w.frozen_reason ?? bucket.frozen_reason
      }
    }

    // Step 4: Build admin rows.
    const out: ProjectWalletAdminRow[] = []
    for (const b of buckets.values()) {
      const totalAvailable = b.offering_available + b.ambassador_available + b.reserve_available
      const balance = totalAvailable * b.share_price
      const totalValue = b.total_shares * b.share_price
      const inflow = totalValue
      const outflow = totalValue - balance
      out.push({
        id: b.project_id,
        project_id: b.project_id,
        project_name: b.project_name,
        balance,
        total_inflow: inflow,
        total_outflow: outflow,
        status: b.any_frozen ? "frozen" : "active",
        created_at: b.created_at || "—",
        frozen_at: b.frozen_at?.slice(0, 10) ?? undefined,
        frozen_reason: b.frozen_reason ?? undefined,
      })
    }

    // Newest first
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return out.slice(0, limit)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-utilities] getAllProjectWalletsAdmin threw:", err)
    return []
  }
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

/** Returns the caller's auth uid, or null if not signed in. */
export async function getMyUserId(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

// ─── Bootstrap + diagnostic (Phase 10.41) ────────────────────────

export interface WhoamiAdminResult {
  authenticated: boolean
  user_id?: string
  email?: string | null
  full_name?: string | null
  role: string
  is_admin: boolean
  is_super_admin: boolean
  super_admin_count: number
  has_profile_row: boolean
}

const WHOAMI_FALLBACK: WhoamiAdminResult = {
  authenticated: false,
  role: "unknown",
  is_admin: false,
  is_super_admin: false,
  super_admin_count: 0,
  has_profile_row: false,
}

/**
 * Calls the `whoami_admin()` diagnostic RPC. Returns a "no auth"
 * fallback if the RPC isn't installed yet (Phase 10.41 not applied).
 * Used by the AdminDiagnosticBanner to surface why admin queries
 * might be returning empty.
 */
export async function whoamiAdmin(): Promise<WhoamiAdminResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("whoami_admin")
    if (error || !data) return WHOAMI_FALLBACK
    const r = data as Partial<WhoamiAdminResult>
    return {
      authenticated: Boolean(r.authenticated),
      user_id: r.user_id,
      email: r.email ?? null,
      full_name: r.full_name ?? null,
      role: r.role ?? "unknown",
      is_admin: Boolean(r.is_admin),
      is_super_admin: Boolean(r.is_super_admin),
      super_admin_count: Number(r.super_admin_count ?? 0),
      has_profile_row: Boolean(r.has_profile_row),
    }
  } catch {
    return WHOAMI_FALLBACK
  }
}

export interface BootstrapResult {
  success: boolean
  reason?: string
  user_id?: string
  role?: string
  existing_super_admin_count?: number
}

/**
 * Calls `bootstrap_first_super_admin()` to self-promote when no
 * super_admin exists in the system yet. Idempotent: subsequent calls
 * after seeding return success=false with reason="already_seeded".
 */
export async function bootstrapFirstSuperAdmin(): Promise<BootstrapResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("bootstrap_first_super_admin")
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || /function .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_migration" }
      }
      return { success: false, reason: msg }
    }
    return (data ?? { success: false, reason: "unknown" }) as BootstrapResult
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : "unknown",
    }
  }
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
