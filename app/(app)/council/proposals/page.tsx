"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Calendar, ChevronLeft, Clock } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, Tabs, Badge, EmptyState } from "@/components/ui"
import {
  type ProposalStatus,
  type ProposalType,
  type CouncilProposal,
} from "@/lib/mock-data"
import {
  getCouncilStats as dbGetCouncilStats,
  getCouncilProposals as dbGetCouncilProposals,
} from "@/lib/data/council"
import { cn } from "@/lib/utils/cn"

type TabId = "voting" | "approved" | "rejected" | "all"

const TYPE_META: Record<ProposalType, { labelKey: string; icon: string }> = {
  new_project:    { labelKey: "typeProject",    icon: "🏗️" },
  shares_release: { labelKey: "typeShares",     icon: "📈" },
  investigation:  { labelKey: "ptInvestigation", icon: "🔍" },
  policy:         { labelKey: "ptPolicy",        icon: "📜" },
}

const STATUS_META: Record<ProposalStatus, { labelKey: string; color: "yellow" | "blue" | "green" | "red" | "neutral" }> = {
  pending:   { labelKey: "psPending",  color: "yellow" },
  voting:    { labelKey: "psVoting",   color: "blue" },
  approved:  { labelKey: "psApproved", color: "green" },
  rejected:  { labelKey: "psRejected", color: "red" },
  executed:  { labelKey: "psExecuted", color: "neutral" },
}

export default function ProposalsPage() {
  const router = useRouter()
  const t = useTranslations("council")
  const [tab, setTab] = useState<TabId>("voting")
  const [typeFilter, setTypeFilter] = useState<ProposalType | "all">("all")

  // Production mode — DB only.
  const [proposals, setProposals] = useState<CouncilProposal[]>([])
  const [stats, setStats] = useState({
    total_members: 0, elected_members: 0, proposals: 0,
    approved: 0, rejected: 0, active: 0,
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([dbGetCouncilStats(), dbGetCouncilProposals()])
      .then(([s, props]) => {
        if (cancelled) return
        if (s) setStats(s)
        if (props.length > 0) {
          setProposals(
            props.map((p): CouncilProposal => ({
              id: p.id,
              title: p.title,
              description: p.description,
              type: p.type as CouncilProposal["type"],
              submitted_by: p.submitted_by,
              submitted_by_name: p.submitted_by_name,
              submitted_by_role: p.submitted_by_role as CouncilProposal["submitted_by_role"],
              status: p.status,
              votes_approve: p.votes_approve ?? 0,
              votes_object: p.votes_object ?? 0,
              votes_abstain: p.votes_abstain ?? 0,
              total_eligible_voters: p.total_eligible_voters ?? 5,
              voting_ends_at: p.voting_ends_at,
              final_decision: p.final_decision ?? undefined,
              final_decision_by: p.final_decision_by ?? undefined,
              final_decision_at: p.final_decision_at?.split("T")[0] ?? undefined,
              council_recommendation: (p.council_recommendation ?? undefined) as CouncilProposal["council_recommendation"],
              related_project_id: p.related_project_id ?? undefined,
              submitted_at: p.created_at?.split("T")[0] ?? "—",
            })),
          )
        }
      })
      .catch(() => { /* keep mock */ })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let rows = [...proposals]
    if (tab === "voting") rows = rows.filter((p) => p.status === "voting" || p.status === "pending")
    else if (tab === "approved") rows = rows.filter((p) => p.status === "approved")
    else if (tab === "rejected") rows = rows.filter((p) => p.status === "rejected")
    if (typeFilter !== "all") rows = rows.filter((p) => p.type === typeFilter)
    return rows.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))
  }, [tab, typeFilter, proposals])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-4xl mx-auto pb-20">

          <PageHeader
            title={t("proposalsTitle")}
            subtitle={t("proposalsSubtitle")}
            backHref="/council"
          />

          {/* ═══ Stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
            <StatCard label={t("stTotal")} value={stats.proposals} />
            <StatCard label={t("stActive")} value={stats.active} color="blue" />
            <StatCard label={t("stApproved")} value={stats.approved} color="green" />
            <StatCard label={t("stRejected")} value={stats.rejected} color="red" />
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="mb-4">
            <Tabs
              tabs={[
                { id: "voting",   icon: "⏳", label: t("tabVoting"),   count: stats.active },
                { id: "approved", icon: "✅", label: t("tabApproved"), count: stats.approved },
                { id: "rejected", icon: "❌", label: t("tabRejected"), count: stats.rejected },
                { id: "all",      icon: "📜", label: t("tabAll"),      count: stats.proposals },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as TabId)}
              size="sm"
            />
          </div>

          {/* ═══ Type filter chips ═══ */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
            {([
              { id: "all", label: t("allTypes") },
              { id: "new_project", label: t("filterProjects") },
              { id: "shares_release", label: t("filterShares") },
              { id: "investigation", label: t("filterInvestigations") },
              { id: "policy", label: t("filterPolicies") },
            ] as Array<{ id: ProposalType | "all"; label: string }>).map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] flex-shrink-0 transition-colors border whitespace-nowrap",
                  typeFilter === f.id
                    ? "bg-white text-black border-transparent font-bold"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ═══ Proposals list ═══ */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="📭"
              title={t("emptyTitle")}
              description={t("emptyDesc")}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const status = STATUS_META[p.status]
                const type = TYPE_META[p.type]
                const total = p.votes_approve + p.votes_object + p.votes_abstain
                const eligible = p.total_eligible_voters
                return (
                  <Card key={p.id} onClick={() => router.push("/council/proposals/" + p.id)}>
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <Badge color="neutral" variant="soft" size="xs" icon={type.icon}>{t(type.labelKey)}</Badge>
                      <Badge color={status.color} variant="soft" size="xs">{t(status.labelKey)}</Badge>
                      {p.council_recommendation && (
                        <Badge
                          color={p.council_recommendation === "approve" ? "green" : p.council_recommendation === "object" ? "red" : "neutral"}
                          variant="soft"
                          size="xs"
                        >
                          {t("recPrefix")} {p.council_recommendation === "approve" ? t("recApprove") : p.council_recommendation === "object" ? t("recObject") : t("recNeutral")}
                        </Badge>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-white mb-2 leading-snug">{p.title}</h3>

                    {/* Description */}
                    <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-3 mb-3">{p.description}</p>

                    {/* Submitter */}
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-3">
                      <span>{t("submittedBy")} <span className="text-white font-bold">{p.submitted_by_name ?? "—"}</span></span>
                      <span>·</span>
                      <span dir="ltr">{p.submitted_at}</span>
                    </div>

                    {/* Voting bars */}
                    {(p.status === "voting" || p.status === "approved" || p.status === "rejected") && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mb-3">
                        <div className="space-y-1.5">
                          {[
                            { label: t("voteApprove"), count: p.votes_approve, color: "bg-green-400", text: "text-green-400" },
                            { label: t("voteObject"),  count: p.votes_object,  color: "bg-red-400",   text: "text-red-400" },
                            { label: t("voteAbstain"), count: p.votes_abstain, color: "bg-neutral-500", text: "text-neutral-400" },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center gap-2">
                              <span className="text-[10px] text-neutral-500 w-12 flex-shrink-0">{row.label}</span>
                              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", row.color)}
                                  style={{ width: eligible > 0 ? (row.count / eligible) * 100 + "%" : "0%" }}
                                />
                              </div>
                              <span className={cn("text-[11px] font-bold font-mono w-8 text-left", row.text)}>{row.count}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[9px] text-neutral-600 mt-2 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {t("votedCount", { total, eligible })}
                        </div>
                      </div>
                    )}

                    {/* Final decision */}
                    {p.final_decision && (
                      <div className={cn(
                        "rounded-lg px-3 py-2 mb-3 text-[11px] flex items-center gap-2",
                        p.final_decision === "approved"
                          ? "bg-green-400/[0.06] border border-green-400/25 text-green-300"
                          : "bg-red-400/[0.06] border border-red-400/25 text-red-300",
                      )}>
                        <Calendar className="w-3 h-3" />
                        {t("finalDecisionBy")} <span className="font-bold">{p.final_decision_by}</span> · {p.final_decision_at}
                      </div>
                    )}

                    {/* CTA */}
                    <div className="flex items-center justify-end">
                      <span className="text-[11px] text-blue-400 font-bold flex items-center gap-1">
                        {t("detailsAndVote")}
                        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
