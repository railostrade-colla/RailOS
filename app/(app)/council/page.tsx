"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, Users, FileText, Vote, BookOpen, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge } from "@/components/ui"
import {
  COUNCIL_PROPOSALS,
  getCouncilStats as getCouncilStatsMock,
  getCurrentElection,
  type ProposalStatus,
  type CouncilProposal,
} from "@/lib/mock-data"
import {
  getCouncilStats as dbGetCouncilStats,
  getCouncilProposals as dbGetCouncilProposals,
} from "@/lib/data"
import { cn } from "@/lib/utils/cn"

const STATUS_META: Record<ProposalStatus, { label: string; color: "yellow" | "blue" | "green" | "red" | "neutral" }> = {
  pending:   { label: "قيد الانتظار",  color: "yellow" },
  voting:    { label: "تصويت نشط",    color: "blue" },
  approved:  { label: "موافق عليه",    color: "green" },
  rejected:  { label: "مرفوض",        color: "red" },
  executed:  { label: "تم التنفيذ",   color: "neutral" },
}

const TYPE_LABELS: Record<string, string> = {
  new_project:    "مشروع جديد",
  shares_release: "إطلاق حصص",
  investigation:  "تحقيق",
  policy:         "سياسة",
}

export default function CouncilPage() {
  const router = useRouter()
  const election = useMemo(() => getCurrentElection(), [])

  // Live data (DB-backed with mock fallback)
  const [stats, setStats] = useState(getCouncilStatsMock())
  const [recentProposals, setRecentProposals] = useState<CouncilProposal[]>(
    [...COUNCIL_PROPOSALS].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)).slice(0, 3)
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([dbGetCouncilStats(), dbGetCouncilProposals()])
      .then(([s, props]) => {
        if (cancelled) return
        if (s) setStats(s)
        if (props.length > 0) {
          // Map DB proposal → mock proposal shape (keys are mostly identical)
          const mapped = props.slice(0, 3).map((p): CouncilProposal => ({
            id: p.id,
            title: p.title,
            description: p.description,
            type: p.type as CouncilProposal["type"],
            submitted_by: p.submitted_by,
            submitted_by_role: p.submitted_by_role as CouncilProposal["submitted_by_role"],
            status: p.status as ProposalStatus,
            votes_approve: p.votes_approve ?? 0,
            votes_object: p.votes_object ?? 0,
            votes_abstain: p.votes_abstain ?? 0,
            total_eligible_voters: p.total_eligible_voters ?? 5,
            voting_ends_at: p.voting_ends_at,
            council_recommendation: (p.council_recommendation ?? undefined) as CouncilProposal["council_recommendation"],
            related_project_id: p.related_project_id ?? undefined,
            submitted_at: p.created_at?.split("T")[0] ?? "—",
          }))
          setRecentProposals(mapped)
        }
      })
      .catch(() => { /* silent → keep mock */ })
    return () => { cancelled = true }
  }, [])

  const participation = Math.round((election.votes_cast / election.total_eligible_voters) * 100)
  const electionLabel = election.status === "voting" ? "نشطة" : election.status === "registration" ? "ترشّح" : "منتهية"

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="🏛️ مجلس السوق"
            subtitle="الجهة الرقابية المنتخبة"
            backHref="/dashboard"
          />

          {/* ═══ § 1: Hero ═══ */}
          <Card variant="gradient" color="purple" className="mb-6">
            <div className="flex items-start gap-4 mb-5 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-purple-400" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white mb-1">مجلس السوق</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {stats.total_members} أعضاء يراقبون السوق ويرفعون التوصيات للإدارة
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <StatCard size="sm" label="الأعضاء" value={stats.total_members} color="purple" />
              <StatCard size="sm" label="القرارات النشطة" value={stats.active} color="blue" />
              <StatCard size="sm" label="نسبة المشاركة" value={participation + "%"} color="green" />
              <StatCard size="sm" label="مدة الدورة" value="سنة" color="yellow" />
            </div>
          </Card>

          {/* ═══ § 2: 4 main sections (2x2 grid) ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">

            {/* Members */}
            <Card variant="gradient" color="purple" onClick={() => router.push("/council/members")}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-400" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-0.5">👥 الأعضاء</h3>
                  <p className="text-[11px] text-neutral-400">تعرّف على أعضاء المجلس</p>
                </div>
              </div>
              <div className="flex -space-x-2 -space-x-reverse mb-3">
                {["أ", "خ", "ع", "م", "ن"].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-2 border-[#0f0f0f] flex items-center justify-center text-xs font-bold text-white">
                    {c}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-purple-400 font-bold flex items-center gap-1">
                عرض الأعضاء
                <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
              </div>
            </Card>

            {/* Proposals */}
            <Card variant="gradient" color="blue" onClick={() => router.push("/council/proposals")}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-400" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-0.5">📋 القرارات والتصويت</h3>
                  <p className="text-[11px] text-neutral-400">اطّلع على القرارات الجارية</p>
                </div>
              </div>
              <Badge color="blue" variant="soft" size="xs">{stats.active} قرار نشط</Badge>
              <div className="text-[11px] text-blue-400 font-bold flex items-center gap-1 mt-3">
                عرض القرارات
                <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
              </div>
            </Card>

            {/* Elections */}
            <Card variant="gradient" color="orange" onClick={() => router.push("/council/elections")}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-400/[0.15] border border-orange-400/30 flex items-center justify-center flex-shrink-0">
                  <Vote className="w-5 h-5 text-orange-400" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-0.5">🗳️ الانتخابات</h3>
                  <p className="text-[11px] text-neutral-400">شارك في انتخاب المجلس</p>
                </div>
              </div>
              <Badge color="orange" variant="soft" size="xs">انتخابات {electionLabel}</Badge>
              <div className="text-[11px] text-orange-400 font-bold flex items-center gap-1 mt-3">
                المشاركة في الانتخابات
                <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
              </div>
            </Card>

            {/* About */}
            <Card variant="gradient" color="green" onClick={() => router.push("/council/about")}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-400/[0.15] border border-green-400/30 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-green-400" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-0.5">📚 كيف يعمل المجلس؟</h3>
                  <p className="text-[11px] text-neutral-400">تعرّف على المهام والصلاحيات</p>
                </div>
              </div>
              <div className="text-[11px] text-green-400 font-bold flex items-center gap-1 mt-3">
                اقرأ الدليل
                <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
              </div>
            </Card>
          </div>

          {/* ═══ § 3: Recent proposals ═══ */}
          <SectionHeader
            title="📊 آخر القرارات"
            subtitle={`${recentProposals.length} قرار حديث`}
            action={{ label: "عرض الكل", href: "/council/proposals" }}
          />
          <div className="space-y-3">
            {recentProposals.map((p) => {
              const status = STATUS_META[p.status]
              const total = p.votes_approve + p.votes_object + p.votes_abstain
              return (
                <Card key={p.id} onClick={() => router.push("/council/proposals/" + p.id)}>
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <Badge color="neutral" variant="soft" size="xs">{TYPE_LABELS[p.type]}</Badge>
                    <Badge color={status.color} variant="soft" size="xs">{status.label}</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-2 leading-snug">{p.title}</h4>
                  {(p.status === "voting" || p.status === "approved" || p.status === "rejected") && (
                    <div className="flex gap-1 mb-3">
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 transition-all"
                          style={{ width: total > 0 ? (p.votes_approve / p.total_eligible_voters) * 100 + "%" : "0%" }}
                        />
                      </div>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 transition-all"
                          style={{ width: total > 0 ? (p.votes_object / p.total_eligible_voters) * 100 + "%" : "0%" }}
                        />
                      </div>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-500 transition-all"
                          style={{ width: total > 0 ? (p.votes_abstain / p.total_eligible_voters) * 100 + "%" : "0%" }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-neutral-500" dir="ltr">{p.submitted_at}</span>
                    <span className="text-[11px] text-blue-400 font-bold flex items-center gap-1">
                      التفاصيل
                      <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
