"use client"

/**
 * ProjectPriceChart — Phase 14.10 C.
 *
 * Extracted from app/(app)/project/[id]/page.tsx so the recharts
 * bundle (~65 KB minified) can be code-split via next/dynamic. The
 * project page imports this component with `dynamic(() => import(...),
 * { ssr: false })`, so the chart bundle no longer ships with the
 * initial page load — it streams in the moment recharts is needed
 * and renders as soon as the price-timeline fetch resolves.
 *
 * The component is pure presentational — it accepts the already
 * filtered + transformed `chartData` array from the page and the
 * `isUp` boolean that drives the up-green / down-red color.
 */

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface ProjectPriceChartPoint {
  ts: number
  price: number
  label: string
}

interface ProjectPriceChartProps {
  data: ProjectPriceChartPoint[]
  isUp: boolean
}

export function ProjectPriceChart({ data, isUp }: ProjectPriceChartProps) {
  return (
    <div className="h-40 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="price-grad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isUp ? "#4ADE80" : "#F87171"}
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor={isUp ? "#4ADE80" : "#F87171"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={false}
            axisLine={false}
          />
          <YAxis dataKey="price" domain={["auto", "auto"]} hide />
          <Tooltip
            cursor={{
              stroke: "rgba(255,255,255,0.15)",
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            contentStyle={{
              backgroundColor: "rgba(15,15,15,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelFormatter={(_value, payload) => {
              const p = payload?.[0]?.payload as
                | { label?: string }
                | undefined
              return p?.label ?? ""
            }}
            formatter={(value) => [
              `${Number(value ?? 0).toLocaleString("en-US")} د.ع`,
              "السعر",
            ]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={isUp ? "#4ADE80" : "#F87171"}
            strokeWidth={2}
            fill="url(#price-grad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
