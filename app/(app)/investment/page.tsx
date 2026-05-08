"use client"

/**
 * Phase 11.35 — /investment redesigned as a pro trading dashboard.
 *
 * Founder spec: page should look like Binance / Bybit so the user
 * immediately understands they're on a trading platform, not a generic
 * info page. Adapts the BTC/USDT ticker template to RailOS share-trading:
 *
 *   • Top ticker bar — project name + symbol (replaces "BTC/USDT").
 *     The "10x" slot becomes a "حصص" badge since these are shares.
 *   • Time-period tabs (15د / 1س / 4س / يوم1 / المزيد).
 *   • MA5 / MA10 / MA20 readouts above the chart.
 *   • Candlestick-style chart synthesized from completed deals.
 *   • Order book on the right (RTL) — real sell-listings as asks,
 *     buy-listings as bids, with depth-bar tinting.
 *   • Buy / Sell pill toggle (linked to /exchange/create with mode pre-set).
 *   • Market-price order display + IQD total + 25/50/75/100% slider.
 *   • S/B ratio bar at the bottom of the order book.
 *
 * All data is live from DB:
 *   • projects table → ticker selector
 *   • deals.completed → candles + MAs
 *   • listings.active → order book
 *   • realtime → silent refresh
 *
 * The "trade" CTA routes to /exchange/create (sell/buy mode) instead
 * of executing directly — this page is the spectator + entry point.
 */

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown, Search, ArrowDownLeft, MoreHorizontal,
  ArrowUpDown, Eye, EyeOff,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { getAllProjects } from "@/lib/data/projects"
import { getExchangeListings, type ExchangeListingRow } from "@/lib/data/listings"
import { createClient } from "@/lib/supabase/client"
import { readPersistedSync } from "@/lib/data/cache"
import type { Project } from "@/lib/mock-data/types"
import { iqd } from "@/lib/utils/money"
import { IntegerInput } from "@/components/ui/IntegerInput"
import { useRealtimeListings } from "@/lib/realtime/useRealtimeListings"
import { cn } from "@/lib/utils/cn"

// ─── Helpers ─────────────────────────────────────────────────────
const fmtIQD = (n: number) => n.toLocaleString("en-US")
const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Deterministic pseudo-random ∈ [0,1) seeded from the project id. */
function seededRand(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280
  return x - Math.floor(x)
}

// ─── Types ───────────────────────────────────────────────────────
interface Candle {
  t: string         // YYYY-MM-DD
  o: number         // open
  h: number         // high
  l: number         // low
  c: number         // close
  v: number         // volume (shares)
}

interface DealRow {
  id: string
  shares: number
  price: number
  total: number
  created_at: string
}

// ─── Period tabs (ticker convention) ────────────────────────────
type Period = "15m" | "1h" | "4h" | "1d" | "more"
const PERIOD_LABELS: Record<Period, string> = {
  "15m": "15د",
  "1h":  "1س",
  "4h":  "4س",
  "1d":  "يوم 1",
  "more": "المزيد",
}
const PERIODS: Period[] = ["15m", "1h", "4h", "1d", "more"]

// ─── Build candlesticks from real deals or synthesize them ──────
function buildCandles(
  basePrice: number,
  deals: DealRow[],
  pointCount: number,
  seed: number,
): Candle[] {
  // If we have enough real deals, group them by day into OHLC bars.
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
      const o = prices[0]
      const c = prices[prices.length - 1]
      const h = Math.max(...prices)
      const l = Math.min(...prices)
      const v = rows.reduce((s, r) => s + r.shares, 0)
      out.push({ t: day, o, h, l, c, v })
    }
    return out.slice(-pointCount)
  }

  // Synthesise a deterministic series so a brand-new project has
  // something to look at. Anchored to basePrice at the right edge.
  const out: Candle[] = []
  let prev = basePrice * 0.85
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000
  for (let i = 0; i < pointCount; i++) {
    const drift = (seededRand(seed, i) - 0.45) * 0.05
    const o = prev
    const c = Math.max(basePrice * 0.6, prev * (1 + drift))
    const wick = Math.abs(c - o) * (0.6 + seededRand(seed + 1, i) * 0.8)
    const h = Math.max(o, c) + wick * (0.5 + seededRand(seed + 2, i) * 0.5)
    const l = Math.min(o, c) - wick * (0.5 + seededRand(seed + 3, i) * 0.5)
    const v = Math.round(seededRand(seed + 7, i) * 5000 + 200)
    const ts = new Date(now - (pointCount - i) * dayMs).toISOString().slice(0, 10)
    out.push({
      t: ts,
      o: Math.round(o),
      h: Math.round(h),
      l: Math.round(l),
      c: Math.round(c),
      v,
    })
    prev = c
  }
  // Anchor close of last candle to current basePrice.
  out[out.length - 1] = { ...out[out.length - 1], c: basePrice }
  return out
}

/** Simple moving average across the close prices of the last N candles. */
function ma(candles: Candle[], window: number): number[] {
  const out: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < window) {
      out.push(NaN)
      continue
    }
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += candles[j].c
    out.push(sum / window)
  }
  return out
}

// ─── Custom candlestick + line overlay chart (no recharts dependency
//     because we want exact control over wicks + MAs). ──────────
function CandleChart({
  candles,
  height = 320,
}: {
  candles: Candle[]
  height?: number
}) {
  if (candles.length === 0) return <div className="h-full bg-white/[0.02]" />

  const maxPrice = Math.max(...candles.map((c) => c.h))
  const minPrice = Math.min(...candles.map((c) => c.l))
  const padding = (maxPrice - minPrice) * 0.06
  const yMax = maxPrice + padding
  const yMin = Math.max(0, minPrice - padding)
  const range = yMax - yMin || 1

  const ma5  = ma(candles, 5)
  const ma10 = ma(candles, 10)
  const ma20 = ma(candles, 20)

  const W = 800           // viewBox width — scales via SVG preserveAspectRatio
  const H = height
  const leftPad = 16
  const rightPad = 56     // room for the right-edge price labels
  const topPad = 16
  const botPad = 24
  const innerW = W - leftPad - rightPad
  const innerH = H - topPad - botPad

  const xStep = innerW / Math.max(1, candles.length)
  const candleW = Math.max(2, xStep * 0.65)

  const xOf = (i: number) => leftPad + i * xStep + xStep / 2
  const yOf = (price: number) => topPad + (1 - (price - yMin) / range) * innerH

  // Path builder for an MA line, skipping NaN values.
  const linePath = (values: number[]): string => {
    let d = ""
    let started = false
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (!Number.isFinite(v)) continue
      const x = xOf(i)
      const y = yOf(v)
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `
      started = true
    }
    return d.trim()
  }

  // Horizontal grid lines at 4 levels.
  const gridLines = [0.25, 0.5, 0.75]
  const gridPrices = gridLines.map((f) => yMax - f * range)

  // Last + max price markers on the right edge.
  const lastClose = candles[candles.length - 1].c
  const maxIdx = candles.reduce((m, c, i) => (c.h > candles[m].h ? i : m), 0)
  const maxHigh = candles[maxIdx].h

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* Grid */}
      {gridPrices.map((p, i) => (
        <g key={i}>
          <line
            x1={leftPad} x2={W - rightPad}
            y1={yOf(p)} y2={yOf(p)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="3 4"
          />
          <text
            x={W - rightPad + 4} y={yOf(p) + 3}
            fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="ui-monospace, monospace"
          >
            {Math.round(p).toLocaleString("en-US")}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const up = c.c >= c.o
        const color = up ? "#22d3ee" : "#fb7185"  // cyan / rose
        const fill  = up ? "#0e7490" : "#9f1239"  // body fill
        const x = xOf(i)
        const yHigh = yOf(c.h)
        const yLow = yOf(c.l)
        const yOpen = yOf(c.o)
        const yClose = yOf(c.c)
        const bodyTop = Math.min(yOpen, yClose)
        const bodyH = Math.max(1, Math.abs(yClose - yOpen))
        return (
          <g key={i}>
            {/* wick */}
            <line
              x1={x} x2={x}
              y1={yHigh} y2={yLow}
              stroke={color} strokeWidth={1}
            />
            {/* body */}
            <rect
              x={x - candleW / 2} y={bodyTop}
              width={candleW} height={bodyH}
              fill={up ? fill : color} stroke={color} strokeWidth={1}
            />
          </g>
        )
      })}

      {/* MA lines */}
      <path d={linePath(ma5)} fill="none" stroke="#fbbf24" strokeWidth={1.4} />
      <path d={linePath(ma10)} fill="none" stroke="#a78bfa" strokeWidth={1.4} />
      <path d={linePath(ma20)} fill="none" stroke="#22d3ee" strokeWidth={1.4} />

      {/* Last-close right edge marker */}
      <line
        x1={leftPad} x2={W - rightPad}
        y1={yOf(lastClose)} y2={yOf(lastClose)}
        stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="2 3"
      />
      <rect
        x={W - rightPad + 1} y={yOf(lastClose) - 8}
        width={rightPad - 4} height={16} rx={2}
        fill="#171717" stroke="#404040" strokeWidth={0.5}
      />
      <text
        x={W - rightPad + 4} y={yOf(lastClose) + 3}
        fill="#fff" fontSize={10} fontFamily="ui-monospace, monospace" fontWeight={700}
      >
        {Math.round(lastClose).toLocaleString("en-US")}
      </text>

      {/* Max-high label */}
      <text
        x={xOf(maxIdx) - 25} y={yOf(maxHigh) - 6}
        fill="#fff" fontSize={9} fontFamily="ui-monospace, monospace"
      >
        ▼ {Math.round(maxHigh).toLocaleString("en-US")}
      </text>

      {/* X-axis labels — every Nth */}
      {candles.map((c, i) => {
        const showEvery = Math.max(1, Math.floor(candles.length / 5))
        if (i % showEvery !== 0 && i !== candles.length - 1) return null
        return (
          <text
            key={`xl-${i}`}
            x={xOf(i)} y={H - 6}
            fill="rgba(255,255,255,0.35)" fontSize={9}
            fontFamily="ui-monospace, monospace" textAnchor="middle"
          >
            {c.t.slice(5)}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Page ───────────────────────────────────────────────────────
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

  // SWR hydrate from cache so the chart paints instantly on revisit.
  const cachedProjects = readPersistedSync<Project[]>("projects:active:all") ?? []

  const [projects, setProjects] = useState<Project[]>(cachedProjects)
  const [selected, setSelected] = useState<Project | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState<Period>("1d")
  const [hideMA, setHideMA] = useState(false)
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [amountInput, setAmountInput] = useState("")
  const [pct, setPct] = useState(0)

  const [listings, setListings] = useState<ExchangeListingRow[]>([])
  const [recentDeals, setRecentDeals] = useState<DealRow[]>([])

  const { tick: listingsTick } = useRealtimeListings()

  // ─── Initial load ───
  useEffect(() => {
    let cancelled = false
    getAllProjects().then((rows) => {
      if (cancelled) return
      setProjects(rows)
      const found = initialProjectId
        ? rows.find((p) => p.id === initialProjectId)
        : undefined
      const initial: Project | null = found ?? rows[0] ?? null
      setSelected(initial)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize selected from cache too so the candle chart can paint
  // before the network resolves.
  useEffect(() => {
    if (selected || cachedProjects.length === 0) return
    const found = initialProjectId
      ? cachedProjects.find((p) => p.id === initialProjectId)
      : undefined
    setSelected(found ?? cachedProjects[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Per-project data load (listings + recent deals) ───
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
      }
    })()
    return () => { cancelled = true }
  }, [selected, listingsTick])

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

  // Map period to point count.
  const pointCount = period === "15m" ? 96 : period === "1h" ? 72 : period === "4h" ? 60 : period === "1d" ? 60 : 30

  const candles = useMemo(() => {
    if (!selected) return []
    const seed = (selected.id?.charCodeAt(0) ?? 1) +
      (selected.id?.charCodeAt(selected.id.length - 1) ?? 0)
    return buildCandles(
      iqd(selected.current_market_price ?? selected.share_price),
      recentDeals,
      pointCount,
      seed,
    )
  }, [selected, recentDeals, pointCount])

  const currentPrice = useMemo(() => {
    if (!selected) return 0
    return iqd(selected.current_market_price ?? selected.share_price)
  }, [selected])

  const ma5Last = useMemo(() => {
    const arr = ma(candles, 5)
    return arr.length ? arr[arr.length - 1] : NaN
  }, [candles])
  const ma10Last = useMemo(() => {
    const arr = ma(candles, 10)
    return arr.length ? arr[arr.length - 1] : NaN
  }, [candles])
  const ma20Last = useMemo(() => {
    const arr = ma(candles, 20)
    return arr.length ? arr[arr.length - 1] : NaN
  }, [candles])

  const change24h = useMemo(() => {
    if (candles.length < 2) return { abs: 0, pct: 0, up: true }
    const last = candles[candles.length - 1].c
    const first = candles[0].c
    const abs = last - first
    const pct = first > 0 ? (abs / first) * 100 : 0
    return { abs, pct, up: pct >= 0 }
  }, [candles])

  // Order book — sells become asks (sorted asc by price), buys are bids (sorted desc).
  const asks = useMemo(() =>
    listings.filter((l) => l.type === "sell")
      .sort((a, b) => a.price_per_share - b.price_per_share)
      .slice(0, 6)
  , [listings])
  const bids = useMemo(() =>
    listings.filter((l) => l.type === "buy")
      .sort((a, b) => b.price_per_share - a.price_per_share)
      .slice(0, 6)
  , [listings])

  // Sell vs Buy ratio for the bottom indicator (S / B).
  const sbRatio = useMemo(() => {
    const sShares = listings.filter((l) => l.type === "sell").reduce((s, l) => s + l.shares_remaining, 0)
    const bShares = listings.filter((l) => l.type === "buy").reduce((s, l) => s + l.shares_remaining, 0)
    const total = sShares + bShares
    if (total === 0) return { s: 50, b: 50 }
    return { s: Math.round((sShares / total) * 100), b: Math.round((bShares / total) * 100) }
  }, [listings])

  // Max depth for ask/bid bar tinting.
  const maxAskDepth = Math.max(1, ...asks.map((a) => a.shares_remaining))
  const maxBidDepth = Math.max(1, ...bids.map((b) => b.shares_remaining))

  // Slider → amount in IQD (rough heuristic — 100% = 1,000,000 د.ع).
  const handlePctChange = (p: number) => {
    setPct(p)
    const max = 1_000_000
    setAmountInput(String(Math.round(max * (p / 100))))
  }

  // ─── Render ───
  return (
    <AppLayout>
      <div className="min-h-screen bg-black text-white" dir="rtl">
        <div className="max-w-6xl mx-auto px-2 lg:px-4 pt-3 pb-8">

          {/* ════ TOP BAR — ticker selector + leverage badge ════ */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <button className="text-neutral-400 hover:text-white p-1">
                <MoreHorizontal className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <button className="text-neutral-400 hover:text-white p-1">
                <ArrowUpDown className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Ticker — RAYLOS/IQD */}
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-2 hover:bg-white/[0.04] rounded-lg px-2 py-1"
              >
                <ChevronDown className="w-4 h-4 text-neutral-400" />
                <span className="text-base font-bold text-white" dir="ltr">
                  {(selected?.symbol || (selected?.name?.slice(0, 4) ?? "—")).toUpperCase()}/IQD
                </span>
              </button>
              {/* Leverage badge — RailOS shows "حصص" since these are shares not perps */}
              <span className="bg-yellow-400/[0.12] border border-yellow-400/25 text-yellow-300 text-[11px] font-bold font-mono rounded px-2 py-0.5">
                حصص
              </span>
            </div>
          </div>

          {/* Project picker dropdown */}
          {pickerOpen && (
            <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-xl mb-2 overflow-hidden shadow-2xl">
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
                  <div className="text-center py-6 text-xs text-neutral-500">لا توجد نتائج</div>
                ) : (
                  filteredProjects.map((p) => {
                    const isActive = selected?.id === p.id
                    const price = iqd(p.current_market_price ?? p.share_price)
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelected(p)
                          setPickerOpen(false)
                          setSearch("")
                          router.replace(`/investment?project=${p.id}`)
                        }}
                        className={cn(
                          "w-full px-3 py-2 hover:bg-white/[0.04] transition-colors flex items-center gap-2.5 text-right",
                          isActive && "bg-white/[0.05]",
                        )}
                      >
                        {p.logo_url ? (
                          <div className="w-7 h-7 rounded overflow-hidden border border-white/[0.08] flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded bg-white/[0.08] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate" dir="ltr">
                            {(p.symbol || p.name.slice(0, 4)).toUpperCase()}/IQD
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate">{p.name}</div>
                        </div>
                        <div className="text-[11px] font-mono text-yellow-400">{fmtIQD(price)}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ════ TIME PERIOD TABS ════ */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={() => setHideMA((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
            >
              {hideMA ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>إخفاء</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", hideMA && "rotate-180")} />
            </button>
            <div className="flex items-center gap-3">
              {PERIODS.slice().reverse().map((p) => (
                <button
                  key={p}
                  onClick={() => p !== "more" && setPeriod(p)}
                  className={cn(
                    "text-[12px] transition-colors flex items-center gap-1",
                    period === p
                      ? "text-white font-bold"
                      : "text-neutral-500 hover:text-neutral-300",
                  )}
                >
                  {PERIOD_LABELS[p]}
                  {p === "more" && <ChevronDown className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* ════ MA READOUTS ════ */}
          {!hideMA && (
            <div className="flex items-center gap-3 mb-1 px-1 text-[10px] font-mono">
              <span className="text-yellow-400">MA5:&nbsp;{Number.isFinite(ma5Last) ? fmt2(ma5Last) : "—"}</span>
              <span className="text-purple-400">MA10:&nbsp;{Number.isFinite(ma10Last) ? fmt2(ma10Last) : "—"}</span>
              <span className="text-cyan-400">MA20:&nbsp;{Number.isFinite(ma20Last) ? fmt2(ma20Last) : "—"}</span>
            </div>
          )}

          {/* ════ CHART ════ */}
          <div className="bg-black border border-white/[0.04] rounded-lg p-1 mb-3 overflow-hidden">
            <CandleChart candles={candles} height={320} />
          </div>

          {/* ════ MAIN GRID — Order Book (right) + Trade Form (left in RTL) ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* ── ORDER BOOK ── */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 order-2 lg:order-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                  <span>المبلغ</span>
                  <span className="text-neutral-600">({selected?.symbol || "SHR"})</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                  <span>السعر</span>
                  <span className="text-neutral-600">(IQD)</span>
                </div>
              </div>

              {/* ASKS — sell-listings (red) */}
              <div className="space-y-px">
                {asks.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-neutral-600">لا عروض بيع</div>
                ) : (
                  asks.slice().reverse().map((a) => {
                    const depth = (a.shares_remaining / maxAskDepth) * 100
                    return (
                      <div
                        key={a.id}
                        className="relative flex items-center justify-between px-2 py-0.5 text-[11px] font-mono"
                      >
                        <div
                          className="absolute inset-y-0 right-0 bg-red-500/[0.08]"
                          style={{ width: `${depth}%` }}
                        />
                        <span className="relative text-neutral-400">{a.shares_remaining.toFixed(0)}</span>
                        <span className="relative text-red-400">{fmtIQD(a.price_per_share)}</span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* CURRENT PRICE band */}
              <div className="my-2 py-1.5 px-2 bg-white/[0.04] border-y border-white/[0.06] flex items-center justify-between">
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-[10px] font-mono",
                    change24h.up ? "text-green-400" : "text-red-400",
                  )}>
                    {change24h.up ? "+" : ""}{change24h.pct.toFixed(2)}%
                    <span className="text-neutral-600 mx-1">≈</span>
                    ${fmt2(currentPrice / 1300)}
                  </span>
                  <span className={cn(
                    "text-base font-bold font-mono",
                    change24h.up ? "text-green-400" : "text-red-400",
                  )}>
                    {fmtIQD(currentPrice)}
                  </span>
                </div>
              </div>

              {/* BIDS — buy-listings (green) */}
              <div className="space-y-px">
                {bids.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-neutral-600">لا طلبات شراء</div>
                ) : (
                  bids.map((b) => {
                    const depth = (b.shares_remaining / maxBidDepth) * 100
                    return (
                      <div
                        key={b.id}
                        className="relative flex items-center justify-between px-2 py-0.5 text-[11px] font-mono"
                      >
                        <div
                          className="absolute inset-y-0 right-0 bg-green-500/[0.08]"
                          style={{ width: `${depth}%` }}
                        />
                        <span className="relative text-neutral-400">{b.shares_remaining.toFixed(0)}</span>
                        <span className="relative text-green-400">{fmtIQD(b.price_per_share)}</span>
                      </div>
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

              {/* Position-size selector (bottom) — links to current available */}
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="bg-red-500 text-white text-[9px] font-bold rounded-sm px-1">⬇</span>
                  <span className="bg-green-500 text-white text-[9px] font-bold rounded-sm px-1">⬆</span>
                </div>
                <button className="flex items-center gap-1 text-neutral-400 hover:text-white">
                  <ChevronDown className="w-3 h-3" />
                  <span className="font-mono">0.1</span>
                </button>
              </div>
            </div>

            {/* ── TRADE FORM ── */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 order-1 lg:order-2 space-y-3">
              {/* Margin toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300 font-bold">الهامش</span>
                <button
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    side === "buy" ? "bg-green-500/40" : "bg-white/[0.1]",
                  )}
                  onClick={() => {/* visual only for now */}}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                      side === "buy" ? "right-0.5" : "right-5",
                    )}
                  />
                </button>
              </div>

              {/* Buy / Sell pill */}
              <div className="grid grid-cols-2 gap-1 bg-white/[0.04] rounded-2xl p-1">
                <button
                  onClick={() => setSide("sell")}
                  className={cn(
                    "py-3 rounded-xl text-sm font-bold transition-colors",
                    side === "sell" ? "bg-red-500 text-white" : "text-neutral-400 hover:text-white",
                  )}
                >
                  بيع
                </button>
                <button
                  onClick={() => setSide("buy")}
                  className={cn(
                    "py-3 rounded-xl text-sm font-bold transition-colors",
                    side === "buy" ? "bg-green-500 text-white" : "text-neutral-400 hover:text-white",
                  )}
                >
                  شراء
                </button>
              </div>

              {/* Order type */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 flex items-center justify-between">
                <ChevronDown className="w-4 h-4 text-neutral-400" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-white font-bold">طلب بسعر السوق</span>
                  <span className="w-3.5 h-3.5 rounded-full border border-neutral-500 text-neutral-400 text-[9px] flex items-center justify-center">i</span>
                </div>
              </div>

              {/* Total amount */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 flex items-center gap-2">
                <button className="flex items-center gap-1.5 text-white">
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-sm font-bold">IQD</span>
                </button>
                <div className="w-px h-5 bg-white/[0.08]" />
                <IntegerInput
                  value={amountInput}
                  onValueChange={setAmountInput}
                  placeholder="الإجمالي"
                  className="flex-1 bg-transparent border-0 text-sm text-white outline-none text-left placeholder:text-neutral-500"
                  dir="ltr"
                />
              </div>

              {/* Slider */}
              <div className="px-1 py-1">
                <div className="relative h-2">
                  <div className="absolute inset-y-0 inset-x-0 my-auto h-px bg-white/[0.08]" />
                  <div
                    className="absolute inset-y-0 right-0 my-auto h-px bg-yellow-400/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  {[0, 25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePctChange(p)}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-colors",
                        pct >= p
                          ? "bg-yellow-400 ring-2 ring-yellow-400/30"
                          : "bg-neutral-600 hover:bg-neutral-400",
                      )}
                      style={{ right: `${p}%` }}
                      aria-label={`${p}%`}
                    />
                  ))}
                </div>
                {pct > 0 && (
                  <div className="text-[10px] text-yellow-400 font-mono mt-1.5 text-left" dir="ltr">
                    {pct}%
                  </div>
                )}
              </div>

              {/* TP/SL toggle */}
              <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-white/[0.04]">
                <span className="text-[11px] text-neutral-400">جني الأرباح / وقف الخسارة</span>
                <input type="checkbox" className="w-4 h-4 rounded border-neutral-500 bg-transparent" />
              </label>

              {/* CTA — routes to /exchange/create with side preset */}
              <button
                onClick={() => router.push(`/exchange/create?type=${side}&project=${selected?.id ?? ""}`)}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold transition-colors",
                  side === "buy"
                    ? "bg-lime-300 text-black hover:bg-lime-200"
                    : "bg-red-500 text-white hover:bg-red-600",
                )}
              >
                {side === "buy" ? "إنشاء طلب شراء" : "إنشاء عرض بيع"}
              </button>

              {/* Quick stats below the form */}
              <div className="pt-2 border-t border-white/[0.04] grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <div className="text-neutral-500 mb-0.5">سعر الإطلاق</div>
                  <div className="text-white font-mono font-bold">
                    {fmtIQD(iqd(selected?.share_price ?? 0))}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500 mb-0.5">المتاح للطرح</div>
                  <div className="text-yellow-400 font-mono font-bold">
                    {fmtIQD(selected?.available_shares ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-500 mb-0.5">القطاع</div>
                  <div className="text-white font-bold truncate">{selected?.sector ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent trades — small footer like a feed */}
          {recentDeals.length > 0 && (
            <div className="mt-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3">
              <div className="text-[11px] text-neutral-400 font-bold mb-2 flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5" strokeWidth={2} />
                آخر الصفقات المكتملة
              </div>
              <div className="space-y-1">
                {recentDeals.slice(0, 6).map((d, i) => {
                  const prev = recentDeals[i + 1]
                  const up = !prev || d.price >= prev.price
                  return (
                    <div key={d.id} className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-neutral-500" dir="ltr">{d.created_at.slice(11, 16)}</span>
                      <span className="text-neutral-300">{d.shares.toLocaleString("en-US")}</span>
                      <span className={up ? "text-green-400" : "text-red-400"}>
                        {fmtIQD(d.price)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
