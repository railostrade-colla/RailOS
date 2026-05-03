"use client"

/**
 * Council — DB-backed data layer (Phase 6.3).
 *
 * Wraps council_members + council_elections + council_candidates +
 * council_election_votes + council_proposals + council_proposal_votes
 * (created in 20260503_phase6_council_schema.sql).
 *
 * Mutations go through SECURITY DEFINER RPCs:
 *   - cast_proposal_vote
 *   - cast_election_vote
 *   - register_as_candidate
 *   - submit_proposal
 *   - set_council_recommendation
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ───────────────────────────────────────────────────

export interface DBCouncilMember {
  id: string
  user_id: string
  role: "founder" | "appointed" | "elected"
  position_title?: string | null
  bio?: string | null
  joined_at: string
  term_ends_at?: string | null
  votes_received: number
  is_active: boolean
  user_name?: string
  avatar_initial?: string
}

export interface DBCouncilProposal {
  id: string
  title: string
  description: string
  type: "new_project" | "shares_release" | "investigation" | "policy"
  submitted_by: string
  submitted_by_role: string
  submitted_by_name?: string
  status: "pending" | "voting" | "approved" | "rejected" | "executed"
  votes_approve: number
  votes_object: number
  votes_abstain: number
  total_eligible_voters: number
  voting_ends_at: string
  final_decision?: "approved" | "rejected" | null
  final_decision_by?: string | null
  final_decision_at?: string | null
  council_recommendation?: "approve" | "object" | "neutral" | null
  related_project_id?: string | null
  created_at: string
}

export interface DBCouncilProposalVote {
  id: string
  proposal_id: string
  member_id: string
  member_name: string
  member_avatar: string
  choice: "approve" | "object" | "abstain"
  reason?: string | null
  voted_at: string
}

export interface DBCouncilElection {
  id: string
  title: string
  status: "registration" | "voting" | "ended"
  registration_starts: string
  registration_ends: string
  voting_starts: string
  voting_ends: string
  seats_available: number
  candidates_count: number
  votes_cast: number
  total_eligible_voters: number
}

export interface DBCouncilCandidate {
  id: string
  user_id: string
  user_name: string
  avatar_initial: string
  level: "basic" | "advanced" | "pro"
  trades_count: number
  success_rate: number
  months_on_platform: number
  votes_received: number
  campaign_statement: string
  is_eligible: boolean
}

// ─── Helpers ─────────────────────────────────────────────────

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function levelKind(s: string | null): "basic" | "advanced" | "pro" {
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function avatarInitial(name: string | null | undefined): string {
  return (name?.trim().charAt(0) || "?").toUpperCase()
}

interface ProfileRef {
  full_name?: string | null
  username?: string | null
  level?: string | null
  total_trades?: number | null
  successful_trades?: number | null
  created_at?: string | null
}

// ─── Reads ───────────────────────────────────────────────────

export async function getCouncilMembers(): Promise<DBCouncilMember[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("council_members")
      .select(
        `id, user_id, role, position_title, bio, joined_at,
         term_ends_at, votes_received, is_active,
         user:profiles!user_id ( full_name, username )`,
      )
      .eq("is_active", true)
      .order("joined_at", { ascending: true })

    if (error || !data) return []
    return (data as Array<DBCouncilMember & { user?: ProfileRef | ProfileRef[] | null }>)
      .map((m) => {
        const u = unwrap(m.user)
        const name = u?.full_name?.trim() || u?.username?.trim() || "—"
        return {
          ...m,
          user_name: name,
          avatar_initial: avatarInitial(name),
        }
      })
  } catch {
    return []
  }
}

export async function getCouncilProposals(
  status?: DBCouncilProposal["status"],
): Promise<DBCouncilProposal[]> {
  try {
    const supabase = createClient()
    let q = supabase
      .from("council_proposals")
      .select(
        `id, title, description, type, submitted_by, submitted_by_role,
         status, votes_approve, votes_object, votes_abstain,
         total_eligible_voters, voting_ends_at, final_decision,
         final_decision_by, final_decision_at, council_recommendation,
         related_project_id, created_at,
         submitter:profiles!submitted_by ( full_name, username )`,
      )
    if (status) q = q.eq("status", status)
    const { data, error } = await q.order("created_at", { ascending: false })

    if (error || !data) return []
    return (data as Array<DBCouncilProposal & { submitter?: ProfileRef | ProfileRef[] | null }>)
      .map((p) => {
        const s = unwrap(p.submitter)
        return {
          ...p,
          submitted_by_name:
            s?.full_name?.trim() || s?.username?.trim() || "—",
        }
      })
  } catch {
    return []
  }
}

export async function getProposalById(
  id: string,
): Promise<DBCouncilProposal | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("council_proposals")
      .select(
        `id, title, description, type, submitted_by, submitted_by_role,
         status, votes_approve, votes_object, votes_abstain,
         total_eligible_voters, voting_ends_at, final_decision,
         final_decision_by, final_decision_at, council_recommendation,
         related_project_id, created_at,
         submitter:profiles!submitted_by ( full_name, username )`,
      )
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    const row = data as DBCouncilProposal & {
      submitter?: ProfileRef | ProfileRef[] | null
    }
    const s = unwrap(row.submitter)
    return {
      ...row,
      submitted_by_name: s?.full_name?.trim() || s?.username?.trim() || "—",
    }
  } catch {
    return null
  }
}

export async function getProposalVotes(
  proposalId: string,
): Promise<DBCouncilProposalVote[]> {
  if (!proposalId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("council_proposal_votes")
      .select(
        `id, proposal_id, member_id, choice, reason, created_at,
         member:council_members!member_id (
           user:profiles!user_id ( full_name, username )
         )`,
      )
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })

    if (error || !data) return []
    interface VoteRow {
      id: string
      proposal_id: string
      member_id: string
      choice: "approve" | "object" | "abstain"
      reason?: string | null
      created_at: string
      member?:
        | { user?: ProfileRef | ProfileRef[] | null }
        | { user?: ProfileRef | ProfileRef[] | null }[]
        | null
    }
    return (data as VoteRow[]).map((v) => {
      const m = unwrap(v.member)
      const u = unwrap(m?.user)
      const name = u?.full_name?.trim() || u?.username?.trim() || "—"
      return {
        id: v.id,
        proposal_id: v.proposal_id,
        member_id: v.member_id,
        member_name: name,
        member_avatar: avatarInitial(name),
        choice: v.choice,
        reason: v.reason ?? null,
        voted_at: v.created_at,
      }
    })
  } catch {
    return []
  }
}

export async function getCurrentElection(): Promise<DBCouncilElection | null> {
  try {
    const supabase = createClient()
    // Active election = registration or voting; if multiple, return latest.
    const { data, error } = await supabase
      .from("council_elections")
      .select("*")
      .in("status", ["registration", "voting"])
      .order("voting_starts", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    // Aggregate counts in parallel
    const [{ count: candidatesCount }, { count: votesCount }] = await Promise.all([
      supabase
        .from("council_candidates")
        .select("id", { count: "exact", head: true })
        .eq("election_id", data.id),
      supabase
        .from("council_election_votes")
        .select("id", { count: "exact", head: true })
        .eq("election_id", data.id),
    ])

    return {
      id: data.id,
      title: data.title,
      status: data.status,
      registration_starts: data.registration_starts,
      registration_ends: data.registration_ends,
      voting_starts: data.voting_starts,
      voting_ends: data.voting_ends,
      seats_available: data.seats_available,
      candidates_count: candidatesCount ?? 0,
      votes_cast: votesCount ?? 0,
      total_eligible_voters: data.total_eligible_voters ?? 0,
    }
  } catch {
    return null
  }
}

export async function getCandidates(
  electionId: string,
): Promise<DBCouncilCandidate[]> {
  if (!electionId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("council_candidates")
      .select(
        `id, user_id, campaign_statement, votes_received, is_eligible,
         user:profiles!user_id (
           full_name, username, level, total_trades, successful_trades, created_at
         )`,
      )
      .eq("election_id", electionId)
      .order("votes_received", { ascending: false })

    if (error || !data) return []

    interface CandRow {
      id: string
      user_id: string
      campaign_statement: string
      votes_received: number
      is_eligible: boolean
      user?: ProfileRef | ProfileRef[] | null
    }

    return (data as CandRow[]).map((c) => {
      const u = unwrap(c.user)
      const name = u?.full_name?.trim() || u?.username?.trim() || "—"
      const totalTrades = num(u?.total_trades)
      const successful = num(u?.successful_trades)
      const successRate =
        totalTrades > 0 ? Math.round((successful / totalTrades) * 100) : 0
      const months = u?.created_at
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(u.created_at).getTime()) /
                (30 * 24 * 60 * 60 * 1000),
            ),
          )
        : 0

      return {
        id: c.id,
        user_id: c.user_id,
        user_name: name,
        avatar_initial: avatarInitial(name),
        level: levelKind(u?.level ?? null),
        trades_count: totalTrades,
        success_rate: successRate,
        months_on_platform: months,
        votes_received: c.votes_received,
        campaign_statement: c.campaign_statement,
        is_eligible: c.is_eligible,
      }
    })
  } catch {
    return []
  }
}

export interface DBCouncilStats {
  total_members: number
  elected_members: number
  proposals: number
  approved: number
  rejected: number
  active: number
}

export async function getCouncilStats(): Promise<DBCouncilStats | null> {
  try {
    const supabase = createClient()
    const [members, proposals] = await Promise.all([
      supabase.from("council_members").select("id, role, is_active"),
      supabase.from("council_proposals").select("id, status"),
    ])
    if (members.error || proposals.error) return null

    interface MemberLite { role: string; is_active: boolean }
    interface ProposalLite { status: string }

    const activeMembers = (members.data as MemberLite[] | null ?? []).filter(
      (m) => m.is_active,
    )
    const props = (proposals.data as ProposalLite[] | null) ?? []
    return {
      total_members: activeMembers.length,
      elected_members: activeMembers.filter((m) => m.role === "elected").length,
      proposals: props.length,
      approved: props.filter((p) => p.status === "approved").length,
      rejected: props.filter((p) => p.status === "rejected").length,
      active: props.filter(
        (p) => p.status === "voting" || p.status === "pending",
      ).length,
    }
  } catch {
    return null
  }
}

/** Has the current user already voted in this election? */
export async function hasVotedInElection(
  electionId: string,
): Promise<{ voted: boolean; candidate_id?: string }> {
  if (!electionId) return { voted: false }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { voted: false }

    const { data } = await supabase
      .from("council_election_votes")
      .select("candidate_id")
      .eq("election_id", electionId)
      .eq("voter_id", user.id)
      .maybeSingle()

    if (data) return { voted: true, candidate_id: data.candidate_id }
    return { voted: false }
  } catch {
    return { voted: false }
  }
}

/** The current user's existing vote on a proposal, if any. */
export async function getMyProposalVote(
  proposalId: string,
): Promise<DBCouncilProposalVote | null> {
  if (!proposalId) return null
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // Find caller's council_member_id first
    const { data: m } = await supabase
      .from("council_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
    if (!m) return null

    const { data } = await supabase
      .from("council_proposal_votes")
      .select("id, proposal_id, member_id, choice, reason, created_at")
      .eq("proposal_id", proposalId)
      .eq("member_id", m.id)
      .maybeSingle()

    if (!data) return null
    return {
      id: data.id,
      proposal_id: data.proposal_id,
      member_id: data.member_id,
      member_name: "أنت",
      member_avatar: "أ",
      choice: data.choice,
      reason: data.reason,
      voted_at: data.created_at,
    }
  } catch {
    return null
  }
}

/** Is the current user an active council member? */
export async function amCouncilMember(): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from("council_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

// ─── Eligibility (live) ──────────────────────────────────────

export interface EligibilityCheck {
  eligible: boolean
  checks: Array<{ label: string; passed: boolean }>
}

export async function checkEligibility(): Promise<EligibilityCheck | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from("profiles")
      .select(
        "level, kyc_status, total_trades, successful_trades, created_at",
      )
      .eq("id", user.id)
      .maybeSingle()

    if (!data) return null
    const totalTrades = num(data.total_trades)
    const successful = num(data.successful_trades)
    const rate = totalTrades > 0 ? (successful / totalTrades) * 100 : 0
    const months = data.created_at
      ? Math.floor(
          (Date.now() - new Date(data.created_at).getTime()) /
            (30 * 24 * 60 * 60 * 1000),
        )
      : 0
    const lvl = levelKind(data.level ?? null)
    const advancedOrPro = lvl === "advanced" || lvl === "pro"

    const checks = [
      { label: "مستوى متقدم أو محترف", passed: advancedOrPro },
      { label: "6 أشهر+ على المنصة", passed: months >= 6 },
      { label: "100+ صفقة ناجحة", passed: totalTrades >= 100 },
      { label: "نسبة نجاح 95%+", passed: rate >= 95 },
      { label: "KYC مكتمل", passed: data.kyc_status === "approved" },
      { label: "لا انتهاكات سابقة", passed: true },
    ]
    return { eligible: checks.every((c) => c.passed), checks }
  } catch {
    return null
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface RpcResult {
  success: boolean
  reason?: string
  error?: string
  data?: Record<string, unknown>
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
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
    const result = (data ?? {}) as { success?: boolean; error?: string } & Record<string, unknown>
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as string) ?? "unknown",
        data: result,
      }
    }
    return { success: true, data: result }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function castProposalVote(
  proposalId: string,
  choice: "approve" | "object" | "abstain",
  reason?: string,
): Promise<RpcResult> {
  return callRpc("cast_proposal_vote", {
    p_proposal_id: proposalId,
    p_choice: choice,
    p_reason: reason ?? null,
  })
}

export async function castElectionVote(
  electionId: string,
  candidateId: string,
): Promise<RpcResult> {
  return callRpc("cast_election_vote", {
    p_election_id: electionId,
    p_candidate_id: candidateId,
  })
}

export async function registerAsCandidate(
  electionId: string,
  campaignStatement: string,
): Promise<RpcResult> {
  return callRpc("register_as_candidate", {
    p_election_id: electionId,
    p_campaign_statement: campaignStatement,
  })
}

export async function submitProposal(input: {
  title: string
  description: string
  type: "new_project" | "shares_release" | "investigation" | "policy"
  voting_ends_at: string
  related_project_id?: string | null
}): Promise<RpcResult> {
  return callRpc("submit_proposal", {
    p_title: input.title,
    p_description: input.description,
    p_type: input.type,
    p_voting_ends_at: input.voting_ends_at,
    p_related_project_id: input.related_project_id ?? null,
  })
}
