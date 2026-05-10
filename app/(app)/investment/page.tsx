"use client"

/**
 * /investment — Phase 13.16 rebuild.
 *
 * From-scratch rewrite of the previous 1076-line trade panel. The
 * new page is a clean *investor showcase* that drives the user to
 * the dedicated /exchange page for actual trading. Layout:
 *
 *   1. Hero — sticky-ish header with the project selector.
 *   2. Chart — recharts area / line over price_history. Reacts to
 *              realtime UPDATEs on projects + INSERTs on
 *              price_history filtered by the selected project.
 *   3. Status grid — funded% / investors / dividends.
 *   4. Action row — full-width "شراء" + "بيع" buttons that route to
 *              /exchange?project=<id>&mode=buy|sell.
 *   5. Brief project info card (description, sector, expected
 *              return) so users have enough context to commit.
 *
 * Data integrity: every number is derived from `projects` +
 * `holdings` (via get_public_investor_counts) + `price_history`
 * (via get_price_history). No hard-coded values.
 *
 * Error handling: if the selected project disappears mid-session
 * (e.g. admin froze it, or RLS rejection), an empty-state card
 * appears asking the user to pick another project. The chart
 * handles its own empty-state when price_history has zero rows.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { ShoppingCart, TrendingDown, ArrowLeft, Info } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { ProjectChart } from "@/components/investment/ProjectChart"
import { ProjectSelector } from "@/components/investment/ProjectSelector"
import {
  ProjectStatusGrid,
  type ProjectStatusValues,
} from "@/components/investment/ProjectStatusGrid"
import { getAllProjects } from "@/lib/data/projects"
import {
  getProjectPriceTimeline,
  type PriceHistoryPoint,
} from "@/lib/data/price-history"
import {
  getProjectLiveSnapshot,
  type ProjectLiveSnapshot,
} from "@/lib/data/project-snapshot"
import { createClient } from "@/lib/supabase/client"
import { readPersistedSync } from "@/lib/data/cache"
import type { Project } from "@/lib/mock-data/types"
import { cn } from "@/lib/utils/cn"

const fmt = (n: number) => n.toLocaleString("en-US")

function InvestmentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get("project") ?? null

  // ─── Hydration: paint instantly from cached projects ────────────
  const cachedProjects =
    readPersistedSync<Project[]>("projects:active:all") ?? []
  const [projects, setProjects] = useState<Project[]>(cachedProjects)
  const [loadingProjects, setLoadingProjects] = useState<boolean>(
    cachedProjects.length === 0,
  )

  // Selected project — defaults to the URL param if present, else first.
  const [selected, setSelected] = useState<Project | null>(() => {
    if (cachedProjects.length === 0) return null
    return (
      cachedProjects.find((p) => p.id === initialProjectId) ??
      cachedProjects[0]
    )
  })
  const [error, setError] = useState<string | null>(null)

  // ─── Live state ──────────────────────────────────────────────────
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([])
  // Phase 13.18 — starts TRUE so the chart shows a skeleton on first
  // mount instead of flashing the "no history" empty state. Flips to
  // false only after the first fetch resolves.
  const [loadingHistory, setLoadingHistory] = useState(true)
  // Tracks whether the network round-trip for the SELECTED project
  // has finished at least once. The chart uses this to decide
  // skeleton vs. real empty state.
  const [historyFetched, setHistoryFetched] = useState(false)
  // Phase 13.22 — canonical live snapshot from get_project_live_snapshot.
  // Replaces the per-field manual derivations with a single object.
  const [snapshot, setSnapshot] = useState<ProjectLiveSnapshot | null>(null)

  // ─── Effect: load projects from DB (refresh) ─────────────────────
  useEffect(() => {
    let cancelled = false
    void getAllProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
      setLoadingProjects(false)
      // If no selection yet, pick from URL or first
      setSelected((prev) => {
        if (prev) return rows.find((p) => p.id === prev.id) ?? rows[0] ?? null
        return (
          rows.find((p) => p.id === initialProjectId) ?? rows[0] ?? null
        )
      })
    })
    return () => { cancelled = true }
  }, [initialProjectId])

  // ─── Effect: load price history + investors + dividends for the
  // selected project. Re-runs on project change + on realtime ticks. ─
  const refreshSelected = useCallback(async (projectId: string) => {
    setLoadingHistory(true)
    setHistoryFetched(false)  // reset for the new project
    setPriceHistory([])       // drop previous project's points so the
                              // chart never shows stale data while
                              // loading the new project.
    setError(null)

    // Phase 13.22 — single live snapshot replaces the previous
    // 3 separate queries (investors RPC + dividends + manual ratio
    // math). It returns offering_total, offering_available,
    // offering_sold, owner_shares, funding_pct, investor_count and
    // dividends_total in one round-trip from project_wallets +
    // holdings + dividends, all aggregated server-side.
    //
    // The price timeline still runs in parallel since it pulls a
    // larger payload (200 history rows).
    const [historyRes, snapshotRes] = await Promise.allSettled([
      getProjectPriceTimeline(projectId, 200),
      getProjectLiveSnapshot(projectId),
    ])

    if (historyRes.status === "fulfilled") {
      setPriceHistory(historyRes.value)
    } else {
      setPriceHistory([])
    }

    if (snapshotRes.status === "fulfilled" && snapshotRes.value) {
      setSnapshot(snapshotRes.value)
    } else {
      setSnapshot(null)
    }

    setLoadingHistory(false)
    setHistoryFetched(true)
  }, [])

  useEffect(() => {
    if (!selected) return
    void refreshSelected(selected.id)
  }, [selected, refreshSelected])

  // ─── Realtime — projects.UPDATE + price_history.INSERT ──────────
  useEffect(() => {
    if (!selected) return
    const supabase = createClient()
    let cancelled = false

    const channel = supabase
      .channel(`investment:${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
          filter: `project_id=eq.${selected.id}`,
        },
        () => { if (!cancelled) void refreshSelected(selected.id) },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${selected.id}`,
        },
        (payload) => {
          if (cancelled) return
          // Merge fresh row into selected so price + meta update live.
          const fresh = payload.new as Partial<Project> & { id: string }
          setSelected((cur) => (cur ? { ...cur, ...fresh } : cur))
          void refreshSelected(selected.id)
        },
      )
      // Holdings change → investor count may change.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "holdings",
          filter: `project_id=eq.${selected.id}`,
        },
        () => { if (!cancelled) void refreshSelected(selected.id) },
      )
      // Phase 13.19 — completed deals are now plotted as price points
      // on the chart, so a new completion should trigger a refresh.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
          filter: `project_id=eq.${selected.id}`,
        },
        () => { if (!cancelled) void refreshSelected(selected.id) },
      )
      // Phase 13.22 — admin "إضافة حصص للطرح" mutates project_wallets
      // (the offering wallet's total_shares + available_shares). The
      // snapshot RPC reads these directly, so we need to refresh
      // when they change.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_wallets",
          filter: `project_id=eq.${selected.id}`,
        },
        () => { if (!cancelled) void refreshSelected(selected.id) },
      )
      .subscribe()

    return () => {
      cancelled = true
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  }, [selected, refreshSelected])

  // ─── Derived: status values ──────────────────────────────────────
  // Phase 13.22 — read EVERYTHING from the live snapshot. Owner
  // equity is never part of the funding ratio (the RPC enforces
  // funding_pct = offering_sold / offering_total). When admin clicks
  // "إضافة حصص للطرح", the offering_wallet grows, the snapshot's
  // offering_total updates, and the percentage adjusts naturally.
  const status: ProjectStatusValues = useMemo(() => {
    if (!snapshot) {
      return {
        fundedPct: 0,
        sharesSold: 0,
        offeringTotal: 0,
        investorsCount: 0,
        dividendsTotal: -1,
      }
    }
    return {
      fundedPct: snapshot.funding_pct,
      sharesSold: snapshot.offering_sold,
      offeringTotal: snapshot.offering_total,
      investorsCount: snapshot.investor_count,
      dividendsTotal: snapshot.dividends_total,
    }
  }, [snapshot])

  // ─── Action handlers ────────────────────────────────────────────
  const goToExchange = (mode: "buy" | "sell") => {
    if (!selected) return
    router.push(`/exchange?project=${selected.id}&mode=${mode}`)
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Phase 13.23 — full-width container on every breakpoint.
           Chart fills 100% of the viewport width (minus a small
           padding) so it reads like a dedicated trading surface
           on desktop. Mobile keeps tighter padding for legibility. */}
      <div className="px-2 sm:px-4 lg:px-6 py-4 w-full">
        {/* Header — back + title */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center"
            aria-label="رجوع"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-300 rotate-180" />
          </button>
          <div className="text-right">
            <div className="text-base sm:text-lg font-bold text-white">📈 الاستثمار</div>
            <div className="text-[10px] text-neutral-500">
              تابع أداء المشروع لحظياً قبل اتخاذ القرار
            </div>
          </div>
        </div>

        {/* 1. Project selector */}
        <div className="mb-4">
          <ProjectSelector
            projects={projects}
            value={selected}
            onChange={(p) => {
              setSelected(p)
              router.replace(`/investment?project=${p.id}`, { scroll: false })
            }}
            label="اختر المشروع"
          />
        </div>

        {/* Empty state when no projects exist at all */}
        {!loadingProjects && projects.length === 0 && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-10 text-center">
            <div className="text-3xl mb-2 opacity-50">🔍</div>
            <div className="text-sm text-white font-bold mb-1">لا توجد مشاريع متاحة</div>
            <div className="text-xs text-neutral-400">
              ستظهر فرص الاستثمار هنا فور إطلاقها على المنصّة.
            </div>
          </div>
        )}

        {/* Project not found edge case */}
        {!loadingProjects && projects.length > 0 && !selected && (
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-2xl p-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-yellow-300 font-bold mb-1">
                المشروع غير متاح
              </div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                قد يكون هذا المشروع قد أُغلق أو جُمِّد. اختر مشروعاً آخر من القائمة أعلاه.
              </div>
            </div>
          </div>
        )}

        {/* 2. Hero: chart + status + actions — only when a project is selected */}
        {selected && (
          <div className="space-y-3 sm:space-y-4">
            {/* Chart — Phase 13.22: currentPrice now comes from the
                 live snapshot (which reads project_wallets +
                 projects in one RPC call). Falls back to local
                 selected.share_price when snapshot hasn't returned
                 yet so the price ribbon is never blank. */}
            <ProjectChart
              key={selected.id}
              points={priceHistory}
              currentPrice={
                snapshot?.current_market_price ??
                Number(
                  (selected as Project & { current_market_price?: number }).current_market_price ??
                    selected.share_price ??
                    0,
                )
              }
              loading={loadingHistory}
              hasFetched={historyFetched}
              symbol={snapshot?.symbol ?? selected.symbol}
            />

            {/* 3. Buy / Sell action row — Phase 13.23: directly under
                 the chart per founder spec, before the status grid,
                 so the primary actions are within thumb reach on
                 mobile. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
              <button
                onClick={() => goToExchange("buy")}
                className={cn(
                  "py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all",
                  "bg-[#deff9a] text-black hover:bg-[#c9eb78] active:scale-[0.98]",
                  "shadow-[0_0_24px_rgba(222,255,154,0.15)]",
                )}
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                شراء
              </button>
              <button
                onClick={() => goToExchange("sell")}
                className={cn(
                  "py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all",
                  "bg-red-400/[0.1] border border-red-400/30 text-red-300 hover:bg-red-400/[0.15] active:scale-[0.98]",
                )}
              >
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                بيع
              </button>
            </div>

            {/* 4. Status grid — under the action row */}
            <ProjectStatusGrid values={status} loading={loadingHistory} />

            {/* 5. Brief project info — Phase 13.22 reads description,
                 sector, distribution_type, expected return, risk
                 level from the live snapshot so admin edits show
                 up here without a page reload. */}
            <ProjectInfoCard project={selected} snapshot={snapshot} />
          </div>
        )}

        {/* Error band */}
        {error && (
          <div className="mt-4 bg-red-400/[0.06] border border-red-400/[0.2] rounded-xl p-3 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// ─── Sub-component: brief project info card ────────────────────────
// Phase 13.22 — every field reads from the live snapshot first; the
// `project` prop is only the cached fallback for cold-cache visits
// before the snapshot RPC resolves. Admin edits to risk_level /
// distribution_type / expected_return propagate here within ~1s
// thanks to the realtime project + project_wallets channel.
const DISTRIBUTION_LABEL: Record<string, string> = {
  monthly: "شهرياً",
  quarterly: "ربع سنوي",
  semi_annual: "نصف سنوي",
  annual: "سنوياً",
}
const RISK_LABEL: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
}

function ProjectInfoCard({
  project,
  snapshot,
}: {
  project: Project
  snapshot: ProjectLiveSnapshot | null
}) {
  // Snapshot wins for every field; fall back to the cached Project
  // shape only when the snapshot hasn't loaded yet.
  type Extra = Project & {
    short_description?: string | null
    expected_return_min?: number | string | null
    expected_return_max?: number | string | null
  }
  const fallback = project as Extra

  const name        = snapshot?.name        ?? project.name
  const symbol      = snapshot?.symbol      ?? project.symbol
  const logoUrl     = snapshot?.logo_url    ?? project.logo_url
  const shortDesc   = (snapshot?.short_description ?? fallback.short_description ?? "")
                       .toString()
                       .trim()
                     || (snapshot?.description ?? fallback.description ?? "").toString().trim()
  const annualMin   = snapshot?.expected_return_min ?? Number(fallback.expected_return_min ?? 0)
  const annualMax   = snapshot?.expected_return_max ?? Number(fallback.expected_return_max ?? 0)
  const distRaw     = (snapshot?.distribution_type ?? "").toString()
  const distLabel   = DISTRIBUTION_LABEL[distRaw] ?? null
  const riskRaw     = (snapshot?.risk_level ?? "").toString()
  const riskLabel   = RISK_LABEL[riskRaw] ?? null

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        {logoUrl ? (
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
            <Image
              src={logoUrl}
              alt={name}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center flex-shrink-0 text-2xl">
            🏗️
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-bold text-white truncate">
            {name}
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {project.sector && <span>{project.sector}</span>}
            {symbol && (
              <span className="font-mono text-[#deff9a]" dir="ltr">
                {symbol}
              </span>
            )}
          </div>
        </div>
        {(annualMin > 0 || annualMax > 0) && (
          <div className="text-left flex-shrink-0">
            <div className="text-[9px] text-neutral-500">العائد المتوقّع</div>
            <div className="text-xs font-bold text-[#deff9a] font-mono mt-0.5">
              {annualMin}-{annualMax}%
              <span className="text-[9px] text-neutral-500 mr-1">سنويّاً</span>
            </div>
          </div>
        )}
      </div>

      {/* Phase 13.22 — distribution + risk pills, read live from snapshot */}
      {(distLabel || riskLabel) && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {distLabel && (
            <span className="text-[10px] bg-blue-400/[0.08] border border-blue-400/[0.2] text-blue-300 rounded-md px-2 py-0.5">
              التوزيع: {distLabel}
            </span>
          )}
          {riskLabel && (
            <span
              className={cn(
                "text-[10px] rounded-md px-2 py-0.5 border",
                riskRaw === "low"  && "bg-green-400/[0.08] border-green-400/[0.2] text-green-300",
                riskRaw === "medium" && "bg-yellow-400/[0.08] border-yellow-400/[0.2] text-yellow-300",
                riskRaw === "high" && "bg-red-400/[0.08] border-red-400/[0.2] text-red-300",
              )}
            >
              المخاطرة: {riskLabel}
            </span>
          )}
        </div>
      )}

      {shortDesc && (
        <p className="text-[11px] sm:text-xs text-neutral-300 leading-relaxed">
          {shortDesc}
        </p>
      )}
    </div>
  )
}

// ─── Default export wraps Suspense for useSearchParams ────────────
export default function InvestmentPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentPageContent />
    </Suspense>
  )
}
