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
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { LineChart as LineIcon, AreaChart as AreaIcon, TrendingUp, TrendingDown } from "lucide-react"
import type { PriceHistoryPoint } from "@/lib/data/price-history"
import { cn } from "@/lib/utils/cn"

const PERIODS = [
  { id: "1d",  label: "1ي", days: 1   },
  { id: "7d",  label: "7ي", days: 7   },
  { id: "30d", label: "1ش", days: 30  },
  { id: "1y",  label: "1س", days: 365 },
  { id: "all", label: "الكل", days: 9999 },
] as const
type PeriodId = typeof PERIODS[number]["id"]

const MODES = [
  { id: "area", label: "منطقة", icon: AreaIcon },
  { id: "line", label: "خطّي",  icon: LineIcon },
] as const
type ChartMode = typeof MODES[number]["id"]

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
    const prices = series.map((s) => s.price)
    const min = Math.min(...prices, currentPrice || Infinity)
    const max = Math.max(...prices, currentPrice || -Infinity)
    const pad = Math.max(1, (max - min) * 0.1)
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }, [series, currentPrice])

  const accent = "#deff9a"
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
                {p.label}
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
                title={m.label}
                aria-label={m.label}
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
          <span className="text-[10px] text-neutral-500">د.ع</span>
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

      {/* Chart canvas — mobile: 280px, lg+: 420px
           Phase 13.18 — three-state rendering:
             • showSkeleton → animated bars (no false-empty flash)
             • isEmpty      → friendly empty state (only after fetch)
             • else         → recharts canvas */}
      <div
        className="w-full"
        style={{ height: "min(60vh, 420px)", minHeight: 280 }}
      >
        {showSkeleton ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <div className="h-full w-full flex items-center justify-center text-center px-6">
            <div>
              <div className="text-3xl mb-2 opacity-50">📊</div>
              <div className="text-xs text-neutral-500">
                لا يوجد سجل أسعار لهذا المشروع بعد
              </div>
              <div className="text-[10px] text-neutral-600 mt-1">
                ستُعرَض الحركات لحظة وقوعها
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === "area" ? (
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
                  formatter={(v) => [`${fmt(Number(v ?? 0))} د.ع`, "السعر"]}
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
                  formatter={(v) => [`${fmt(Number(v ?? 0))} د.ع`, "السعر"]}
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
