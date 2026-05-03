"use client"

/**
 * Council admin — DB-backed data layer (Phase 7).
 *
 * Reads use the existing council.* tables. Mutations go through
 * dedicated admin RPCs (add/remove members, announce elections,
 * finalise proposals).
 */

import { createClient } from "@/lib/supabase/client"

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
  member_id?: string
  election_id?: string
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
    const result = (data ?? {}) as { success?: boolean; error?: string; member_id?: string; election_id?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return {
      success: true,
      member_id: result.member_id,
      election_id: result.election_id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminAddCouncilMember(input: {
  user_id: string
  role: "founder" | "appointed" | "elected"
  position_title: string
  bio?: string
  term_ends_at?: string
}): Promise<AdminRpcResult> {
  return callRpc("admin_add_council_member", {
    p_user_id: input.user_id,
    p_role: input.role,
    p_position_title: input.position_title,
    p_bio: input.bio ?? null,
    p_term_ends_at: input.term_ends_at ?? null,
  })
}

export async function adminRemoveCouncilMember(
  memberId: string,
  reason?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_remove_council_member", {
    p_member_id: memberId,
    p_reason: reason ?? null,
  })
}

export async function adminUpdateCouncilMember(input: {
  member_id: string
  position_title?: string
  bio?: string
}): Promise<AdminRpcResult> {
  return callRpc("admin_update_council_member", {
    p_member_id: input.member_id,
    p_position_title: input.position_title ?? null,
    p_bio: input.bio ?? null,
  })
}

export async function adminAnnounceElection(input: {
  title: string
  registration_starts: string
  registration_ends: string
  voting_starts: string
  voting_ends: string
  seats_available: number
}): Promise<AdminRpcResult> {
  return callRpc("admin_announce_election", {
    p_title: input.title,
    p_registration_starts: input.registration_starts,
    p_registration_ends: input.registration_ends,
    p_voting_starts: input.voting_starts,
    p_voting_ends: input.voting_ends,
    p_seats_available: input.seats_available,
  })
}

export async function adminFinalizeProposal(
  proposalId: string,
  decision: "approved" | "rejected",
  notes?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_finalize_proposal", {
    p_proposal_id: proposalId,
    p_decision: decision,
    p_notes: notes ?? null,
  })
}
