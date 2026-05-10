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
  /** Loading flag — shows a subtle pulse instead of empty state. */
  loading?: boolean
  /** Project symbol for the tooltip label. */
  symbol?: string
}

export function ProjectChart({ points, currentPrice, loading, symbol }: Props) {
  const [period, setPeriod] = useState<PeriodId>("30d")
  const [mode, setMode] = useState<ChartMode>("area")

  // ─── Period filter + shape mapping ───────────────────────────────
  const series = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)?.days ?? 30
    const cutoff = Date.now() - days * 86_400_000
    const inWindow =
      days >= 9999
        ? points
        : points.filter((p) => new Date(p.recorded_at).getTime() >= cutoff)

    // recharts wants ascending time + numeric x easier for tooltip.
    return inWindow
      .slice()
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime(),
      )
      .map((p) => ({
        ts: new Date(p.recorded_at).getTime(),
        price: p.new_price,
        date: new Date(p.recorded_at).toLocaleDateString("en-GB"),
      }))
  }, [points, period])

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

      {/* Chart canvas — mobile: 280px, lg+: 420px */}
      <div
        className={cn(
          "w-full",
          loading && "animate-pulse opacity-70",
        )}
        style={{ height: "min(60vh, 420px)", minHeight: 280 }}
      >
        {series.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-center px-6">
            <div>
              <div className="text-3xl mb-2 opacity-50">📊</div>
              <div className="text-xs text-neutral-500">
                {loading
                  ? "جاري تحميل بيانات السعر..."
                  : "لا يوجد سجل أسعار لهذا المشروع بعد"}
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
