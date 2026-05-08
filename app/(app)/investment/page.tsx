"use client"

/**
 * Phase 11.37 — /investment refined per founder spec.
 *
 *   1. Top-right ticker shows {symbol} prominently + project NAME beside
 *      it (no more "/IQD" suffix). The "حصص" badge stays.
 *   2. Chart-type switcher icon (replaces the static candle icon) — flips
 *      between Candles / Line / Area / Bars.
 *   3. Container 1 ("order book") rebuilt as a unified MIXED list of
 *      buy + sell listings. No more "السعر / المبلغ" headers. Each row:
 *      [icon] {symbol}  {price}  {Δ%}  {funded%}   color-tinted by side.
 *   4. Container 2 rebuilt as a PROJECT BROWSER (same row style) with a
 *      compact trade form pinned at the bottom. Clicking a project
 *      switches the chart. Submitting the form creates a real listing
 *      via the same RPC the /exchange page uses, so the new order
 *      shows up in BOTH Container 1 and the public /exchange feed.
 */

import { Suspense, useEffect, useMemo, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown, Search, MoreHorizontal,
  CandlestickChart, LineChart as LineChartIcon, AreaChart as AreaChartIcon, BarChart3,
  Briefcase, ShoppingCart, FileText, Share2, Loader2,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { getAllProjects } from "@/lib/data/projects"
import {
  getExchangeListings, type ExchangeListingRow,
} from "@/lib/data/listings"
import { createListingDB } from "@/lib/data/portfolio-analytics"
import { createClient } from "@/lib/supabase/client"
import { readPersistedSync } from "@/lib/data/cache"
import type { Project } from "@/lib/mock-data/types"
import { iqd, parseIqdInput } from "@/lib/utils/money"
import { transliterate } from "@/lib/utils/symbol-generator"
import { IntegerInput } from "@/components/ui/IntegerInput"
import { useRealtimeListings } from "@/lib/realtime/useRealtimeListings"
import { showInfo, showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ─────────────────────────────────────────────────────
const fmtIQD = (n: number) => n.toLocaleString("en-US")
const fmt1 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Phase 11.38 — symbol = ALWAYS exactly 3 uppercase Latin letters.
 *
 *   1. If `project.symbol` is set, take its first 3 Latin letters
 *      (in case the admin entered something longer / lowercase /
 *      with punctuation).
 *   2. Otherwise transliterate the (possibly Arabic) name with the
 *      shared transliterate() helper and take the first 3 Latin
 *      letters from the result.
 *   3. If the name still doesn't yield 3 letters (rare — non-Latin
 *      non-Arabic characters), fall back to "—".
 *
 * Examples: "رايلوس" → "RAY", "مزرعة الواحة" → "MZR", "Brj" → "BRJ".
 */
function symbolOf(p: Project | null | undefined): string {
  if (!p) return "—"
  const fromSymbol = (p.symbol || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
  if (fromSymbol.length === 3) return fromSymbol
  const fromName = transliterate(p.name)
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
  if (fromName.length === 3) return fromName
  return fromName || fromSymbol || "—"
}

function seededRand(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280
  return x - Math.floor(x)
}

// ─── Types ───────────────────────────────────────────────────────
interface Candle { t: string; o: number; h: number; l: number; c: number; v: number }
interface DealRow { id: string; shares: number; price: number; total: number; created_at: string }

type Period = "15m" | "1h" | "4h" | "1d"
const PERIOD_LABELS: Record<Period, string> = { "15m": "15د", "1h": "1س", "4h": "4س", "1d": "يوم 1" }
const PERIODS: Period[] = ["15m", "1h", "4h", "1d"]

type ChartType = "candles" | "line" | "area" | "bars"
const CHART_TYPES: { id: ChartType; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "candles", label: "شموع",   icon: CandlestickChart },
  { id: "line",    label: "خطّي",   icon: LineChartIcon },
  { id: "area",    label: "منطقة",  icon: AreaChartIcon },
  { id: "bars",    label: "أعمدة",  icon: BarChart3 },
]

// ─── Build candles ────────────────────────────────────────────────
function buildCandles(
  basePrice: number, deals: DealRow[], pointCount: number, seed: number,
): Candle[] {
  if (deals.length >= 6) {
    const byDay = new Map<string, DealRow[]>()
    for (const d of deals) {
      const day = d.created_at.slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(d)
    }
    const days = Array.from(byDay.keys()).sort()
    const out: Candle[] = []
    for (const day of days) {
      const rows = byDay.get(day)!.sort((a, b) => a.created_at.localeCompare(b.created_at))
      const prices = rows.map((r) => r.price)
      out.push({
        t: day,
        o: prices[0],
        c: prices[prices.length - 1],
        h: Math.max(...prices),
        l: Math.min(...prices),
        v: rows.reduce((s, r) => s + r.shares, 0),
      })
    }
    return out.slice(-pointCount)
  }
  if (basePrice <= 0) return []
  const out: Candle[] = []
  let prev = basePrice * 0.82
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000
  for (let i = 0; i < pointCount; i++) {
    const drift = (seededRand(seed, i) - 0.42) * 0.05
    const o = prev
    const c = Math.max(basePrice * 0.55, prev * (1 + drift))
    const wick = Math.abs(c - o) * (0.6 + seededRand(seed + 1, i) * 0.8)
    const h = Math.max(o, c) + wick * (0.3 + seededRand(seed + 2, i) * 0.4)
    const l = Math.min(o, c) - wick * (0.3 + seededRand(seed + 3, i) * 0.4)
    const v = Math.round(seededRand(seed + 7, i) * 5000 + 200)
    const ts = new Date(now - (pointCount - i) * dayMs).toISOString().slice(0, 10)
    out.push({ t: ts, o: Math.round(o), h: Math.round(h), l: Math.round(l), c: Math.round(c), v })
    prev = c
  }
  out[out.length - 1] = { ...out[out.length - 1], c: basePrice }
  return out
}

function ma(candles: Candle[], window: number): number[] {
  const out: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < window) { out.push(NaN); continue }
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += candles[j].c
    out.push(sum / window)
  }
  return out
}

// ─── Universal SVG chart (candles / line / area / bars) ───────────
function MultiChart({
  candles, height = 360, showMA = true, type = "candles", loading = false,
}: {
  candles: Candle[]; height?: number; showMA?: boolean; type?: ChartType; loading?: boolean
}) {
  if (candles.length === 0) {
    return (
      <div
        className="bg-white/[0.02] flex items-center justify-center text-xs text-neutral-600"
        style={{ height }}
      >
        {loading ? "جاري تحميل بيانات السعر..." : "لا توجد بيانات للعرض"}
      </div>
    )
  }

  const maxPrice = Math.max(...candles.map((c) => c.h))
  const minPrice = Math.min(...candles.map((c) => c.l))
  const padding = (maxPrice - minPrice) * 0.06 || maxPrice * 0.02
  const yMax = maxPrice + padding
  const yMin = Math.max(0, minPrice - padding)
  const range = yMax - yMin || 1

  const ma5  = ma(candles, 5)
  const ma10 = ma(candles, 10)
  const ma20 = ma(candles, 20)

  const W = 800, H = height
  const leftPad = 16, rightPad = 64, topPad = 16, botPad = 28
  const innerW = W - leftPad - rightPad
  const innerH = H - topPad - botPad
  const xStep = innerW / Math.max(1, candles.length)
  const candleW = Math.max(2, xStep * 0.65)
  const xOf = (i: number) => leftPad + i * xStep + xStep / 2
  const yOf = (price: number) => topPad + (1 - (price - yMin) / range) * innerH

  const linePath = (values: number[]): string => {
    let d = ""; let started = false
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (!Number.isFinite(v)) continue
      const x = xOf(i); const y = yOf(v)
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `
      started = true
    }
    return d.trim()
  }

  const closes = candles.map((c) => c.c)
  const closesPath = linePath(closes)
  const areaPath = closesPath
    ? `${closesPath} L ${xOf(candles.length - 1).toFixed(1)},${(topPad + innerH).toFixed(1)} L ${xOf(0).toFixed(1)},${(topPad + innerH).toFixed(1)} Z`
    : ""

  const lastClose = candles[candles.length - 1].c
  const firstClose = candles[0].c
  const trendUp = lastClose >= firstClose
  const lineColor = trendUp ? "#22c55e" : "#ef4444"

  const gridLines = [0.2, 0.4, 0.6, 0.8]
  const gridPrices = gridLines.map((f) => yMax - f * range)
  const maxIdx = candles.reduce((m, c, i) => (c.h > candles[m].h ? i : m), 0)
  const maxHigh = candles[maxIdx].h

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" preserveAspectRatio="none" style={{ height }}>
      {/* Grid + right-axis */}
      {gridPrices.map((p, i) => (
        <g key={i}>
          <line x1={leftPad} x2={W - rightPad} y1={yOf(p)} y2={yOf(p)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3 4" />
          <text x={W - rightPad + 4} y={yOf(p) + 3} fill="rgba(255,255,255,0.4)" fontSize={10} fontFamily="ui-monospace, monospace">
            {Math.round(p).toLocaleString("en-US")}
          </text>
        </g>
      ))}

      {/* CANDLES */}
      {type === "candles" && candles.map((c, i) => {
        const up = c.c >= c.o
        const stroke = up ? "#22c55e" : "#ef4444"
        const fill = up ? "#22c55e" : "#ef4444"
        const x = xOf(i)
        const yOpen = yOf(c.o), yClose = yOf(c.c)
        const bodyTop = Math.min(yOpen, yClose)
        const bodyH = Math.max(1, Math.abs(yClose - yOpen))
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={stroke} strokeWidth={1} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={fill} stroke={stroke} strokeWidth={0.5} />
          </g>
        )
      })}

      {/* BARS — colored by direction */}
      {type === "bars" && candles.map((c, i) => {
        const up = c.c >= c.o
        const fill = up ? "#22c55e" : "#ef4444"
        const x = xOf(i)
        const yClose = yOf(c.c)
        const baseY = topPad + innerH
        return (
          <rect key={i} x={x - candleW / 2} y={Math.min(yClose, baseY)}
            width={candleW} height={Math.max(1, Math.abs(baseY - yClose))}
            fill={fill} fillOpacity={0.7} />
        )
      })}

      {/* AREA */}
      {type === "area" && (
        <>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={closesPath} fill="none" stroke={lineColor} strokeWidth={1.8} />
        </>
      )}

      {/* LINE */}
      {type === "line" && (
        <path d={closesPath} fill="none" stroke={lineColor} strokeWidth={1.6} />
      )}

      {/* MA overlays — visible on candles + bars; toggleable */}
      {showMA && (type === "candles" || type === "bars") && (
        <>
          <path d={linePath(ma5)} fill="none" stroke="#fbbf24" strokeWidth={1.4} />
          <path d={linePath(ma10)} fill="none" stroke="#a78bfa" strokeWidth={1.4} />
          <path d={linePath(ma20)} fill="none" stroke="#06b6d4" strokeWidth={1.4} />
        </>
      )}

      {/* Last-close marker */}
      <line x1={leftPad} x2={W - rightPad} y1={yOf(lastClose)} y2={yOf(lastClose)}
        stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="2 3" />
      <rect x={W - rightPad + 1} y={yOf(lastClose) - 8}
        width={rightPad - 4} height={16} rx={2}
        fill="#171717" stroke="#404040" strokeWidth={0.5} />
      <text x={W - rightPad + 4} y={yOf(lastClose) + 3}
        fill="#fff" fontSize={10} fontFamily="ui-monospace, monospace" fontWeight={700}>
        {Math.round(lastClose).toLocaleString("en-US")}
      </text>

      {/* Max-high tag */}
      <text x={xOf(maxIdx) - 28} y={yOf(maxHigh) - 6}
        fill="#fff" fontSize={9} fontFamily="ui-monospace, monospace">
        ▼ {Math.round(maxHigh).toLocaleString("en-US")}
      </text>

      {/* X-axis */}
      {candles.map((c, i) => {
        const showEvery = Math.max(1, Math.floor(candles.length / 4))
        if (i % showEvery !== 0 && i !== candles.length - 1) return null
        return (
          <text key={`xl-${i}`} x={xOf(i)} y={H - 8}
            fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="ui-monospace, monospace" textAnchor="middle">
            {c.t.slice(2).replace(/-/g, "/")}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Mini-row card ───────────────────────────────────────────────
function MiniRow({
  symbol, name, logoUrl, price, changePct, fundedPct, side, onClick,
}: {
  symbol: string
  name?: string
  logoUrl?: string | null
  price: number
  changePct: number | null
  fundedPct: number | null
  side?: "buy" | "sell" | null  // null = neutral (project row)
  onClick?: () => void
}) {
  const tint = side === "sell"
    ? "bg-red-500/[0.06] border-red-500/[0.15] hover:bg-red-500/[0.10]"
    : side === "buy"
      ? "bg-green-500/[0.06] border-green-500/[0.15] hover:bg-green-500/[0.10]"
      : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
  const priceColor = side === "sell" ? "text-red-400" : side === "buy" ? "text-green-400" : "text-white"
  const changeColor = changePct == null ? "text-neutral-500" : changePct >= 0 ? "text-green-400" : "text-red-400"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-right transition-colors",
        tint,
      )}
    >
      {/* Project icon */}
      {logoUrl ? (
        <div className="w-7 h-7 rounded-md overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={symbol} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[9px] text-neutral-400 font-bold flex-shrink-0">
          {symbol.slice(0, 2)}
        </div>
      )}

      {/* Symbol + full Arabic name (no truncation per Phase 11.38) */}
      <div className="flex-shrink-0">
        <div className="text-[11px] font-bold text-white" dir="ltr">{symbol}</div>
        {name && (
          <div className="text-[9px] text-neutral-400 leading-tight">{name}</div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Price + change + funded — all on one line */}
      <div className="flex items-center gap-2 text-[11px] font-mono flex-shrink-0">
        <span className={cn("font-bold", priceColor)}>{fmtIQD(price)}</span>
        {changePct != null && (
          <span className={cn("text-[10px]", changeColor)}>
            {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
          </span>
        )}
        {fundedPct != null && (
          <span className="text-[9px] text-neutral-500">📊{fundedPct.toFixed(0)}%</span>
        )}
      </div>
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────
export default function InvestmentPage() {
  return (
    <Suspense fallback={<AppLayout><div /></AppLayout>}>
      <InvestmentPageInner />
    </Suspense>
  )
}

function InvestmentPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProjectId = searchParams?.get("project")

  const cachedProjects = readPersistedSync<Project[]>("projects:active:all") ?? []

  const [projects, setProjects] = useState<Project[]>(cachedProjects)
  const [selected, setSelected] = useState<Project | null>(() => {
    if (cachedProjects.length === 0) return null
    if (initialProjectId) return cachedProjects.find((p) => p.id === initialProjectId) ?? cachedProjects[0]
    return cachedProjects[0]
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("1d")
  const [hideMA, setHideMA] = useState(false)
  const [chartType, setChartType] = useState<ChartType>("candles")
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [sharesInput, setSharesInput] = useState("")
  const [priceInput, setPriceInput] = useState("")
  const [pct, setPct] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [chartPickerOpen, setChartPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const moreRef = useRef<HTMLDivElement>(null)
  const chartPickerRef = useRef<HTMLDivElement>(null)

  const [allListings, setAllListings] = useState<ExchangeListingRow[]>([])
  const [recentDeals, setRecentDeals] = useState<DealRow[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)

  const { tick: listingsTick } = useRealtimeListings()

  // Initial projects load
  useEffect(() => {
    let cancelled = false
    getAllProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
      if (!selected && rows.length > 0) {
        const found = initialProjectId ? rows.find((p) => p.id === initialProjectId) : undefined
        setSelected(found ?? rows[0])
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // All active listings — used by Container 1 (mixed buy/sell rows).
  useEffect(() => {
    let cancelled = false
    getExchangeListings()
      .then((rows) => { if (!cancelled) setAllListings(rows) })
    return () => { cancelled = true }
  }, [listingsTick])

  // Per-project deals → candles
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoadingDeals(true)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("deals")
          .select("id, shares, total_amount, price_per_share, status, created_at")
          .eq("project_id", selected.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(120)
        if (cancelled) return
        const rows = (data ?? []) as Array<{
          id: string; shares: number; total_amount: number;
          price_per_share: number; status: string; created_at: string
        }>
        setRecentDeals(rows.map((d) => ({
          id: d.id,
          shares: Number(d.shares ?? 0),
          price: iqd(d.price_per_share),
          total: iqd(d.total_amount),
          created_at: d.created_at,
        })))
      } catch {
        if (!cancelled) setRecentDeals([])
      } finally {
        if (!cancelled) setLoadingDeals(false)
      }
    })()
    return () => { cancelled = true }
  }, [selected, listingsTick])

  // Click-outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
      if (chartPickerRef.current && !chartPickerRef.current.contains(t)) setChartPickerOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  // Derived
  const filteredProjects = useMemo(() => {
    if (!search) return projects
    const q = search.toLowerCase()
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      symbolOf(p).toLowerCase().includes(q) ||
      p.sector.toLowerCase().includes(q),
    )
  }, [projects, search])

  const pointCount = period === "15m" ? 96 : period === "1h" ? 72 : period === "4h" ? 60 : 60

  const candles = useMemo(() => {
    if (!selected) return []
    const seed = (selected.id?.charCodeAt(0) ?? 1) +
      (selected.id?.charCodeAt(selected.id.length - 1) ?? 0)
    return buildCandles(
      iqd(selected.current_market_price ?? selected.share_price),
      recentDeals, pointCount, seed,
    )
  }, [selected, recentDeals, pointCount])

  const currentPrice = useMemo(() => {
    if (!selected) return 0
    return iqd(selected.current_market_price ?? selected.share_price)
  }, [selected])

  const change24h = useMemo(() => {
    if (candles.length < 2) return { abs: 0, pct: 0, up: true }
    const last = candles[candles.length - 1].c
    const first = candles[0].c
    const abs = last - first
    const pct = first > 0 ? (abs / first) * 100 : 0
    return { abs, pct, up: pct >= 0 }
  }, [candles])

  const ma5Last = useMemo(() => { const a = ma(candles, 5); return a.length ? a[a.length - 1] : NaN }, [candles])
  const ma10Last = useMemo(() => { const a = ma(candles, 10); return a.length ? a[a.length - 1] : NaN }, [candles])
  const ma20Last = useMemo(() => { const a = ma(candles, 20); return a.length ? a[a.length - 1] : NaN }, [candles])

  // Look up project by id (used to render project icons inside listing rows).
  const projectsById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  // Container 1 — unified mixed list, sorted: sells (asks) first asc by price,
  // then buys (bids) desc, capped at 12.
  const orderRows = useMemo(() => {
    const sells = allListings.filter((l) => l.type === "sell").sort((a, b) => a.price_per_share - b.price_per_share)
    const buys  = allListings.filter((l) => l.type === "buy").sort((a, b) => b.price_per_share - a.price_per_share)
    return [...sells, ...buys].slice(0, 12)
  }, [allListings])

  const sbRatio = useMemo(() => {
    const s = allListings.filter((l) => l.type === "sell").reduce((acc, l) => acc + l.shares_remaining, 0)
    const b = allListings.filter((l) => l.type === "buy").reduce((acc, l) => acc + l.shares_remaining, 0)
    const total = s + b
    if (total === 0) return { s: 50, b: 50 }
    return { s: Math.round((s / total) * 100), b: Math.round((b / total) * 100) }
  }, [allListings])

  // Container 2 — list of all projects with mini-row data.
  const projectRows = useMemo(() => projects.map((p) => {
    const price = iqd(p.current_market_price ?? p.share_price)
    const launch = iqd(p.share_price)
    const changePct = launch > 0 ? ((price - launch) / launch) * 100 : 0
    const offering = (p.offering_shares ?? p.available_shares ?? 0)
    const sold = Math.max(0, offering - (p.available_shares ?? 0))
    const fundedPct = offering > 0 ? (sold / offering) * 100 : 0
    return {
      project: p,
      symbol: symbolOf(p),
      name: p.name,
      logoUrl: p.logo_url ?? null,
      price, changePct, fundedPct,
    }
  }), [projects])

  // Slider → pct of available
  const handlePctChange = (p: number) => {
    setPct(p)
    if (!selected) return
    const max = side === "sell"
      ? 100  // user picks shares to sell
      : Math.max(1, Math.floor(currentPrice * 10))  // rough IQD ceiling
    const value = side === "sell"
      ? Math.round(max * (p / 100))
      : Math.round(max * (p / 100))
    if (side === "sell") setSharesInput(String(value))
    else setSharesInput(String(Math.max(1, Math.round((max * (p / 100)) / Math.max(1, currentPrice)))))
  }

  // Submit listing — uses createListingDB (same RPC /exchange/create uses).
  const handleSubmit = async () => {
    if (!selected) return showError("اختر مشروعاً أولاً")
    const sharesNum = parseIqdInput(sharesInput)
    if (sharesNum < 1) return showError("أدخل عدد الحصص")
    const priceNum = priceInput === "" ? currentPrice : parseIqdInput(priceInput)
    if (priceNum < 1) return showError("أدخل سعر الحصة")
    setSubmitting(true)
    try {
      const res = await createListingDB(
        selected.id, sharesNum, priceNum,
        JSON.stringify({ source: "investment_page" }),
        false, side,
      )
      if (!res.success) {
        const reasonMap: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول أولاً",
          invalid_shares: "عدد الحصص غير صحيح",
          invalid_price: "السعر غير صحيح",
          invalid_type: "نوع الإعلان غير صحيح",
          no_holdings: "لا تملك حصصاً في هذا المشروع",
          insufficient_unfrozen: `متاح للبيع: ${res.available ?? "؟"} حصة فقط`,
          insufficient_fee_units: `وحدات الرسوم غير كافية`,
          missing_table: "الميزة غير مفعّلة بعد على الخادم",
          rls: "ليس لديك صلاحية لنشر إعلان",
        }
        showError(reasonMap[res.reason ?? ""] ?? "تعذّر نشر الطلب")
        return
      }
      showSuccess(side === "buy" ? "✅ تم نشر طلب الشراء" : "✅ تم نشر عرض البيع")
      setSharesInput("")
      setPriceInput("")
      setPct(0)
      // Listings cache invalidated inside createListingDB; realtime will
      // also fire — Container 1 + /exchange both refresh automatically.
    } catch (e) {
      showError(e instanceof Error ? e.message : "تعذّر نشر الطلب")
    } finally {
      setSubmitting(false)
    }
  }

  const sym = symbolOf(selected)
  const ChartTypeIcon = CHART_TYPES.find((t) => t.id === chartType)?.icon ?? CandlestickChart

  // ─── Render ───
  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white" dir="rtl">
        <div className="max-w-6xl mx-auto px-2 lg:px-4 pt-3 pb-20">

          {/* ════ TICKER BAR ════ */}
          <div className="flex items-center justify-between mb-3 px-1">
            {/* Right (in RTL): symbol + name + leverage */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-2 hover:bg-white/[0.04] rounded-lg px-2 py-1 transition-colors"
              >
                <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", pickerOpen && "rotate-180")} />
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {/* Phase 11.38 — symbol = strict 3 uppercase Latin letters
                      (no slash/IQD suffix). Full Arabic name shown beside,
                      no truncation so the founder can read it cleanly. */}
                  <span className="text-base font-bold text-white" dir="ltr">{sym}</span>
                  {selected && (
                    <span className="text-[11px] text-neutral-300">{selected.name}</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => showInfo("هذا تداول حصص — لا يوجد رفع مالي. الكمية المتاحة من محفظة الطرح.")}
                className="bg-yellow-400/[0.12] border border-yellow-400/25 hover:bg-yellow-400/[0.18] text-yellow-300 text-[11px] font-bold rounded px-2 py-0.5 transition-colors flex-shrink-0"
              >
                حصص
              </button>
            </div>

            {/* Left (in RTL): chart-type + more */}
            <div className="flex items-center gap-1">
              <div className="relative" ref={chartPickerRef}>
                <button
                  onClick={() => setChartPickerOpen((v) => !v)}
                  className="text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/[0.04] transition-colors"
                  title={`نوع الرسم: ${CHART_TYPES.find((t) => t.id === chartType)?.label}`}
                >
                  <ChartTypeIcon className="w-4 h-4" strokeWidth={2} />
                </button>
                {chartPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 z-40 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden w-44">
                    <div className="text-[10px] text-neutral-500 px-3 pt-2 pb-1 font-bold border-b border-white/[0.05]">
                      نوع الرسم البياني
                    </div>
                    {CHART_TYPES.map((t) => {
                      const Icon = t.icon
                      const active = t.id === chartType
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setChartType(t.id); setChartPickerOpen(false) }}
                          className={cn(
                            "w-full text-right px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center gap-2 transition-colors",
                            active ? "text-green-400 bg-green-400/[0.05]" : "text-white",
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                          <span className="flex-1">{t.label}</span>
                          {active && <span className="text-[10px]">✓</span>}
                        </button>
                      )
                    })}
                    <div className="border-t border-white/[0.05] mt-1">
                      <button
                        onClick={() => { setHideMA((v) => !v); setChartPickerOpen(false) }}
                        className="w-full text-right px-3 py-2 text-xs text-white hover:bg-white/[0.04] flex items-center justify-between"
                      >
                        <span className={cn("text-[10px]", !hideMA ? "text-green-400" : "text-neutral-500")}>
                          {!hideMA ? "✓" : ""}
                        </span>
                        <span>عرض المتوسطات (MA)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className="text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/[0.04] transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" strokeWidth={2.5} />
                </button>
                {moreOpen && (
                  <div className="absolute top-full left-0 mt-1 z-40 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden w-52">
                    <div className="text-[10px] text-neutral-500 px-3 pt-2 pb-1 font-bold border-b border-white/[0.05]">
                      {sym} — أوامر سريعة
                    </div>
                    <button onClick={() => { setMoreOpen(false); selected && router.push(`/project/${selected.id}`) }}
                      className="w-full text-right px-3 py-2 text-xs text-white hover:bg-white/[0.04] flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>تفاصيل المشروع</span>
                    </button>
                    <button onClick={() => { setMoreOpen(false); router.push("/portfolio") }}
                      className="w-full text-right px-3 py-2 text-xs text-white hover:bg-white/[0.04] flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-yellow-400" />
                      <span>محفظتي</span>
                    </button>
                    <button onClick={() => { setMoreOpen(false); selected && router.push(`/exchange?project=${selected.id}`) }}
                      className="w-full text-right px-3 py-2 text-xs text-white hover:bg-white/[0.04] flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-green-400" />
                      <span>اذهب إلى السوق</span>
                    </button>
                    <button
                      onClick={() => {
                        setMoreOpen(false)
                        if (typeof navigator !== "undefined" && navigator.share && selected) {
                          navigator.share({
                            title: `${selected.name} (${sym})`,
                            text: `سعر ${sym}: ${fmtIQD(currentPrice)} د.ع`,
                            url: window.location.href,
                          }).catch(() => undefined)
                        }
                      }}
                      className="w-full text-right px-3 py-2 text-xs text-white hover:bg-white/[0.04] flex items-center gap-2 border-t border-white/[0.04]">
                      <Share2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>مشاركة الرابط</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project picker dropdown */}
          {pickerOpen && (
            <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl mb-3 overflow-hidden shadow-2xl">
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
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-xs text-neutral-500">
                    {projects.length === 0 ? "لا توجد مشاريع نشطة بعد" : "لا توجد نتائج"}
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const price = iqd(p.current_market_price ?? p.share_price)
                    const launch = iqd(p.share_price)
                    const changePct = launch > 0 ? ((price - launch) / launch) * 100 : 0
                    const offering = (p.offering_shares ?? p.available_shares ?? 0)
                    const sold = Math.max(0, offering - (p.available_shares ?? 0))
                    const fundedPct = offering > 0 ? (sold / offering) * 100 : 0
                    return (
                      <MiniRow
                        key={p.id}
                        symbol={symbolOf(p)}
                        name={p.name}
                        logoUrl={p.logo_url ?? null}
                        price={price}
                        changePct={changePct}
                        fundedPct={fundedPct}
                        side={null}
                        onClick={() => {
                          setSelected(p); setPickerOpen(false); setSearch("")
                          router.replace(`/investment?project=${p.id}`)
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* PERIOD TABS */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button onClick={() => setHideMA((v) => !v)} className="flex items-center gap-1 text-[12px] text-neutral-400 hover:text-white transition-colors">
              <ChevronDown className={cn("w-3 h-3 transition-transform", hideMA && "rotate-180")} />
              <span>إخفاء</span>
            </button>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-300">
                <ChevronDown className="w-3 h-3" />
                المزيد
              </button>
              {[...PERIODS].reverse().map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "text-[12px] transition-colors",
                    period === p ? "text-white font-bold" : "text-neutral-500 hover:text-neutral-300",
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* MA */}
          {!hideMA && (chartType === "candles" || chartType === "bars") && (
            <div className="flex items-center gap-3 mb-1 px-1 text-[10px] font-mono">
              <span className="text-yellow-400">MA5:&nbsp;{Number.isFinite(ma5Last) ? fmt1(ma5Last) : "—"}</span>
              <span className="text-purple-400">MA10:&nbsp;{Number.isFinite(ma10Last) ? fmt1(ma10Last) : "—"}</span>
              <span className="text-cyan-400">MA20:&nbsp;{Number.isFinite(ma20Last) ? fmt1(ma20Last) : "—"}</span>
            </div>
          )}

          {/* CHART */}
          <div className="bg-black border border-white/[0.04] rounded-lg overflow-hidden mb-3">
            <MultiChart
              candles={candles}
              type={chartType}
              showMA={!hideMA}
              loading={loadingDeals && candles.length === 0}
              height={360}
            />
          </div>

          {/* MAIN GRID — Container 1 (orders) + Container 2 (projects + form) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* ════ CONTAINER 1 — UNIFIED ORDER LIST ════ */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 order-2 md:order-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold text-neutral-400">طلبات السوق</span>
                <span className="text-[9px] text-neutral-600">{allListings.length} إعلان</span>
              </div>

              {/* Unified mini-row list */}
              <div className="space-y-1">
                {orderRows.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-neutral-600">
                    لا توجد طلبات بيع أو شراء حالياً
                  </div>
                ) : (
                  orderRows.map((l) => {
                    const proj = projectsById.get(l.project_id) ?? null
                    const launch = iqd(proj?.share_price ?? l.project_share_price ?? 0)
                    const changePct = launch > 0 ? ((l.price_per_share - launch) / launch) * 100 : 0
                    const fillPct = l.shares_offered > 0 ? ((l.shares_offered - l.shares_remaining) / l.shares_offered) * 100 : 0
                    return (
                      <MiniRow
                        key={l.id}
                        symbol={symbolOf(proj) || l.project_name.slice(0, 4).toUpperCase()}
                        name={l.project_name}
                        logoUrl={proj?.logo_url ?? null}
                        price={l.price_per_share}
                        changePct={changePct}
                        fundedPct={fillPct}
                        side={l.type as "buy" | "sell"}
                        onClick={() => router.push(`/exchange?project=${l.project_id}`)}
                      />
                    )
                  })
                )}
              </div>

              {/* S / B ratio bar */}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono font-bold">
                <span className="bg-red-500/15 border border-red-500/30 text-red-400 rounded px-1.5 py-0.5">S</span>
                <span className="text-red-400">{sbRatio.s}%</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex">
                  <div className="bg-red-500/40 h-full" style={{ width: `${sbRatio.s}%` }} />
                  <div className="bg-green-500/40 h-full" style={{ width: `${sbRatio.b}%` }} />
                </div>
                <span className="text-green-400">{sbRatio.b}%</span>
                <span className="bg-green-500/15 border border-green-500/30 text-green-400 rounded px-1.5 py-0.5">B</span>
              </div>

              {/* Current price band */}
              <div className="mt-2 py-1.5 px-2 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">سعر السوق الحالي ({sym})</span>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-[10px] font-mono", change24h.up ? "text-green-400" : "text-red-400")}>
                    {change24h.up ? "+" : ""}{change24h.pct.toFixed(2)}%
                  </span>
                  <span className={cn("text-sm font-bold font-mono", change24h.up ? "text-green-400" : "text-red-400")}>
                    {fmtIQD(currentPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* ════ CONTAINER 2 — PROJECTS + COMPACT TRADE FORM ════ */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 order-1 md:order-2 flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold text-neutral-400">المشاريع</span>
                <span className="text-[9px] text-neutral-600">{projects.length} مشروع</span>
              </div>

              {/* Project rows — same MiniRow style. Click switches the chart. */}
              <div className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                {projectRows.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-neutral-600">
                    لا توجد مشاريع نشطة
                  </div>
                ) : (
                  projectRows.map((r) => (
                    <MiniRow
                      key={r.project.id}
                      symbol={r.symbol}
                      name={r.name}
                      logoUrl={r.logoUrl}
                      price={r.price}
                      changePct={r.changePct}
                      fundedPct={r.fundedPct}
                      side={null}
                      onClick={() => {
                        setSelected(r.project)
                        router.replace(`/investment?project=${r.project.id}`)
                      }}
                    />
                  ))
                )}
              </div>

              {/* Compact trade form — pinned at the bottom of the container */}
              <div className="border-t border-white/[0.06] pt-3 mt-auto space-y-2.5">
                {/* Buy/Sell pill */}
                <div className="grid grid-cols-2 gap-1 bg-white/[0.04] rounded-xl p-1">
                  <button
                    onClick={() => setSide("sell")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-bold transition-colors",
                      side === "sell" ? "bg-red-500 text-white" : "text-neutral-400 hover:text-white",
                    )}
                  >
                    بيع
                  </button>
                  <button
                    onClick={() => setSide("buy")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-bold transition-colors",
                      side === "buy" ? "bg-green-500 text-white" : "text-neutral-400 hover:text-white",
                    )}
                  >
                    شراء
                  </button>
                </div>

                {/* Shares + price (side-by-side) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-neutral-500 mb-0.5">عدد الحصص</div>
                    <IntegerInput
                      value={sharesInput}
                      onValueChange={setSharesInput}
                      placeholder="0"
                      className="w-full bg-transparent text-xs font-mono text-white outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-neutral-500 mb-0.5">السعر (د.ع)</div>
                    <IntegerInput
                      value={priceInput}
                      onValueChange={setPriceInput}
                      max={currentPrice > 0 ? currentPrice : null}
                      placeholder={currentPrice > 0 ? fmtIQD(currentPrice) : "—"}
                      className="w-full bg-transparent text-xs font-mono text-white outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Slider */}
                <div className="px-1 py-0.5">
                  <div className="relative h-2">
                    <div className="absolute inset-y-0 inset-x-0 my-auto h-px bg-white/[0.08]" />
                    <div className="absolute inset-y-0 right-0 my-auto h-px bg-yellow-400/60 transition-all" style={{ width: `${pct}%` }} />
                    {[0, 25, 50, 75, 100].map((p) => (
                      <button key={p} onClick={() => handlePctChange(p)}
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all",
                          pct >= p ? "bg-yellow-400 ring-2 ring-yellow-400/30" : "bg-neutral-600 hover:bg-neutral-400",
                        )}
                        style={{ right: `${p}%` }} aria-label={`${p}%`} />
                    ))}
                  </div>
                </div>

                {/* CTA — creates a real listing */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selected || parseIqdInput(sharesInput) < 1}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                    side === "buy"
                      ? "bg-lime-300 text-black hover:bg-lime-200"
                      : "bg-red-500 text-white hover:bg-red-600",
                  )}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting
                    ? "جاري النشر..."
                    : side === "buy"
                      ? `إنشاء طلب شراء ${sym}`
                      : `إنشاء عرض بيع ${sym}`}
                </button>

                {/* Note: the listing also lands in /exchange */}
                <div className="text-[9px] text-neutral-600 text-center">
                  سيظهر طلبك في قائمة الطلبات أعلاه وفي صفحة <span className="text-blue-400">السوق</span> فوراً.
                </div>
              </div>
            </div>
          </div>

          {/* Empty state */}
          {projects.length === 0 && (
            <div className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
              <div className="text-5xl mb-3 opacity-50">📊</div>
              <div className="text-sm text-neutral-300 font-bold mb-1">لا توجد مشاريع نشطة بعد</div>
              <div className="text-[11px] text-neutral-500">سيظهر هنا الرمز فور نشر أول مشروع.</div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
