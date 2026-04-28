/**
 * Market Council — members, proposals, voting, elections.
 */

import { USERS } from "./users"

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
export type CouncilRole = "founder" | "appointed" | "elected"
export type ProposalType = "new_project" | "shares_release" | "investigation" | "policy"
export type ProposalStatus = "pending" | "voting" | "approved" | "rejected" | "executed"
export type VoteChoice = "approve" | "object" | "abstain"
export type ElectionStatus = "registration" | "voting" | "ended"

export interface CouncilMember {
  id: string
  user_id: string
  name: string
  avatar_initial: string
  role: CouncilRole
  position_title: string
  joined_at: string
  term_ends_at?: string
  votes_received?: number
  bio?: string
  is_current_user?: boolean
}

export interface CouncilProposal {
  id: string
  title: string
  description: string
  type: ProposalType
  submitted_by: string
  submitted_by_name?: string
  submitted_by_role: "admin" | "council" | "investor"
  status: ProposalStatus
  votes_approve: number
  votes_object: number
  votes_abstain: number
  total_eligible_voters: number
  voting_ends_at: string
  final_decision?: "approved" | "rejected"
  final_decision_by?: string
  final_decision_at?: string
  council_recommendation?: "approve" | "object" | "neutral"
  related_project_id?: string
  related_company_id?: string
  submitted_at: string
}

export interface CouncilVote {
  id: string
  proposal_id: string
  member_id: string
  member_name: string
  member_avatar: string
  choice: VoteChoice
  reason?: string
  voted_at: string
}

export interface CouncilCandidate {
  id: string
  user_id: string
  name: string
  avatar_initial: string
  level: "advanced" | "pro"
  trades_count: number
  success_rate: number
  months_on_platform: number
  votes_received: number
  campaign_statement: string
  is_current_user?: boolean
  is_eligible: boolean
}

export interface CouncilElection {
  id: string
  title: string
  status: ElectionStatus
  registration_starts: string
  registration_ends: string
  voting_starts: string
  voting_ends: string
  seats_available: number
  candidates_count: number
  votes_cast: number
  total_eligible_voters: number
}

// ──────────────────────────────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────────────────────────────
export const COUNCIL_MEMBERS: CouncilMember[] = [
  {
    id: "cm-1",
    user_id: "founder-1",
    name: "أحمد المؤسس",
    avatar_initial: "أ",
    role: "founder",
    position_title: "المؤسس والمدير العام",
    joined_at: "2024-01-01",
    bio: "مؤسس منصة رايلوس وصاحب الرؤية الاستراتيجية",
  },
  {
    id: "cm-2",
    user_id: "admin-1",
    name: "خالد الإداري",
    avatar_initial: "خ",
    role: "appointed",
    position_title: "نائب الرئيس التنفيذي",
    joined_at: "2024-03-01",
    bio: "معيّن من قبل الإدارة لمتابعة العمليات اليومية",
  },
  {
    id: "cm-3",
    user_id: "u_a8f9_3c2b",
    name: "علي حسن",
    avatar_initial: "ع",
    role: "elected",
    position_title: "عضو منتخب",
    joined_at: "2026-01-15",
    term_ends_at: "2027-01-15",
    votes_received: 1240,
    bio: "مستثمر متمرّس في قطاع الزراعة منذ 2018",
  },
  {
    id: "cm-4",
    user_id: "u_b1c4_5d7e",
    name: "محمد أحمد",
    avatar_initial: "م",
    role: "elected",
    position_title: "عضو منتخب",
    joined_at: "2026-01-15",
    term_ends_at: "2027-01-15",
    votes_received: 980,
    bio: "متخصّص في العقارات والاستثمارات الكبرى",
  },
  {
    id: "cm-5",
    user_id: "u_d5e7_8a1b",
    name: "نور الكوفي",
    avatar_initial: "ن",
    role: "elected",
    position_title: "عضو منتخب",
    joined_at: "2026-01-15",
    term_ends_at: "2027-01-15",
    votes_received: 875,
    bio: "خبيرة في تقييم المخاطر وحماية حقوق المستثمرين",
  },
]

export const COUNCIL_PROPOSALS: CouncilProposal[] = [
  {
    id: "cp-1",
    title: "مشروع جديد: مزرعة الخصب الكبرى",
    description: "اقتراح إضافة مشروع زراعي جديد بقيمة 500 مليون د.ع في الكوفة. المشروع يهدف لإنتاج التمور والخضروات للتصدير الإقليمي. مدة المشروع 5 سنوات بعائد متوقّع 15-18% سنوياً.",
    type: "new_project",
    submitted_by: "admin-1",
    submitted_by_name: "خالد الإداري",
    submitted_by_role: "admin",
    status: "voting",
    votes_approve: 2,
    votes_object: 0,
    votes_abstain: 1,
    total_eligible_voters: 5,
    voting_ends_at: new Date(Date.now() + 4 * 86_400_000).toISOString(),
    submitted_at: "2026-04-22",
    council_recommendation: "approve",
  },
  {
    id: "cp-2",
    title: "إطلاق دفعة حصص جديدة لبرج بغداد",
    description: "اقتراح إطلاق 1000 حصة إضافية بسعر السوق الحالي (250,000 د.ع) لتمويل توسعة الطابق التجاري. الإطلاق سيكون عبر مزاد علني.",
    type: "shares_release",
    submitted_by: "founder-1",
    submitted_by_name: "أحمد المؤسس",
    submitted_by_role: "admin",
    status: "approved",
    votes_approve: 4,
    votes_object: 1,
    votes_abstain: 0,
    total_eligible_voters: 5,
    voting_ends_at: "2026-04-20",
    submitted_at: "2026-04-15",
    final_decision: "approved",
    final_decision_by: "أحمد المؤسس",
    final_decision_at: "2026-04-21",
    council_recommendation: "approve",
    related_project_id: "2",
  },
  {
    id: "cp-3",
    title: "طلب تحقيق: شكوى من مستخدم",
    description: "تحقيق في شكوى تأخير معاملة في مشروع نخيل العراق. المستخدم يدّعي تأخير 14 يوماً في تحويل الأرباح الربعية.",
    type: "investigation",
    submitted_by: "cm-3",
    submitted_by_name: "علي حسن",
    submitted_by_role: "council",
    status: "pending",
    votes_approve: 0,
    votes_object: 0,
    votes_abstain: 0,
    total_eligible_voters: 5,
    voting_ends_at: new Date(Date.now() + 9 * 86_400_000).toISOString(),
    submitted_at: "2026-04-25",
  },
  {
    id: "cp-4",
    title: "اقتراح تعديل: رسوم العقود الجماعية",
    description: "تعديل رسوم إنهاء العقد من 0.10% إلى 0.15% لتغطية مصاريف التوزيع التلقائي.",
    type: "policy",
    submitted_by: "cm-4",
    submitted_by_name: "محمد أحمد",
    submitted_by_role: "council",
    status: "rejected",
    votes_approve: 1,
    votes_object: 3,
    votes_abstain: 1,
    total_eligible_voters: 5,
    voting_ends_at: "2026-04-10",
    submitted_at: "2026-04-01",
    final_decision: "rejected",
    final_decision_by: "أحمد المؤسس",
    final_decision_at: "2026-04-12",
    council_recommendation: "object",
  },
]

export const COUNCIL_VOTES: CouncilVote[] = [
  // cp-1 votes (2 approve, 1 abstain so far)
  { id: "v1", proposal_id: "cp-1", member_id: "cm-3", member_name: "علي حسن",   member_avatar: "ع", choice: "approve", reason: "مشروع واعد ودراسة جدوى متينة", voted_at: new Date(Date.now() - 6 * 3_600_000).toISOString() },
  { id: "v2", proposal_id: "cp-1", member_id: "cm-4", member_name: "محمد أحمد", member_avatar: "م", choice: "approve", reason: "موقع استراتيجي ممتاز",            voted_at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
  { id: "v3", proposal_id: "cp-1", member_id: "cm-5", member_name: "نور الكوفي", member_avatar: "ن", choice: "abstain", reason: "أحتاج معلومات إضافية",        voted_at: new Date(Date.now() - 1 * 3_600_000).toISOString() },

  // cp-2 votes (final 4-1-0)
  { id: "v4", proposal_id: "cp-2", member_id: "cm-3", member_name: "علي حسن",   member_avatar: "ع", choice: "approve",                                          voted_at: "2026-04-18T10:00:00" },
  { id: "v5", proposal_id: "cp-2", member_id: "cm-4", member_name: "محمد أحمد", member_avatar: "م", choice: "approve",                                          voted_at: "2026-04-18T11:30:00" },
  { id: "v6", proposal_id: "cp-2", member_id: "cm-5", member_name: "نور الكوفي", member_avatar: "ن", choice: "object", reason: "السعر مرتفع نسبياً",            voted_at: "2026-04-19T09:15:00" },

  // cp-4 votes (rejected — 1 approve, 3 object, 1 abstain)
  { id: "v7", proposal_id: "cp-4", member_id: "cm-3", member_name: "علي حسن",   member_avatar: "ع", choice: "object", reason: "زيادة الرسوم تثقل كاهل المستثمرين", voted_at: "2026-04-08T14:00:00" },
  { id: "v8", proposal_id: "cp-4", member_id: "cm-5", member_name: "نور الكوفي", member_avatar: "ن", choice: "object",                                          voted_at: "2026-04-09T10:00:00" },
]

export const CURRENT_ELECTION: CouncilElection = {
  id: "el-1",
  title: "انتخابات مجلس السوق - 2027",
  status: "voting",
  registration_starts: "2026-04-01",
  registration_ends: "2026-04-15",
  voting_starts: "2026-04-25",
  voting_ends: new Date(Date.now() + 9 * 86_400_000).toISOString(),
  seats_available: 3,
  candidates_count: 5,
  votes_cast: 4520,
  total_eligible_voters: 8500,
}

export const COUNCIL_CANDIDATES: CouncilCandidate[] = [
  {
    id: "cc-1",
    user_id: "u_x1",
    name: "ليلى جاسم",
    avatar_initial: "ل",
    level: "pro",
    trades_count: 680,
    success_rate: 97.8,
    months_on_platform: 22,
    votes_received: 2100,
    campaign_statement: "صوت المستثمرين الصغار في المجلس. أعدكم بالشفافية والمحاسبة.",
    is_eligible: true,
  },
  {
    id: "cc-2",
    user_id: "u_x2",
    name: "سارة أحمد",
    avatar_initial: "س",
    level: "pro",
    trades_count: 540,
    success_rate: 98.2,
    months_on_platform: 18,
    votes_received: 1850,
    campaign_statement: "أعدكم بالشفافية الكاملة ومراقبة فعّالة للمشاريع.",
    is_eligible: true,
  },
  {
    id: "cc-3",
    user_id: "u_x3",
    name: "حسن علي",
    avatar_initial: "ح",
    level: "advanced",
    trades_count: 215,
    success_rate: 96.5,
    months_on_platform: 14,
    votes_received: 1420,
    campaign_statement: "خبرة في تحليل المشاريع الزراعية والصناعية.",
    is_eligible: true,
  },
  {
    id: "cc-4",
    user_id: "u_x4",
    name: "زينب محمود",
    avatar_initial: "ز",
    level: "pro",
    trades_count: 310,
    success_rate: 97.1,
    months_on_platform: 12,
    votes_received: 980,
    campaign_statement: "تركيز على حماية حقوق صغار المستثمرين والشفافية.",
    is_eligible: true,
  },
  {
    id: "cc-5",
    user_id: "u_x5",
    name: "كريم سلمان",
    avatar_initial: "ك",
    level: "advanced",
    trades_count: 145,
    success_rate: 95.8,
    months_on_platform: 9,
    votes_received: 720,
    campaign_statement: "إصلاحات في آلية التصويت لجعلها أكثر تمثيلاً.",
    is_eligible: true,
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function getCouncilMembers(): CouncilMember[] {
  return COUNCIL_MEMBERS
}

export function getCouncilProposals(status?: ProposalStatus): CouncilProposal[] {
  return status ? COUNCIL_PROPOSALS.filter((p) => p.status === status) : COUNCIL_PROPOSALS
}

export function getProposalById(id: string): CouncilProposal | undefined {
  return COUNCIL_PROPOSALS.find((p) => p.id === id)
}

export function getProposalVotes(proposalId: string): CouncilVote[] {
  return COUNCIL_VOTES.filter((v) => v.proposal_id === proposalId)
    .sort((a, b) => (a.voted_at < b.voted_at ? 1 : -1))
}

export function getCurrentElection(): CouncilElection {
  return CURRENT_ELECTION
}

export function getCandidates(): CouncilCandidate[] {
  return [...COUNCIL_CANDIDATES].sort((a, b) => b.votes_received - a.votes_received)
}

export interface EligibilityCheck {
  eligible: boolean
  checks: Array<{ label: string; passed: boolean }>
}

export function checkEligibility(_userId: string = "me"): EligibilityCheck {
  // Mock — derive from CURRENT_USER (assumed advanced)
  const tradesCount = 250
  const successRate = 96.5
  const monthsOnPlatform = 8
  const level: "basic" | "advanced" | "pro" = "advanced"
  const kycComplete = true
  const noViolations = true

  const isAdvancedOrPro: boolean = level === "advanced" || level === "pro"

  const checks = [
    { label: "مستوى متقدم أو محترف",      passed: isAdvancedOrPro },
    { label: "6 أشهر+ على المنصة",       passed: monthsOnPlatform >= 6 },
    { label: "100+ صفقة ناجحة",          passed: tradesCount >= 100 },
    { label: "نسبة نجاح 95%+",           passed: successRate >= 95 },
    { label: "KYC مكتمل",                passed: kycComplete },
    { label: "لا انتهاكات سابقة",        passed: noViolations },
  ]

  return { eligible: checks.every((c) => c.passed), checks }
}

export function getCouncilStats() {
  const proposals = COUNCIL_PROPOSALS.length
  const approved = COUNCIL_PROPOSALS.filter((p) => p.status === "approved").length
  const rejected = COUNCIL_PROPOSALS.filter((p) => p.status === "rejected").length
  const active = COUNCIL_PROPOSALS.filter((p) => p.status === "voting" || p.status === "pending").length
  return {
    total_members: COUNCIL_MEMBERS.length,
    elected_members: COUNCIL_MEMBERS.filter((m) => m.role === "elected").length,
    proposals,
    approved,
    rejected,
    active,
  }
}

/** Is the current user a council member (used to gate voting UI). */
export function isCouncilMember(_userId: string = "me"): boolean {
  return false
}

// ──────────────────────────────────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────────────────────────────────
export interface CouncilNotification {
  id: string
  type: "council_proposal" | "council_decision" | "election"
  icon: string
  title: string
  desc: string
  time: string
  href: string
  is_unread: boolean
}

export function generateCouncilNotifications(_userId: string = "me"): CouncilNotification[] {
  return [
    {
      id: "cn-1",
      type: "council_proposal",
      icon: "📋",
      title: "قرار جديد للتصويت",
      desc: "مشروع جديد: مزرعة الخصب الكبرى",
      time: "منذ ساعة",
      href: "/council/proposals/cp-1",
      is_unread: true,
    },
    {
      id: "cn-2",
      type: "council_decision",
      icon: "✅",
      title: "تم اعتماد إطلاق حصص برج بغداد",
      desc: "بقرار من المؤسس بعد توصية المجلس",
      time: "أمس",
      href: "/council/proposals/cp-2",
      is_unread: true,
    },
    {
      id: "cn-3",
      type: "election",
      icon: "🗳️",
      title: "الانتخابات بدأت!",
      desc: "صوّت لمرشّحك في مجلس السوق",
      time: "منذ يومين",
      href: "/council/elections",
      is_unread: false,
    },
  ]
}

// Suppress unused import warning — kept for future user-derived eligibility
void USERS
