"use client"

/**
 * Phase 11.07 — /investment redesigned as a project-monitoring dashboard.
 *
 * Founder spec: trading-view-style page that shows project performance,
 * order book, and recent trades. The "BTC/USDT" pair selector at the
 * top of the reference screenshot is replaced with the platform's
 * project/company selector. All data is real (projects table + listings
 * table + deals table); price history falls back to a deterministic
 * synthesised series when fewer than 6 deals exist (so a brand-new
 * project still gets a chart instead of an empty box).
 *
 * Design respects the app identity: black background, white/[0.05]
 * cards, monospace numbers, no third-party trading-view widget.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown, Search, ArrowUpRight, ArrowDownRight, TrendingUp, BarChart3, Clock, Wallet,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { getAllProjects } from "@/lib/data/projects"
import { getExchangeListings, type ExchangeListingRow } from "@/lib/data/listings"
import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/mock-data/types"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ─────────────────────────────────────────────────────
const fmtIQD = (n: number) => n.toLocaleString("en-US")
const fmtCompact = (n: number) =>
  n >= 1_000_000_000 ? (n / 1_000_000_000).toFixed(2) + "B"
  : n >= 1_000_000   ? (n / 1_000_000).toFixed(2) + "M"
  : n >= 1_000       ? (n / 1_000).toFixed(2) + "K"
  : n.toFixed(0)

/** Deterministic pseudo-random ∈ [0,1) seeded from the project id. */
function seededRand(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280
  return x - Math.floor(x)
}

/** Build a synthesised OHLC-like series for the chart when no real
 *  trade history is available yet. */
function buildSyntheticSeries(
  basePrice: number,
  points: number,
  seed: number,
): Array<{ t: string; price: number; volume: number }> {
  const out: Array<{ t: string; price: number; volume: number }> = []
  let p = basePrice * 0.85
  const now = Date.now()
  const step = (24 * 3600 * 1000)  // 1 day per point for the default
  for (let i = 0; i < points; i++) {
    const drift = (seededRand(seed, i) - 0.45) * 0.04
    p = Math.max(basePrice * 0.6, p * (1 + drift))
    const ts = new Date(now - (points - i) * step)
    out.push({
      t: ts.toISOString().slice(0, 10),
      price: Math.round(p),
      volume: Math.round(seededRand(seed + 7, i) * 5000 + 200),
    })
  }
  // Anchor the last point exactly at the current price.
  out[out.length - 1] = { ...out[out.length - 1], price: basePrice }
  return out
}

// ─── Period tabs ────────────────────────────────────────────────
type Period = "1D" | "7D" | "30D" | "90D" | "ALL"
const PERIOD_POINTS: Record<Period, number> = {
  "1D": 24,
  "7D": 14,
  "30D": 30,
  "90D": 60,
  "ALL": 120,
}
const PERIOD_LABELS: Record<Period, string> = {
  "1D": "يوم",
  "7D": "أسبوع",
  "30D": "شهر",
  "90D": "ربع",
  "ALL": "كل",
}

// ─── Page ───────────────────────────────────────────────────────
export default function InvestmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get("project")

  // Projects list + selector
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("30D")

  // Live data
  const [listings, setListings] = useState<ExchangeListingRow[]>([])
  const [recentTrades, setRecentTrades] = useState<Array<{
    id: string; shares: number; total_amount: number; price: number; created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)

  // ─── Initial load ───
  useEffect(() => {
    let cancelled = false
    getAllProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
      // Strict null typing: "" || undefined && find(...) leaks the
      // empty string through ??, so we branch explicitly.
      const found = initialProjectId
        ? rows.find((p) => p.id === initialProjectId)
        : undefined
      const initial: Project | null = found ?? rows[0] ?? null
      setSelected(initial)
      setLoading(false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Per-project data load (listings + recent trades) ───
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      try {
        const all = await getExchangeListings()
        if (cancelled) return
        setListings(all.filter((l) => l.project_id === selected.id))
      } catch {
        if (!cancelled) setListings([])
      }
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("deals")
          .select("id, shares, total_amount, price_per_share, status, created_at")
          .eq("project_id", selected.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(20)
        if (cancelled) return
        const rows = (data ?? []) as Array<{
          id: string; shares: number; total_amount: number;
          price_per_share: number; status: string; created_at: string
        }>
        setRecentTrades(rows.map((d) => ({
          id: d.id,
          shares: Number(d.shares ?? 0),
          total_amount: Number(d.total_amount ?? 0),
          price: Number(d.price_per_share ?? 0),
          created_at: d.created_at,
        })))
      } catch {
        if (!cancelled) setRecentTrades([])
      }
    })()
    return () => { cancelled = true }
  }, [selected])

  // ─── Derived data ───
  const filteredProjects = useMemo(() => {
    if (!search) return projects
    const q = search.toLowerCase()
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.symbol?.toLowerCase() ?? "").includes(q) ||
      p.sector.toLowerCase().includes(q),
    )
  }, [projects, search])

  const chartData = useMemo(() => {
    if (!selected) return []
    // Use real trade prices when available, else synthesise.
    const trades = recentTrades.slice().reverse()  // oldest first
    const points = PERIOD_POINTS[period]
    if (trades.length >= 6) {
      return trades.slice(-points).map((t) => ({
        t: t.created_at.slice(0, 10),
        price: t.price,
        volume: t.shares,
      }))
    }
    const seed = selected.id?.charCodeAt(0) ?? 1
    return buildSyntheticSeries(selected.share_price, points, seed)
  }, [selected, recentTrades, period])

  const stats = useMemo(() => {
    if (!selected) {
      return { current: 0, prev: 0, changePct: 0, isUp: true, marketCap: 0, sold: 0, available: 0 }
    }
    const current = selected.share_price
    const prev = chartData.length > 1 ? chartData[0].price : current
    const changePct = prev > 0 ? ((current - prev) / prev) * 100 : 0
    const offering = selected.offering_shares ?? selected.available_shares ?? 0
    const sold = Math.max(0, offering - (selected.available_shares ?? 0))
    return {
      current,
      prev,
      changePct,
      isUp: changePct >= 0,
      marketCap: current * (selected.total_shares ?? 0),
      sold,
      available: selected.available_shares ?? 0,
      offering,
    }
  }, [selected, chartData])

  const sellListings = listings.filter((l) => l.type === "sell")
    .sort((a, b) => b.price_per_share - a.price_per_share).slice(0, 6)
  const buyListings = listings.filter((l) => l.type === "buy")
    .sort((a, b) => b.price_per_share - a.price_per_share).slice(0, 6)

  // ─── Render ───
  return (
    <AppLayout>
      <div className="relative min-h-screen bg-black">
        <div className="px-3 lg:px-8 py-4 max-w-6xl mx-auto">
          <PageHeader
            title="📊 الاستثمار"
            subtitle="مراقبة أداء المشاريع · حركة الأسعار · سجل التداول"
          />

          {loading ? (
            <div className="text-center text-xs text-neutral-500 py-20">
              جارٍ التحميل...
            </div>
          ) : !selected ? (
            <div className="text-center text-xs text-neutral-500 py-20">
              لا توجد مشاريع متاحة بعد.
            </div>
          ) : (
            <>
              {/* ═══ Top bar — project selector + period tabs ═══ */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  {/* Project selector — replaces "BTC/USDT" */}
                  <div className="relative flex-1">
                    <button
                      onClick={() => setPickerOpen((v) => !v)}
                      className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl flex items-center gap-2 hover:bg-white/[0.07] transition-colors"
                    >
                      {(selected.logo_url || selected.logo) ? (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selected.logo_url || selected.logo} alt={selected.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-400/[0.1] border border-blue-400/[0.2] flex items-center justify-center text-base">📊</div>
                      )}
                      <div className="text-right flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate flex items-center gap-1.5 justify-end">
                          {selected.name}
                          {selected.symbol && (
                            <span className="text-[10px] font-mono text-blue-400 bg-blue-400/[0.1] border border-blue-400/[0.2] rounded px-1.5 py-0.5" dir="ltr">
                              {selected.symbol}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{selected.sector}</div>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", pickerOpen && "rotate-180")} />
                    </button>

                    {pickerOpen && (
                      <div className="absolute top-full right-0 left-0 mt-1 z-40 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-2 border-b border-white/[0.05]">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="ابحث عن مشروع..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pr-8 pl-3 py-1.5 text-xs text-white outline-none"
                            />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                          {filteredProjects.length === 0 ? (
                            <div className="text-center text-[11px] text-neutral-500 py-6">لا توجد نتائج</div>
                          ) : (
                            filteredProjects.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => { setSelected(p); setPickerOpen(false); setSearch("") }}
                                className={cn(
                                  "w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.06] transition-colors text-right",
                                  selected.id === p.id && "bg-white/[0.05]",
                                )}
                              >
                                {(p.logo_url || p.logo) ? (
                                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.logo_url || p.logo} alt={p.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-xs">📊</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white font-bold truncate">{p.name}</div>
                                  <div className="text-[10px] text-neutral-500 truncate">{p.sector} · {fmtIQD(p.share_price)} د.ع</div>
                                </div>
                                {selected.id === p.id && <span className="text-green-400 text-xs">✓</span>}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Period tabs — name only, matching Phase 11.06 style */}
                <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
                  {(Object.keys(PERIOD_LABELS) as Period[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setPeriod(k)}
                      className={cn(
                        "flex-1 py-1.5 text-[11px] rounded-lg transition-colors",
                        period === k
                          ? "bg-white/[0.08] text-white font-bold"
                          : "text-neutral-400 hover:text-white",
                      )}
                    >
                      {PERIOD_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ═══ Price card + chart ═══ */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-[10px] text-neutral-500 mb-1">السعر الحالي</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl lg:text-4xl font-bold text-white font-mono">
                        {fmtIQD(stats.current)}
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">د.ع</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border",
                      stats.isUp
                        ? "bg-green-400/[0.06] border-green-400/[0.2] text-green-400"
                        : "bg-red-400/[0.06] border-red-400/[0.2] text-red-400"
                    )}>
                      {stats.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span className="font-mono">{stats.changePct >= 0 ? "+" : ""}{stats.changePct.toFixed(2)}%</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1">آخر {PERIOD_LABELS[period]}</div>
                  </div>
                </div>

                {/* Chart */}
                <div className="h-64 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={stats.isUp ? "#4ADE80" : "#F87171"} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={stats.isUp ? "#4ADE80" : "#F87171"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="t"
                        tick={{ fill: "#737373", fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        orientation="right"
                        tick={{ fill: "#737373", fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => fmtCompact(Number(v))}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0a0a0a",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        labelStyle={{ color: "#a3a3a3", fontSize: 10 }}
                        formatter={(value) => [
                          fmtIQD(Number(value ?? 0)) + " د.ع",
                          "السعر",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={stats.isUp ? "#4ADE80" : "#F87171"}
                        strokeWidth={2}
                        fill="url(#priceGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ═══ Stats grid ═══ */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <StatCard
                  icon={<Wallet className="w-3.5 h-3.5 text-yellow-400" strokeWidth={1.5} />}
                  label="القيمة السوقية"
                  value={fmtCompact(stats.marketCap) + " د.ع"}
                />
                <StatCard
                  icon={<BarChart3 className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />}
                  label="الحصص المتاحة"
                  value={fmtIQD(stats.available)}
                  unit="SHR"
                />
                <StatCard
                  icon={<TrendingUp className="w-3.5 h-3.5 text-green-400" strokeWidth={1.5} />}
                  label="مباع من الطرح"
                  value={fmtIQD(stats.sold)}
                  unit="SHR"
                />
                <StatCard
                  icon={<Clock className="w-3.5 h-3.5 text-purple-400" strokeWidth={1.5} />}
                  label="إجمالي الحصص"
                  value={fmtIQD(selected.total_shares ?? 0)}
                  unit="SHR"
                />
              </div>

              {/* ═══ Order book + Recent trades ═══ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                {/* Order book */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-white">📒 دفتر الأوامر</div>
                    <span className="text-[10px] text-neutral-500">{listings.length} إعلان</span>
                  </div>
                  <div className="grid grid-cols-2 text-[10px] text-neutral-500 mb-1.5 px-2">
                    <span className="text-right">السعر (د.ع)</span>
                    <span className="text-left">الحصص</span>
                  </div>

                  {/* Asks (sell) — top, red */}
                  <div className="space-y-0.5 mb-2">
                    {sellListings.length === 0 ? (
                      <div className="text-center text-[10px] text-neutral-600 py-3">لا توجد عروض بيع</div>
                    ) : (
                      sellListings.map((l) => (
                        <div key={l.id} className="grid grid-cols-2 px-2 py-1 rounded text-xs font-mono bg-red-400/[0.04] hover:bg-red-400/[0.08] transition-colors">
                          <span className="text-right text-red-400">{fmtIQD(l.price_per_share)}</span>
                          <span className="text-left text-neutral-300">{fmtIQD(l.shares_remaining)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Current price divider */}
                  <div className="px-2 py-1.5 rounded bg-white/[0.04] border-y border-white/[0.06] my-1 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500">سعر السوق</span>
                    <span className={cn("text-sm font-bold font-mono", stats.isUp ? "text-green-400" : "text-red-400")}>
                      {fmtIQD(stats.current)}
                    </span>
                  </div>

                  {/* Bids (buy) — bottom, green */}
                  <div className="space-y-0.5 mt-2">
                    {buyListings.length === 0 ? (
                      <div className="text-center text-[10px] text-neutral-600 py-3">لا توجد عروض شراء</div>
                    ) : (
                      buyListings.map((l) => (
                        <div key={l.id} className="grid grid-cols-2 px-2 py-1 rounded text-xs font-mono bg-green-400/[0.04] hover:bg-green-400/[0.08] transition-colors">
                          <span className="text-right text-green-400">{fmtIQD(l.price_per_share)}</span>
                          <span className="text-left text-neutral-300">{fmtIQD(l.shares_remaining)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent trades */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-white">⚡ آخر الصفقات</div>
                    <span className="text-[10px] text-neutral-500">{recentTrades.length} صفقة</span>
                  </div>
                  <div className="grid grid-cols-3 text-[10px] text-neutral-500 mb-1.5 px-2">
                    <span className="text-right">السعر (د.ع)</span>
                    <span className="text-center">الحصص</span>
                    <span className="text-left">الوقت</span>
                  </div>
                  {recentTrades.length === 0 ? (
                    <div className="text-center text-[11px] text-neutral-600 py-8">
                      لم تتم أي صفقة كاملة بعد
                    </div>
                  ) : (
                    <div className="space-y-0.5 max-h-72 overflow-y-auto">
                      {recentTrades.map((t) => {
                        const time = new Date(t.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit", minute: "2-digit", hour12: false,
                        })
                        return (
                          <div key={t.id} className="grid grid-cols-3 px-2 py-1 rounded text-xs font-mono hover:bg-white/[0.04] transition-colors">
                            <span className="text-right text-green-400">{fmtIQD(t.price)}</span>
                            <span className="text-center text-neutral-300">{fmtIQD(t.shares)}</span>
                            <span className="text-left text-neutral-500 text-[10px]" dir="ltr">{time}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ CTA buttons ═══ */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                  onClick={() => router.push(`/project/${selected.id}?action=invest`)}
                  className="py-3.5 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2] transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  استثمر الآن
                </button>
                <button
                  onClick={() => router.push(`/exchange?project=${selected.id}`)}
                  className="py-3.5 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold hover:bg-blue-500/[0.2] transition-colors flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  افتح السوق
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Sub-components ──────────────────────────────────────────────
function StatCard({
  icon, label, value, unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] text-neutral-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-bold text-white font-mono">{value}</span>
        {unit && <span className="text-[9px] text-neutral-500 font-mono">{unit}</span>}
      </div>
    </div>
  )
}
