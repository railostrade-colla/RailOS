"use client"

/**
 * DashboardCharts — Phase 14.11 A6.
 *
 * The /dashboard page had two inline recharts charts (a price
 * sparkline + a volume area chart). recharts is ~65 KB and was
 * imported eagerly at the top of dashboard/page.tsx, so it shipped
 * in the dashboard's initial JS even though both charts are below
 * the hero / quick-actions fold.
 *
 * This module carries the recharts JSX so dashboard/page.tsx can
 * pull it in via next/dynamic({ ssr: false }) — same pattern as
 * Phase 14.10 C's ProjectPriceChart. The charts now stream in after
 * first paint instead of blocking it, and any future user-side page
 * that doesn't render a chart no longer pays the recharts cost.
 *
 * Both components are pure presentational — the page keeps all data
 * prep (timeline → {ts,price} mapping, up/down detection) and passes
 * the finished arrays down.
 */

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ─── 1. Price sparkline (selected-project mini chart) ─────────────
export interface SparklinePoint {
  ts: number
  price: number
}

export function DashboardSparkline({
  data,
  isUp,
}: {
  data: SparklinePoint[]
  isUp: boolean
}) {
  return (
    <div className="h-[50px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isUp ? "#4ADE80" : "#F87171"}
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor={isUp ? "#4ADE80" : "#F87171"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "rgba(15,15,15,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              fontSize: "10px",
            }}
            labelFormatter={() => ""}
            formatter={(value) => [
              `${Number(value ?? 0).toLocaleString("en-US")} د.ع`,
              "السعر",
            ]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isUp ? "#4ADE80" : "#F87171"}
            strokeWidth={1.8}
            fill="url(#spark-grad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── 2. Volume area chart ─────────────────────────────────────────
export interface VolumePoint {
  month: string
  volume: number
}

export function DashboardVolumeChart({ data }: { data: VolumePoint[] }) {
  return (
    <div className="h-40 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
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
  )
}
