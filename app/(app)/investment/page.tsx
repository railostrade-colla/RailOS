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
  getPriceHistory,
  type PriceHistoryPoint,
} from "@/lib/data/price-history"
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
  const [investorsCount, setInvestorsCount] = useState(0)
  const [dividendsTotal, setDividendsTotal] = useState<number>(-1) // -1 = unknown

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
    const supabase = createClient()

    // Parallel: history + investors + dividends (best-effort)
    const [historyRes, investorsRes, dividendsRes] = await Promise.allSettled([
      getPriceHistory(projectId, 200),
      supabase.rpc("get_public_investor_counts", { p_project_ids: [projectId] }),
      supabase
        .from("dividends")
        .select("amount")
        .eq("project_id", projectId),
    ])

    if (historyRes.status === "fulfilled") {
      setPriceHistory(historyRes.value)
    } else {
      setPriceHistory([])
    }

    if (investorsRes.status === "fulfilled" && Array.isArray(investorsRes.value.data)) {
      const row = (investorsRes.value.data as Array<{ investor_count: number | string }>)[0]
      setInvestorsCount(Number(row?.investor_count ?? 0))
    } else {
      setInvestorsCount(0)
    }

    if (
      dividendsRes.status === "fulfilled" &&
      Array.isArray(dividendsRes.value.data)
    ) {
      type DivRow = { amount?: number | string | null }
      const total = (dividendsRes.value.data as DivRow[]).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      )
      setDividendsTotal(total)
    } else {
      // Table missing or RLS blocked → unknown (renders "—").
      setDividendsTotal(-1)
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
      .subscribe()

    return () => {
      cancelled = true
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
    }
  }, [selected, refreshSelected])

  // ─── Derived: status values ──────────────────────────────────────
  const status: ProjectStatusValues = useMemo(() => {
    if (!selected) {
      return {
        fundedPct: 0,
        sharesSold: 0,
        offeringTotal: 0,
        investorsCount: 0,
        dividendsTotal: -1,
      }
    }
    type WithOfferingPct = Project & { offering_percentage?: number }
    const offeringPct = Number((selected as WithOfferingPct).offering_percentage ?? 0)
    const offeringTotal =
      offeringPct > 0
        ? Math.round(Number(selected.total_shares ?? 0) * offeringPct / 100)
        : Number(selected.total_shares ?? 0)
    const available = Number(selected.available_shares ?? 0)
    const sharesSold = Math.max(0, offeringTotal - available)
    const fundedPct =
      offeringTotal > 0 ? (sharesSold / offeringTotal) * 100 : 0

    return {
      fundedPct,
      sharesSold,
      offeringTotal,
      investorsCount,
      dividendsTotal,
    }
  }, [selected, investorsCount, dividendsTotal])

  // ─── Action handlers ────────────────────────────────────────────
  const goToExchange = (mode: "buy" | "sell") => {
    if (!selected) return
    router.push(`/exchange?project=${selected.id}&mode=${mode}`)
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="px-3 sm:px-6 py-4 max-w-screen-xl mx-auto">
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
            {/* Chart — Phase 13.18: explicit hasFetched so the empty
                 state never shows during the initial fetch. The
                 `key` prop forces a clean remount when the user picks
                 a different project so internal chart state (period,
                 mode) doesn't bleed across projects. */}
            <ProjectChart
              key={selected.id}
              points={priceHistory}
              currentPrice={Number(
                (selected as Project & { current_market_price?: number }).current_market_price ??
                  selected.share_price ??
                  0,
              )}
              loading={loadingHistory}
              hasFetched={historyFetched}
              symbol={selected.symbol}
            />

            {/* 3. Status grid */}
            <ProjectStatusGrid values={status} loading={loadingHistory} />

            {/* 4. Buy / Sell action row */}
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
                  "bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.08] active:scale-[0.98]",
                )}
              >
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                بيع
              </button>
            </div>

            {/* 5. Brief project info */}
            <ProjectInfoCard project={selected} />
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
function ProjectInfoCard({ project }: { project: Project }) {
  type Extra = Project & {
    short_description?: string | null
    expected_return_min?: number | string | null
    expected_return_max?: number | string | null
  }
  const p = project as Extra
  const shortDesc =
    p.short_description?.toString().trim() ||
    p.description?.toString().trim() ||
    ""
  const annualMin = Number(p.expected_return_min ?? p.expected_return_min ?? 0)
  const annualMax = Number(p.expected_return_max ?? p.expected_return_max ?? 0)

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        {project.logo_url ? (
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
            <Image
              src={project.logo_url}
              alt={project.name}
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
            {project.name}
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {project.sector && <span>{project.sector}</span>}
            {project.symbol && (
              <span className="font-mono text-[#deff9a]" dir="ltr">
                {project.symbol}
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
