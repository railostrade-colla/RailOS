"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ChevronLeft,
  ChevronDown,
  AlertTriangle,
  Calculator,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionHeader, Tabs, EmptyState } from "@/components/ui"
import {
  getInvestmentAnalytics,
  getProjectCurrentPrice,
  getPriceHistoryForChart,
  HOLDINGS,
  getDistributionsByUser,
  getTotalDistributions,
  type PerformanceRow,
} from "@/lib/mock-data"
import { fmtLimit } from "@/lib/utils/contractLimits"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ──────────────────────────────────────────────────────
const fmtIQD = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) => {
  if (s.includes("طب")) return "🏥"
  if (s.includes("تقن")) return "💻"
  if (s.includes("زراع")) return "🌾"
  if (s.includes("تجار")) return "🏪"
  if (s.includes("صناع")) return "🏭"
  if (s.includes("عقار")) return "🏢"
  return "🏢"
}

// Sector → color mapping (matches design tokens)
const SECTOR_COLORS: Record<string, string> = {
  "زراعة": "#4ADE80",
  "عقارات": "#60A5FA",
  "صناعة": "#FB923C",
  "تجارة": "#FBBF24",
  "تقنية": "#C084FC",
  "طب": "#F87171",
  "أخرى": "#737373",
}

const RANGES = [
  { id: "1m" as const, label: "1ش", months: 1 },
  { id: "3m" as const, label: "3ش", months: 3 },
  { id: "6m" as const, label: "6ش", months: 6 },
  { id: "12m" as const, label: "سنة", months: 12 },
]

const SORT_OPTIONS = [
  { id: "newest" as const, label: "الأحدث" },
  { id: "profit" as const, label: "أعلى ربح" },
  { id: "value" as const, label: "أعلى قيمة" },
  { id: "sector" as const, label: "حسب القطاع" },
]

const CALC_PERIODS = [
  { id: "6m" as const, label: "6 أشهر", months: 6 },
  { id: "1y" as const, label: "سنة", months: 12 },
  { id: "3y" as const, label: "3 سنوات", months: 36 },
]

type RangeId = (typeof RANGES)[number]["id"]
type SortId = (typeof SORT_OPTIONS)[number]["id"]
type PeriodId = (typeof CALC_PERIODS)[number]["id"]

// ════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════
export default function InvestmentPage() {
  const router = useRouter()

  const analytics = useMemo(() => {
    const base = getInvestmentAnalytics("me")
    // Override per-row current_value with live market price
    const performance = base.performance.map((r) => {
      const livePrice = getProjectCurrentPrice(r.project_id)
      if (!livePrice) return r
      const newValue = r.shares_owned * livePrice
      const profit = newValue - r.cost
      const profitPercent = r.cost > 0 ? (profit / r.cost) * 100 : 0
      return { ...r, current_value: newValue, profit, profitPercent }
    })
    const totalValue = performance.reduce((s, r) => s + (r.current_value ?? 0), 0)
    const totalProfit = totalValue - base.totalCost
    const totalProfitPercent = base.totalCost > 0 ? (totalProfit / base.totalCost) * 100 : 0

    // Aggregate price_history across user holdings into 12 monthly buckets
    const userHoldings = HOLDINGS.filter((h) => (h.user_id ?? "me") === "me")
    const months: Record<string, number> = {}
    userHoldings.forEach((h) => {
      const points = getPriceHistoryForChart(h.project_id, 90)
      points.forEach((pt) => {
        const monthKey = pt.date.slice(0, 7)
        months[monthKey] = (months[monthKey] ?? 0) + pt.price * h.shares_owned
      })
    })
    const aggregated = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ month: key.slice(5), value: Math.round(val) }))
    const historicalData = aggregated.length >= 2 ? aggregated : base.historicalData

    const bestPerformers = [...performance].sort((a, b) => b.profitPercent - a.profitPercent).slice(0, 3)
    const worstPerformers = [...performance].sort((a, b) => a.profitPercent - b.profitPercent).slice(0, 3)

    return {
      ...base,
      performance,
      bestPerformers,
      worstPerformers,
      totalValue,
      totalProfit,
      totalProfitPercent: parseFloat(totalProfitPercent.toFixed(2)),
      historicalData,
    }
  }, [])
  const distributions = useMemo(() => getDistributionsByUser("me"), [])
  const totalDistributions = useMemo(() => getTotalDistributions("me"), [])

  const [range, setRange] = useState<RangeId>("12m")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortId>("newest")
  const [showSort, setShowSort] = useState(false)
  const [calcPeriod, setCalcPeriod] = useState<PeriodId>("1y")

  // ─── Derived ────────────────────────────────────────────────────
  const profitUp = analytics.totalProfit >= 0
  const dailyChangePercent = useMemo(() => Math.sin(Date.now() / 86_400_000) * 2 + 0.5, [])
  const dailyUp = dailyChangePercent >= 0

  // Sliced historical data based on range
  const chartData = useMemo(() => {
    const months = RANGES.find((r) => r.id === range)?.months ?? 12
    return analytics.historicalData.slice(-months)
  }, [analytics.historicalData, range])

  const chartHigh = chartData.length ? Math.max(...chartData.map((d) => d.value)) : 0
  const chartLow = chartData.length ? Math.min(...chartData.map((d) => d.value)) : 0
  const chartGrowth = chartData.length > 1
    ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100
    : 0

  // Filtered + sorted performance table
  const filteredPerformance = useMemo(() => {
    let rows = analytics.performance.slice()
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((r) => r.project.name.toLowerCase().includes(q) || r.project.sector.toLowerCase().includes(q))
    }
    switch (sortBy) {
      case "profit":
        rows.sort((a, b) => b.profitPercent - a.profitPercent)
        break
      case "value":
        rows.sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
        break
      case "sector":
        rows.sort((a, b) => a.project.sector.localeCompare(b.project.sector))
        break
      default:
        // newest — keep original order
        break
    }
    return rows
  }, [analytics.performance, search, sortBy])

  // Best/worst by absolute profit (single number)
  const highestProfit = useMemo(
    () => analytics.performance.reduce((max, r) => (r.profit > max ? r.profit : max), 0),
    [analytics.performance],
  )
  const lowestProfit = useMemo(
    () => analytics.performance.reduce((min, r) => (r.profit < min ? r.profit : min), highestProfit),
    [analytics.performance, highestProfit],
  )

  // Calculator
  const calcMonths = CALC_PERIODS.find((p) => p.id === calcPeriod)?.months ?? 12
  const expectedReturn = Math.round(analytics.totalValue * (analytics.avgReturnPerYear / 100) * (calcMonths / 12))
  const expectedFutureValue = analytics.totalValue + expectedReturn
  const totalGrowth = analytics.totalValue > 0 ? (expectedReturn / analytics.totalValue) * 100 : 0

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-6xl mx-auto pb-20">

          <PageHeader
            title="لوحة استثماراتي"
            subtitle="تحليل شامل لأداء محفظتك الاستثمارية"
            showBack={false}
          />

          {/* ═══════════ § 1: HERO — Portfolio summary ═══════════ */}
          <div className="bg-gradient-to-br from-purple-400/[0.06] via-blue-400/[0.04] to-transparent border border-white/[0.08] rounded-2xl p-6 mb-6 backdrop-blur">
            <div className="flex justify-between items-start mb-3 gap-2">
              <div className="text-[11px] text-neutral-500">إجمالي قيمة محفظتك</div>
              <span
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold",
                  dailyUp
                    ? "bg-green-400/[0.08] border-green-400/25 text-green-400"
                    : "bg-red-400/[0.08] border-red-400/25 text-red-400",
                )}
              >
                {dailyUp ? <TrendingUp className="w-3 h-3" strokeWidth={2.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={2.5} />}
                {dailyUp ? "+" : ""}{dailyChangePercent.toFixed(1)}% اليوم
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-4xl lg:text-5xl font-bold text-white tracking-tight font-mono">
                {fmtIQD(analytics.totalValue)}
              </span>
              <span className="text-sm text-neutral-500">IQD</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Card 1 — Profit/Loss */}
              <div
                className={cn(
                  "rounded-xl p-3 border",
                  profitUp
                    ? "bg-green-400/[0.06] border-green-400/20"
                    : "bg-red-400/[0.06] border-red-400/20",
                )}
              >
                <div className="text-[10px] text-neutral-500 mb-1">إجمالي الربح/الخسارة</div>
                <div className={cn("text-base font-bold font-mono", profitUp ? "text-green-400" : "text-red-400")}>
                  {profitUp ? "+" : ""}{fmtIQD(analytics.totalProfit)}
                </div>
                <div className={cn("text-[10px] font-bold mt-0.5", profitUp ? "text-green-400/80" : "text-red-400/80")}>
                  {profitUp ? "+" : ""}{analytics.totalProfitPercent}%
                </div>
              </div>

              {/* Card 2 — Investments count */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
                <div className="text-[10px] text-neutral-500 mb-1">عدد الاستثمارات</div>
                <div className="text-base font-bold text-white font-mono">{analytics.holdingsCount}</div>
                <span className="text-[9px] text-green-400 bg-green-400/[0.1] border border-green-400/25 rounded px-1.5 py-0.5 mt-0.5 inline-block">
                  ● نشط
                </span>
              </div>

              {/* Card 3 — Sectors */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
                <div className="text-[10px] text-neutral-500 mb-1">القطاعات</div>
                <div className="text-base font-bold text-white font-mono">{analytics.sectorsCount}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">متنوّعة</div>
              </div>

              {/* Card 4 — Annual return */}
              <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-xl p-3">
                <div className="text-[10px] text-blue-400/80 mb-1">العائد السنوي المتوقع</div>
                <div className="text-base font-bold text-blue-400 font-mono">{analytics.avgReturnPerYear}%</div>
                <div className="text-[10px] text-blue-400/70 mt-0.5">تقديري</div>
              </div>
            </div>
          </div>

          {/* ═══════════ § 2: Historical Performance ═══════════ */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-6 backdrop-blur">
            <div className="flex justify-between items-end mb-4 gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-white">📈 أداء محفظتي</h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  آخر {RANGES.find((r) => r.id === range)?.label}
                </p>
              </div>
              <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRange(r.id)}
                    className={cn(
                      "px-3 py-1 rounded text-[11px] transition-colors",
                      range === r.id
                        ? "bg-white text-black font-bold"
                        : "text-neutral-400 hover:text-white",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                <div className="text-[10px] text-neutral-500 mb-0.5">أعلى قيمة</div>
                <div className="text-xs font-bold text-white font-mono">{fmtIQD(chartHigh)}</div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                <div className="text-[10px] text-neutral-500 mb-0.5">أدنى قيمة</div>
                <div className="text-xs font-bold text-white font-mono">{fmtIQD(chartLow)}</div>
              </div>
              <div className={cn(
                "rounded-lg p-2.5 border",
                chartGrowth >= 0 ? "bg-green-400/[0.06] border-green-400/20" : "bg-red-400/[0.06] border-red-400/20",
              )}>
                <div className="text-[10px] text-neutral-500 mb-0.5">نمو الفترة</div>
                <div className={cn("text-xs font-bold font-mono", chartGrowth >= 0 ? "text-green-400" : "text-red-400")}>
                  {chartGrowth >= 0 ? "+" : ""}{chartGrowth.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Area Chart */}
            <div className="h-64 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 5, left: 8 }}>
                  <defs>
                    <linearGradient id="perf-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={profitUp ? "#4ADE80" : "#F87171"} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={profitUp ? "#4ADE80" : "#F87171"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#737373", fontSize: 10 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: "rgba(15,15,15,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    labelStyle={{ color: "#a3a3a3", fontSize: "10px" }}
                    formatter={(value) => [`${fmtIQD(Number(value))} د.ع`, "القيمة"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={profitUp ? "#4ADE80" : "#F87171"}
                    strokeWidth={2.5}
                    fill="url(#perf-gradient)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ═══════════ § 3: Sector Distribution + KPIs (2 cols) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Sector Distribution */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <SectionHeader title="🥧 توزيع القطاعات" subtitle="كيف توزّعت استثماراتك" />

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.sectorDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analytics.sectorDistribution.map((s) => (
                        <Cell
                          key={s.name}
                          fill={SECTOR_COLORS[s.name] ?? SECTOR_COLORS["أخرى"]}
                          stroke="rgba(15,15,15,0.6)"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,15,15,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                      formatter={(value) => [`${fmtIQD(Number(value))} د.ع`, "القيمة"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 mt-3">
                {analytics.sectorDistribution.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SECTOR_COLORS[s.name] ?? SECTOR_COLORS["أخرى"] }}
                      />
                      <span className="text-neutral-300">{s.name}</span>
                    </div>
                    <span className="text-white font-bold font-mono">{s.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <SectionHeader title="📊 مؤشرات الأداء" subtitle="نظرة شاملة على استثماراتك" />

              <div className="space-y-2">
                {[
                  { icon: "💰", label: "متوسط العائد السنوي", value: `${analytics.avgReturnPerYear}%`, color: "text-blue-400" },
                  { icon: "🏆", label: "أعلى ربح فردي", value: `+${fmtIQD(highestProfit)} د.ع`, color: "text-green-400" },
                  { icon: "📉", label: "أقل ربح فردي", value: `${lowestProfit >= 0 ? "+" : ""}${fmtIQD(lowestProfit)} د.ع`, color: lowestProfit >= 0 ? "text-yellow-400" : "text-red-400" },
                  { icon: "⏱️", label: "متوسط مدة الاحتفاظ", value: `${analytics.avgHoldingMonths} أشهر`, color: "text-white" },
                  { icon: "📈", label: "معدل النمو الشهري", value: "+1.8%", color: "text-green-400" },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{kpi.icon}</span>
                      <span className="text-[11px] text-neutral-300">{kpi.label}</span>
                    </div>
                    <span className={cn("text-xs font-bold font-mono", kpi.color)}>{kpi.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════ § 4: All Investments Table ═══════════ */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-6 backdrop-blur">
            <div className="flex justify-between items-end mb-4 gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-white">📊 كل استثماراتي</h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">{filteredPerformance.length} استثمار</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث..."
                    className="bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white outline-none w-32 lg:w-40"
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowSort(!showSort)}
                    className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showSort && "rotate-180")} />
                  </button>
                  {showSort && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-[rgba(15,15,15,0.98)] border border-white/[0.08] rounded-lg shadow-2xl z-20 overflow-hidden">
                      {SORT_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSortBy(s.id); setShowSort(false) }}
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
              </div>
            </div>

            {filteredPerformance.length === 0 ? (
              <EmptyState
                icon="📦"
                title={search ? "لا توجد نتائج" : "لا توجد استثمارات بعد"}
                description={search ? "جرّب كلمة بحث أخرى" : "ابدأ رحلتك الاستثمارية الآن"}
                action={!search ? { label: "اكتشف الفرص", href: "/market" } : undefined}
                size="md"
              />
            ) : (
              <div className="space-y-2">
                {filteredPerformance.map((row) => (
                  <PerformanceRowItem key={row.id} row={row} onClick={() => router.push(`/project/${row.project_id}`)} />
                ))}
              </div>
            )}
          </div>

          {/* ═══════════ § 5: Best / Worst performers (2 cols) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Best */}
            <div className="bg-green-400/[0.04] border border-green-400/20 rounded-2xl p-5 backdrop-blur">
              <SectionHeader title="🏆 أفضل أداء" subtitle="أكثر استثماراتك ربحاً" />
              <div className="space-y-2">
                {analytics.bestPerformers.map((r) => (
                  <PerformerCard
                    key={"best-" + r.id}
                    row={r}
                    variant="best"
                    onClick={() => router.push(`/project/${r.project_id}`)}
                  />
                ))}
              </div>
            </div>

            {/* Worst */}
            <div className="bg-orange-400/[0.04] border border-orange-400/20 rounded-2xl p-5 backdrop-blur">
              <SectionHeader title="📉 يحتاج اهتمامك" subtitle="استثمارات أقل ربحاً" />
              <div className="space-y-2">
                {analytics.worstPerformers.map((r) => (
                  <PerformerCard
                    key={"worst-" + r.id}
                    row={r}
                    variant="worst"
                    onClick={() => router.push(`/project/${r.project_id}`)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════ § 6: Distributions Timeline + Calculator (2 cols) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Distributions Timeline */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 backdrop-blur">
              <div className="flex justify-between items-end mb-4 gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">💰 تاريخ التوزيعات</h2>
                  <p className="text-[11px] text-neutral-500 mt-0.5">أرباحك المستلمة</p>
                </div>
                <span className="bg-green-400/[0.08] border border-green-400/25 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-full font-mono">
                  إجمالي: +{fmtLimit(totalDistributions)} د.ع
                </span>
              </div>

              <div className="relative">
                <div className="absolute right-2 top-2 bottom-2 w-0.5 bg-white/[0.08] z-0" />
                <div className="space-y-2 relative z-10">
                  {distributions.map((d) => (
                    <div key={d.id} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 flex items-start gap-3 mr-1">
                      <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-black flex-shrink-0 mt-1 shadow-[0_0_6px_rgba(74,222,158,0.6)]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-xs font-bold text-white truncate">{d.project_name}</span>
                          <span className="text-sm font-bold text-green-400 font-mono flex-shrink-0">
                            +{fmtIQD(d.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] text-neutral-500 font-mono" dir="ltr">{d.date}</span>
                          <span className="text-[9px] text-neutral-700">·</span>
                          <span className="text-[9px] bg-white/[0.06] border border-white/[0.08] text-neutral-300 px-1.5 py-0.5 rounded">
                            {d.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Profit Calculator */}
            <div className="bg-gradient-to-br from-purple-400/[0.06] to-transparent border border-purple-400/20 rounded-2xl p-5 backdrop-blur">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-purple-400" strokeWidth={2} />
                <h2 className="text-base font-bold text-white">توقّع أرباحك المستقبلية</h2>
              </div>
              <p className="text-[11px] text-neutral-500 mb-4">إذا استمر الأداء بنفس النسبة</p>

              {/* Period selector */}
              <div className="mb-4">
                <div className="text-[11px] text-neutral-400 mb-2 font-bold">مدة الاستثمار</div>
                <div className="grid grid-cols-3 gap-2">
                  {CALC_PERIODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setCalcPeriod(p.id)}
                      className={cn(
                        "py-2 rounded-lg text-xs transition-colors border",
                        calcPeriod === p.id
                          ? "bg-white text-black border-transparent font-bold"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div className="space-y-2 mb-4">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-300">📈 العائد المتوقع</span>
                  <span className="text-sm font-bold text-green-400 font-mono">
                    +{fmtIQD(expectedReturn)} د.ع
                  </span>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-300">💎 القيمة المتوقعة</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {fmtIQD(expectedFutureValue)} د.ع
                  </span>
                </div>
                <div className="bg-purple-400/[0.06] border border-purple-400/20 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-300">📊 النمو الإجمالي</span>
                  <span className="text-sm font-bold text-purple-400 font-mono">
                    +{totalGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded-lg p-2.5 flex gap-2 items-start">
                <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="text-[10px] text-yellow-300/90 leading-relaxed">
                  تقديرات تقريبية بناءً على الأداء التاريخي
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────

function PerformanceRowItem({
  row,
  onClick,
}: {
  row: PerformanceRow
  onClick: () => void
}) {
  const profitUp = row.profitPercent >= 0
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg p-3 transition-colors text-right"
    >
      {/* Mobile: stacked */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-base flex-shrink-0">
              {sectorIcon(row.project.sector)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{row.project.name}</div>
              <div className="text-[10px] text-neutral-500">{row.project.sector}</div>
            </div>
          </div>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono",
              profitUp
                ? "bg-green-400/[0.1] border-green-400/25 text-green-400"
                : "bg-red-400/[0.1] border-red-400/25 text-red-400",
            )}
          >
            {profitUp ? "+" : ""}{row.profitPercent.toFixed(1)}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <div className="text-neutral-500">الحصص</div>
            <div className="text-white font-mono font-bold">{row.shares_owned}</div>
          </div>
          <div>
            <div className="text-neutral-500">القيمة الحالية</div>
            <div className="text-white font-mono font-bold">{fmtIQD(row.current_value ?? 0)}</div>
          </div>
          <div>
            <div className="text-neutral-500">الربح/الخسارة</div>
            <div className={cn("font-mono font-bold", profitUp ? "text-green-400" : "text-red-400")}>
              {profitUp ? "+" : ""}{fmtIQD(row.profit)}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: row */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_80px_120px_120px_140px_70px_24px] lg:gap-3 lg:items-center">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-base flex-shrink-0">
            {sectorIcon(row.project.sector)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{row.project.name}</div>
            <div className="text-[10px] text-neutral-500">{row.project.sector}</div>
          </div>
        </div>
        <div className="text-xs text-white font-mono text-center">{row.shares_owned}</div>
        <div className="text-xs text-neutral-300 font-mono text-center">{fmtIQD(row.cost)}</div>
        <div className="text-xs text-white font-mono text-center font-bold">{fmtIQD(row.current_value ?? 0)}</div>
        <div className={cn("text-xs font-mono font-bold text-center", profitUp ? "text-green-400" : "text-red-400")}>
          {profitUp ? "+" : ""}{fmtIQD(row.profit)}
        </div>
        <div>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono inline-block",
              profitUp
                ? "bg-green-400/[0.1] border-green-400/25 text-green-400"
                : "bg-red-400/[0.1] border-red-400/25 text-red-400",
            )}
          >
            {profitUp ? "+" : ""}{row.profitPercent.toFixed(1)}%
          </span>
        </div>
        <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={2} />
      </div>
    </button>
  )
}

function PerformerCard({
  row,
  variant,
  onClick,
}: {
  row: PerformanceRow
  variant: "best" | "worst"
  onClick: () => void
}) {
  const profitUp = row.profitPercent >= 0
  const negativeColor = !profitUp
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg p-3 transition-colors flex items-center justify-between gap-3 text-right"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg flex-shrink-0">
          {sectorIcon(row.project.sector)}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-white truncate">{row.project.name}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            <span className="font-mono text-yellow-400">{row.shares_owned}</span> حصة · {row.project.sector}
          </div>
        </div>
      </div>
      <div className="text-left flex-shrink-0">
        <div className="text-xs font-bold text-white font-mono mb-0.5">{fmtIQD(row.current_value ?? 0)}</div>
        <div className={cn(
          "text-[10px] font-bold flex items-center gap-0.5 justify-end",
          variant === "best" ? "text-green-400" :
          negativeColor ? "text-red-400" : "text-orange-400",
        )}>
          {variant === "best" ? <ArrowUpRight className="w-2.5 h-2.5" strokeWidth={2.5} /> : <ArrowDownRight className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {profitUp ? "+" : ""}{row.profitPercent.toFixed(1)}%
        </div>
      </div>
    </button>
  )
}
