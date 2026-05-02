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
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { AppLayout } from "@/components/layout/AppLayout"
import { AdsSlider } from "@/components/common/AdsSlider"
import { ProjectCard } from "@/components/cards"
import { SectionHeader, Tabs, SkeletonCard } from "@/components/ui"
import {
  mockProjects,
  mockAds,
  mockStats,
  CURRENT_USER,
  HOLDINGS,
  getPortfolioSummary,
  getActiveAlerts,
  getTrendingProjects as getTrendingProjectsMock,
  getClosingSoonProjects,
  getNewProjects as getNewProjectsMock,
  getRecentNews,
  getProjectCurrentPrice,
  getProjectPriceTrend,
  type ProjectCardData,
} from "@/lib/mock-data"
import {
  getNewProjects as dbGetNewProjects,
  getTrendingProjects as dbGetTrendingProjects,
  getLatestNews as dbGetLatestNews,
} from "@/lib/data"
import { LEVEL_LABELS, LEVEL_ICONS } from "@/lib/utils/contractLimits"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ────────────────────────────────────────────────────
function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "K"
  return n.toString()
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return "صباح الخير"
  return "مساء الخير"
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

// ─── Sparkline (reusable mini chart) ──────────────────────────
function Sparkline({ basePrice, height = 50 }: { basePrice: number; height?: number }) {
  const points = useMemo(() => {
    const data: number[] = []
    let p = basePrice * 0.95
    for (let i = 0; i < 7; i++) {
      p = Math.max(p + (Math.sin(i * 0.7 + basePrice * 0.0001) * 0.025) * p, basePrice * 0.85)
      data.push(p)
    }
    data.push(basePrice)
    return data
  }, [basePrice])

  const W = 200
  const H = height
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 8) - 4
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const trendUp = points[points.length - 1] >= points[0]
  const color = trendUp ? "#4ADE80" : "#F87171"
  const gradId = `spark-${trendUp ? "up" : "down"}`

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${W},${H} L0,${H} Z`} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── 12-month volume mock data ──────────────────────────────────
const VOLUME_HISTORY = [
  { month: "يناير", volume: 1.8 },
  { month: "فبراير", volume: 2.0 },
  { month: "مارس", volume: 1.7 },
  { month: "أبريل", volume: 2.3 },
  { month: "مايو", volume: 2.1 },
  { month: "يونيو", volume: 2.6 },
  { month: "يوليو", volume: 2.4 },
  { month: "أغسطس", volume: 2.8 },
  { month: "سبتمبر", volume: 2.5 },
  { month: "أكتوبر", volume: 3.0 },
  { month: "نوفمبر", volume: 2.7 },
  { month: "ديسمبر", volume: 2.4 },
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
    badge: 2,
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
// Main page
// ════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter()
  const [selectedProject, setSelectedProject] = useState(mockProjects[0])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [discoverTab, setDiscoverTab] = useState<"trending" | "closing" | "new">("trending")

  // ─── Centralized data ─────────────────────────────────────────
  const portfolio = useMemo(() => getPortfolioSummary("me"), [])
  const alerts = useMemo(() => getActiveAlerts("me"), [])
  const closing = useMemo(() => getClosingSoonProjects(15).slice(0, 3), [])

  // Live data (DB-backed with mock fallback)
  const [trending, setTrending] = useState<ProjectCardData[]>(getTrendingProjectsMock().slice(0, 3))
  const [newProjects, setNewProjects] = useState<ProjectCardData[]>(getNewProjectsMock().slice(0, 3))
  const [news, setNews] = useState(getRecentNews(4))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([dbGetTrendingProjects(3), dbGetNewProjects(3), dbGetLatestNews(4)])
      .then(([t, n, ns]) => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (t.length > 0) setTrending(t as any as ProjectCardData[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (n.length > 0) setNewProjects(n as any as ProjectCardData[])
        if (ns.length > 0) {
          setNews(ns.map((row) => ({
            id: row.id,
            icon: row.news_type === "feature" ? "🎉" : row.news_type === "promo" ? "🎁" : row.news_type === "alert" ? "⚠️" : "📢",
            title: row.title,
            date: row.published_at?.split("T")[0] ?? "—",
            is_new: row.published_at ? (Date.now() - new Date(row.published_at).getTime()) < 7 * 86_400_000 : false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          })) as any)
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const sectorsCount = useMemo(
    () => new Set(HOLDINGS.filter((h) => (h.user_id ?? "me") === "me").map((h) => h.project.sector)).size,
    [],
  )

  const filteredProjects = mockProjects.filter(
    (p) => !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const dailyUp = portfolio.dailyChange >= 0
  const discoverItems = discoverTab === "trending" ? trending : discoverTab === "closing" ? closing : newProjects
  const discoverEmptyMsg =
    discoverTab === "trending" ? "لا توجد مشاريع رائجة حالياً" :
    discoverTab === "closing" ? "لا توجد فرص تنتهي قريباً" :
    "لا توجد مشاريع جديدة"

  return (
    <AppLayout>
      <div className="relative">
{/* Sticky Project Selector (kept — global context) */}
        <div className="sticky top-[60px] lg:top-[68px] z-30 bg-black/85 backdrop-blur-xl border-b border-white/[0.1] px-4 lg:px-8 py-3">
          <div className="relative max-w-2xl">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                "w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl flex items-center justify-between hover:bg-white/[0.07] transition-colors",
                showDropdown && "rounded-b-none",
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">
                  {sectorIcon(selectedProject.sector)}
                </div>
                <div className="text-right">
                  <div className="text-sm text-white font-medium">{selectedProject.name}</div>
                  <div className="text-[10px] text-neutral-500">{selectedProject.sector}</div>
                </div>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", showDropdown && "rotate-180")} />
            </button>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 bg-[rgba(15,15,15,0.98)] backdrop-blur-2xl border border-white/[0.08] border-t-0 rounded-b-xl shadow-2xl overflow-hidden">
                <div className="p-2.5 border-b border-white/[0.05]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ابحث عن مشروع..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pr-9 pl-3 py-1.5 text-xs text-white outline-none"
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
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">{sectorIcon(p.sector)}</div>
                        <div className="flex-1 text-right">
                          <div className="text-xs text-white font-medium">{p.name}</div>
                          <div className="text-[10px] text-neutral-500">{p.share_price.toLocaleString("en-US")} د.ع</div>
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

        <div className="px-4 lg:px-8 py-6 max-w-screen-2xl mx-auto">

          {/* ═════════════ § 1: HERO — Welcome + Portfolio ═════════════ */}
          <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:p-6 mb-6 backdrop-blur">
            <div className="grid lg:grid-cols-3 gap-5 items-center">

              {/* Right column — text content (2/3 on lg) */}
              <div className="lg:col-span-2 min-w-0">
                <div className="text-xs text-neutral-400 mb-1">{getGreeting()} 👋</div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h1 className="text-base font-bold text-white truncate">{CURRENT_USER.name}</h1>
                  <span className="bg-white/[0.08] border border-white/[0.12] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>{LEVEL_ICONS[CURRENT_USER.level]}</span>
                    <span className="text-neutral-200">{LEVEL_LABELS[CURRENT_USER.level]}</span>
                  </span>
                </div>

                <div className="text-[11px] text-neutral-500 mb-1">إجمالي محفظتك</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight font-mono">
                    {fmtCompact(portfolio.totalValue)}
                  </span>
                  <span className="text-xs text-neutral-500">IQD</span>
                </div>

                <div className={cn("text-xs font-bold flex items-center gap-1 mb-3", dailyUp ? "text-green-400" : "text-red-400")}>
                  {dailyUp ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={2.5} />}
                  <span>{dailyUp ? "+" : ""}{fmtCompact(portfolio.dailyChange)} د.ع</span>
                  <span className="text-neutral-600 font-normal">·</span>
                  <span>{dailyUp ? "+" : ""}{portfolio.dailyChangePercent}% اليوم</span>
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

              {/* Left column — Sparkline (1/3 on lg) */}
              <div className="hidden lg:block">
                <Sparkline basePrice={portfolio.totalValue / Math.max(1, portfolio.holdingsCount)} height={120} />
                <div className="text-[10px] text-neutral-500 text-center mt-1">آخر 7 أيام</div>
              </div>
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
                  className="group flex flex-col items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl py-3 px-2 relative transition-colors"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg border flex items-center justify-center group-hover:scale-105 transition-transform",
                      item.iconBg,
                      item.iconBorder,
                    )}
                  >
                    <Icon className={cn("w-4 h-4", item.iconColor)} strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] text-neutral-300 font-medium">{item.label}</span>
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
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-7 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,158,0.6)]" />
                <span className="text-[11px] text-green-400 font-semibold">السوق مفتوح</span>
              </div>
              <span className="text-[11px] text-neutral-500">{selectedProject.name}</span>
            </div>

            {(() => {
              const livePrice = getProjectCurrentPrice(selectedProject.id) || selectedProject.share_price
              const trend = getProjectPriceTrend(selectedProject.id)
              const trendArrow = trend === "up" ? "↗" : trend === "down" ? "↘" : "→"
              const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-neutral-500"
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
              {[
                { label: "حجم تداول الحصة", value: fmtCompact((getProjectCurrentPrice(selectedProject.id) || selectedProject.share_price) * (selectedProject.total_shares - selectedProject.available_shares)), unit: "IQD" },
                { label: "حصص الشركة", value: selectedProject.available_shares.toLocaleString("en-US"), unit: "SHR" },
                { label: "الحصص المتداولة", value: "320", unit: "SHR", highlight: true },
                { label: "القيمة السوقية", value: fmtCompact(selectedProject.project_value ?? 0), unit: "IQD" },
              ].map((item, i) => (
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
                  <div className="text-base font-bold text-white font-mono">
                    {item.value} <span className="text-[10px] text-neutral-500 font-sans">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 mb-4">
              <div className="text-[10px] text-neutral-500 mb-1">آخر 7 أيام</div>
              <Sparkline basePrice={getProjectCurrentPrice(selectedProject.id) || selectedProject.share_price} height={50} />
            </div>

            <button
              onClick={() => router.push(`/project/${selectedProject.id}`)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              تفاصيل المشروع
              <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>

          {/* ═════════════ § 5: Volume Chart (moved from bottom) ═════════════ */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-7 backdrop-blur">
            <SectionHeader
              title="📈 حجم تداول المنصة"
              subtitle="آخر 12 شهر"
              action={{ label: "تفاصيل أكثر", href: "/market" }}
            />

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] text-neutral-500 mb-1">القيمة الإجمالية</div>
                <div className="text-base font-bold text-white font-mono">
                  {fmtCompact(mockStats.volume)} <span className="text-[10px] text-neutral-500 font-sans">IQD</span>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] text-neutral-500 mb-1">مشاريع نشطة</div>
                <div className="text-base font-bold text-white font-mono">{mockStats.projects}</div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] text-neutral-500 mb-1">حصص متداولة</div>
                <div className="text-base font-bold text-white font-mono">{mockStats.shares.toLocaleString("en-US")}</div>
              </div>
            </div>

            {/* Recharts AreaChart */}
            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={VOLUME_HISTORY} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="volume-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#737373", fontSize: 9 }}
                    interval={1}
                    height={20}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "rgba(15,15,15,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    labelStyle={{ color: "#a3a3a3", fontSize: "10px" }}
                    formatter={(value) => [`${value}B IQD`, "الحجم"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#4ADE80"
                    strokeWidth={2}
                    fill="url(#volume-gradient)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ═════════════ § 6: Ads banner — standalone container ═════════════ */}
          <div className="bg-gradient-to-br from-purple-400/[0.06] via-blue-400/[0.04] to-transparent border border-purple-400/20 rounded-2xl p-5 mb-7 backdrop-blur">
            <AdsSlider
              ads={mockAds}
              autoPlayInterval={5000}
              onAdClick={(ad) => {
                if (ad.link_type === "internal" && ad.link_url) router.push(ad.link_url)
                else if (ad.link_type === "external" && ad.link_url) window.open(ad.link_url, "_blank")
              }}
            />
          </div>

          {/* ═════════════ § 7: Discover (col-span-2) + News (col-span-1) ═════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">

            {/* Discover — col-span-2 on lg */}
            <div className="lg:col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <SectionHeader
                title="🌟 اكتشف"
                subtitle="فرص استثمارية مختارة"
                action={{ label: "كل المشاريع", href: "/market" }}
              />

              {/* Tabs (uses Tabs primitive) */}
              <div className="mb-3">
                <Tabs
                  tabs={[
                    { id: "trending", icon: "🔥", label: "رائج", count: trending.length },
                    { id: "closing", icon: "⏰", label: "قريباً", count: closing.length },
                    { id: "new", icon: "🆕", label: "جديد", count: newProjects.length },
                  ]}
                  activeTab={discoverTab}
                  onChange={(id) => setDiscoverTab(id as typeof discoverTab)}
                />
              </div>

              {/* Cards */}
              {discoverItems.length === 0 ? (
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
                  <button
                    key={n.id}
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
