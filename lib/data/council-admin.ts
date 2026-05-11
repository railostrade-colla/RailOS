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

/**
 * Phase 13.61 — one-click election kick-off.
 *
 * Announces a new election with the candidacy door OPEN immediately
 * (registration_starts = now) and reasonable default windows:
 *   • registration window: now → +14 days
 *   • voting window:       +14 days → +21 days
 *
 * Used by the "إجراء انتخابات وفتح باب الترشيح" button in the
 * admin council panel so the founder doesn't have to fill the
 * scheduling form for a regular cycle.
 */
export async function adminQuickStartElection(input: {
  title?: string
  seats_available?: number
  registration_days?: number
  voting_days?: number
}): Promise<AdminRpcResult> {
  const now = new Date()
  const regDays = Math.max(1, input.registration_days ?? 14)
  const voteDays = Math.max(1, input.voting_days ?? 7)
  const regStart = now
  const regEnd = new Date(now.getTime() + regDays * 86_400_000)
  const voteStart = regEnd
  const voteEnd = new Date(voteStart.getTime() + voteDays * 86_400_000)
  const title =
    input.title?.trim() ||
    `انتخابات المجلس — ${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`

  return adminAnnounceElection({
    title,
    registration_starts: regStart.toISOString(),
    registration_ends:   regEnd.toISOString(),
    voting_starts:       voteStart.toISOString(),
    voting_ends:         voteEnd.toISOString(),
    seats_available:     Math.max(1, input.seats_available ?? 5),
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
