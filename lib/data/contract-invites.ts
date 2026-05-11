"use client"

/**
 * contract-invites — Phase 13.58.
 *
 * Two responsibilities:
 *   1. Fetch the signed-in user's oldest pending invite for the
 *      global <ContractInviteModal /> popup
 *   2. Wrap respond_to_contract_invite RPC for the modal's accept
 *      / decline buttons
 *
 * The modal subscribes to contract_members realtime separately; this
 * layer only fires snapshot reads + the response mutation.
 */

import { createClient } from "@/lib/supabase/client"

export interface PendingContractInvite {
  contract_id: string
  contract_title: string
  contract_description: string | null
  total_investment: number
  end_fee_pct: number | null
  creator_id: string
  creator_name: string
  share_percent: number
  invited_at: string
}

export async function getMyPendingContractInvite(): Promise<PendingContractInvite | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // 1) Find the oldest pending invite where user is a member.
    const { data: invite, error: e1 } = await supabase
      .from("contract_members")
      .select("contract_id, share_percent, created_at, invite_status")
      .eq("user_id", user.id)
      .eq("invite_status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (e1 || !invite) return null

    type InviteRow = {
      contract_id: string
      share_percent: number | string | null
      created_at: string
      invite_status: string
    }
    const inv = invite as InviteRow

    // 2) Pull the contract header.
    const { data: contract, error: e2 } = await supabase
      .from("partnership_contracts")
      .select("id, title, description, total_investment, end_fee_pct, creator_id")
      .eq("id", inv.contract_id)
      .maybeSingle()

    if (e2 || !contract) return null

    type ContractRow = {
      id: string
      title: string
      description: string | null
      total_investment: number | string | null
      end_fee_pct: number | string | null
      creator_id: string
    }
    const c = contract as ContractRow

    // 3) Creator's public display name.
    let creatorName = "—"
    try {
      const { data: prof } = await supabase
        .from("profiles_public")
        .select("full_name, username")
        .eq("id", c.creator_id)
        .maybeSingle()
      const p = prof as { full_name?: string | null; username?: string | null } | null
      creatorName =
        p?.full_name?.trim() || p?.username?.trim() || c.creator_id.slice(0, 8)
    } catch { /* fallback to short id */ }

    return {
      contract_id: c.id,
      contract_title: c.title,
      contract_description: c.description,
      total_investment: Number(c.total_investment ?? 0),
      end_fee_pct: c.end_fee_pct != null ? Number(c.end_fee_pct) : null,
      creator_id: c.creator_id,
      creator_name: creatorName,
      share_percent: Number(inv.share_percent ?? 0),
      invited_at: inv.created_at,
    }
  } catch {
    return null
  }
}

export interface RespondResult {
  success: boolean
  accepted?: boolean
  reason?: string
}

export async function respondToContractInvite(
  contractId: string,
  accept: boolean,
  declineReason?: string,
): Promise<RespondResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("respond_to_contract_invite", {
      p_contract_id: contractId,
      p_accept: accept,
      p_decline_reason: declineReason ?? null,
    })
    if (error) {
      return { success: false, reason: error.message }
    }
    type R = { success?: boolean; error?: string; accepted?: boolean }
    const r = (data ?? {}) as R
    if (!r.success) return { success: false, reason: r.error ?? "unknown" }
    return { success: true, accepted: r.accepted }
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : "unknown",
    }
  }
}
