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

// ─── Phase 9.3a — Multi-account additions ─────────────────────

export type ContractMemberPermission =
  | "creator"
  | "view_only"
  | "buy_only"
  | "buy_and_sell"

export interface UserContractRow {
  contract_id: string
  contract_title: string
  is_creator: boolean
  permission: ContractMemberPermission
  total_balance: number
  status: ContractStatus
}

export interface ContractHoldingRow {
  id: string
  contract_id: string
  project_id: string
  project_name: string
  shares: number
  total_invested: number
  current_market_price?: number
}

export interface ContractTransactionRow {
  id: string
  contract_id: string
  initiator_id: string
  initiator_name: string
  transaction_type: "buy" | "sell" | "deposit" | "withdraw" | "distribution"
  amount: number
  shares: number | null
  project_id: string | null
  project_name: string | null
  notes: string | null
  created_at: string
}

/** Active contracts the caller is a part of — powers AccountSwitcher. */
export async function getUserContracts(): Promise<UserContractRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase.rpc("get_user_contracts")
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[contracts] getUserContracts:", error.message)
      return []
    }
    return ((data ?? []) as UserContractRow[]).map((r) => ({
      ...r,
      total_balance: num(r.total_balance),
    }))
  } catch {
    return []
  }
}

interface HoldingRow {
  id: string
  contract_id: string
  project_id: string
  shares: number | string
  total_invested: number | string
  project?:
    | { name?: string | null; current_market_price?: number | string | null }
    | { name?: string | null; current_market_price?: number | string | null }[]
    | null
}

export async function getContractHoldings(
  contractId: string,
): Promise<ContractHoldingRow[]> {
  if (!contractId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contract_holdings")
      .select(
        `id, contract_id, project_id, shares, total_invested,
         project:projects!project_id ( name, current_market_price )`,
      )
      .eq("contract_id", contractId)

    if (error || !data) return []
    return (data as HoldingRow[]).map((h): ContractHoldingRow => {
      const project = unwrap(h.project)
      return {
        id: h.id,
        contract_id: h.contract_id,
        project_id: h.project_id,
        project_name: project?.name?.trim() || "—",
        shares: num(h.shares),
        total_invested: num(h.total_invested),
        current_market_price: project?.current_market_price != null
          ? num(project.current_market_price)
          : undefined,
      }
    })
  } catch {
    return []
  }
}

interface TxnRow {
  id: string
  contract_id: string
  initiator_id: string
  transaction_type: "buy" | "sell" | "deposit" | "withdraw" | "distribution"
  amount: number | string
  shares: number | string | null
  project_id: string | null
  notes: string | null
  created_at: string
  initiator?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
  project?:
    | { name?: string | null }
    | { name?: string | null }[]
    | null
}

export async function getContractTransactions(
  contractId: string,
  limit = 50,
): Promise<ContractTransactionRow[]> {
  if (!contractId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contract_transactions")
      .select(
        `id, contract_id, initiator_id, transaction_type, amount, shares,
         project_id, notes, created_at,
         initiator:profiles!initiator_id ( full_name, username ),
         project:projects!project_id ( name )`,
      )
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as TxnRow[]).map((t): ContractTransactionRow => {
      const init = unwrap(t.initiator)
      const proj = unwrap(t.project)
      return {
        id: t.id,
        contract_id: t.contract_id,
        initiator_id: t.initiator_id,
        initiator_name:
          init?.full_name?.trim() || init?.username?.trim() || "—",
        transaction_type: t.transaction_type,
        amount: num(t.amount),
        shares: t.shares != null ? num(t.shares) : null,
        project_id: t.project_id,
        project_name: proj?.name?.trim() ?? null,
        notes: t.notes,
        created_at: t.created_at,
      }
    })
  } catch {
    return []
  }
}

export interface UpdatePermissionResult {
  success: boolean
  reason?: string
  error?: string
}

export async function updateMemberPermission(
  memberId: string,
  permission: "view_only" | "buy_only" | "buy_and_sell",
): Promise<UpdatePermissionResult> {
  if (!memberId) return { success: false, reason: "missing_id" }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("update_member_permission", {
      p_member_id: memberId,
      p_permission: permission,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      if (code === "42501") return { success: false, reason: "rls", error: error.message }
      return { success: false, reason: "unknown", error: error.message }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string }
    if (!result.success) {
      return { success: false, reason: result.error ?? "unknown" }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Member rows for a contract — used by the permissions panel. */
export interface ContractMemberFull {
  id: string // contract_members.id
  user_id: string
  user_name: string
  share_percent: number
  invite_status: "pending" | "accepted" | "declined"
  permission: ContractMemberPermission
}

export async function getContractMembersFull(
  contractId: string,
): Promise<ContractMemberFull[]> {
  if (!contractId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contract_members")
      .select(
        `id, user_id, share_percent, invite_status, permission,
         member:profiles!user_id ( full_name, username )`,
      )
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true })

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      share_percent: number | string
      invite_status: "pending" | "accepted" | "declined"
      permission: ContractMemberPermission
      member?:
        | { full_name?: string | null; username?: string | null }
        | { full_name?: string | null; username?: string | null }[]
        | null
    }

    return (data as Row[]).map((m) => {
      const member = unwrap(m.member)
      return {
        id: m.id,
        user_id: m.user_id,
        user_name:
          member?.full_name?.trim() || member?.username?.trim() || "—",
        share_percent: num(m.share_percent),
        invite_status: m.invite_status,
        permission: m.permission ?? "view_only",
      }
    })
  } catch {
    return []
  }
}

// ─── End-contract (existing) ──────────────────────────────────

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
