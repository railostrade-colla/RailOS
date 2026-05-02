"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Vote,
  Award,
  Check,
  X,
  TrendingUp,
  Calendar,
  Clock,
  ChevronDown,
  Star,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Modal } from "@/components/ui"
import {
  getCurrentElection,
  getCandidates,
  checkEligibility,
  type CouncilCandidate,
} from "@/lib/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type SortBy = "votes" | "level" | "name"

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

export default function ElectionsPage() {
  const router = useRouter()
  const election = useMemo(() => getCurrentElection(), [])
  const initialCandidates = useMemo(() => getCandidates(), [])
  const eligibility = useMemo(() => checkEligibility("me"), [])

  const [candidates, setCandidates] = useState<CouncilCandidate[]>(initialCandidates)
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [voteTarget, setVoteTarget] = useState<CouncilCandidate | null>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [campaignStatement, setCampaignStatement] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("votes")
  const [sortOpen, setSortOpen] = useState(false)

  const countdown = useCountdown(election.voting_ends)
  const participation = Math.round((election.votes_cast / election.total_eligible_voters) * 100)
  const electionLabel: "active" | "upcoming" | "ended" =
    election.status === "voting" ? "active" :
    election.status === "registration" ? "upcoming" : "ended"

  const sortedCandidates = useMemo(() => {
    const rows = [...candidates]
    if (sortBy === "votes") rows.sort((a, b) => b.votes_received - a.votes_received)
    else if (sortBy === "level") rows.sort((a, b) => (a.level === "pro" ? -1 : 1) - (b.level === "pro" ? -1 : 1))
    else rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [candidates, sortBy])

  const handleVote = async () => {
    if (!voteTarget) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    setCandidates((prev) =>
      prev.map((c) => (c.id === voteTarget.id ? { ...c, votes_received: c.votes_received + 1 } : c)),
    )
    setVotedFor(voteTarget.id)
    showSuccess(`تم تسجيل صوتك لـ ${voteTarget.name}`)
    setSubmitting(false)
    setVoteTarget(null)
  }

  const handleRegister = async () => {
    if (!campaignStatement.trim() || campaignStatement.length < 30) {
      showError("بيان الحملة يجب أن يكون 30 حرف على الأقل")
      return
    }
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    showSuccess("تم تسجيل ترشّحك بنجاح! ستظهر في قائمة المرشّحين خلال 24 ساعة")
    setShowRegisterModal(false)
    setCampaignStatement("")
    setSubmitting(false)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="🗳️ انتخابات مجلس السوق"
            subtitle={election.title}
            backHref="/council"
          />

          {/* ═══ § 1: Hero ═══ */}
          <Card variant="gradient" color="orange" className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-white mb-1">{election.title}</h2>
                <Badge color={electionLabel === "active" ? "green" : electionLabel === "upcoming" ? "yellow" : "neutral"} variant="soft">
                  {electionLabel === "active" ? "🟢 التصويت نشط" : electionLabel === "upcoming" ? "⏳ ترشّح" : "منتهية"}
                </Badge>
              </div>
              {election.status === "voting" && !countdown.ended && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2">
                  <div className="text-[10px] text-neutral-500 mb-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    ينتهي خلال
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {countdown.d}ي {countdown.h}س {countdown.m}د
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatCard size="sm" label="المقاعد" value={election.seats_available} color="orange" />
              <StatCard size="sm" label="المرشّحون" value={election.candidates_count} color="purple" />
              <StatCard size="sm" label="أصوات مُدلى" value={election.votes_cast.toLocaleString("en-US")} color="blue" />
              <StatCard size="sm" label="نسبة المشاركة" value={participation + "%"} color="green" />
            </div>
          </Card>

          {/* ═══ § 2: Eligibility / Status ═══ */}
          {eligibility.eligible ? (
            <Card variant="highlighted" color="green" className="mb-6">
              <div className="flex items-start gap-3 mb-3">
                <Award className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" strokeWidth={2} />
                <div>
                  <h3 className="text-base font-bold text-white mb-1">🎯 أنت مؤهّل للترشّح</h3>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    تحقّق من وضعك وتقديم بيانك للترشّح في الدورة القادمة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4" strokeWidth={2.5} />
                ترشّح للانتخابات
              </button>
            </Card>
          ) : (
            <Card variant="highlighted" color="yellow" className="mb-6">
              <SectionHeader title="📋 شروط الترشّح" subtitle="حالتك الحالية" />
              <div className="space-y-2">
                {eligibility.checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {c.passed ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" strokeWidth={2.5} />
                    ) : (
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={2.5} />
                    )}
                    <span className={c.passed ? "text-neutral-300" : "text-red-400 font-bold"}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push("/council/about")}
                className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-white py-2.5 rounded-xl text-xs font-bold mt-3 transition-colors"
              >
                اعرف أكثر عن الشروط
              </button>
            </Card>
          )}

          {/* ═══ § 3: Voting CTA ═══ */}
          {election.status === "voting" && !countdown.ended && (
            <Card variant="highlighted" color="blue" className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Vote className="w-5 h-5 text-blue-400" strokeWidth={2} />
                <h3 className="text-sm font-bold text-white">✅ يمكنك التصويت الآن</h3>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                اختر أحد المرشّحين أدناه واضغط "صوّت" — صوتك سرّي ولا يُغيَّر بعد التأكيد.
              </p>
            </Card>
          )}

          {/* ═══ § 4: Candidates ═══ */}
          <SectionHeader
            title="👥 المرشّحون"
            subtitle={`${candidates.length} مرشّح`}
          />

          {/* Sort dropdown */}
          <div className="flex justify-end mb-4 relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white flex items-center gap-1.5 transition-colors"
            >
              <span>
                {sortBy === "votes" ? "الأكثر أصواتاً" : sortBy === "level" ? "الأعلى مستوى" : "ترتيب أبجدي"}
              </span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", sortOpen && "rotate-180")} />
            </button>
            {sortOpen && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-[rgba(15,15,15,0.98)] border border-white/[0.08] rounded-lg shadow-2xl z-20 overflow-hidden">
                {([
                  { id: "votes", label: "الأكثر أصواتاً" },
                  { id: "level", label: "الأعلى مستوى" },
                  { id: "name",  label: "ترتيب أبجدي" },
                ] as Array<{ id: SortBy; label: string }>).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSortBy(s.id); setSortOpen(false) }}
                    className={cn(
                      "w-full px-3 py-2 text-xs text-right hover:bg-white/[0.06] transition-colors",
                      sortBy === s.id ? "bg-white/[0.04] text-white" : "text-neutral-400",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sortedCandidates.map((c, i) => (
              <Card key={c.id} className="relative">
                {/* Top badges */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {i === 0 && sortBy === "votes" && (
                      <Badge color="yellow" variant="soft" size="xs" icon={<Star className="w-2 h-2 fill-yellow-400" />}>
                        المتصدّر
                      </Badge>
                    )}
                    {c.is_eligible && <Badge color="green" variant="soft" size="xs">✓ مؤهّل</Badge>}
                  </div>
                  {votedFor === c.id && <Badge color="blue" variant="solid" size="xs">✓ صوّت</Badge>}
                </div>

                {/* Avatar + name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/[0.1] flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                    {c.avatar_initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate mb-1">{c.name}</h3>
                    <Badge color={c.level === "pro" ? "purple" : "blue"} variant="soft" size="xs">
                      {c.level === "pro" ? "محترف" : "متقدم"}
                    </Badge>
                  </div>
                </div>

                {/* 4 mini stats */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-neutral-500">صفقات</div>
                    <div className="text-xs font-bold text-white font-mono">{c.trades_count}</div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-neutral-500">نجاح %</div>
                    <div className="text-xs font-bold text-green-400 font-mono">{c.success_rate}</div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-neutral-500">أشهر</div>
                    <div className="text-xs font-bold text-white font-mono">{c.months_on_platform}</div>
                  </div>
                  <div className="bg-orange-400/[0.08] border border-orange-400/25 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-orange-400/70">أصوات</div>
                    <div className="text-xs font-bold text-orange-400 font-mono">{c.votes_received.toLocaleString("en-US")}</div>
                  </div>
                </div>

                {/* Campaign */}
                <p className="text-[11px] text-neutral-300 leading-relaxed line-clamp-3 mb-3 italic">
                  &quot;{c.campaign_statement}&quot;
                </p>

                {/* Vote button */}
                {election.status === "voting" && !countdown.ended && (
                  <button
                    onClick={() => setVoteTarget(c)}
                    disabled={!!votedFor}
                    className={cn(
                      "w-full py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
                      votedFor === c.id
                        ? "bg-green-400/[0.12] border border-green-400/30 text-green-400"
                        : votedFor
                          ? "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
                          : "bg-neutral-100 text-black hover:bg-neutral-200",
                    )}
                  >
                    <Vote className="w-3.5 h-3.5" strokeWidth={2.5} />
                    {votedFor === c.id ? "صوّت لهذا المرشّح" : votedFor ? "صوّت لمرشّح آخر" : "صوّت"}
                  </button>
                )}
              </Card>
            ))}
          </div>

        </div>
      </div>

      {/* ═══ Vote confirmation Modal ═══ */}
      {voteTarget && (
        <Modal
          isOpen={!!voteTarget}
          onClose={() => !submitting && setVoteTarget(null)}
          title="🗳️ تأكيد التصويت"
          subtitle={`ستصوّت لـ ${voteTarget.name}`}
          variant="warning"
          size="sm"
          footer={
            <>
              <button
                onClick={() => setVoteTarget(null)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleVote}
                disabled={submitting}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                    تأكيد التصويت
                  </>
                )}
              </button>
            </>
          }
        >
          <p className="text-sm text-neutral-300 leading-relaxed">
            ⚠️ <strong className="text-white">لا يمكن تغيير صوتك</strong> بعد التأكيد.
          </p>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-base font-bold text-white">
              {voteTarget.avatar_initial}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{voteTarget.name}</div>
              <div className="text-[10px] text-neutral-500">
                {voteTarget.level === "pro" ? "محترف" : "متقدم"} · {voteTarget.trades_count} صفقة
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ Register modal ═══ */}
      {showRegisterModal && (
        <Modal
          isOpen={showRegisterModal}
          onClose={() => !submitting && setShowRegisterModal(false)}
          title="🎯 ترشّح للانتخابات"
          subtitle="اكتب بيان حملتك"
          variant="success"
          size="md"
          footer={
            <>
              <button
                onClick={() => setShowRegisterModal(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleRegister}
                disabled={submitting || campaignStatement.trim().length < 30}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  campaignStatement.trim().length >= 30 && !submitting
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري...
                  </>
                ) : (
                  "تأكيد الترشّح"
                )}
              </button>
            </>
          }
        >
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">بيان حملتك</div>
            <textarea
              value={campaignStatement}
              onChange={(e) => setCampaignStatement(e.target.value)}
              placeholder="عرّف الناخبين بنفسك ورؤيتك (30 حرف على الأقل)..."
              rows={5}
              maxLength={200}
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none transition-colors"
            />
            <div className="text-[10px] text-neutral-500 mt-1 text-left font-mono" dir="ltr">
              {campaignStatement.length}/200
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}
