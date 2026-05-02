"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { ShoppingCart, Heart, X, Image as ImageIcon, Clock, TrendingUp, TrendingDown, AlertCircle, Building2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { CreateDealModal } from "@/components/deals/CreateDealModal"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")
const sectorIcon = (s: string) => s?.includes("طب") ? "🏥" : s?.includes("تقن") ? "💻" : s?.includes("زراع") ? "🌾" : s?.includes("تجار") ? "🏪" : "🏢"
const riskLabel = (r: string) => r === "low" ? "منخفض" : r === "medium" ? "متوسط" : "مرتفع"
const riskColor = (r: string) => r === "low" ? "text-green-400" : r === "medium" ? "text-yellow-400" : "text-red-400"

// Mock projects + trades — centralized
import {
  projectsById as mockProjects,
  projectRecentTrades as mockTrades,
  getMarketStateByProject,
  getProjectPublicStatus,
  getPriceHistoryForChart,
  type Project as MockProject,
} from "@/lib/mock-data"
import { getProjectById } from "@/lib/data"
import { Card, SectionHeader, StatCard, Badge, SkeletonCard } from "@/components/ui"
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts"

function genChart(base: number, days: number, seed = 1) {
  const d: number[] = []
  let p = base * 0.82
  for (let i = 0; i < days; i++) {
    p = Math.max(p + (Math.sin(i * seed * 0.3) * 0.018 + 0.002) * p, base * 0.7)
    d.push(Math.round(p))
  }
  d.push(base)
  return d
}

function LineChart({ data, color = "#fff" }: { data: number[]; color?: string }) {
  const [tip, setTip] = useState<{ x: number; v: number } | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  if (!data.length) return null

  const W = 600
  const H = 100
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - ((v - min) / range) * (H - 16) - 8, v }))
  const polyline = pts.map((p) => p.x + "," + p.y).join(" ")
  const polygon = "0," + H + " " + polyline + " " + W + "," + H

  return (
    <div className="relative">
      <svg
        ref={ref}
        width="100%"
        height={H}
        viewBox={"0 0 " + W + " " + H}
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect()
          if (!r) return
          const idx = Math.min(Math.max(Math.round((e.clientX - r.left) / r.width * (data.length - 1)), 0), data.length - 1)
          setTip({ x: (e.clientX - r.left) / r.width * 100, v: pts[idx].v })
        }}
        onMouseLeave={() => setTip(null)}
        className="cursor-crosshair"
      >
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={polygon} fill="url(#pg)" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {tip && (
          <line x1={tip.x / 100 * W} y1="0" x2={tip.x / 100 * W} y2={H} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>
      {tip && (
        <div
          className="absolute top-0 bg-white/[0.1] border border-white/[0.15] rounded-lg px-2.5 py-1 text-[11px] font-bold text-white pointer-events-none whitespace-nowrap"
          style={{ left: Math.min(tip.x, 80) + "%" }}
        >
          {tip.v.toLocaleString("en-US")} IQD
        </div>
      )}
    </div>
  )
}

const galleryEmojis = ["🏗️", "🏛️", "📊", "🌾"]

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [project, setProject] = useState<MockProject | null>(mockProjects[id] || null)
  const [loading, setLoading] = useState(true)
  const trades = mockTrades
  const investors = 247
  const myShares = 0 // Mock - في الإنتاج: من holdings

  // Try DB first; fall back to mock projectsById on miss/error
  useEffect(() => {
    let cancelled = false
    getProjectById(id)
      .then((p) => {
        if (cancelled) return
        if (p) setProject(p)
        else if (!project) setProject(mockProjects[id] || mockProjects["1"])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        if (!project) setProject(mockProjects[id] || mockProjects["1"])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  const [period, setPeriod] = useState<"1D" | "7D" | "30D" | "كل">("7D")
  const [tab, setTab] = useState<"info" | "gallery" | "history">("info")
  const [following, setFollowing] = useState(false)
  const [showBuyOptions, setShowBuyOptions] = useState(false)
  const [showCreateDeal, setShowCreateDeal] = useState(false)

  if (loading || !project) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20 space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </AppLayout>
    )
  }

  const pct = project.total_shares > 0
    ? Math.round(((project.total_shares - (project.available_shares ?? 0)) / project.total_shares) * 100)
    : 0
  const marketCap = project.share_price * ((project.total_shares ?? 0) - (project.available_shares ?? 0))
  const priceChange = (pct * 0.12).toFixed(1)
  const isUp = parseFloat(priceChange) >= 0
  const chartDays: Record<string, number> = { "1D": 24, "7D": 30, "30D": 60, "كل": 120 }
  const chartData = genChart(project.share_price, chartDays[period] || 30, project.id?.charCodeAt(0) || 1)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 max-w-3xl mx-auto">

          <PageHeader
            title="تفاصيل المشروع"
            subtitle={project.name}
            rightAction={
              <button
                onClick={() => {
                  setFollowing((f) => !f)
                  showSuccess(following ? "تم إلغاء المتابعة" : "تتم المتابعة")
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border",
                  following
                    ? "bg-white/[0.05] border-white/[0.15] text-white hover:bg-white/[0.08]"
                    : "bg-neutral-100 text-black border-transparent hover:bg-neutral-200"
                )}
              >
                <Heart className={cn("w-3.5 h-3.5", following && "fill-current")} strokeWidth={1.5} />
                {following ? "متابَع" : "متابعة"}
              </button>
            }
          />

          {/* Hero */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-3xl flex-shrink-0">
                {sectorIcon(project.sector)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold text-white truncate">{project.name}</div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="bg-white/[0.06] border border-white/[0.08] text-neutral-300 px-2 py-0.5 rounded text-[10px]">{project.sector}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border",
                    project.risk_level === "low" ? "bg-green-400/10 border-green-400/20 text-green-400" :
                    project.risk_level === "medium" ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" :
                    "bg-red-400/10 border-red-400/20 text-red-400"
                  )}>
                    خطر {riskLabel(project.risk_level)}
                  </span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="mb-3">
              <div className="text-[11px] text-neutral-500 mb-1">السعر الحالي للحصة</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight font-mono">{project.share_price.toLocaleString("en-US")}</span>
                <span className="text-xs text-neutral-500">IQD</span>
                <span className={cn("text-sm font-bold flex items-center gap-0.5 mr-2", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(parseFloat(priceChange))}%
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-neutral-500">نسبة التمويل</span>
                <span className="text-[11px] font-bold text-white">{pct}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    pct > 70 ? "bg-green-400" : pct > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: pct + "%" }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "القيمة السوقية", value: fmtIQD(marketCap) + " IQD" },
                { label: "المستثمرين", value: investors },
                { label: "حصص متاحة", value: project.available_shares.toLocaleString("en-US") },
                { label: "إجمالي الحصص", value: project.total_shares.toLocaleString("en-US") },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                  <div className="text-[10px] text-neutral-500 mb-0.5">{s.label}</div>
                  <div className="text-sm font-bold text-white font-mono">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-white">حركة السعر</div>
              <div className="flex gap-1">
                {(["1D", "7D", "30D", "كل"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      period === p ? "bg-white text-black font-bold" : "bg-white/[0.04] text-neutral-400 hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <LineChart data={chartData} color={isUp ? "#4ADE80" : "#F87171"} />
          </div>

          {/* ═══ Price Movement Card ═══ */}
          {(() => {
            const ms = getMarketStateByProject(String(project.id))
            if (!ms) return null
            const status = getProjectPublicStatus(String(project.id))
            const chart = getPriceHistoryForChart(String(project.id), 30)
            const trendUp = ms.total_growth_pct >= 0
            return (
              <Card className="mb-4">
                <SectionHeader
                  title="💹 حركة سعر الحصة"
                  subtitle="السعر الحالي للحصة الواحدة"
                  action={{ label: "تفاصيل أكثر", href: "/investment" }}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <div className="flex flex-col gap-3">
                    <StatCard
                      label="السعر الحالي"
                      value={ms.current_price.toLocaleString("en-US") + " IQD"}
                      color="green"
                      trend={{ value: ms.total_growth_pct, direction: trendUp ? "up" : "down" }}
                      size="lg"
                    />
                    <div className="text-[10px] text-neutral-500">منذ الإطلاق</div>
                    <Badge
                      color={status.status === "frozen" ? "blue" : status.status === "review" ? "yellow" : "green"}
                      variant="soft"
                      size="sm"
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                    <div className="text-[10px] text-neutral-500 mb-2">آخر تحركات السعر</div>
                    <div className="h-32 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chart} margin={{ top: 5, right: 4, bottom: 0, left: 4 }}>
                          <defs>
                            <linearGradient id="pm-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#4ADE80" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide />
                          <Tooltip
                            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                            contentStyle={{
                              backgroundColor: "rgba(15,15,15,0.95)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                            formatter={(value) => [`${Number(value).toLocaleString("en-US")} IQD`, "السعر"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#4ADE80"
                            strokeWidth={2}
                            fill="url(#pm-grad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })()}

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-3">
            {([
              { key: "info", label: "المعلومات" },
              { key: "gallery", label: "معرض الصور" },
              { key: "history", label: "السجل" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs transition-colors",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Info Tab */}
          {tab === "info" && (
            <>
              {project.description && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-2">عن المشروع</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">{project.description}</div>
                </div>
              )}

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="text-sm font-bold text-white mb-3">البيانات المالية</div>
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { label: "رأس المال الكلي", value: fmtIQD(project.share_price * project.total_shares) + " IQD" },
                    { label: "المبلغ الممول", value: fmtIQD(marketCap) + " IQD" },
                    { label: "المتبقي للتمويل", value: fmtIQD(project.share_price * project.available_shares) + " IQD" },
                    { label: "الحد الأدنى للاستثمار", value: project.share_price.toLocaleString("en-US") + " IQD" },
                    { label: "إجمالي الحصص", value: project.total_shares.toLocaleString("en-US") + " SHR" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <span className="text-xs text-neutral-500">{item.label}</span>
                      <span className="text-xs font-bold text-white font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="text-sm font-bold text-white mb-3">العوائد المتوقعة</div>
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { label: "العائد السنوي المتوقع", value: project.return_min + "% - " + project.return_max + "%" },
                    { label: "آلية التوزيع", value: project.distribution_type === "monthly" ? "شهري" : project.distribution_type === "quarterly" ? "ربع سنوي" : project.distribution_type === "semi_annual" ? "نصف سنوي" : "سنوي" },
                    { label: "مصدر العوائد", value: project.profit_source || "أرباح التشغيل" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <span className="text-xs text-neutral-500">{item.label}</span>
                      <span className="text-xs font-bold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-white/[0.04] border-r-2 border-white/[0.15] rounded-lg p-2.5 text-[10px] text-neutral-400">
                  ⚠️ العوائد تقديرية وتعتمد على الأداء الفعلي
                </div>
              </div>

              {/* ═══ Extended classification (admin form data) ═══ */}
              {(project.symbol || project.entity_type || project.build_status || project.quality) && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">التصنيف</div>
                  <div className="grid grid-cols-2 gap-2">
                    {project.symbol && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">الرمز</div>
                        <div className="text-sm font-bold text-blue-400 font-mono" dir="ltr">{project.symbol}</div>
                      </div>
                    )}
                    {project.entity_type && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">نوع الكيان</div>
                        <div className="text-sm font-bold text-white">
                          {project.entity_type === "company" ? "🏢 شركة"
                            : project.entity_type === "project" ? "🏗️ مشروع"
                            : project.entity_type === "individual" ? "👤 فرد"
                            : "🤝 شراكة"}
                        </div>
                      </div>
                    )}
                    {project.build_status && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">حالة الإنشاء</div>
                        <div className="text-sm font-bold text-white">
                          {project.build_status === "planning" ? "قيد الإنشاء"
                            : project.build_status === "active" ? "نشط" : "منجز"}
                        </div>
                      </div>
                    )}
                    {project.quality && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">الجودة</div>
                        <div className="text-sm font-bold">
                          <span className={
                            project.quality === "high" ? "text-green-400"
                            : project.quality === "medium" ? "text-yellow-400" : "text-red-400"
                          }>
                            {project.quality === "high" ? "🟢 عالي"
                              : project.quality === "medium" ? "🟡 متوسط" : "🔴 منخفض"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Capital progress (admin form data) ═══ */}
              {project.capital_needed && project.capital_needed > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">رأس المال</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">رأس المال المطلوب</span>
                      <span className="text-white font-bold font-mono">{fmtIQD(project.capital_needed)} د.ع</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">المُحقَّق حتى الآن</span>
                      <span className="text-yellow-400 font-bold font-mono">{fmtIQD(project.capital_raised ?? 0)} د.ع</span>
                    </div>
                    <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all"
                        style={{
                          width: `${Math.min(100, ((project.capital_raised ?? 0) / project.capital_needed) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-neutral-500">نسبة التحقيق</span>
                      <span className="text-yellow-400 font-mono">
                        {(((project.capital_raised ?? 0) / project.capital_needed) * 100).toFixed(1)}%
                      </span>
                    </div>
                    {(project.owner_percent || project.offer_percent) && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.04]">
                        {project.owner_percent !== undefined && (
                          <div>
                            <div className="text-[10px] text-neutral-500">نسبة المالك</div>
                            <div className="text-sm font-bold text-white font-mono">{project.owner_percent}%</div>
                          </div>
                        )}
                        {project.offer_percent !== undefined && (
                          <div>
                            <div className="text-[10px] text-neutral-500">نسبة المطروح</div>
                            <div className="text-sm font-bold text-white font-mono">{project.offer_percent}%</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Owner contact (admin form data) ═══ */}
              {(project.owner_name || project.address) && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">المالك</div>
                  <div className="space-y-2">
                    {project.owner_name && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">اسم المالك</span>
                        <span className="text-xs font-bold text-white">{project.owner_name}</span>
                      </div>
                    )}
                    {project.owner_phone && myShares > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">الهاتف</span>
                        <span className="text-xs font-bold text-white font-mono" dir="ltr">{project.owner_phone}</span>
                      </div>
                    )}
                    {project.owner_email && myShares > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">البريد</span>
                        <span className="text-xs font-bold text-white font-mono" dir="ltr">{project.owner_email}</span>
                      </div>
                    )}
                    {project.address && (
                      <div className="py-1.5">
                        <div className="text-xs text-neutral-500 mb-1">العنوان</div>
                        <div className="text-xs text-white leading-relaxed">{project.address}</div>
                      </div>
                    )}
                    {!myShares && (project.owner_phone || project.owner_email) && (
                      <div className="bg-blue-400/[0.05] border border-blue-400/20 rounded-lg p-2.5 text-[10px] text-blue-400 leading-relaxed">
                        🔒 بيانات التواصل (هاتف/بريد) متاحة للمستثمرين فقط
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Documents (admin form data) ═══ */}
              {project.documents && project.documents.length > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">📁 الأوراق الرسمية</div>
                  <div className="space-y-2">
                    {project.documents.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] rounded-lg p-2.5 transition-colors"
                      >
                        <span className="text-blue-400">📄</span>
                        <span className="text-xs text-white flex-1 truncate">{doc.name}</span>
                        <span className="text-[10px] text-blue-400">تنزيل ←</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {myShares > 0 && (
                <div className="bg-green-400/[0.06] border border-green-400/20 rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-green-400 mb-3">استثماري الشخصي</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "الحصص المملوكة", value: myShares + " SHR" },
                      { label: "القيمة الحالية", value: fmtIQD(myShares * project.share_price) + " IQD" },
                      { label: "العائد التقديري", value: "+" + priceChange + "%", color: "text-green-400" },
                      { label: "نسبة المشروع", value: ((myShares / project.total_shares) * 100).toFixed(2) + "%" },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/[0.04] border border-green-400/[0.15] rounded-lg p-2.5">
                        <div className="text-[10px] text-green-400/70 mb-0.5">{item.label}</div>
                        <div className={cn("text-sm font-bold", item.color || "text-white")}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Gallery Tab */}
          {tab === "gallery" && (
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-2">
                {galleryEmojis.map((img, i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] bg-white/[0.05] border border-white/[0.08] rounded-2xl flex items-center justify-center text-5xl cursor-pointer hover:bg-white/[0.07] transition-colors"
                  >
                    {img}
                  </div>
                ))}
              </div>
              <div className="text-center mt-3 text-[11px] text-neutral-500">
                <ImageIcon className="w-4 h-4 mx-auto mb-1.5 opacity-40" />
                سيتم رفع الصور الحقيقية من لوحة التحكم
              </div>
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="space-y-2 mb-3">
              {trades.length === 0 ? (
                <div className="text-center py-12 text-sm text-neutral-500">لا توجد صفقات مسجلة</div>
              ) : (
                trades.map((t, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{t.shares} حصة</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{t.created_at}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-yellow-400 font-mono">{fmtIQD(t.price * t.shares)} IQD</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{t.price.toLocaleString("en-US")} /حصة</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowBuyOptions(true)}
              disabled={project.available_shares === 0}
              className={cn(
                "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                project.available_shares > 0
                  ? "bg-neutral-100 text-black hover:bg-neutral-200"
                  : "bg-white/[0.08] text-neutral-500 cursor-not-allowed"
              )}
            >
              <ShoppingCart className="w-4 h-4" strokeWidth={2} />
              {project.available_shares === 0 ? "نفذت الحصص" : "شراء حصص"}
            </button>
            {myShares > 0 && (
              <button
                onClick={() => router.push("/market/new")}
                className="flex-1 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.08]"
              >
                بيع
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Buy Options Modal */}
      {showBuyOptions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-base font-bold text-white">اختر طريقة الشراء</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{project.name} • {project.share_price.toLocaleString("en-US")} IQD/حصة</div>
              </div>
              <button onClick={() => setShowBuyOptions(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option 1: Direct buy from system */}
            <button
              onClick={() => {
                setShowBuyOptions(false)
                setShowCreateDeal(true)
              }}
              className="w-full mt-4 bg-white/[0.04] border border-white/[0.1] rounded-xl p-4 text-right hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xl flex-shrink-0">
                  🏦
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">طلب شراء مباشر</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">الشراء مباشرةً من المنصة</div>
                </div>
              </div>
              <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded-lg p-2.5 text-[11px] text-yellow-400 leading-relaxed">
                <Clock className="w-3 h-3 inline ml-1" />
                الطلب يذهب للبائع فوراً، يحتاج رد خلال 5 دقائق
              </div>
            </button>

            {/* Option 2: From investors */}
            <button
              onClick={() => {
                setShowBuyOptions(false)
                router.push("/exchange?project=" + project.id)
              }}
              className="w-full mt-3 bg-green-400/[0.04] border border-green-400/20 rounded-xl p-4 text-right hover:bg-green-400/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-400/[0.1] border border-green-400/20 flex items-center justify-center text-xl flex-shrink-0">
                  ⚡
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-green-400">شراء من المستثمرين</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">سوق التبادل بين المستثمرين</div>
                </div>
              </div>
              <div className="bg-green-400/[0.06] border border-green-400/20 rounded-lg p-2.5 text-[11px] text-green-400 leading-relaxed">
                ✅ يتم بسرعة حسب الإعلانات المتاحة
              </div>
            </button>

            <button
              onClick={() => setShowBuyOptions(false)}
              className="w-full mt-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      <CreateDealModal
        open={showCreateDeal}
        onClose={() => setShowCreateDeal(false)}
        project={{
          id: project.id,
          name: project.name,
          share_price: project.share_price,
          available_shares: project.available_shares,
        }}
        seller={{
          id: project.seller_id || "seller_main",
          name: project.seller_name || "إدارة المنصة",
        }}
      />
    </AppLayout>
  )
}
