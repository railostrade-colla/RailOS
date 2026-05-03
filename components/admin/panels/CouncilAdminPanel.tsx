"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  COUNCIL_MEMBERS,
  COUNCIL_PROPOSALS,
  CURRENT_ELECTION,
  COUNCIL_CANDIDATES,
  getCouncilStats as getCouncilStatsMock,
  type CouncilMember,
  type CouncilProposal,
  type CouncilRole,
  type ProposalType,
  type ProposalStatus,
  type CouncilElection,
  type CouncilCandidate,
} from "@/lib/mock-data/council"
import {
  getCouncilMembers as dbGetCouncilMembers,
  getCouncilProposals as dbGetCouncilProposals,
  getCurrentElection as dbGetCurrentElection,
  getCandidates as dbGetCandidates,
  getCouncilStats as dbGetCouncilStats,
} from "@/lib/data/council"
import {
  adminAddCouncilMember,
  adminRemoveCouncilMember,
  adminUpdateCouncilMember,
  adminAnnounceElection,
  adminFinalizeProposal,
} from "@/lib/data/council-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const ROLE_META: Record<CouncilRole, { label: string; color: "purple" | "blue" | "green" }> = {
  founder: { label: "مؤسس", color: "purple" },
  appointed: { label: "معيّن", color: "blue" },
  elected: { label: "منتخب", color: "green" },
}

const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  new_project: "مشروع جديد",
  shares_release: "إطلاق حصص",
  investigation: "تحقيق",
  policy: "سياسة",
}

const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; color: "yellow" | "blue" | "green" | "red" | "purple" }> = {
  pending: { label: "بانتظار التصويت", color: "yellow" },
  voting: { label: "تصويت نشط", color: "blue" },
  approved: { label: "مُوافَق", color: "green" },
  rejected: { label: "مرفوض", color: "red" },
  executed: { label: "مُنفَّذ", color: "purple" },
}

type SubTab = "members" | "proposals" | "elections"
type MemberAction = null | "remove" | "edit_bio" | "add"
type ProposalAction = null | "execute"

export function CouncilAdminPanel() {
  const [tab, setTab] = useState<SubTab>("members")
  const [submitting, setSubmitting] = useState(false)

  // Mock first-paint, real DB on mount.
  const [members, setMembers] = useState<CouncilMember[]>(COUNCIL_MEMBERS)
  const [proposals, setProposals] = useState<CouncilProposal[]>(COUNCIL_PROPOSALS)
  const [election, setElection] = useState<CouncilElection>(CURRENT_ELECTION)
  const [candidates, setCandidates] = useState<CouncilCandidate[]>(COUNCIL_CANDIDATES)
  const [stats, setStats] = useState(getCouncilStatsMock())

  const refresh = () => {
    Promise.all([
      dbGetCouncilMembers(),
      dbGetCouncilProposals(),
      dbGetCurrentElection(),
      dbGetCouncilStats(),
    ]).then(async ([m, p, e, s]) => {
      if (m.length > 0) {
        setMembers(m.map((row): CouncilMember => ({
          id: row.id,
          user_id: row.user_id,
          name: row.user_name ?? "—",
          avatar_initial: row.avatar_initial ?? "?",
          role: row.role,
          position_title: row.position_title ?? "",
          joined_at: row.joined_at?.split("T")[0] ?? "—",
          term_ends_at: row.term_ends_at ?? undefined,
          votes_received: row.votes_received,
          bio: row.bio ?? undefined,
        })))
      }
      if (p.length > 0) {
        setProposals(p.map((row): CouncilProposal => ({
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.type as ProposalType,
          submitted_by: row.submitted_by,
          submitted_by_name: row.submitted_by_name,
          submitted_by_role: row.submitted_by_role as CouncilProposal["submitted_by_role"],
          status: row.status,
          votes_approve: row.votes_approve,
          votes_object: row.votes_object,
          votes_abstain: row.votes_abstain,
          total_eligible_voters: row.total_eligible_voters,
          voting_ends_at: row.voting_ends_at,
          final_decision: row.final_decision ?? undefined,
          final_decision_by: row.final_decision_by ?? undefined,
          final_decision_at: row.final_decision_at?.split("T")[0] ?? undefined,
          council_recommendation: (row.council_recommendation ?? undefined) as CouncilProposal["council_recommendation"],
          related_project_id: row.related_project_id ?? undefined,
          submitted_at: row.created_at?.split("T")[0] ?? "—",
        })))
      }
      if (e) {
        setElection({
          id: e.id,
          title: e.title,
          status: e.status,
          registration_starts: e.registration_starts,
          registration_ends: e.registration_ends,
          voting_starts: e.voting_starts,
          voting_ends: e.voting_ends,
          seats_available: e.seats_available,
          candidates_count: e.candidates_count,
          votes_cast: e.votes_cast,
          total_eligible_voters: e.total_eligible_voters,
        })
        const cands = await dbGetCandidates(e.id)
        if (cands.length > 0) {
          setCandidates(cands.map((c): CouncilCandidate => ({
            id: c.id,
            user_id: c.user_id,
            name: c.user_name,
            avatar_initial: c.avatar_initial,
            level: c.level === "basic" ? "advanced" : c.level,
            trades_count: c.trades_count,
            success_rate: c.success_rate,
            months_on_platform: c.months_on_platform,
            votes_received: c.votes_received,
            campaign_statement: c.campaign_statement,
            is_eligible: c.is_eligible,
          })))
        }
      }
      if (s) setStats(s)
    })
  }
  useEffect(() => {
    refresh()
  }, [])
  void submitting

  // Member actions
  const [selectedMember, setSelectedMember] = useState<CouncilMember | null>(null)
  const [memberAction, setMemberAction] = useState<MemberAction>(null)
  const [memberBio, setMemberBio] = useState("")
  const [removeReason, setRemoveReason] = useState("")
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState("")
  const [newMemberTitle, setNewMemberTitle] = useState("")

  // Proposal actions
  const [selectedProposal, setSelectedProposal] = useState<CouncilProposal | null>(null)
  const [proposalAction, setProposalAction] = useState<ProposalAction>(null)
  const [decision, setDecision] = useState<"approved" | "rejected">("approved")
  const [decisionNotes, setDecisionNotes] = useState("")

  // Election announcement form
  const [showAnnounceElection, setShowAnnounceElection] = useState(false)
  const [electionTitle, setElectionTitle] = useState("")
  const [regStart, setRegStart] = useState("")
  const [regEnd, setRegEnd] = useState("")
  const [voteStart, setVoteStart] = useState("")
  const [voteEnd, setVoteEnd] = useState("")
  const [seatsCount, setSeatsCount] = useState("3")
  const [conditions, setConditions] = useState("")
  const [publishOfficial, setPublishOfficial] = useState(true)

  // Candidate promotion
  const [showPromoCandidate, setShowPromoCandidate] = useState(false)
  const [promoCandidate, setPromoCandidate] = useState<string>("")
  const [promoType, setPromoType] = useState<"banner" | "popup" | "notification">("banner")
  const [promoDuration, setPromoDuration] = useState<3 | 7 | 14>(7)
  const [promoText, setPromoText] = useState("")
  const PROMO_COSTS: Record<3 | 7 | 14, number> = { 3: 50, 7: 100, 14: 180 }

  const handleAnnounceElection = async () => {
    if (!electionTitle.trim() || !regStart || !regEnd || !voteStart || !voteEnd || !seatsCount) {
      return showError("املأ كل الحقول الإجبارية")
    }
    setSubmitting(true)
    const result = await adminAnnounceElection({
      title: electionTitle.trim(),
      registration_starts: new Date(regStart).toISOString(),
      registration_ends: new Date(regEnd).toISOString(),
      voting_starts: new Date(voteStart).toISOString(),
      voting_ends: new Date(voteEnd).toISOString(),
      seats_available: Number(seatsCount),
    })
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_seats: "عدد المقاعد غير صحيح",
        invalid_dates: "التواريخ غير صحيحة",
        missing_table: "الجداول غير منشورة",
      }
      showError(map[result.reason ?? ""] ?? "فشل الإنشاء")
      setSubmitting(false)
      return
    }
    showSuccess(`✅ تم إنشاء "${electionTitle}"${publishOfficial ? " + إعلان رسمي" : ""}`)
    setShowAnnounceElection(false)
    setElectionTitle(""); setRegStart(""); setRegEnd(""); setVoteStart(""); setVoteEnd("")
    setSeatsCount("3"); setConditions(""); setPublishOfficial(true)
    setSubmitting(false)
    refresh()
  }

  const handlePromoCandidate = () => {
    if (!promoCandidate || !promoText.trim()) {
      return showError("اختر مرشّحاً + اكتب نصّاً ترويجياً")
    }
    const candidate = candidates.find((c) => c.id === promoCandidate)
    showSuccess(`✅ تم تفعيل ترويج ${candidate?.name} (${promoDuration} أيام) — خُصمت ${PROMO_COSTS[promoDuration]} وحدة`)
    setShowPromoCandidate(false)
    setPromoCandidate(""); setPromoType("banner"); setPromoDuration(7); setPromoText("")
  }

  const closeMember = () => {
    setSelectedMember(null)
    setMemberAction(null)
    setMemberBio("")
    setRemoveReason("")
  }

  const closeProposal = () => {
    setSelectedProposal(null)
    setProposalAction(null)
    setDecisionNotes("")
    setDecision("approved")
  }

  const handleMemberAction = async () => {
    if (!selectedMember || !memberAction) return
    if (memberAction === "remove" && !removeReason.trim()) {
      showError("سبب الإقالة مطلوب")
      return
    }
    if (memberAction === "edit_bio" && !memberBio.trim()) {
      showError("النبذة لا يمكن أن تكون فارغة")
      return
    }
    setSubmitting(true)
    if (memberAction === "remove") {
      const result = await adminRemoveCouncilMember(selectedMember.id, removeReason.trim())
      if (!result.success) { showError("فشل الإقالة"); setSubmitting(false); return }
      showSuccess(`✅ تمت إقالة ${selectedMember.name}`)
    } else if (memberAction === "edit_bio") {
      const result = await adminUpdateCouncilMember({
        member_id: selectedMember.id,
        bio: memberBio.trim(),
      })
      if (!result.success) { showError("فشل التحديث"); setSubmitting(false); return }
      showSuccess("✅ تم تحديث النبذة")
    }
    setSubmitting(false)
    closeMember()
    refresh()
  }

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberTitle.trim()) {
      showError("الاسم والمنصب مطلوبان")
      return
    }
    // The user_id mapping needs admin selection — for now, show a hint.
    // The form is missing a user picker. Keep optimistic toast until we
    // add a profile-search input.
    showSuccess(`✅ ${newMemberName} (الإضافة الفعلية تحتاج اختيار user_id من قائمة الملفات)`)
    setShowAddMember(false)
    setNewMemberName("")
    setNewMemberTitle("")
    void adminAddCouncilMember
  }

  const handleExecuteDecision = async () => {
    if (!selectedProposal) return
    if (!decisionNotes.trim()) {
      showError("ملاحظات القرار مطلوبة")
      return
    }
    setSubmitting(true)
    const result = await adminFinalizeProposal(
      selectedProposal.id,
      decision,
      decisionNotes.trim(),
    )
    if (!result.success) { showError("فشل تنفيذ القرار"); setSubmitting(false); return }
    const recommendation = selectedProposal.council_recommendation
    const matches = (decision === "approved" && recommendation === "approve") ||
                    (decision === "rejected" && recommendation === "object")
    if (!matches && recommendation && recommendation !== "neutral") {
      showSuccess(`⚠️ تم تنفيذ القرار رغم مخالفته لتوصية المجلس`)
    } else {
      showSuccess(`✅ تم تنفيذ القرار: ${decision === "approved" ? "موافقة" : "رفض"}`)
    }
    setSubmitting(false)
    closeProposal()
    refresh()
  }

  const tabs = [
    { key: "members", label: "👥 الأعضاء", count: stats.total_members },
    { key: "proposals", label: "📜 المقترحات", count: stats.proposals },
    { key: "elections", label: "🗳️ الانتخابات", count: undefined },
  ]

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🏛️ مجلس السوق — الإدارة"
        subtitle="إدارة الأعضاء وتنفيذ قرارات المجلس وإدارة الانتخابات"
      />

      <InnerTabBar tabs={tabs} active={tab} onSelect={(k) => setTab(k as SubTab)} />

      {/* ═══════════ TAB 1: MEMBERS ═══════════ */}
      {tab === "members" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="إجمالي" val={members.length} color="#fff" />
            <KPI label="منتخبون" val={members.filter((m) => m.role === "elected").length} color="#4ADE80" />
            <KPI label="معيّنون" val={members.filter((m) => m.role === "appointed").length} color="#60A5FA" />
            <KPI label="مؤسس" val={members.filter((m) => m.role === "founder").length} color="#a855f7" />
          </div>

          <div className="flex justify-end mb-3">
            <ActionBtn label="+ إضافة عضو معيّن" color="purple" onClick={() => setShowAddMember(true)} />
          </div>

          <Table>
            <THead>
              <TH>العضو</TH>
              <TH>الدور</TH>
              <TH>المنصب</TH>
              <TH>الانضمام</TH>
              <TH>نهاية الدورة</TH>
              <TH>الأصوات</TH>
              <TH>إجراءات</TH>
            </THead>
            <TBody>
              {members.map((m) => {
                const r = ROLE_META[m.role]
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-xs font-bold text-purple-300">
                          {m.avatar_initial}
                        </div>
                        <div>
                          <div className="text-xs text-white font-bold">{m.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{m.user_id}</div>
                        </div>
                      </div>
                    </TD>
                    <TD><Badge label={r.label} color={r.color} /></TD>
                    <TD>{m.position_title}</TD>
                    <TD><span className="text-[11px] text-neutral-500">{m.joined_at}</span></TD>
                    <TD><span className="text-[11px] text-neutral-500">{m.term_ends_at || "—"}</span></TD>
                    <TD>
                      {m.votes_received !== undefined ? (
                        <span className="font-mono text-green-400 font-bold">{fmtNum(m.votes_received)}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <ActionBtn label="عرض" color="gray" sm onClick={() => { setSelectedMember(m); setMemberBio(m.bio || "") }} />
                        {m.role !== "founder" && (
                          <ActionBtn label="إقالة" color="red" sm onClick={() => { setSelectedMember(m); setMemberAction("remove") }} />
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </>
      )}

      {/* ═══════════ TAB 2: PROPOSALS ═══════════ */}
      {tab === "proposals" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KPI label="بانتظار التصويت" val={proposals.filter((p) => p.status === "pending").length} color="#FBBF24" />
            <KPI label="تصويت نشط" val={proposals.filter((p) => p.status === "voting").length} color="#60A5FA" />
            <KPI label="مُوافَق" val={proposals.filter((p) => p.status === "approved").length} color="#4ADE80" />
            <KPI label="مرفوض" val={proposals.filter((p) => p.status === "rejected").length} color="#F87171" />
          </div>

          {proposals.length === 0 ? (
            <AdminEmpty title="لا توجد مقترحات" />
          ) : (
            <Table>
              <THead>
                <TH>العنوان</TH>
                <TH>النوع</TH>
                <TH>مُقدِّم</TH>
                <TH>الحالة</TH>
                <TH>التصويت (موافقة / اعتراض / امتناع)</TH>
                <TH>التوصية</TH>
                <TH>إجراءات</TH>
              </THead>
              <TBody>
                {proposals.map((p) => {
                  const st = PROPOSAL_STATUS_META[p.status]
                  const total = p.votes_approve + p.votes_object + p.votes_abstain
                  return (
                    <TR key={p.id}>
                      <TD>
                        <div className="text-xs text-white font-bold max-w-xs truncate">{p.title}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{p.id}</div>
                      </TD>
                      <TD>{PROPOSAL_TYPE_LABELS[p.type]}</TD>
                      <TD>
                        <div className="text-[11px]">
                          <div className="text-white">{p.submitted_by_name || p.submitted_by}</div>
                          <div className="text-neutral-500">{p.submitted_by_role}</div>
                        </div>
                      </TD>
                      <TD><Badge label={st.label} color={st.color} /></TD>
                      <TD>
                        <div className="flex items-center gap-1.5 min-w-[180px]">
                          {total > 0 ? (
                            <>
                              <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden flex">
                                <div className="bg-green-400" style={{ width: `${(p.votes_approve / total) * 100}%` }} />
                                <div className="bg-red-400" style={{ width: `${(p.votes_object / total) * 100}%` }} />
                                <div className="bg-neutral-500" style={{ width: `${(p.votes_abstain / total) * 100}%` }} />
                              </div>
                              <span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap">
                                {p.votes_approve}/{p.votes_object}/{p.votes_abstain}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-neutral-600">لم يُصوّت أحد</span>
                          )}
                        </div>
                      </TD>
                      <TD>
                        {p.council_recommendation ? (
                          <Badge
                            label={
                              p.council_recommendation === "approve" ? "💡 توصية: موافقة" :
                              p.council_recommendation === "object" ? "💡 توصية: اعتراض" : "💡 محايد"
                            }
                            color={
                              p.council_recommendation === "approve" ? "green" :
                              p.council_recommendation === "object" ? "red" : "gray"
                            }
                          />
                        ) : (
                          <span className="text-[10px] text-neutral-600">—</span>
                        )}
                      </TD>
                      <TD>
                        <ActionBtn label="التفاصيل" color="blue" sm onClick={() => setSelectedProposal(p)} />
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </>
      )}

      {/* ═══════════ TAB 3: ELECTIONS ═══════════ */}
      {tab === "elections" && (
        <>
          {/* Top action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <ActionBtn label="📢 إعلان انتخابات جديدة" color="purple" onClick={() => setShowAnnounceElection(true)} />
            <ActionBtn label="📢 ترويج مرشّح" color="blue" onClick={() => setShowPromoCandidate(true)} />
          </div>

          {/* Current election card */}
          <div className="bg-gradient-to-br from-purple-500/[0.08] to-blue-500/[0.04] border border-purple-400/[0.2] rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-base font-bold text-white">{election.title}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">{election.id}</div>
              </div>
              <Badge
                label={
                  election.status === "registration" ? "تسجيل المرشّحين" :
                  election.status === "voting" ? "تصويت نشط" : "انتهت"
                }
                color={
                  election.status === "registration" ? "blue" :
                  election.status === "voting" ? "green" : "gray"
                }
              />
            </div>

            {/* Timeline */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📅 الجدول الزمني</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "بدء التسجيل", value: election.registration_starts.split("T")[0], active: true },
                  { label: "بدء التصويت", value: election.voting_starts.split("T")[0], active: election.status === "voting" || election.status === "ended" },
                  { label: "انتهاء التصويت", value: election.voting_ends.split("T")[0], active: election.status === "ended" },
                ].map((step, i) => (
                  <div key={i} className={cn(
                    "p-2 rounded-lg border text-center",
                    step.active ? "bg-purple-400/[0.06] border-purple-400/[0.2]" : "bg-white/[0.02] border-white/[0.04]"
                  )}>
                    <div className="text-[10px] text-neutral-500 mb-1">{step.label}</div>
                    <div className={cn("text-[11px] font-mono font-bold", step.active ? "text-purple-300" : "text-neutral-600")}>
                      {step.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KPI label="مرشّحون" val={election.candidates_count} color="#a855f7" />
              <KPI label="أصوات" val={fmtNum(election.votes_cast)} color="#4ADE80" />
              <KPI label="مقاعد" val={election.seats_available} color="#60A5FA" />
              <KPI
                label="نسبة المشاركة"
                val={Math.round((election.votes_cast / election.total_eligible_voters) * 100) + "%"}
                color="#FBBF24"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {election.status === "registration" && (
                <ActionBtn label="🔒 إغلاق التسجيل" color="yellow" onClick={() => showSuccess("تم إغلاق تسجيل المرشّحين")} />
              )}
              {election.status === "voting" && (
                <>
                  <ActionBtn label="🏆 إعلان النتائج" color="green" onClick={() => showSuccess("تم إعلان نتائج الانتخابات + تعيين الفائزين")} />
                  <ActionBtn label="⏸️ إيقاف مؤقّت" color="yellow" onClick={() => showSuccess("تم إيقاف التصويت مؤقّتاً")} />
                </>
              )}
              {election.status === "ended" && (
                <Badge label="انتهت — النتائج مُعلنة" color="gray" />
              )}
            </div>
          </div>

          {/* Candidates */}
          <SectionHeader title="🎯 المرشّحون" subtitle={`${candidates.length} مرشّح`} />
          <Table>
            <THead>
              <TH>الترتيب</TH>
              <TH>المرشّح</TH>
              <TH>المستوى</TH>
              <TH>صفقات</TH>
              <TH>نسبة النجاح</TH>
              <TH>أشهر</TH>
              <TH>الأصوات</TH>
              <TH>الفوز</TH>
            </THead>
            <TBody>
              {[...candidates]
                .sort((a, b) => b.votes_received - a.votes_received)
                .map((c, i) => {
                  const isWinner = i < election.seats_available
                  return (
                    <TR key={c.id}>
                      <TD>
                        <span className={cn("font-mono font-bold", i === 0 ? "text-yellow-400" : i < election.seats_available ? "text-green-400" : "text-neutral-500")}>
                          #{i + 1}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center text-[11px] font-bold text-blue-300">
                            {c.avatar_initial}
                          </div>
                          <span className="text-xs text-white font-bold">{c.name}</span>
                        </div>
                      </TD>
                      <TD><Badge label={c.level} color={c.level === "pro" ? "purple" : "blue"} /></TD>
                      <TD><span className="font-mono">{fmtNum(c.trades_count)}</span></TD>
                      <TD><span className="font-mono text-green-400">{c.success_rate}%</span></TD>
                      <TD><span className="font-mono">{c.months_on_platform}</span></TD>
                      <TD><span className="font-mono text-green-400 font-bold">{fmtNum(c.votes_received)}</span></TD>
                      <TD>
                        {isWinner ? <Badge label="✓ فائز" color="green" /> : <Badge label="—" color="gray" />}
                      </TD>
                    </TR>
                  )
                })}
            </TBody>
          </Table>
        </>
      )}

      {/* ═══════════ MEMBER DETAIL MODAL ═══════════ */}
      {selectedMember && !memberAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-base font-bold text-purple-300">
                  {selectedMember.avatar_initial}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{selectedMember.name}</div>
                  <div className="text-xs text-neutral-500">{selectedMember.position_title}</div>
                </div>
              </div>
              <button onClick={closeMember} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["الدور", ROLE_META[selectedMember.role].label],
                ["الانضمام", selectedMember.joined_at],
                ["نهاية الدورة", selectedMember.term_ends_at || "—"],
                ["أصوات الانتخاب", selectedMember.votes_received !== undefined ? fmtNum(selectedMember.votes_received) : "—"],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white">{v}</span>
                </div>
              ))}
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">النبذة</label>
            <textarea
              value={memberBio}
              onChange={(e) => setMemberBio(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <ActionBtn label="حفظ التعديل" color="green" onClick={() => setMemberAction("edit_bio")} />
              {selectedMember.role !== "founder" && (
                <ActionBtn label="إقالة" color="red" onClick={() => setMemberAction("remove")} />
              )}
              <button
                onClick={closeMember}
                className="px-4 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member confirm action */}
      {selectedMember && memberAction && memberAction !== "add" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {memberAction === "remove" && "❌ تأكيد الإقالة"}
                {memberAction === "edit_bio" && "✏️ حفظ التعديل"}
              </div>
              <button onClick={() => setMemberAction(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-3">
              العضو: <span className="text-white font-bold">{selectedMember.name}</span>
            </div>

            {memberAction === "remove" && (
              <>
                <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-400">
                  ⚠️ سيتم حذف العضو من المجلس فوراً + توثيق السبب في audit_log.
                </div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الإقالة (إجباري)</label>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  rows={3}
                  placeholder="اذكر السبب القانوني للإقالة..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            {memberAction === "edit_bio" && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
                سيتم حفظ النبذة الجديدة وعرضها في صفحة المجلس.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setMemberAction(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleMemberAction}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border",
                  memberAction === "remove" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                  memberAction === "edit_bio" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]"
                )}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">+ تعيين عضو جديد</div>
              <button onClick={() => setShowAddMember(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">اسم العضو</label>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="مثلاً: محمد العبيدي"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-3"
            />

            <label className="text-xs text-neutral-400 mb-2 block font-bold">المنصب</label>
            <input
              type="text"
              value={newMemberTitle}
              onChange={(e) => setNewMemberTitle(e.target.value)}
              placeholder="مثلاً: مستشار قانوني"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-4"
            />

            <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-xs text-purple-300">
              العضو الجديد سيكون من نوع <span className="font-bold">"معيّن"</span> ولن يحضر الدورة الانتخابية القادمة افتراضياً.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMember(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddMember}
                className="flex-1 py-3 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2]"
              >
                تعيين
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PROPOSAL DETAIL MODAL ═══════════ */}
      {selectedProposal && !proposalAction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">{selectedProposal.title}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">{selectedProposal.id}</div>
              </div>
              <button onClick={closeProposal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <Badge label={PROPOSAL_TYPE_LABELS[selectedProposal.type]} color="blue" />
              <Badge
                label={PROPOSAL_STATUS_META[selectedProposal.status].label}
                color={PROPOSAL_STATUS_META[selectedProposal.status].color}
              />
              {selectedProposal.council_recommendation && (
                <Badge
                  label={`💡 توصية: ${selectedProposal.council_recommendation === "approve" ? "موافقة" : selectedProposal.council_recommendation === "object" ? "اعتراض" : "محايد"}`}
                  color={selectedProposal.council_recommendation === "approve" ? "green" : selectedProposal.council_recommendation === "object" ? "red" : "gray"}
                />
              )}
            </div>

            {/* Description */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-2">📜 نص المقترح</div>
              <div className="text-xs text-neutral-200 leading-relaxed">{selectedProposal.description}</div>
            </div>

            {/* Voting result */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">🗳️ نتيجة التصويت</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-green-400/[0.06] border border-green-400/[0.2] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-green-400 mb-1">موافقة</div>
                  <div className="text-xl font-bold text-green-400 font-mono">{selectedProposal.votes_approve}</div>
                </div>
                <div className="bg-red-400/[0.06] border border-red-400/[0.2] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-red-400 mb-1">اعتراض</div>
                  <div className="text-xl font-bold text-red-400 font-mono">{selectedProposal.votes_object}</div>
                </div>
                <div className="bg-white/[0.06] border border-white/[0.1] rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-neutral-400 mb-1">امتناع</div>
                  <div className="text-xl font-bold text-neutral-300 font-mono">{selectedProposal.votes_abstain}</div>
                </div>
              </div>
              <div className="text-[10px] text-neutral-500 text-center">
                من إجمالي {selectedProposal.total_eligible_voters} عضو مؤهّل · ينتهي التصويت {new Date(selectedProposal.voting_ends_at).toLocaleDateString("ar")}
              </div>
            </div>

            {/* Final decision (if any) */}
            {selectedProposal.final_decision && (
              <div className={cn(
                "rounded-xl p-4 mb-4 border",
                selectedProposal.final_decision === "approved"
                  ? "bg-green-400/[0.05] border-green-400/[0.2]"
                  : "bg-red-400/[0.05] border-red-400/[0.2]"
              )}>
                <div className={cn(
                  "text-[11px] font-bold mb-2",
                  selectedProposal.final_decision === "approved" ? "text-green-400" : "text-red-400"
                )}>
                  ⚖️ القرار النهائي: {selectedProposal.final_decision === "approved" ? "موافقة" : "رفض"}
                </div>
                <div className="text-[11px] text-neutral-400">
                  بواسطة: <span className="text-white font-bold">{selectedProposal.final_decision_by}</span> · في {selectedProposal.final_decision_at}
                </div>
              </div>
            )}

            {/* Action: execute decision (only for voting status) */}
            {selectedProposal.status === "voting" && (
              <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] font-bold text-blue-400 mb-2">🚀 تنفيذ القرار النهائي</div>
                <div className="text-[11px] text-neutral-400 mb-3">
                  بصلاحية المؤسس / الرئيس التنفيذي فقط. القرار النهائي قد يتطابق أو يخالف توصية المجلس.
                </div>
                <ActionBtn label="🚀 تنفيذ القرار" color="blue" onClick={() => setProposalAction("execute")} />
              </div>
            )}

            <button
              onClick={closeProposal}
              className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Execute decision modal */}
      {selectedProposal && proposalAction === "execute" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">🚀 تنفيذ القرار النهائي</div>
              <button onClick={() => setProposalAction(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-400 mb-3 max-w-full break-words">
              المقترح: <span className="text-white font-bold">{selectedProposal.title}</span>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">القرار</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setDecision("approved")}
                className={cn(
                  "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                  decision === "approved"
                    ? "bg-green-400/[0.15] border-green-400/[0.4] text-green-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                )}
              >
                ✅ موافقة
              </button>
              <button
                onClick={() => setDecision("rejected")}
                className={cn(
                  "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                  decision === "rejected"
                    ? "bg-red-400/[0.15] border-red-400/[0.4] text-red-400"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                )}
              >
                ❌ رفض
              </button>
            </div>

            {/* Recommendation conflict warning */}
            {selectedProposal.council_recommendation && selectedProposal.council_recommendation !== "neutral" && (
              <>
                {((decision === "approved" && selectedProposal.council_recommendation === "object") ||
                  (decision === "rejected" && selectedProposal.council_recommendation === "approve")) && (
                  <div className="bg-yellow-400/[0.06] border border-yellow-400/[0.3] rounded-xl p-3 mb-3 text-xs text-yellow-400">
                    ⚠️ <span className="font-bold">تحذير:</span> هذا القرار يخالف توصية المجلس
                    ({selectedProposal.council_recommendation === "approve" ? "موافقة" : "اعتراض"}).
                    سيُسجَّل التجاوز في audit_log.
                  </div>
                )}
              </>
            )}

            <label className="text-xs text-neutral-400 mb-2 block font-bold">ملاحظات القرار (إجبارية للأرشفة)</label>
            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={4}
              placeholder="اشرح أساس القرار، خصوصاً إذا خالف توصية المجلس..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setProposalAction(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteDecision}
                className="flex-1 py-3 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold hover:bg-blue-500/[0.2]"
              >
                تنفيذ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ANNOUNCE NEW ELECTION MODAL ═══════════ */}
      {showAnnounceElection && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div className="text-base font-bold text-white">📢 إعلان انتخابات جديدة</div>
              <button onClick={() => setShowAnnounceElection(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">عنوان الانتخابات *</label>
                <input type="text" value={electionTitle} onChange={(e) => setElectionTitle(e.target.value)} placeholder="مثلاً: انتخابات المجلس 2026 - الدورة الثانية" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">بدء التسجيل *</label>
                  <input type="date" value={regStart} onChange={(e) => setRegStart(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">انتهاء التسجيل *</label>
                  <input type="date" value={regEnd} onChange={(e) => setRegEnd(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">بدء التصويت *</label>
                  <input type="date" value={voteStart} onChange={(e) => setVoteStart(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">انتهاء التصويت *</label>
                  <input type="date" value={voteEnd} onChange={(e) => setVoteEnd(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-white/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">عدد المقاعد المتاحة *</label>
                <input type="number" value={seatsCount} onChange={(e) => setSeatsCount(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">شروط خاصّة للترشّح</label>
                <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} placeholder="مثلاً: مستوى متقدّم فأعلى، 100+ صفقة..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={publishOfficial} onChange={(e) => setPublishOfficial(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs text-neutral-300">📢 نشر إعلان رسمي لكل المستثمرين</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAnnounceElection(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleAnnounceElection} className="flex-1 py-3 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2]">إنشاء + إعلان</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CANDIDATE PROMOTION MODAL ═══════════ */}
      {showPromoCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div className="text-base font-bold text-white">📢 ترويج مرشّح</div>
              <button onClick={() => setShowPromoCandidate(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المرشّح *</label>
                <select value={promoCandidate} onChange={(e) => setPromoCandidate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20">
                  <option value="">— اختر —</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.level})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">نوع الإعلان</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["banner", "popup", "notification"] as const).map((t) => (
                    <button key={t} onClick={() => setPromoType(t)} className={cn(
                      "py-2 rounded-lg text-xs font-bold border transition-colors",
                      promoType === t ? "bg-blue-400/[0.15] border-blue-400/[0.4] text-blue-400" : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                    )}>
                      {t === "banner" ? "Banner" : t === "popup" ? "Popup" : "إشعار"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">النصّ الترويجي *</label>
                <textarea value={promoText} onChange={(e) => setPromoText(e.target.value)} rows={3} placeholder="رسالتك للناخبين..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المدّة (التكلفة تُحسب تلقائياً)</label>
                <div className="grid grid-cols-3 gap-2">
                  {([3, 7, 14] as const).map((d) => (
                    <button key={d} onClick={() => setPromoDuration(d)} className={cn(
                      "py-2.5 rounded-lg text-xs font-bold border transition-colors flex flex-col items-center",
                      promoDuration === d ? "bg-yellow-400/[0.15] border-yellow-400/[0.4] text-yellow-400" : "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                    )}>
                      <span>{d} أيام</span>
                      <span className="text-[10px] mt-0.5 opacity-80">{PROMO_COSTS[d]} وحدة</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 text-[11px] text-yellow-400">
                ⚠️ سيُخصم <span className="font-bold font-mono">{PROMO_COSTS[promoDuration]}</span> وحدة من رصيد المرشّح عند التأكيد.
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPromoCandidate(false)} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handlePromoCandidate} className="flex-1 py-3 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold hover:bg-blue-500/[0.2]">تأكيد الترويج</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
