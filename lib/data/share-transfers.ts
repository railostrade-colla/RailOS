"use client"

/**
 * Share transfers data layer (Phase 8.3).
 *
 * Wraps the share_transfers table + 3 SECURITY DEFINER RPCs:
 *   - submit_share_transfer       (sender → recipient, locks shares)
 *   - respond_to_share_transfer   (recipient accepts / rejects)
 *   - cancel_share_transfer       (sender cancels while pending)
 *
 * On accept the holdings rows are mutated atomically server-side
 * and the sender pays a 2% fee from fee_unit_balances when present.
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export type ShareTransferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired"

export interface ShareTransferRow {
  id: string
  sender_id: string
  sender_name: string
  recipient_id: string
  recipient_name: string
  project_id: string
  project_name: string
  shares: number
  transfer_fee_pct: number
  fee_amount: number
  status: ShareTransferStatus
  message: string | null
  rejection_reason: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
  applied_at: string | null
  /** "incoming" | "outgoing" relative to the calling user. */
  direction: "incoming" | "outgoing" | "other"
}

export interface ShareTransferRpcResult {
  success: boolean
  reason?: string
  error?: string
  transfer_id?: string
  fee_amount?: number
  available?: number
  accepted?: boolean
  fee_deducted?: number
}

// ─── Helpers ─────────────────────────────────────────────────

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function profileName(p: ProfileRef | null | undefined): string {
  return p?.full_name?.trim() || p?.username?.trim() || "—"
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

interface RawTransferRow {
  id: string
  sender_id: string
  recipient_id: string
  project_id: string
  shares: number | string
  transfer_fee_pct: number | string
  fee_amount: number | string
  status: ShareTransferStatus
  message: string | null
  rejection_reason: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
  applied_at: string | null
  sender?: ProfileRef | ProfileRef[] | null
  recipient?: ProfileRef | ProfileRef[] | null
  project?: { name?: string | null } | { name?: string | null }[] | null
}

function mapTransferRow(r: RawTransferRow, currentUid: string): ShareTransferRow {
  const project = unwrap(r.project)
  const direction: ShareTransferRow["direction"] =
    r.sender_id === currentUid
      ? "outgoing"
      : r.recipient_id === currentUid
        ? "incoming"
        : "other"
  return {
    id: r.id,
    sender_id: r.sender_id,
    sender_name: profileName(unwrap(r.sender)),
    recipient_id: r.recipient_id,
    recipient_name: profileName(unwrap(r.recipient)),
    project_id: r.project_id,
    project_name: project?.name?.trim() || "—",
    shares: num(r.shares),
    transfer_fee_pct: num(r.transfer_fee_pct),
    fee_amount: num(r.fee_amount),
    status: r.status,
    message: r.message,
    rejection_reason: r.rejection_reason,
    created_at: r.created_at,
    expires_at: r.expires_at,
    responded_at: r.responded_at,
    applied_at: r.applied_at,
    direction,
  }
}

// ─── Reads ───────────────────────────────────────────────────

export interface MyTransfersBucket {
  incoming: ShareTransferRow[]
  outgoing: ShareTransferRow[]
}

export async function getMyShareTransfers(
  options: { onlyPending?: boolean } = {},
): Promise<MyTransfersBucket> {
  const empty: MyTransfersBucket = { incoming: [], outgoing: [] }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return empty

    let query = supabase
      .from("share_transfers")
      .select(
        `id, sender_id, recipient_id, project_id, shares, transfer_fee_pct,
         fee_amount, status, message, rejection_reason, created_at,
         expires_at, responded_at, applied_at,
         sender:profiles!sender_id ( full_name, username ),
         recipient:profiles!recipient_id ( full_name, username ),
         project:projects!project_id ( name )`,
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })

    if (options.onlyPending) {
      query = query.eq("status", "pending")
    }

    const { data, error } = await query
    if (error || !data) return empty

    const rows = (data as RawTransferRow[]).map((r) => mapTransferRow(r, user.id))
    return {
      incoming: rows.filter((r) => r.direction === "incoming"),
      outgoing: rows.filter((r) => r.direction === "outgoing"),
    }
  } catch {
    return empty
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<ShareTransferRpcResult> {
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
    const result = (data ?? {}) as ShareTransferRpcResult
    if (!result.success) {
      return {
        success: false,
        reason: result.reason ?? (result as { error?: string }).error ?? "unknown",
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

export async function submitShareTransfer(input: {
  recipient_id: string
  project_id: string
  shares: number
  message?: string
}): Promise<ShareTransferRpcResult> {
  return callRpc("submit_share_transfer", {
    p_recipient_id: input.recipient_id,
    p_project_id: input.project_id,
    p_shares: input.shares,
    p_message: input.message ?? null,
  })
}

export async function respondToShareTransfer(
  transferId: string,
  accept: boolean,
  reason?: string,
): Promise<ShareTransferRpcResult> {
  return callRpc("respond_to_share_transfer", {
    p_transfer_id: transferId,
    p_accept: accept,
    p_reason: reason ?? null,
  })
}

export async function cancelShareTransfer(
  transferId: string,
): Promise<ShareTransferRpcResult> {
  return callRpc("cancel_share_transfer", { p_transfer_id: transferId })
}
