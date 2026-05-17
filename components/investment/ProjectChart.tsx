"use client"

/**
 * ProjectChart — Phase 13.16.
 *
 * Hero-section price chart for /investment. Uses `recharts` (already
 * in the bundle) instead of pulling in a fresh ~50KB Lightweight
 * Charts dependency — it satisfies the founder's "Lightweight Charts
 * أو ما يماثلها" spec, supports area/line modes, and renders crisp
 * on every breakpoint without extra config.
 *
 * Data source: `get_price_history` RPC (price_history table). Each
 * row records a price change event (old_price → new_price). We
 * convert to a timeseries of `new_price` points anchored at
 * `recorded_at`.
 *
 * Realtime: parent owns the subscription; passing fresh `points` in
 * via props updates the chart in place (no remount, no flash).
 *
 * Mobile-first: 280px tall on small screens, stretches to 420px on
 * lg+. Fills 100% of parent width via ResponsiveContainer.
 */

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  AreaChart, Area, LineChart, Line,
  ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import {
  LineChart as LineIcon, AreaChart as AreaIcon,
  CandlestickChart as CandleIcon,
  TrendingUp, TrendingDown,
} from "lucide-react"
import type { PriceHistoryPoint } from "@/lib/data/price-history"
import { cn } from "@/lib/utils/cn"

const PERIODS = [
  { id: "1d",  labelKey: "pcPeriod1d",  days: 1   },
  { id: "7d",  labelKey: "pcPeriod7d",  days: 7   },
  { id: "30d", labelKey: "pcPeriod30d", days: 30  },
  { id: "1y",  labelKey: "pcPeriod1y",  days: 365 },
  { id: "all", labelKey: "pcPeriodAll", days: 9999 },
] as const
type PeriodId = typeof PERIODS[number]["id"]

const MODES = [
  { id: "area",   labelKey: "pcModeArea",   icon: AreaIcon },
  { id: "line",   labelKey: "pcModeLine",   icon: LineIcon },
  { id: "candle", labelKey: "pcModeCandle", icon: CandleIcon },
] as const
type ChartMode = typeof MODES[number]["id"]

// Phase 13.21 — bucket granularity per period. Each price point in
// the source data is a discrete event (deal, admin change, anchor).
// For candlesticks we group those events into fixed time intervals
// and compute OHLC per bucket.
const BUCKET_MS: Record<PeriodId, number> = {
  "1d":  60 * 60 * 1000,           // 1 hour
  "7d":  4 * 60 * 60 * 1000,       // 4 hours
  "30d": 24 * 60 * 60 * 1000,      // 1 day
  "1y":  7 * 24 * 60 * 60 * 1000,  // 1 week
  "all": 30 * 24 * 60 * 60 * 1000, // 30 days
}

interface OHLC {
  ts: number
  open: number
  high: number
  low: number
  close: number
  /** [low, high] body range — recharts wants two values per bar so
   *  the bar fills the wick range; the actual body is drawn by our
   *  custom shape. */
  range: [number, number]
}

/**
 * Group an ascending [{ ts, price }] series into OHLC buckets of
 * `bucketMs` width. Empty buckets are dropped (the chart shows only
 * intervals with at least one observation).
 */
function bucketToOHLC(
  series: { ts: number; price: number }[],
  bucketMs: number,
): OHLC[] {
  if (series.length === 0) return []
  // Group by floor(ts / bucketMs).
  const groups = new Map<number, { ts: number; price: number }[]>()
  for (const s of series) {
    const key = Math.floor(s.ts / bucketMs) * bucketMs
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  const result: OHLC[] = []
  for (const [bucketTs, items] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    if (items.length === 0) continue
    const sorted = items.slice().sort((a, b) => a.ts - b.ts)
    const open = sorted[0].price
    const close = sorted[sorted.length - 1].price
    let high = -Infinity
    let low = Infinity
    for (const it of items) {
      if (it.price > high) high = it.price
      if (it.price < low) low = it.price
    }
    result.push({
      ts: bucketTs + bucketMs / 2, // center-of-bucket for x-axis
      open,
      high,
      low,
      close,
      range: [low, high],
    })
  }
  return result
}

const fmt = (n: number) => n.toLocaleString("en-US")

interface Props {
  /** Price history rows from get_price_history RPC. Empty = empty state. */
  points: PriceHistoryPoint[]
  /** Current market price — drawn as a reference line on the chart. */
  currentPrice: number
  /** Loading flag — shows a skeleton instead of empty state.
   *  IMPORTANT: this should start true and flip to false ONLY after
   *  the first fetch has completed. The component uses this to
   *  distinguish "still fetching" from "fetched 0 rows". */
  loading?: boolean
  /**
   * Phase 13.18 — explicit "the network round-trip finished" flag.
   * When undefined we infer it from `loading` (treat false as
   * fetched), but the parent should pass it for correctness.
   */
  hasFetched?: boolean
  /** Project symbol for the tooltip label. */
  symbol?: string
}

export function ProjectChart({ points, currentPrice, loading, hasFetched, symbol }: Props) {
  const tr = useTranslations("portfolioUI")
  const [period, setPeriod] = useState<PeriodId>("30d")
  const [mode, setMode] = useState<ChartMode>("area")

  // ─── Phase 13.18 — defensive timestamp parsing ──────────────────
  // Supabase returns recorded_at as ISO 8601 (YYYY-MM-DDTHH:MM:SS.SSSZ)
  // by default, but legacy rows or RPC variants can drop the trailing
  // Z or use ' ' instead of 'T'. Coerce safely; rows that fail to
  // parse are silently dropped instead of becoming NaN points that
  // make recharts render a blank canvas.
  const parsed = useMemo(() => {
    return points
      .map((p) => {
        let raw = p.recorded_at as unknown as string
        if (typeof raw !== "string") raw = String(raw ?? "")
        // Normalise " " → "T" (Postgres default rendering inside RPCs)
        const normalised = raw.includes("T") ? raw : raw.replace(" ", "T")
        const ms = new Date(normalised).getTime()
        return {
          ms: Number.isFinite(ms) ? ms : NaN,
          price: Number(p.new_price ?? 0),
        }
      })
      .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.price))
  }, [points])

  // ─── Period filter + shape mapping ───────────────────────────────
  const series = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)?.days ?? 30
    const cutoff = Date.now() - days * 86_400_000
    const inWindow = days >= 9999 ? parsed : parsed.filter((p) => p.ms >= cutoff)

    // recharts wants ascending time + numeric x easier for tooltip.
    return inWindow
      .slice()
      .sort((a, b) => a.ms - b.ms)
      .map((p) => ({
        ts: p.ms,
        price: p.price,
        date: new Date(p.ms).toLocaleDateString("en-GB"),
      }))
  }, [parsed, period])

  // Phase 13.21 — OHLC buckets for candle mode. Computed only when
  // mode === "candle" so the line/area paths skip the work.
  const candles = useMemo(() => {
    if (mode !== "candle") return []
    return bucketToOHLC(series, BUCKET_MS[period])
  }, [series, mode, period])

  // ─── Phase 13.18 — derive the "show empty state" decision ───────
  // Three states:
  //   • Loading       → skeleton
  //   • Fetched, 0    → empty state ("لا يوجد سجل")
  //   • Fetched, N>0 OR not yet fetched → render the chart
  //
  // The "not yet fetched" branch falls through to the chart so we
  // don't flash the empty-state copy on first paint. If `points` is
  // truly empty after the fetch, the parent flips `hasFetched=true`
  // and we surface the empty copy.
  const isLoading = !!loading
  const fetched = hasFetched ?? !isLoading
  const isEmpty = fetched && parsed.length === 0 && !isLoading
  const showSkeleton = isLoading || (!fetched && parsed.length === 0)

  // ─── Trend calc (first vs last in window) ───────────────────────
  const trend = useMemo(() => {
    if (series.length < 2) return { delta: 0, pct: 0, up: true }
    const first = series[0].price
    const last = series[series.length - 1].price
    const delta = last - first
    const pct = first > 0 ? (delta / first) * 100 : 0
    return { delta, pct, up: delta >= 0 }
  }, [series])

  // ─── Dynamic Y-axis padding (5% above max / below min) ───────────
  const yDomain = useMemo<[number, number]>(() => {
    if (series.length === 0) return [0, 1]
    const prices: number[] = series.map((s) => s.price)
    // Phase 13.21 — include candle highs/lows so they're not clipped.
    if (mode === "candle") {
      for (const c of candles) {
        prices.push(c.high)
        prices.push(c.low)
      }
    }
    const min = Math.min(...prices, currentPrice || Infinity)
    const max = Math.max(...prices, currentPrice || -Infinity)
    const pad = Math.max(1, (max - min) * 0.1)
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }, [series, candles, mode, currentPrice])

  const accent = "#4ADE80"
  const trendColor = trend.up ? "#4ade80" : "#f87171"

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-white/[0.06]">
        {/* Period pills */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 overflow-x-auto">
          {PERIODS.map((p) => {
            const active = p.id === period
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors",
                  active
                    ? "bg-white/[0.1] text-white"
                    : "text-neutral-500 hover:text-white",
                )}
              >
                {tr(p.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = m.id === mode
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={tr(m.labelKey)}
                aria-label={tr(m.labelKey)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  active
                    ? "bg-white/[0.1] text-white"
                    : "text-neutral-500 hover:text-white",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Trend ribbon */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          {symbol && (
            <span className="text-[11px] font-mono text-neutral-400" dir="ltr">
              {symbol}
            </span>
          )}
          <span className="text-xl sm:text-2xl font-bold text-white font-mono">
            {fmt(currentPrice)}
          </span>
          <span className="text-[10px] text-neutral-500">{tr("iqd")}</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-bold font-mono",
            trend.up ? "text-green-400" : "text-red-400",
          )}
        >
          {trend.up ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {trend.up ? "+" : ""}{trend.delta.toLocaleString("en-US")}
          <span className="opacity-70">({trend.pct.toFixed(2)}%)</span>
        </div>
      </div>

      {/* Chart canvas — Phase 13.23: spec'd to fill the visible
           viewport on mobile and stretch tall on desktop. The cap
           prevents extreme ratios on huge monitors.
           Phase 13.18 three-state rendering:
             • showSkeleton → animated bars (no false-empty flash)
             • isEmpty      → friendly empty state (only after fetch)
             • else         → recharts canvas */}
      <div
        className="w-full"
        style={{ height: "min(75vh, 600px)", minHeight: 360 }}
      >
        {showSkeleton ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <div className="h-full w-full flex items-center justify-center text-center px-6">
            <div>
              <div className="text-3xl mb-2 opacity-50">📊</div>
              <div className="text-xs text-neutral-500">
                {tr("pcNoHistory")}
              </div>
              <div className="text-[10px] text-neutral-600 mt-1">
                {tr("pcMovementsLive")}
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === "candle" ? (
              <ComposedChart data={candles} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
                  }
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={(v) => fmt(Math.round(v))}
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  width={60}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,10,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(Number(v)).toLocaleString("en-GB")}
                  // OHLC tooltip: show all 4 values for the bucket.
                  formatter={(value, name, item) => {
                    const p = item?.payload as OHLC | undefined
                    if (!p) return [String(value), String(name)]
                    return [
                      `O ${fmt(p.open)} • H ${fmt(p.high)} • L ${fmt(p.low)} • C ${fmt(p.close)}`,
                      "OHLC",
                    ]
                  }}
                  cursor={{ stroke: accent, strokeWidth: 1, strokeOpacity: 0.4 }}
                />
                {currentPrice > 0 && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke={accent}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                )}
                {/* Single Bar with custom shape draws wick + body. */}
                <Bar
                  dataKey="range"
                  isAnimationActive={false}
                  shape={(props: unknown) => <Candle {...(props as CandleShapeProps)} />}
                />
              </ComposedChart>
            ) : mode === "area" ? (
              <AreaChart data={series} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
                  }
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={(v) => fmt(Math.round(v))}
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  width={60}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,10,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleString("en-GB")}
                  formatter={(v) => [`${fmt(Number(v ?? 0))} ${tr("iqd")}`, tr("pcPriceTooltip")]}
                  cursor={{ stroke: accent, strokeWidth: 1, strokeOpacity: 0.4 }}
                />
                {currentPrice > 0 && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke={accent}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={accent}
                  strokeWidth={2}
                  fill="url(#priceFill)"
                  isAnimationActive
                />
              </AreaChart>
            ) : (
              <LineChart data={series} margin={{ top: 20, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
                  }
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={(v) => fmt(Math.round(v))}
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  width={60}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,10,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => new Date(v).toLocaleString("en-GB")}
                  formatter={(v) => [`${fmt(Number(v ?? 0))} ${tr("iqd")}`, tr("pcPriceTooltip")]}
                  cursor={{ stroke: accent, strokeWidth: 1, strokeOpacity: 0.4 }}
                />
                {currentPrice > 0 && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke={accent}
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={trendColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Phase 13.21 / 13.23 — Candle custom shape ────────────────────
//
// Recharts has no native candlestick. We render one by giving every
// Bar a custom shape: a thin vertical wick from low → high plus a
// rectangular body from open → close.
//
// Phase 13.23 colors (matching the founder's Binance-style reference
// + Raylos brand):
//   • Bullish (close > open) → #4ADE80 — the app's signature green.
//                                Body filled solid for visibility.
//   • Bearish (close < open) → #f87171 — soft red. Body filled solid
//                                so it reads at a glance, even at the
//                                small bucket sizes on mobile.
//   • Doji   (close == open) → #d4d4d4 — neutral grey, no fill.
interface CandleShapeProps {
  /** Pixel coordinates of the bar's bounding box, supplied by recharts. */
  x?: number
  y?: number
  width?: number
  height?: number
  /** The OHLC payload that recharts attached to this bar. */
  payload?: OHLC
  /** Y-axis pixel-mapping helper recharts injects when shape is a fn. */
  yAxis?: { scale?: (v: number) => number }
}

function Candle(props: CandleShapeProps) {
  const { x, width, payload, yAxis } = props
  if (!payload || x === undefined || width === undefined) return null
  const scale = yAxis?.scale
  if (typeof scale !== "function") return null

  const yHigh  = scale(payload.high)
  const yLow   = scale(payload.low)
  const yOpen  = scale(payload.open)
  const yClose = scale(payload.close)

  const bullish = payload.close > payload.open
  const bearish = payload.close < payload.open
  const isDoji  = !bullish && !bearish
  // Raylos green for bullish, red for bearish. Phase 13.25 — when
  // the bucket has only 1 observation (O=H=L=C), use the Raylos
  // accent so the doji is visible AND visually tied to the brand.
  const color = bullish ? "#4ADE80" : bearish ? "#f87171" : "#4ADE80"

  // ─── Phase 13.25 — minimum-visibility guards ─────────────────
  // A doji or single-point bucket gives bodyHeight=0 and wick of
  // 0 length, so the candle vanishes. Force a minimum 4-pixel body
  // and, for true doji, a 5-pixel-wide centered horizontal block
  // so the user sees the price marker even on a flat day.
  const MIN_BODY_PX = 4

  // Body width = ~70% of bucket slot (min 4px) centered on x.
  const bodyWidth = Math.max(4, width * 0.7)
  const bodyX = x + (width - bodyWidth) / 2

  // Wick = single vertical line at the slot center.
  const wickX = x + width / 2

  if (isDoji) {
    // Single-point bucket: render a flat horizontal bar at the
    // close price so the candle is visible. Wick degenerates to
    // a dot, so we omit it.
    const yMid = yClose
    return (
      <g>
        <rect
          x={bodyX}
          y={yMid - MIN_BODY_PX / 2}
          width={bodyWidth}
          height={MIN_BODY_PX}
          fill={color}
          stroke={color}
          strokeWidth={1}
          rx={1}
        />
      </g>
    )
  }

  // Normal bullish/bearish candle.
  let bodyTop = Math.min(yOpen, yClose)
  let bodyBottom = Math.max(yOpen, yClose)
  let bodyHeight = bodyBottom - bodyTop
  if (bodyHeight < MIN_BODY_PX) {
    // Expand around the midpoint so the candle stays anchored.
    const mid = (bodyTop + bodyBottom) / 2
    bodyTop = mid - MIN_BODY_PX / 2
    bodyBottom = mid + MIN_BODY_PX / 2
    bodyHeight = MIN_BODY_PX
  }

  return (
    <g>
      {/* Wick (low → high) */}
      <line
        x1={wickX}
        x2={wickX}
        y1={yHigh}
        y2={yLow}
        stroke={color}
        strokeWidth={1.25}
      />
      {/* Body — solid fill for both bullish and bearish. */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  )
}


// ─── Phase 13.18 — ChartSkeleton ──────────────────────────────────
//
// Static silhouette of a chart while the network round-trip is in
// flight. Renders identical bars on mobile + desktop so the chart
// area never flashes the empty-state copy. Uses Tailwind's
// animate-pulse for the soft breathing effect.
function ChartSkeleton() {
  // 24 vertical bars of varying heights — visually reads as "data
  // is loading" without implying any specific shape.
  const heights = [
    35, 48, 42, 58, 52, 65, 60, 72, 68, 78, 70, 82,
    75, 88, 80, 75, 85, 70, 78, 65, 72, 60, 68, 55,
  ]
  return (
    <div className="h-full w-full px-3 sm:px-4 py-4 flex flex-col">
      <div className="flex-1 flex items-end gap-1 sm:gap-1.5 animate-pulse">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-white/[0.06] rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-700">
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-2 w-12 bg-white/[0.04] rounded animate-pulse" />
      </div>
    </div>
  )
}
