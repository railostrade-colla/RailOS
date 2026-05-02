"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Check, X, Minus, Clock, Calendar, Crown } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Badge, Modal, EmptyState } from "@/components/ui"
import {
  getProposalById,
  getProposalVotes,
  isCouncilMember,
  type VoteChoice,
  type ProposalStatus,
  type ProposalType,
  type CouncilVote,
} from "@/lib/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const TYPE_META: Record<ProposalType, { label: string; icon: string }> = {
  new_project:    { label: "مشروع جديد",    icon: "🏗️" },
  shares_release: { label: "إطلاق حصص",     icon: "📈" },
  investigation:  { label: "تحقيق",          icon: "🔍" },
  policy:         { label: "سياسة",         icon: "📜" },
}

const STATUS_META: Record<ProposalStatus, { label: string; color: "yellow" | "blue" | "green" | "red" | "neutral" }> = {
  pending:   { label: "قيد الانتظار", color: "yellow" },
  voting:    { label: "تصويت نشط",   color: "blue" },
  approved:  { label: "موافق عليه",   color: "green" },
  rejected:  { label: "مرفوض",       color: "red" },
  executed:  { label: "تم التنفيذ",  color: "neutral" },
}

const CHOICE_META: Record<VoteChoice, { label: string; color: "green" | "red" | "neutral"; icon: typeof Check }> = {
  approve: { label: "موافقة", color: "green",   icon: Check },
  object:  { label: "اعتراض", color: "red",     icon: X },
  abstain: { label: "امتناع", color: "neutral", icon: Minus },
}

function useCountdown(endsAt: string) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, ended: false })
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setParts({ d: 0, h: 0, m: 0, ended: true })
        return
      }
      setParts({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        ended: false,
      })
    }
    calc()
    const t = setInterval(calc, 60_000)
    return () => clearInterval(t)
  }, [endsAt])
  return parts
}

export default function ProposalDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const proposalId = (params?.id as string) ?? ""

  const proposal = useMemo(() => getProposalById(proposalId), [proposalId])
  const initialVotes = useMemo(() => getProposalVotes(proposalId), [proposalId])

  const [votes, setVotes] = useState<CouncilVote[]>(initialVotes)
  const [choice, setChoice] = useState<VoteChoice | null>(null)
  const [reason, setReason] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const countdown = useCountdown(proposal?.voting_ends_at ?? new Date().toISOString())

  if (!proposal) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
            <PageHeader title="تفاصيل القرار" backHref="/council/proposals" />
            <EmptyState
              icon="🔍"
              title="القرار غير موجود"
              description="ربما تم حذفه أو الرابط غير صحيح"
              action={{ label: "كل القرارات", href: "/council/proposals" }}
              size="lg"
            />
          </div>
        </div>
      </AppLayout>
    )
  }

  const status = STATUS_META[proposal.status]
  const type = TYPE_META[proposal.type]
  const isMember = isCouncilMember("me")
  const canVote = isMember && proposal.status === "voting" && !hasVoted

  // Live counts (incorporating new vote if cast)
  const liveCounts = useMemo(() => {
    const approve = votes.filter((v) => v.choice === "approve").length + (proposal.votes_approve - initialVotes.filter((v) => v.choice === "approve").length)
    const object = votes.filter((v) => v.choice === "object").length + (proposal.votes_object - initialVotes.filter((v) => v.choice === "object").length)
    const abstain = votes.filter((v) => v.choice === "abstain").length + (proposal.votes_abstain - initialVotes.filter((v) => v.choice === "abstain").length)
    return { approve, object, abstain, total: approve + object + abstain }
  }, [votes, initialVotes, proposal])

  const handleSubmitVote = async () => {
    if (!choice) {
      showError("اختر موقفك أولاً")
      return
    }
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    const newVote: CouncilVote = {
      id: "new-" + Date.now(),
      proposal_id: proposalId,
      member_id: "me",
      member_name: "أنت",
      member_avatar: "أ",
      choice,
      reason: reason.trim() || undefined,
      voted_at: new Date().toISOString(),
    }
    setVotes((prev) => [newVote, ...prev])
    setHasVoted(true)
    setShowConfirm(false)
    showSuccess(`تم تسجيل صوتك: ${CHOICE_META[choice].label}`)
    setSubmitting(false)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="تفاصيل القرار"
            subtitle={proposal.title}
            backHref="/council/proposals"
          />

          {/* ═══ § 1: Hero ═══ */}
          <Card variant="gradient" color={proposal.status === "voting" ? "blue" : proposal.final_decision === "approved" ? "green" : proposal.final_decision === "rejected" ? "red" : "neutral"} className="mb-6">
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <Badge color="neutral" variant="soft" icon={type.icon}>{type.label}</Badge>
              <Badge color={status.color} variant="soft">{status.label}</Badge>
              {proposal.council_recommendation && (
                <Badge
                  color={proposal.council_recommendation === "approve" ? "green" : proposal.council_recommendation === "object" ? "red" : "neutral"}
                  variant="soft"
                  size="xs"
                >
                  توصية: {proposal.council_recommendation === "approve" ? "موافقة" : proposal.council_recommendation === "object" ? "اعتراض" : "محايد"}
                </Badge>
              )}
            </div>
            <h2 className="text-base font-bold text-white mb-3">{proposal.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span>قُدّم من: <span className="text-white font-bold">{proposal.submitted_by_name}</span></span>
              <span>·</span>
              <span dir="ltr">{proposal.submitted_at}</span>
            </div>

            {/* Countdown */}
            {proposal.status === "voting" && !countdown.ended && (
              <div className="mt-4 bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
                <div className="text-[10px] text-neutral-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ينتهي التصويت خلال
                </div>
                <div className="text-base font-bold text-white font-mono">
                  {countdown.d}ي {countdown.h}س {countdown.m}د
                </div>
              </div>
            )}
          </Card>

          {/* ═══ § 2: Description ═══ */}
          <Card className="mb-6">
            <SectionHeader title="📝 الوصف الكامل" />
            <p className="text-sm text-neutral-300 leading-relaxed">{proposal.description}</p>
            {proposal.related_project_id && (
              <button
                onClick={() => router.push("/project/" + proposal.related_project_id)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-3 flex items-center gap-1 transition-colors"
              >
                مشروع مرتبط: {proposal.related_project_id} ←
              </button>
            )}
          </Card>

          {/* ═══ § 3: Voting (council only) ═══ */}
          {proposal.status === "voting" && (
            isMember ? (
              <Card variant="highlighted" color="blue" className="mb-6">
                <SectionHeader title="🗳️ صوّت على هذا القرار" subtitle={hasVoted ? "تم تسجيل صوتك" : "اختر موقفك من القرار"} />

                {hasVoted ? (
                  <div className="bg-green-400/[0.06] border border-green-400/25 rounded-xl p-3 text-center">
                    <Check className="w-6 h-6 text-green-400 mx-auto mb-1" strokeWidth={2.5} />
                    <div className="text-sm font-bold text-green-400">تم تسجيل صوتك بنجاح</div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {(["approve", "object", "abstain"] as VoteChoice[]).map((c) => {
                        const meta = CHOICE_META[c]
                        const Icon = meta.icon
                        const active = choice === c
                        const colorClasses =
                          meta.color === "green" ? (active ? "bg-green-500 border-green-500 text-white" : "bg-green-400/[0.06] border-green-400/25 text-green-400 hover:bg-green-400/[0.1]") :
                          meta.color === "red"   ? (active ? "bg-red-500 border-red-500 text-white"     : "bg-red-400/[0.06] border-red-400/25 text-red-400 hover:bg-red-400/[0.1]") :
                          (active ? "bg-neutral-500 border-neutral-500 text-white" : "bg-white/[0.06] border-white/[0.15] text-neutral-300 hover:bg-white/[0.1]")
                        return (
                          <button
                            key={c}
                            onClick={() => setChoice(c)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all font-bold text-xs",
                              colorClasses,
                            )}
                          >
                            <Icon className="w-4 h-4" strokeWidth={2.5} />
                            {meta.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="mb-3">
                      <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">سبب التصويت (اختياري)</div>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="وضّح موقفك للتوثيق..."
                        rows={3}
                        maxLength={300}
                        className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none transition-colors"
                      />
                    </div>

                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={!choice}
                      className={cn(
                        "w-full py-3 rounded-xl text-sm font-bold transition-colors",
                        choice
                          ? "bg-neutral-100 text-black hover:bg-neutral-200"
                          : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
                      )}
                    >
                      تأكيد التصويت
                    </button>
                  </>
                )}
              </Card>
            ) : (
              <Card className="mb-6 text-center">
                <div className="text-3xl mb-2 opacity-50">ℹ️</div>
                <div className="text-sm font-bold text-white mb-1">التصويت محصور بأعضاء المجلس فقط</div>
                <div className="text-[11px] text-neutral-500">يمكنك متابعة النتيجة هنا</div>
              </Card>
            )
          )}

          {/* ═══ § 4: Live tally ═══ */}
          <Card className="mb-6">
            <SectionHeader
              title="📊 نتائج التصويت الحالية"
              subtitle={`${liveCounts.total} من ${proposal.total_eligible_voters} عضو صوّتوا`}
            />
            <div className="space-y-3">
              {[
                { label: "موافقة", count: liveCounts.approve, color: "bg-green-400",   text: "text-green-400" },
                { label: "اعتراض", count: liveCounts.object,   color: "bg-red-400",     text: "text-red-400" },
                { label: "امتناع", count: liveCounts.abstain,  color: "bg-neutral-500", text: "text-neutral-400" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-neutral-300">{row.label}</span>
                    <span className={cn("text-sm font-bold font-mono", row.text)}>{row.count}</span>
                  </div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all", row.color)}
                      style={{ width: proposal.total_eligible_voters > 0 ? (row.count / proposal.total_eligible_voters) * 100 + "%" : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ═══ § 5: Voters list ═══ */}
          {votes.length > 0 && (
            <Card className="mb-6" padding="sm">
              <div className="px-2 py-2">
                <SectionHeader title="🗳️ المصوّتون" subtitle={`${votes.length} صوت`} />
              </div>
              <div className="space-y-1">
                {votes.map((v) => {
                  const meta = CHOICE_META[v.choice]
                  return (
                    <div key={v.id} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {v.member_avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold text-white">{v.member_name}</span>
                          <Badge color={meta.color} variant="soft" size="xs">{meta.label}</Badge>
                        </div>
                        {v.reason && (
                          <p className="text-[11px] text-neutral-400 leading-relaxed">{v.reason}</p>
                        )}
                        <div className="text-[9px] text-neutral-600 mt-1" dir="ltr">
                          {new Date(v.voted_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* ═══ § 6: Final decision ═══ */}
          {proposal.final_decision && (
            <Card variant="highlighted" color={proposal.final_decision === "approved" ? "green" : "red"}>
              <div className="flex items-center gap-2 mb-3">
                <Crown className={cn("w-5 h-5", proposal.final_decision === "approved" ? "text-green-400" : "text-red-400")} strokeWidth={2} />
                <h3 className="text-sm font-bold text-white">القرار النهائي</h3>
              </div>
              <Badge
                color={proposal.final_decision === "approved" ? "green" : "red"}
                variant="solid"
                size="md"
              >
                {proposal.final_decision === "approved" ? "✅ تم الاعتماد" : "❌ تم الرفض"}
              </Badge>
              <div className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                <div className="flex items-center gap-2">
                  <Crown className="w-3 h-3 text-yellow-400" />
                  <span>صدر من: <span className="font-bold text-white">{proposal.final_decision_by}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-neutral-500" />
                  <span dir="ltr">{proposal.final_decision_at}</span>
                </div>
                {proposal.council_recommendation && (
                  <div className="text-[10px] text-neutral-500 mt-2">
                    💡 توصية المجلس كانت: <span className="font-bold">
                      {proposal.council_recommendation === "approve" ? "موافقة" : proposal.council_recommendation === "object" ? "اعتراض" : "محايد"}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* ═══ Vote confirmation modal ═══ */}
      {showConfirm && choice && (
        <Modal
          isOpen={showConfirm}
          onClose={() => !submitting && setShowConfirm(false)}
          title="🗳️ تأكيد التصويت"
          subtitle={`موقفك: ${CHOICE_META[choice].label}`}
          variant="warning"
          size="sm"
          footer={
            <>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitVote}
                disabled={submitting}
                className="flex-1 bg-neutral-100 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                    جاري...
                  </>
                ) : (
                  "تأكيد"
                )}
              </button>
            </>
          }
        >
          <p className="text-sm text-neutral-300 leading-relaxed">
            ⚠️ لا يمكن تغيير صوتك بعد التأكيد.
          </p>
          {reason.trim() && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mt-3">
              <div className="text-[10px] text-neutral-500 mb-1">سبب تصويتك:</div>
              <p className="text-xs text-neutral-300 leading-relaxed">{reason}</p>
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  )
}
