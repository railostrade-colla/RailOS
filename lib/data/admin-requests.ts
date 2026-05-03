"use client"

/**
 * Admin Requests Hub data layer (Phase 9.4).
 *
 * Aggregates the 5 categories of work that flow into the admin
 * inbox + the notification-locking primitives that coordinate
 * concurrent admins.
 *
 * Categories:
 *   1. shares    — share modification requests (Feature 5; placeholder
 *                  for now, returns [])
 *   2. volume    — read-only deal aggregates (today / week / month)
 *   3. fees      — fee_unit_requests where status = 'pending'
 *   4. deals     — deals where status IN ('pending', 'in_dispute')
 *   5. disputes  — disputes where status = 'open'
 *
 * Locking:
 *   - lockNotification(id), unlockNotification(id), processNotification(id)
 *   - Wraps the SECURITY DEFINER RPCs from
 *     20260503_phase9_admin_request_locking.sql
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface PendingFeeRequest {
  id: string
  user_id: string
  user_name: string
  amount_requested: number
  payment_method: string
  proof_image_url: string | null
  notes: string | null
  submitted_at: string
}

export interface PendingDeal {
  id: string
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string
  project_name: string
  shares_amount: number
  total_amount: number
  status: string
  created_at: string
}

export interface OpenDispute {
  id: string
  deal_id: string
  opened_by: string
  opener_name: string
  reason: string
  status: string
  opened_at: string
}

export interface VolumeStats {
  today: { count: number; total: number }
  week: { count: number; total: number }
  month: { count: number; total: number }
}

export interface PendingShareRequest {
  id: string
  project_id: string
  project_name: string
  modification_type: "increase" | "decrease"
  shares_amount: number
  reason: string | null
  status: string
  requested_by_name: string
  created_at: string
}

export interface AdminRoleInfo {
  is_admin: boolean
  is_super_admin: boolean
}

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

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

// ─── Reads ───────────────────────────────────────────────────

export async function getMyAdminRole(): Promise<AdminRoleInfo> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { is_admin: false, is_super_admin: false }

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const role = (data as { role?: string } | null)?.role ?? ""
    return {
      is_admin: role === "admin" || role === "super_admin",
      is_super_admin: role === "super_admin",
    }
  } catch {
    return { is_admin: false, is_super_admin: false }
  }
}

export async function getPendingFeeRequests(): Promise<PendingFeeRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("fee_unit_requests")
      .select(
        `id, user_id, amount_requested, payment_method, proof_image_url,
         notes, submitted_at,
         user:profiles!user_id ( full_name, username )`,
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      amount_requested: number | string
      payment_method: string
      proof_image_url: string | null
      notes: string | null
      submitted_at: string
      user?: ProfileRef | ProfileRef[] | null
    }
    return (data as Row[]).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: profileName(unwrap(r.user)),
      amount_requested: num(r.amount_requested),
      payment_method: r.payment_method,
      proof_image_url: r.proof_image_url,
      notes: r.notes,
      submitted_at: r.submitted_at,
    }))
  } catch {
    return []
  }
}

export async function getPendingDeals(): Promise<PendingDeal[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("deals")
      .select(
        `id, buyer_id, seller_id, shares_amount, total_amount, status, created_at,
         buyer:profiles!buyer_id ( full_name, username ),
         seller:profiles!seller_id ( full_name, username ),
         project:projects!project_id ( name )`,
      )
      .in("status", ["pending", "in_dispute"])
      .order("created_at", { ascending: false })
      .limit(100)

    if (error || !data) return []

    interface Row {
      id: string
      buyer_id: string
      seller_id: string
      shares_amount: number | string
      total_amount: number | string
      status: string
      created_at: string
      buyer?: ProfileRef | ProfileRef[] | null
      seller?: ProfileRef | ProfileRef[] | null
      project?: { name?: string | null } | { name?: string | null }[] | null
    }
    return (data as Row[]).map((d) => {
      const project = unwrap(d.project)
      return {
        id: d.id,
        buyer_id: d.buyer_id,
        buyer_name: profileName(unwrap(d.buyer)),
        seller_id: d.seller_id,
        seller_name: profileName(unwrap(d.seller)),
        project_name: project?.name?.trim() || "—",
        shares_amount: num(d.shares_amount),
        total_amount: num(d.total_amount),
        status: d.status,
        created_at: d.created_at,
      }
    })
  } catch {
    return []
  }
}

export async function getOpenDisputes(): Promise<OpenDispute[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("disputes")
      .select(
        `id, deal_id, opened_by, reason, status, opened_at,
         opener:profiles!opened_by ( full_name, username )`,
      )
      .eq("status", "open")
      .order("opened_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      deal_id: string
      opened_by: string
      reason: string
      status: string
      opened_at: string
      opener?: ProfileRef | ProfileRef[] | null
    }
    return (data as Row[]).map((d) => ({
      id: d.id,
      deal_id: d.deal_id,
      opened_by: d.opened_by,
      opener_name: profileName(unwrap(d.opener)),
      reason: d.reason,
      status: d.status,
      opened_at: d.opened_at,
    }))
  } catch {
    return []
  }
}

export async function getTradingVolumeStats(): Promise<VolumeStats> {
  const empty: VolumeStats = {
    today: { count: 0, total: 0 },
    week: { count: 0, total: 0 },
    month: { count: 0, total: 0 },
  }
  try {
    const supabase = createClient()
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const since = new Date(now - 30 * dayMs).toISOString()

    const { data, error } = await supabase
      .from("deals")
      .select("total_amount, completed_at, created_at, status")
      .eq("status", "completed")
      .gte("created_at", since)

    if (error || !data) return empty

    interface DealLite {
      total_amount: number | string
      completed_at: string | null
      created_at: string
      status: string
    }

    const todayStart = now - dayMs
    const weekStart = now - 7 * dayMs
    const monthStart = now - 30 * dayMs

    let todayCount = 0, todayTotal = 0
    let weekCount = 0, weekTotal = 0
    let monthCount = 0, monthTotal = 0

    for (const d of data as DealLite[]) {
      const ts = new Date(d.completed_at || d.created_at).getTime()
      const amt = num(d.total_amount)
      if (ts >= monthStart) {
        monthCount += 1
        monthTotal += amt
      }
      if (ts >= weekStart) {
        weekCount += 1
        weekTotal += amt
      }
      if (ts >= todayStart) {
        todayCount += 1
        todayTotal += amt
      }
    }

    return {
      today: { count: todayCount, total: todayTotal },
      week: { count: weekCount, total: weekTotal },
      month: { count: monthCount, total: monthTotal },
    }
  } catch {
    return empty
  }
}

/** Placeholder for Feature 5. Returns [] gracefully if the table
 *  doesn't exist yet. */
export async function getPendingShareRequests(): Promise<PendingShareRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("share_modification_requests")
      .select(
        `id, project_id, modification_type, shares_amount, reason, status, created_at,
         project:projects!project_id ( name ),
         requested:profiles!requested_by ( full_name, username )`,
      )
      .eq("status", "pending_super_admin")
      .order("created_at", { ascending: false })

    if (error) {
      // Table missing (Feature 5 not deployed yet) — fail soft.
      return []
    }
    if (!data) return []

    interface Row {
      id: string
      project_id: string
      modification_type: "increase" | "decrease"
      shares_amount: number | string
      reason: string | null
      status: string
      created_at: string
      project?: { name?: string | null } | { name?: string | null }[] | null
      requested?: ProfileRef | ProfileRef[] | null
    }
    return (data as Row[]).map((r) => {
      const proj = unwrap(r.project)
      return {
        id: r.id,
        project_id: r.project_id,
        project_name: proj?.name?.trim() || "—",
        modification_type: r.modification_type,
        shares_amount: num(r.shares_amount),
        reason: r.reason,
        status: r.status,
        requested_by_name: profileName(unwrap(r.requested)),
        created_at: r.created_at,
      }
    })
  } catch {
    return []
  }
}

// ─── Notification locking (RPCs) ──────────────────────────────

export interface LockResult {
  success: boolean
  reason?: string
  error?: string
  override?: boolean
  locked_by?: string
  locked_at?: string
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<LockResult> {
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
        /column .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      override?: boolean
      locked_by?: string
      locked_at?: string
    }
    if (!result.success) {
      return {
        success: false,
        reason: result.error ?? "unknown",
        locked_by: result.locked_by,
        locked_at: result.locked_at,
      }
    }
    return { success: true, override: result.override }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function lockNotification(notificationId: string): Promise<LockResult> {
  return callRpc("admin_lock_notification", { p_notification_id: notificationId })
}

export async function unlockNotification(notificationId: string): Promise<LockResult> {
  return callRpc("admin_unlock_notification", { p_notification_id: notificationId })
}

export async function processNotification(notificationId: string): Promise<LockResult> {
  return callRpc("admin_process_notification", { p_notification_id: notificationId })
}

// ─── Admin-targeted notifications list ──────────────────────────────

export interface AdminInboxNotification {
  id: string
  user_id: string
  notification_type: string
  title: string
  message: string
  priority: string
  link_url: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  created_at: string
  locked_by: string | null
  locked_by_name: string | null
  locked_at: string | null
  processed_by: string | null
  processed_by_name: string | null
  processed_at: string | null
}

/** Lists admin-targeted notifications. We approximate "admin-targeted"
 *  by reading the caller's own notifications row — most ops-related
 *  notifications are dispatched to the on-call admin's user_id by
 *  the broadcaster + dispute/fee-request triggers. */
export async function getAdminNotifications(
  limit: number = 100,
): Promise<AdminInboxNotification[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("notifications")
      .select(
        `id, user_id, notification_type, title, message, priority,
         link_url, metadata, is_read, created_at,
         locked_by, locked_at, processed_by, processed_at,
         locker:profiles!locked_by ( full_name, username ),
         processor:profiles!processed_by ( full_name, username )`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      notification_type: string
      title: string
      message: string
      priority: string
      link_url: string | null
      metadata: Record<string, unknown> | null
      is_read: boolean
      created_at: string
      locked_by: string | null
      locked_at: string | null
      processed_by: string | null
      processed_at: string | null
      locker?: ProfileRef | ProfileRef[] | null
      processor?: ProfileRef | ProfileRef[] | null
    }

    return (data as Row[]).map((n) => ({
      id: n.id,
      user_id: n.user_id,
      notification_type: n.notification_type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      link_url: n.link_url,
      metadata: n.metadata,
      is_read: n.is_read,
      created_at: n.created_at,
      locked_by: n.locked_by,
      locked_by_name: n.locked_by ? profileName(unwrap(n.locker)) : null,
      locked_at: n.locked_at,
      processed_by: n.processed_by,
      processed_by_name: n.processed_by ? profileName(unwrap(n.processor)) : null,
      processed_at: n.processed_at,
    }))
  } catch {
    return []
  }
}
