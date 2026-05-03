"use client"

/**
 * Share modifications data layer (Phase 9.5).
 *
 * Two-step authorization for changing total project shares:
 *   1. Super admin generates a 6-digit code (24h expiry, single use).
 *   2. Admin submits a request using the code.
 *   3. Super admin approves/rejects. On approve the change is applied
 *      atomically to projects.total_shares + the RESERVE wallet only
 *      (offering / ambassador wallets stay untouched, so live trading
 *      is never affected).
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface ShareCodeRow {
  id: string
  code: string
  generated_by: string
  project_id: string
  project_name: string
  expires_at: string
  is_used: boolean
  used_by: string | null
  used_by_name: string | null
  used_at: string | null
  created_at: string
  status: "active" | "used" | "expired"
}

export interface ShareRequestRow {
  id: string
  project_id: string
  project_name: string
  requested_by: string
  requested_by_name: string
  modification_type: "increase" | "decrease"
  shares_amount: number
  reason: string | null
  status: "pending_super_admin" | "approved" | "rejected"
  super_admin_id: string | null
  super_admin_name: string | null
  super_admin_at: string | null
  super_admin_note: string | null
  applied_at: string | null
  created_at: string
}

export interface ProjectOption {
  id: string
  name: string
  total_shares: number
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

export async function getProjectsForSelect(): Promise<ProjectOption[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, total_shares")
      .order("name", { ascending: true })

    if (error || !data) return []
    return (data as Array<{ id: string; name: string; total_shares: number | string }>).map(
      (p) => ({
        id: p.id,
        name: p.name,
        total_shares: num(p.total_shares),
      }),
    )
  } catch {
    return []
  }
}

export async function getMyGeneratedCodes(): Promise<ShareCodeRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("share_modification_codes")
      .select(
        `id, code, generated_by, project_id, expires_at, is_used,
         used_by, used_at, created_at,
         project:projects!project_id ( name ),
         user:profiles!used_by ( full_name, username )`,
      )
      .eq("generated_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return []

    interface Row {
      id: string
      code: string
      generated_by: string
      project_id: string
      expires_at: string
      is_used: boolean
      used_by: string | null
      used_at: string | null
      created_at: string
      project?: { name?: string | null } | { name?: string | null }[] | null
      user?: ProfileRef | ProfileRef[] | null
    }

    const now = Date.now()
    return (data as Row[]).map((r): ShareCodeRow => {
      const project = unwrap(r.project)
      const status: ShareCodeRow["status"] = r.is_used
        ? "used"
        : new Date(r.expires_at).getTime() < now
          ? "expired"
          : "active"
      return {
        id: r.id,
        code: r.code,
        generated_by: r.generated_by,
        project_id: r.project_id,
        project_name: project?.name?.trim() || "—",
        expires_at: r.expires_at,
        is_used: r.is_used,
        used_by: r.used_by,
        used_by_name: r.used_by ? profileName(unwrap(r.user)) : null,
        used_at: r.used_at,
        created_at: r.created_at,
        status,
      }
    })
  } catch {
    return []
  }
}

export async function getPendingShareRequests(): Promise<ShareRequestRow[]> {
  return getShareRequestsByStatus("pending_super_admin")
}

export async function getMyShareRequests(): Promise<ShareRequestRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("share_modification_requests")
      .select(
        `id, project_id, requested_by, modification_type, shares_amount,
         reason, status, super_admin_id, super_admin_at, super_admin_note,
         applied_at, created_at,
         project:projects!project_id ( name ),
         requester:profiles!requested_by ( full_name, username ),
         decider:profiles!super_admin_id ( full_name, username )`,
      )
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !data) return []
    return mapRequestRows(data as RawRequestRow[])
  } catch {
    return []
  }
}

interface RawRequestRow {
  id: string
  project_id: string
  requested_by: string
  modification_type: "increase" | "decrease"
  shares_amount: number | string
  reason: string | null
  status: "pending_super_admin" | "approved" | "rejected"
  super_admin_id: string | null
  super_admin_at: string | null
  super_admin_note: string | null
  applied_at: string | null
  created_at: string
  project?: { name?: string | null } | { name?: string | null }[] | null
  requester?: ProfileRef | ProfileRef[] | null
  decider?: ProfileRef | ProfileRef[] | null
}

function mapRequestRows(rows: RawRequestRow[]): ShareRequestRow[] {
  return rows.map((r): ShareRequestRow => {
    const project = unwrap(r.project)
    return {
      id: r.id,
      project_id: r.project_id,
      project_name: project?.name?.trim() || "—",
      requested_by: r.requested_by,
      requested_by_name: profileName(unwrap(r.requester)),
      modification_type: r.modification_type,
      shares_amount: num(r.shares_amount),
      reason: r.reason,
      status: r.status,
      super_admin_id: r.super_admin_id,
      super_admin_name: r.super_admin_id ? profileName(unwrap(r.decider)) : null,
      super_admin_at: r.super_admin_at,
      super_admin_note: r.super_admin_note,
      applied_at: r.applied_at,
      created_at: r.created_at,
    }
  })
}

async function getShareRequestsByStatus(
  status: "pending_super_admin" | "approved" | "rejected",
): Promise<ShareRequestRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("share_modification_requests")
      .select(
        `id, project_id, requested_by, modification_type, shares_amount,
         reason, status, super_admin_id, super_admin_at, super_admin_note,
         applied_at, created_at,
         project:projects!project_id ( name ),
         requester:profiles!requested_by ( full_name, username ),
         decider:profiles!super_admin_id ( full_name, username )`,
      )
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error || !data) return []
    return mapRequestRows(data as RawRequestRow[])
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface ShareRpcResult {
  success: boolean
  reason?: string
  error?: string
  code?: string
  expires_in_hours?: number
  request_id?: string
  available?: number
  requested?: number
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<ShareRpcResult> {
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
      code?: string
      expires_in_hours?: number
      request_id?: string
      available?: number
      requested?: number
    }
    if (!result.success) {
      return {
        success: false,
        reason: result.error ?? "unknown",
        available: result.available,
        requested: result.requested,
      }
    }
    return {
      success: true,
      code: result.code,
      expires_in_hours: result.expires_in_hours,
      request_id: result.request_id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function generateShareCode(projectId: string): Promise<ShareRpcResult> {
  return callRpc("admin_generate_share_code", { p_project_id: projectId })
}

export async function submitShareModification(input: {
  project_id: string
  type: "increase" | "decrease"
  shares: number
  code: string
  reason?: string
}): Promise<ShareRpcResult> {
  return callRpc("admin_submit_share_modification", {
    p_project_id: input.project_id,
    p_type: input.type,
    p_shares: input.shares,
    p_code: input.code,
    p_reason: input.reason ?? null,
  })
}

export async function approveShareModification(
  requestId: string,
): Promise<ShareRpcResult> {
  return callRpc("admin_approve_share_modification", { p_request_id: requestId })
}

export async function rejectShareModification(
  requestId: string,
  note?: string,
): Promise<ShareRpcResult> {
  return callRpc("admin_reject_share_modification", {
    p_request_id: requestId,
    p_note: note ?? null,
  })
}
