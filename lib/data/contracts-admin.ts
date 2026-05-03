"use client"

/**
 * Contracts admin — DB-backed data layer (Phase 7).
 *
 * Admin sees ALL partnership_contracts via RLS. Mutations go through
 * dedicated RPCs (force_end / cancel / resolve_internally).
 */

import { createClient } from "@/lib/supabase/client"
import type { ContractListItem, ContractStatus } from "@/lib/mock-data/types"

interface ProfileRef {
  full_name?: string | null
  username?: string | null
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

function asStatus(s: string): ContractStatus {
  if (s === "pending" || s === "active" || s === "ended" || s === "cancelled") return s
  return "pending"
}

interface ContractRow {
  id: string
  title: string
  total_investment: number | string
  status: string
  end_fee_pct: number | string
  creator_id: string
  created_at: string
  started_at?: string | null
  ended_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  creator?: ProfileRef | ProfileRef[] | null
}

export async function getAllContracts(): Promise<ContractListItem[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("partnership_contracts")
      .select(
        `id, title, total_investment, status, end_fee_pct,
         creator_id, created_at, started_at, ended_at,
         cancelled_at, cancellation_reason,
         creator:profiles!creator_id ( full_name, username )`,
      )
      .order("created_at", { ascending: false })

    if (error || !data) return []

    return (data as ContractRow[]).map((c): ContractListItem => {
      const creator = unwrap(c.creator)
      const creatorName =
        creator?.full_name?.trim() || creator?.username?.trim() || "—"
      return {
        id: c.id,
        title: c.title,
        creator_id: c.creator_id,
        total_investment: num(c.total_investment),
        status: asStatus(c.status),
        partners: [{ user: { name: creatorName, is_verified: true } }],
        created_at: c.created_at?.split("T")[0] ?? "—",
      }
    })
  } catch {
    return []
  }
}

export interface AdminContractMember {
  id: string
  user_id: string
  user_name: string
  share_percent: number
  invite_status: "pending" | "accepted" | "declined"
}

export async function getContractMembers(
  contractId: string,
): Promise<AdminContractMember[]> {
  if (!contractId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contract_members")
      .select(
        `id, user_id, share_percent, invite_status,
         user:profiles!user_id ( full_name, username )`,
      )
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true })

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      share_percent: number | string
      invite_status: "pending" | "accepted" | "declined"
      user?: ProfileRef | ProfileRef[] | null
    }

    return (data as Row[]).map((r) => {
      const u = unwrap(r.user)
      return {
        id: r.id,
        user_id: r.user_id,
        user_name: u?.full_name?.trim() || u?.username?.trim() || "—",
        share_percent: num(r.share_percent),
        invite_status: r.invite_status,
      }
    })
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<AdminRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" ||
          /function .* does not exist/i.test(msg) ||
          /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminForceEndContract(
  contractId: string,
  reason?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_force_end_contract", {
    p_contract_id: contractId,
    p_reason: reason ?? null,
  })
}

export async function adminCancelContract(
  contractId: string,
  reason: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_cancel_contract", {
    p_contract_id: contractId,
    p_reason: reason,
  })
}

export async function adminResolveContractInternally(
  contractId: string,
  percents: Record<string, number>,
  notes?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_resolve_contract_internally", {
    p_contract_id: contractId,
    p_percents: percents,
    p_notes: notes ?? null,
  })
}
