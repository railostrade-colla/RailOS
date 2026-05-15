"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  ChevronDown,
  ChevronLeft,
  Wallet,
  ArrowLeftRight,
  FileText,
  Gavel,
  TrendingUp,
  TrendingDown,
  Briefcase,
} from "lucide-react"
// Phase 14.11 A6 — recharts (~65 KB) is code-split. Both dashboard
// charts live below the hero + quick-actions fold, so deferring them
// shaves recharts off the dashboard's initial JS and off every other
// user-side page's shared chunk.
import dynamic from "next/dynamic"
const DashboardSparkline = dynamic(
  () =>
    import("@/components/dashboard/DashboardCharts").then(
      (m) => m.DashboardSparkline,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[50px] flex items-center justify-center text-[10px] text-neutral-600">
        جاري التحميل...
      </div>
    ),
  },
)
const DashboardVolumeChart = dynamic(
  () =>
    import("@/components/dashboard/DashboardCharts").then(
      (m) => m.DashboardVolumeChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 flex items-center justify-center text-[10px] text-neutral-600">
        جاري التحميل...
      </div>
    ),
  },
)
import { AppLayout } from "@/components/layout/AppLayout"
import { AdsSlider } from "@/components/common/AdsSlider"
import { ProjectCard } from "@/components/cards"
import { SectionHeader, Tabs, SkeletonCard } from "@/components/ui"
// Phase 14.07f — only type imports survive from mock-data. The 10 runtime
// helpers that used to live here (mockProjects, mockAds, mockStats,
// CURRENT_USER, HOLDINGS, getPortfolioSummary, getActiveAlerts,
// getTrendingProjects, getClosingSoonProjects, getNewProjects,
// getRecentNews) were already unused — the real DB equivalents in
// "@/lib/data" took over months ago. The two that WERE still wired
// (getProjectCurrentPrice / getProjectPriceTrend) returned synthetic
// data; price now derives directly from project.current_market_price
// and trend from priceTimeline (see derivePriceTrend below).
import type { Project, Ad } from "@/lib/mock-data/types"
import type { ProjectCardData } from "@/lib/mock-data"
import {
  getNewProjects as dbGetNewProjects,
  getTrendingProjects as dbGetTrendingProjects,
  getComingSoonProjects as dbGetComingSoonProjects,
  getLatestNews as dbGetLatestNews,
  getAllProjects as dbGetAllProjects,
} from "@/lib/data"
import { getActiveAds, type DBAd } from "@/lib/data/ads"
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/data/profile"
import { getPortfolioData, type PortfolioSummary as DBPortfolioSummary } from "@/lib/data/portfolio"
import {
  getPortfolioChangeMetrics,
  EMPTY_PORTFOLIO_CHANGE_METRICS,
  type PortfolioChangeMetrics,
} from "@/lib/data/portfolio-change-metrics"
// Phase 14.07f — real per-project price timeline for the Active Project
// mini-chart. Same helper that powers the /project/[id] full chart.
import {
  getProjectPriceTimeline,
  type PriceHistoryPoint,
} from "@/lib/data/price-history"
import { readPersistedSync, invalidateCache } from "@/lib/data/cache"
import { createClient } from "@/lib/supabase/client"
import { ProjectCardSkeleton } from "@/components/skeletons/ProjectCardSkeleton"
import { LEVEL_LABELS, LEVEL_ICONS } from "@/lib/utils/contractLimits"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ────────────────────────────────────────────────────
// Phase 11.17 — full-digit IQD formatter. Founder spec: no
// "ألف / مليون / مليار" shorthand on the dashboard — render the
// actual zeroes with thousand separators (875,000 / 1,000,000,000).
// Name kept as fmtCompact only for grep continuity; behaviour is now
// "always full digits". || 0 guards against undefined during the
// initial loading state.
function fmtCompact(n: number): string {
  return Math.round(n || 0).toLocaleString("en-US")
}

// Phase 13.49 — keep big-IQD/SHR tile values inside their containers on
// mobile by shrinking the font as the number's magnitude grows. Founder
// spec: "اي رقم يصل المليار صغّره 30%، والذي يصل المليون صغّره 15%".
// Base size in the tile grid is `text-base` (16px), so:
//   • ≥ 1B   → 16 × 0.70 ≈ 11.2px  → text-[11px]
//   • ≥ 1M   → 16 × 0.85 ≈ 13.6px  → text-[13px]
//   • else   → text-base
function tileValueSize(n: number): string {
  const abs = Math.abs(Number(n) || 0)
  if (abs >= 1_000_000_000) return "text-[11px]"
  if (abs >= 1_000_000) return "text-[13px]"
  return "text-base"
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return "صباح الخير"
  return "مساء الخير"
}

// ─── Phase 13.48 — wallet-header change pills ──────────────────
function pillTone(positive: boolean, neutral: boolean) {
  if (neutral) return "text-neutral-400"
  return positive ? "text-green-400" : "text-red-400"
}

function ChangePill({ valueIqd, label }: { valueIqd: number; label: string }) {
  const v = Math.round(valueIqd || 0)
  const positive = v > 0
  const neutral = v === 0
  return (
    <span className={cn("text-xs font-bold flex items-center gap-1", pillTone(positive, neutral))}>
      {positive
        ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
        : v < 0
          ? <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
          : null}
      <span dir="ltr" className="font-mono">
        {positive ? "+" : ""}{v.toLocaleString("en-US")}
      </span>
      <span className="text-[10px] text-neutral-500">IQD</span>
      <span className="text-[10px] text-neutral-500 font-normal">{label}</span>
    </span>
  )
}

function ChangePillPct({ pct, label }: { pct: number; label: string }) {
  const v = Number(pct || 0)
  const positive = v > 0
  const neutral = v === 0
  const formatted = (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)).replace(/\.00$/, "")
  return (
    <span className={cn("text-xs font-bold flex items-center gap-1", pillTone(positive, neutral))}>
      {positive
        ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
        : v < 0
          ? <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
          : null}
      <span dir="ltr" className="font-mono">
        {positive ? "+" : ""}{formatted}%
      </span>
      <span className="text-[10px] text-neutral-500 font-normal">{label}</span>
    </span>
  )
}

/** Map a DB ad row → the slider's legacy Ad shape (Phase N). */
function dbAdToMockShape(row: DBAd): Ad {
  const isExternal = /^https?:\/\//i.test(row.link_url ?? "")
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    icon: "📢",
    action_label: "اعرف أكثر",
    link_type: isExternal ? "external" : "internal",
    link_url: row.link_url ?? "/",
    type: row.image_url ? "image" : "text",
  }
}

const sectorIcon = (s: string) => {
  if (s.includes("طب")) return "🏥"
  if (s.includes("تقن")) return "💻"
  if (s.includes("زراع")) return "🌾"
  if (s.includes("تجار")) return "🏪"
  if (s.includes("صناع")) return "🏭"
  if (s.includes("عقار")) return "🏢"
  return "🏢"
}

// Phase 14.07f — the inline Sparkline component (Math.sin-driven SVG)
// was removed. It fabricated price history that didn't exist in the
// DB. The Active Project mini-chart now uses real
// `getProjectPriceTimeline()` rendered via Recharts (below). The Hero
// portfolio sparkline was deleted entirely since no portfolio-history
// table exists — better an honest empty space than a synthetic curve.

/** Derive an up/down/flat indicator from the live price vs the
 *  founder's reference share_price. No DB call needed — both values
 *  are already on the Project row. */
function derivePriceTrend(
  currentPrice: number,
  referencePrice: number,
): "up" | "down" | "flat" {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(referencePrice)) return "flat"
  if (currentPrice > referencePrice) return "up"
  if (currentPrice < referencePrice) return "down"
  return "flat"
}

// 12-month volume — populated from DB analytics when wired (currently
// renders a flat zero baseline so the chart doesn't show fake demand).
const VOLUME_HISTORY: Array<{ month: string; volume: number }> = [
  { month: "يناير", volume: 0 },
  { month: "فبراير", volume: 0 },
  { month: "مارس", volume: 0 },
  { month: "أبريل", volume: 0 },
  { month: "مايو", volume: 0 },
  { month: "يونيو", volume: 0 },
  { month: "يوليو", volume: 0 },
  { month: "أغسطس", volume: 0 },
  { month: "سبتمبر", volume: 0 },
  { month: "أكتوبر", volume: 0 },
  { month: "نوفمبر", volume: 0 },
  { month: "ديسمبر", volume: 0 },
]

// ─── Quick action items (4 only — no send/receive) ──────────────
const QUICK_ACTIONS = [
  {
    label: "محفظة",
    path: "/portfolio",
    icon: Wallet,
    badge: 0,
    iconColor: "text-green-400",
    iconBg: "bg-green-400/10",
    iconBorder: "border-green-400/30",
  },
  {
    label: "تبادل",
    path: "/exchange",
    icon: ArrowLeftRight,
    badge: 0,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    iconBorder: "border-blue-400/30",
  },
  {
    label: "مزاد",
    path: "/auctions",
    icon: Gavel,
    badge: 0,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-400/10",
    iconBorder: "border-orange-400/30",
  },
  {
    label: "عقود",
    path: "/contracts",
    icon: FileText,
    badge: 0,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    iconBorder: "border-purple-400/30",
  },
] as const

// ════════════════════════════════════════════════════════════════
// Main page — production mode (no mock data)
// ════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [discoverTab, setDiscoverTab] = useState<"trending" | "closing" | "new">("trending")

  // ─── Production defaults (zero state — no mock fallbacks) ─────
  const alerts: Array<{ id: string; type: string; title: string; href: string }> = []

  // Live data — populated from DB only
  const [trending, setTrending] = useState<ProjectCardData[]>([])
  const [newProjects, setNewProjects] = useState<ProjectCardData[]>([])
  // Phase 13.17 — coming-soon tab now backed by the discover RPC
  // (admin pins + future offering_start_date).
  const [closing, setClosing] = useState<ProjectCardData[]>([])
  const [news, setNews] = useState<Array<{
    id: string; icon: string; title: string; date: string; is_new: boolean
  }>>([])
  const [loading, setLoading] = useState(true)

  // Phase 11.18 — stale-while-revalidate. Read last-known values
  // from localStorage SYNCHRONOUSLY at mount so the page paints
  // instantly with whatever the user saw last time, instead of an
  // empty skeleton. Then fetch fresh in the background and update
  // state when it resolves. localStorage hits are <1ms — no perceived
  // delay. Cold-cache (first-ever visit) still shows skeletons but
  // every subsequent visit feels instant.
  const cachedTrending   = readPersistedSync<Project[]>("projects:trending:3") ?? []
  const cachedNew        = readPersistedSync<Project[]>("projects:new:3") ?? []
  const cachedAllProj    = readPersistedSync<Project[]>("projects:active:all") ?? []
  const cachedProfile    = readPersistedSync<CurrentUserProfile>("currentUser:profile")
  const cachedPortfolio  = readPersistedSync<{ summary: DBPortfolioSummary }>("portfolio:data:v3")

  const [userProfile, setUserProfile] = useState<CurrentUserProfile | null>(cachedProfile)
  const [dbPortfolio, setDbPortfolio] = useState<DBPortfolioSummary | null>(
    cachedPortfolio?.summary ?? null,
  )
  const [dbProjects, setDbProjects] = useState<Project[]>(cachedAllProj)
  // Phase N — real ads from the `ads` table (mock fallback when empty).
  const [dbAds, setDbAds] = useState<Ad[]>([])
  // Phase 13.48 — portfolio change metrics for the hero card indicator
  // (reference delta IQD + daily % + weekly %).
  const [changeMetrics, setChangeMetrics] = useState<PortfolioChangeMetrics>(
    EMPTY_PORTFOLIO_CHANGE_METRICS,
  )

  // Phase 14.07f — real price timeline for the currently selected
  // project's mini-chart. Fetched only when selectedProject changes
  // (debounced 200ms to coalesce rapid switches from the dropdown).
  // Empty array ⇒ the chart slot shows an empty state instead of a
  // synthetic curve.
  const [selectedProjectTimeline, setSelectedProjectTimeline] = useState<
    PriceHistoryPoint[]
  >([])
  const [selectedProjectTimelineLoading, setSelectedProjectTimelineLoading] =
    useState<boolean>(false)

  // Seed trending/new from persisted cache too — same instant-paint trick.
  useEffect(() => {
    if (cachedTrending.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTrending(cachedTrending as any as ProjectCardData[])
    }
    if (cachedNew.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNewProjects(cachedNew as any as ProjectCardData[])
    }
    // If we already had ANY persisted state, hide the "loading" gate
    // so the page renders the cached frame instead of the skeleton.
    if (
      cachedTrending.length > 0 ||
      cachedNew.length > 0 ||
      cachedAllProj.length > 0 ||
      cachedPortfolio
    ) {
      setLoading(false)
    }
    if (cachedAllProj.length > 0) {
      setSelectedProject((cur) => cur ?? cachedAllProj[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Phase 13.49 — decoupled fetchers + realtime + focus refresh ──
  // Previously, all 9 fetchers were awaited via a single Promise.all,
  // which meant the slowest call (typically getPortfolioData → 4-6
  // round-trips) blocked EVERY UI section from updating, including
  // the active-project card. Splitting them lets each piece paint as
  // soon as its own data is ready.
  //
  // We also subscribe to `projects` postgres_changes so admin
  // edits (price changes, new projects) reach the dashboard
  // instantly without a manual reload, and refresh on tab focus to
  // catch anything missed while the tab was hidden.
  useEffect(() => {
    let cancelled = false

    // Active-project list — the one the user complained about.
    // Fired FIRST so it has the best chance to paint before the
    // expensive portfolio aggregation finishes.
    const loadProjects = (force = false) => {
      if (force) invalidateCache("projects:active:all")
      dbGetAllProjects().then((allProj) => {
        if (cancelled) return
        setDbProjects(allProj)
        if (allProj.length > 0) {
          setSelectedProject((cur) => cur ?? allProj[0])
        }
        setLoading(false)
      }).catch(() => { if (!cancelled) setLoading(false) })
    }

    const loadDiscover = () => {
      dbGetTrendingProjects(3).then((t) => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTrending(t as any as ProjectCardData[])
      }).catch(() => {})
      dbGetNewProjects(3).then((n) => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNewProjects(n as any as ProjectCardData[])
      }).catch(() => {})
      dbGetComingSoonProjects(3).then((cs) => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setClosing(cs as any as ProjectCardData[])
      }).catch(() => {})
    }

    const loadNews = () => {
      dbGetLatestNews(4).then((ns) => {
        if (cancelled) return
        setNews(ns.map((row) => ({
          id: row.id,
          icon: row.news_type === "feature" ? "🎉" : row.news_type === "promo" ? "🎁" : row.news_type === "alert" ? "⚠️" : "📢",
          title: row.title,
          date: row.published_at?.split("T")[0] ?? "—",
          is_new: row.published_at ? (Date.now() - new Date(row.published_at).getTime()) < 7 * 86_400_000 : false,
        })))
      }).catch(() => {})
    }

    const loadProfile = () => {
      getCurrentUserProfile().then((prof) => {
        if (cancelled || !prof) return
        setUserProfile(prof)
      }).catch(() => {})
    }

    const loadPortfolio = (force = false) => {
      if (force) invalidateCache("portfolio:data:v3")
      getPortfolioData().then((port) => {
        if (cancelled) return
        if (port) setDbPortfolio(port.summary)
      }).catch(() => {})
      getPortfolioChangeMetrics().then((metrics) => {
        if (cancelled) return
        setChangeMetrics(metrics)
      }).catch(() => {})
    }

    const loadAds = () => {
      getActiveAds("dashboard").then((ads) => {
        if (cancelled) return
        setDbAds(ads.map(dbAdToMockShape))
      }).catch(() => {})
    }

    // Kick off everything in parallel — no one blocks anyone else.
    loadProjects()
    loadDiscover()
    loadNews()
    loadProfile()
    loadPortfolio()
    loadAds()

    // ─── Realtime subscription on projects ──────────────────────
    // Any admin price/state edit pushes a postgres_changes event.
    // We invalidate the cache and refetch — debounced via a 250ms
    // timer so a burst of trigger updates doesn't refetch 5x.
    const supabase = createClient()
    let refetchTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => {
        if (cancelled) return
        loadProjects(true)
        loadPortfolio(true)
      }, 250)
    }

    const channel = supabase
      .channel("dashboard:projects+price-history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => scheduleRefetch(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "price_history" },
        () => scheduleRefetch(),
      )
      .subscribe()

    // ─── Tab-focus refresh ──────────────────────────────────────
    // When the user switches back to the tab after it was hidden,
    // realtime may have re-connected with no cached events — force
    // a full refetch to catch up.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadProjects(true)
        loadPortfolio(true)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", handleVisibility)

    return () => {
      cancelled = true
      if (refetchTimer) clearTimeout(refetchTimer)
      supabase.removeChannel(channel).catch(() => {})
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", handleVisibility)
    }
  }, [])

  // ─── Phase 14.07f — selected-project price timeline ─────────────
  // Loads real points (creation anchor + completed deals + admin
  // changes + now snapshot) for the Active Project mini-chart.
  // Debounced so flipping between projects in the dropdown doesn't
  // spam the DB. Reset to [] immediately on switch so the user
  // never sees the previous project's data while loading.
  useEffect(() => {
    if (!selectedProject?.id) {
      setSelectedProjectTimeline([])
      setSelectedProjectTimelineLoading(false)
      return
    }
    const projectId = selectedProject.id
    let cancelled = false
    setSelectedProjectTimeline([])
    setSelectedProjectTimelineLoading(true)
    const debounce = setTimeout(() => {
      getProjectPriceTimeline(projectId, 30)
        .then((points) => {
          if (!cancelled) setSelectedProjectTimeline(points)
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[dashboard] price timeline fetch failed:", err)
          if (!cancelled) setSelectedProjectTimeline([])
        })
        .finally(() => {
          if (!cancelled) setSelectedProjectTimelineLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
  }, [selectedProject?.id])

  // ─── Resolved values (production — DB only, zero defaults) ────
  const userName =
    userProfile?.full_name?.trim() ||
    userProfile?.username?.trim() ||
    "—"
  const userLevel = (
    userProfile?.level && (userProfile.level in LEVEL_LABELS)
      ? userProfile.level
      : "starter"
  ) as keyof typeof LEVEL_LABELS

  const portfolio = dbPortfolio
    ? {
        totalValue: dbPortfolio.totalValue,
        dailyChange: 0,
        dailyChangePercent: 0,
        holdingsCount: dbPortfolio.holdingsCount,
      }
    : { totalValue: 0, dailyChange: 0, dailyChangePercent: 0, holdingsCount: 0 }

  const sectorsCount = dbPortfolio ? dbPortfolio.sectorsCount : 0

  // DB projects only — no mock fallback.
  const allProjects = dbProjects

  const filteredProjects = allProjects.filter(
    (p) => !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const discoverItems = discoverTab === "trending" ? trending : discoverTab === "closing" ? closing : newProjects
  const discoverEmptyMsg =
    discoverTab === "trending" ? "لا توجد مشاريع رائجة حالياً" :
    discoverTab === "closing" ? "لا توجد فرص تنتهي قريباً" :
    "لا توجد مشاريع جديدة"

  // Phase 13.13 — only show the skeleton on the FIRST visit (cold
  // localStorage cache). On subsequent visits we already painted with
  // cached data, so the empty state below is the right fallback when
  // the fresh fetch genuinely returns 0 rows.
  const discoverFirstLoad =
    loading &&
    trending.length === 0 &&
    newProjects.length === 0 &&
    cachedTrending.length === 0 &&
    cachedNew.length === 0

  return (
    <AppLayout>
      <div className="relative">
{/* Sticky Project Selector — hidden when no projects exist */}
        {selectedProject && (
        <div className="sticky top-[60px] lg:top-[68px] z-30 bg-card backdrop-blur-xl border-b border-border px-4 lg:px-8 py-3">
          <div className="relative max-w-2xl">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                "w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors",
                showDropdown && "rounded-b-none",
              )}
            >
              <div className="flex items-center gap-2.5">
                {/* Phase 11.05 — uploaded project logo (logo_url from
                    admin form), with sector-emoji fallback. */}
                {(selectedProject.logo_url || selectedProject.logo) ? (
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedProject.logo_url || selectedProject.logo}
                      alt={selectedProject.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">
                    {sectorIcon(selectedProject.sector)}
                  </div>
                )}
                <div className="text-right">
                  <div className="text-sm text-white font-medium">{selectedProject.name}</div>
                  <div className="text-[10px] text-neutral-500">{selectedProject.sector}</div>
                </div>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", showDropdown && "rotate-180")} />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 bg-card backdrop-blur-2xl border border-border border-t-0 rounded-b-xl shadow-floating overflow-hidden">
                <div className="p-2.5 border-b border-border">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ابحث عن مشروع..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-lg pr-9 pl-3 py-1.5 text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <div className="p-4 text-center text-xs text-neutral-500">لا توجد نتائج</div>
                  ) : (
                    filteredProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject(p); setShowDropdown(false); setSearchQuery("") }}
                        className={cn(
                          "w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.08] transition-colors border-b border-white/[0.04] last:border-0",
                          selectedProject.id === p.id && "bg-white/[0.05]",
                        )}
                      >
                        {/* Phase 11.05 — logo in dropdown rows */}
                        {(p.logo_url || p.logo) ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.logo_url || p.logo}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">{sectorIcon(p.sector)}</div>
                        )}
                        <div className="flex-1 text-right">
                          <div className="text-xs text-white font-medium">{p.name}</div>
                          <div className="text-[10px] text-neutral-500">{(p.current_market_price ?? p.share_price).toLocaleString("en-US")} د.ع</div>
                        </div>
                        {selectedProject.id === p.id && <span className="text-white text-sm">✓</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="px-4 lg:px-8 py-6 max-w-screen-2xl mx-auto">

          {/* ═════════════ § 1: HERO — Welcome + Portfolio ═════════════
              Phase 14.07f — dropped the right-hand Sparkline column.
              It was a Math.sin curve labelled "آخر 7 أيام" but no
              portfolio_history table exists in the DB to back it. We
              promote the existing change pills (reference delta /
              daily / weekly — all real from getPortfolioChangeMetrics)
              as the only motion indicator and let the hero use full
              width on desktop. */}
          <div className="shadow-card bg-gradient-to-br from-white/[0.06] to-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:p-6 mb-6 backdrop-blur">
            <div className="min-w-0">
                <div className="text-xs text-neutral-400 mb-1">{getGreeting()} 👋</div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h1 className="text-base font-bold text-white truncate">{userName}</h1>
                  <span className="bg-white/[0.08] border border-white/[0.12] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>{LEVEL_ICONS[userLevel]}</span>
                    <span className="text-neutral-200">{LEVEL_LABELS[userLevel]}</span>
                  </span>
                </div>

                <div className="text-[11px] text-neutral-500 mb-1">إجمالي محفظتك</div>
                <div className="flex items-baseline gap-2 mb-2">
                  {/* Phase 11.14 — show the full numeric value (with
                      thousand separators), not the compact "ألف/مليون"
                      shorthand. Founder spec: 500,000 instead of "500 ألف".
                      Inlined the formatter (was fmtIQD) to dodge a Railway
                      build-cache hiccup that kept reporting the helper
                      undefined even after it was defined at module scope. */}
                  <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight font-mono">
                    {Math.round(portfolio.totalValue || 0).toLocaleString("en-US")}
                  </span>
                  <span className="text-xs text-neutral-500">IQD</span>
                </div>

                {/* Phase 13.48 — three-line wallet indicator:
                      • reference delta in IQD (current market vs founder's
                        reference share_price)
                      • today's % change (resets at 06:00)
                      • this week's % change (rolling 7d)
                    Each pill is colour-coded independently (green/red/grey). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                  <ChangePill
                    valueIqd={changeMetrics.reference_delta_iqd}
                    label="عن السعر المرجعي"
                  />
                  <span className="text-neutral-700 text-[10px] hidden sm:inline">·</span>
                  <ChangePillPct
                    pct={changeMetrics.daily_change_pct}
                    label="اليوم"
                  />
                  <span className="text-neutral-700 text-[10px] hidden sm:inline">·</span>
                  <ChangePillPct
                    pct={changeMetrics.weekly_change_pct}
                    label="الأسبوع"
                  />
                </div>

                <div className="flex gap-2 flex-wrap mb-4">
                  <span className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-neutral-300">
                    <Briefcase className="w-3 h-3 text-blue-400" strokeWidth={2} />
                    {portfolio.holdingsCount} استثمار
                  </span>
                  <span className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-neutral-300">
                    <span className="text-blue-400">●</span>
                    {sectorsCount} قطاعات
                  </span>
                </div>

                <button
                  onClick={() => router.push("/portfolio")}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  التفاصيل
                  <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                </button>
            </div>
          </div>

          {/* ═════════════ § 2: Quick Actions (4 buttons) ═════════════ */}
          <div className="grid grid-cols-4 gap-2 mb-7">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.path)}
                  className="shadow-card group flex flex-col items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-2xl py-2.5 px-2 relative transition-colors"
                >
                  <div
                    style={{ borderRadius: 12 }}
                    className={cn(
                      "w-10 h-10 border flex items-center justify-center group-hover:scale-105 transition-transform",
                      item.iconBg,
                      item.iconBorder,
                    )}
                  >
                    <Icon className={cn("w-5 h-5", item.iconColor)} strokeWidth={1.8} />
                  </div>
                  <span className="text-xs text-foreground font-medium">{item.label}</span>
                  {item.badge > 0 && (
                    <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-full bg-red-400 text-[8px] font-bold text-white flex items-center justify-center">
                      {item.badge}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* ═════════════ § 3: Alerts strip (interactive pills) ═════════════ */}
          {alerts.length > 0 && (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-yellow-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  تنبيهات تحتاج انتباهك
                </span>
                <button
                  onClick={() => router.push("/notifications")}
                  className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition-colors"
                >
                  عرض الكل
                  <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => router.push(a.href)}
                    className={cn(
                      "flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-full border transition-colors text-[11px] font-bold whitespace-nowrap",
                      "bg-yellow-400/[0.08] border-yellow-400/30 text-yellow-400",
                      "hover:bg-yellow-400/[0.15] hover:border-yellow-400/50 active:bg-yellow-400/[0.2]"
                    )}
                  >
                    <span>{a.title}</span>
                    <ChevronLeft className="w-3 h-3 opacity-70" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════ § 4: Active Project ═════════════ */}
          {selectedProject ? (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-7 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,158,0.6)]" />
                <span className="text-[11px] text-green-400 font-semibold">السوق مفتوح</span>
              </div>
              <span className="text-[11px] text-neutral-500">{selectedProject.name}</span>
            </div>

            {(() => {
              // Phase 14.07f — live price from DB only; trend derived
              // from current_market_price vs reference share_price.
              // Both fields ship on every Project row, so no extra
              // fetch needed for the arrow.
              const livePrice =
                selectedProject.current_market_price ||
                selectedProject.share_price
              const trend = derivePriceTrend(livePrice, selectedProject.share_price)
              const trendArrow = trend === "up" ? "↗" : trend === "down" ? "↘" : "→"
              const trendColor =
                trend === "up"
                  ? "text-green-400"
                  : trend === "down"
                    ? "text-red-400"
                    : "text-neutral-500"
              return (
                <div className="mb-4">
                  <div className="text-[11px] text-neutral-500 mb-1">سعر الحصة الحالي</div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight font-mono">
                      {livePrice.toLocaleString("en-US")}
                    </span>
                    <span className="text-xs text-neutral-500">IQD</span>
                    <span className={cn("text-sm font-bold flex items-center gap-0.5", trendColor)}>
                      <span className="text-base leading-none">{trendArrow}</span>
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Phase 11.14 — sold count + trading volume now reflect
                real public-offering activity:
                  soldCount  = offering_shares − available_shares
                  volumeIQD  = soldCount × current_market_price */}
            {(() => {
              // Phase 14.07f — same DB-only price chain as the header.
              const livePrice =
                selectedProject.current_market_price ||
                selectedProject.share_price
              const offering =
                selectedProject.offering_shares ?? selectedProject.available_shares ?? 0
              const available = selectedProject.available_shares ?? 0
              const soldCount = Math.max(0, offering - available)
              const tradingVolume = soldCount * livePrice
              const tiles: Array<{
                label: string
                raw: number
                unit: string
                highlight?: boolean
              }> = [
                { label: "حجم تداول الحصة", raw: tradingVolume, unit: "IQD" },
                { label: "حصص الشركة", raw: selectedProject.total_shares - offering, unit: "SHR" },
                { label: "الحصص المتداولة", raw: soldCount, unit: "SHR", highlight: true },
                { label: "القيمة السوقية", raw: selectedProject.project_value ?? 0, unit: "IQD" },
              ]
              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                  {tiles.map((item, i) => (
                <div
                  key={i}
                  onClick={() => item.highlight && router.push("/exchange")}
                  className={cn(
                    "rounded-xl p-3 border transition-colors",
                    item.highlight
                      ? "bg-white/[0.07] border-white/[0.12] cursor-pointer hover:bg-white/[0.09]"
                      : "bg-white/[0.04] border-white/[0.06]",
                  )}
                >
                  <div className="text-[10px] text-neutral-500 mb-1">{item.label}</div>
                  <div className={cn("font-bold text-white font-mono leading-tight", tileValueSize(item.raw))}>
                    {fmtCompact(item.raw)} <span className="text-[10px] text-neutral-500 font-sans">{item.unit}</span>
                  </div>
                </div>
              ))}
                </div>
              )
            })()}

            {/* Phase 14.07f — real mini-chart fed by getProjectPriceTimeline
                (creation anchor + completed deals + admin price changes
                + "now" snapshot). Three states:
                  loading  → labelled placeholder
                  empty    → "لا توجد بيانات تداول بعد"
                  data     → Recharts AreaChart, green-up / red-down. */}
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 mb-4">
              <div className="text-[10px] text-neutral-500 mb-1.5">
                حركة السعر — بيانات حقيقية
              </div>
              {(() => {
                if (selectedProjectTimelineLoading) {
                  return (
                    <div className="h-[50px] flex items-center justify-center text-[10px] text-neutral-600">
                      جاري التحميل...
                    </div>
                  )
                }
                if (selectedProjectTimeline.length < 2) {
                  return (
                    <div className="h-[50px] flex items-center justify-center text-[10px] text-neutral-600">
                      لا توجد بيانات تداول بعد
                    </div>
                  )
                }
                const refPrice = selectedProject.share_price ?? 0
                const lastPrice =
                  Number(
                    selectedProjectTimeline[selectedProjectTimeline.length - 1]
                      ?.new_price ?? refPrice,
                  ) || refPrice
                const miniIsUp = lastPrice >= refPrice
                const miniData = selectedProjectTimeline.map((p) => ({
                  ts: new Date(p.recorded_at).getTime(),
                  price: Math.round(Number(p.new_price) || 0),
                }))
                return (
                  <DashboardSparkline data={miniData} isUp={miniIsUp} />
                )
              })()}
            </div>

            <button
              onClick={() => router.push(`/project/${selectedProject.id}`)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              تفاصيل المشروع
              <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 mb-7 text-center">
              <div className="text-4xl mb-3 opacity-50">🏗️</div>
              <div className="text-sm text-white font-bold mb-1">لا توجد مشاريع بعد</div>
              <div className="text-[11px] text-neutral-500">
                ستظهر تفاصيل سعر الحصص والتداول هنا فور إطلاق أول مشروع.
              </div>
            </div>
          )}

          {/* ═════════════ § 5: Volume Chart (moved from bottom) ═════════════ */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-7 backdrop-blur">
            <SectionHeader
              title="📈 حجم تداول المنصة"
              subtitle="آخر 12 شهر"
              action={{ label: "تفاصيل أكثر", href: "/market" }}
            />

            {/* Mini stats — Phase 11.15: real platform-wide totals.
                  • totalSoldShares  = Σ (offering_shares − available_shares)
                                       across every active project.
                  • totalVolumeIQD   = Σ (sold × current_market_price).
                مثال: مشروع A باع 20 (×25,000=500,000)، مشروع B باع 60
                (×8,000≈480,000) → الحصص المتداولة = 80، القيمة = 980,000. */}
            {(() => {
              let totalSold = 0
              let totalVolume = 0
              for (const p of dbProjects) {
                const offering = p.offering_shares ?? p.available_shares ?? 0
                const sold = Math.max(0, offering - (p.available_shares ?? 0))
                // Phase 14.07f — DB price only (current_market_price
                // already drives all admin/engine adjustments).
                const price = p.current_market_price || p.share_price || 0
                totalSold   += sold
                totalVolume += sold * price
              }
              return (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                    <div className="text-[10px] text-neutral-500 mb-1">القيمة الإجمالية</div>
                    <div className={cn("font-bold text-white font-mono leading-tight", tileValueSize(totalVolume))}>
                      {fmtCompact(totalVolume)} <span className="text-[10px] text-neutral-500 font-sans">IQD</span>
                    </div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                    <div className="text-[10px] text-neutral-500 mb-1">مشاريع نشطة</div>
                    <div className={cn("font-bold text-white font-mono leading-tight", tileValueSize(dbProjects.length))}>{dbProjects.length}</div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                    <div className="text-[10px] text-neutral-500 mb-1">حصص متداولة</div>
                    <div className={cn("font-bold text-white font-mono leading-tight", tileValueSize(totalSold))}>
                      {totalSold.toLocaleString("en-US")}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Phase 14.11 A6 — recharts volume chart, code-split via
                next/dynamic. Replaces the former inline AreaChart. */}
            <DashboardVolumeChart data={VOLUME_HISTORY} />
          </div>

          {/* ═════════════ § 6: Ads banner — only when real ads exist ═════════════ */}
          {dbAds.length > 0 && (
            <div className="bg-gradient-to-br from-purple-400/[0.06] via-blue-400/[0.04] to-transparent border border-purple-400/20 rounded-2xl p-5 mb-7 backdrop-blur">
              <AdsSlider
                ads={dbAds}
                autoPlayInterval={5000}
                onAdClick={(ad) => {
                  if (ad.link_type === "internal" && ad.link_url) router.push(ad.link_url)
                  else if (ad.link_type === "external" && ad.link_url) window.open(ad.link_url, "_blank")
                }}
              />
            </div>
          )}

          {/* ═════════════ § 7: Discover (col-span-2) + News (col-span-1) ═════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">

            {/* Discover — col-span-2 on lg */}
            <div className="lg:col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <SectionHeader
                title="🌟 اكتشف"
                subtitle="فرص استثمارية مختارة"
                action={{ label: "كل المشاريع", href: "/market" }}
              />

              {/* Tabs — Phase 11.06: name-only, no icons / no counts.
                  Matches the standardized tab styling used elsewhere in
                  the app (founder spec: تبويبات موحدة في كل التطبيق). */}
              <div className="mb-3">
                <Tabs
                  tabs={[
                    { id: "trending", label: "رائج" },
                    { id: "closing",  label: "قريباً" },
                    { id: "new",      label: "جديد" },
                  ]}
                  activeTab={discoverTab}
                  onChange={(id) => setDiscoverTab(id as typeof discoverTab)}
                />
              </div>

              {/* Cards — Phase 13.13:
                   • Cold cache + first fetch in flight → skeleton
                   • Otherwise empty fetch → empty state
                   • Otherwise → cards (cached or fresh) */}
              {discoverFirstLoad ? (
                <ProjectCardSkeleton count={3} className="grid grid-cols-1 lg:grid-cols-3 gap-3 space-y-0" />
              ) : discoverItems.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
                  <div className="text-3xl mb-2 opacity-50">🔍</div>
                  <div className="text-sm text-neutral-400">{discoverEmptyMsg}</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {discoverItems.map((p) => (
                    <ProjectCard key={discoverTab + "-" + p.id} project={p} variant="compact" />
                  ))}
                </div>
              )}
            </div>

            {/* News — col-span-1 on lg */}
            <div className="lg:col-span-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <SectionHeader
                title="📰 آخر الأخبار"
                subtitle="آخر مستجدات المنصة"
                action={{ label: "الكل", href: "/notifications" }}
              />

              <div className="space-y-1">
                {news.map((n, i) => (
                  // Phase 13.63 — clickable, navigates to /news/[id]
                  // detail page (image, full content, reactions, comments).
                  <button
                    key={n.id}
                    onClick={() => router.push(`/news/${n.id}`)}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2.5 bg-white/[0.04] hover:bg-white/[0.06] rounded-lg transition-colors text-right",
                      i < news.length - 1 && "mb-1",
                    )}
                  >
                    <span className="text-base flex-shrink-0">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{n.title}</span>
                        {n.is_new && (
                          <span className="bg-green-400/[0.12] border border-green-400/30 text-green-400 text-[8px] font-bold px-1 py-0.5 rounded font-mono flex-shrink-0">
                            جديد
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-neutral-600 mt-0.5">{n.date}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
