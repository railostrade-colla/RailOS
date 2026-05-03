"use client"

/**
 * Group contracts (partnerships) — DB-backed data layer (Phase 6.2).
 *
 * Wraps partnership_contracts + contract_members tables created by
 * 20260503_phase6_contracts_schema.sql. Contract end goes through
 * the end_partnership_contract RPC for atomic fee deduction +
 * status transition.
 *
 * Activation: a contract auto-flips to 'active' when ALL invited
 * members accept (trigger maybe_activate_contract). Until then it
 * stays 'pending'.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  ContractListItem,
  ContractDetail,
  ContractStatus,
} from "@/lib/mock-data/types"
import type { InvestorLevel } from "@/lib/utils/contractLimits"

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function asContractStatus(s: string): ContractStatus {
  if (s === "active" || s === "ended" || s === "cancelled") return s
  return "pending"
}

function asLevel(s: string | null | undefined): InvestorLevel {
  if (s === "advanced") return "advanced"
  // collapse pro/elite → pro for the contract member display
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// ─── Row types ───────────────────────────────────────────────

interface ContractRow {
  id: string
  title: string
  description: string | null
  creator_id: string
  total_investment: number | string
  status: string
  end_fee_pct: number | string
  created_at: string
  started_at: string | null
  ended_at: string | null
  creator?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
  members?: ContractMemberRow[] | null
}

interface ContractMemberRow {
  id: string
  contract_id: string
  user_id: string
  share_percent: number | string
  invite_status: string
  joined_at: string | null
  member?:
    | {
        full_name?: string | null
        username?: string | null
        level?: string | null
        kyc_status?: string | null
      }
    | { full_name?: string | null; username?: string | null; level?: string | null; kyc_status?: string | null }[]
    | null
}

function rowToListItem(r: ContractRow): ContractListItem {
  const accepted = (r.members ?? []).filter(
    (m) => m.invite_status === "accepted" || m.invite_status === "pending",
  )
  return {
    id: r.id,
    title: r.title,
    status: asContractStatus(r.status),
    creator_id: r.creator_id,
    total_investment: num(r.total_investment),
    created_at: r.created_at?.slice(0, 10) ?? "",
    partners: accepted.map((m) => {
      const member = unwrap(m.member)
      return {
        user: {
          name:
            member?.full_name?.trim() ||
            member?.username?.trim() ||
            "—",
          is_verified: member?.kyc_status === "approved",
        },
      }
    }),
  }
}

function rowToDetail(r: ContractRow): ContractDetail {
  const creator = unwrap(r.creator)
  return {
    id: r.id,
    title: r.title,
    status:
      r.status === "active" || r.status === "ended"
        ? r.status
        : "pending",
    creator: creator?.full_name?.trim() || creator?.username?.trim() || "—",
    total_investment: num(r.total_investment),
    created_at: r.created_at?.slice(0, 10) ?? "",
    description: r.description ?? undefined,
    members: (r.members ?? []).map((m) => {
      const member = unwrap(m.member)
      return {
        user_id: m.user_id,
        name:
          member?.full_name?.trim() ||
          member?.username?.trim() ||
          "—",
        level: asLevel(member?.level),
        share_percent: num(m.share_percent),
      }
    }),
  }
}

// ─── Reads ───────────────────────────────────────────────────

/**
 * Returns contracts the current user is involved in — either as
 * creator or as an invited member (any invite_status).
 */
export async function getMyContracts(): Promise<ContractListItem[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // Two queries union'd client-side: the creator query is simple,
    // the member query needs a join. We use Promise.all + dedupe.
    const [createdRes, memberRes] = await Promise.all([
      supabase
        .from("partnership_contracts")
        .select(
          `id, title, description, creator_id, total_investment,
           status, end_fee_pct, created_at, started_at, ended_at,
           members:contract_members ( id, contract_id, user_id, share_percent, invite_status, joined_at,
             member:profiles!user_id ( full_name, username, level, kyc_status ) )`,
        )
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contract_members")
        .select(
          `contract:partnership_contracts!contract_id (
             id, title, description, creator_id, total_investment,
             status, end_fee_pct, created_at, started_at, ended_at,
             members:contract_members ( id, contract_id, user_id, share_percent, invite_status, joined_at,
               member:profiles!user_id ( full_name, username, level, kyc_status ) )
           )`,
        )
        .eq("user_id", user.id),
    ])

    const created = (createdRes.data ?? []) as ContractRow[]
    const memberRaw = (memberRes.data ?? []) as { contract: ContractRow | ContractRow[] | null }[]
    const memberOnly = memberRaw
      .map((r) => unwrap(r.contract))
      .filter((c): c is ContractRow => !!c)

    // Dedupe by id (the creator can also be in their own contract).
    const seen = new Set<string>()
    const all: ContractRow[] = []
    for (const r of [...created, ...memberOnly]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      all.push(r)
    }
    all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return all.map(rowToListItem)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[contracts] getMyContracts:", err)
    return []
  }
}

export async function getContractById(
  id: string,
): Promise<ContractDetail | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("partnership_contracts")
      .select(
        `id, title, description, creator_id, total_investment,
         status, end_fee_pct, created_at, started_at, ended_at,
         creator:profiles!creator_id ( full_name, username ),
         members:contract_members ( id, contract_id, user_id, share_percent, invite_status, joined_at,
           member:profiles!user_id ( full_name, username, level, kyc_status ) )`,
      )
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return rowToDetail(data as ContractRow)
  } catch {
    return null
  }
}

// ─── Writes ──────────────────────────────────────────────────

export interface CreateContractInput {
  title: string
  description?: string
  total_investment: number
  members: Array<{ user_id: string; share_percent: number }>
}

export interface CreateContractResult {
  success: boolean
  contract_id?: string
  reason?:
    | "unauthenticated"
    | "invalid"
    | "share_percent_not_100"
    | "rls"
    | "missing_table"
    | "unknown"
  error?: string
}

export async function createContract(
  input: CreateContractInput,
): Promise<CreateContractResult> {
  if (!input.title?.trim() || input.total_investment <= 0) {
    return { success: false, reason: "invalid", error: "العنوان والمبلغ مطلوبان" }
  }
  if (!Array.isArray(input.members) || input.members.length === 0) {
    return { success: false, reason: "invalid", error: "أضِف شريكاً واحداً على الأقل" }
  }
  const totalShare = input.members.reduce((s, m) => s + (m.share_percent || 0), 0)
  if (Math.round(totalShare) !== 100) {
    return {
      success: false,
      reason: "share_percent_not_100",
      error: `مجموع النسب يجب أن يكون 100 (الحالي: ${totalShare})`,
    }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    // 1) Create the contract header.
    const { data: contract, error: contractErr } = await supabase
      .from("partnership_contracts")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        creator_id: user.id,
        total_investment: input.total_investment,
      })
      .select("id")
      .single()

    if (contractErr || !contract) {
      const code = contractErr?.code ?? ""
      const msg = contractErr?.message ?? ""
      if (code === "42P01") return { success: false, reason: "missing_table", error: msg }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }

    const contractId = (contract as { id: string }).id

    // 2) Insert all members. The creator may or may not be in the
    //    members list — we don't auto-add them; the form already lets
    //    the creator set their own share.
    const memberRows = input.members.map((m) => ({
      contract_id: contractId,
      user_id: m.user_id,
      share_percent: m.share_percent,
      // The creator's own row can be auto-accepted; everyone else
      // stays 'pending' until they respond.
      invite_status: m.user_id === user.id ? "accepted" : "pending",
      joined_at: m.user_id === user.id ? new Date().toISOString() : null,
    }))

    const { error: membersErr } = await supabase
      .from("contract_members")
      .insert(memberRows)

    if (membersErr) {
      // Best-effort cleanup if member insert fails.
      await supabase.from("partnership_contracts").delete().eq("id", contractId)
      return {
        success: false,
        reason: "unknown",
        error: membersErr.message,
      }
    }

    return { success: true, contract_id: contractId }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function respondToContractInvite(
  memberRowId: string,
  accept: boolean,
  declineReason?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!memberRowId) return { success: false, error: "missing id" }
  try {
    const supabase = createClient()
    const patch: Record<string, unknown> = {
      invite_status: accept ? "accepted" : "declined",
    }
    if (accept) patch.joined_at = new Date().toISOString()
    else {
      patch.declined_at = new Date().toISOString()
      if (declineReason) patch.decline_reason = declineReason.trim()
    }
    const { error } = await supabase
      .from("contract_members")
      .update(patch)
      .eq("id", memberRowId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface EndContractResult {
  success: boolean
  fee_deducted?: number
  new_balance?: number
  reason?:
    | "unauthenticated"
    | "not_found"
    | "not_owner"
    | "not_active"
    | "missing_table"
    | "rls"
    | "unknown"
  error?: string
}

export async function endContract(contractId: string): Promise<EndContractResult> {
  if (!contractId) return { success: false, reason: "not_found" }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase.rpc("end_partnership_contract", {
      p_contract_id: contractId,
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01")
        return { success: false, reason: "missing_table", error: msg }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as {
      success?: boolean
      fee_deducted?: number
      new_balance?: number
      error?: string
    }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as EndContractResult["reason"]) ?? "unknown",
      }
    }
    return {
      success: true,
      fee_deducted: result.fee_deducted,
      new_balance: result.new_balance,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
