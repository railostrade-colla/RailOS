import { createClient } from "@/lib/supabase/client"

export interface DBCouncilMember {
  id: string
  user_id: string
  role: string
  position_title?: string
  bio?: string
  joined_at?: string
  term_ends_at?: string
  votes_received?: number
  is_active?: boolean
}

export interface DBCouncilProposal {
  id: string
  title: string
  description: string
  type: string
  submitted_by: string
  submitted_by_role: string
  status: string
  votes_approve: number
  votes_object: number
  votes_abstain: number
  total_eligible_voters: number
  voting_ends_at: string
  final_decision?: string
  council_recommendation?: string
  related_project_id?: string
  created_at?: string
}

export async function getCouncilMembers(): Promise<DBCouncilMember[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("council_members")
      .select("*")
      .eq("is_active", true)
      .order("joined_at", { ascending: true })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getCouncilProposals(status?: string): Promise<DBCouncilProposal[]> {
  try {
    const supabase = createClient()
    let q = supabase.from("council_proposals").select("*")
    if (status) q = q.eq("status", status)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}

export async function getCouncilStats() {
  try {
    const supabase = createClient()
    const [members, proposals] = await Promise.all([
      supabase.from("council_members").select("id, role, is_active"),
      supabase.from("council_proposals").select("id, status"),
    ])
    if (members.error || proposals.error) {
      return null
    }
    const activeMembers = (members.data ?? []).filter((m: any) => m.is_active)
    const props = proposals.data ?? []
    return {
      total_members: activeMembers.length,
      elected_members: activeMembers.filter((m: any) => m.role === "elected").length,
      proposals: props.length,
      approved: props.filter((p: any) => p.status === "approved").length,
      rejected: props.filter((p: any) => p.status === "rejected").length,
      active: props.filter((p: any) => p.status === "voting" || p.status === "pending").length,
    }
  } catch {
    return null
  }
}
