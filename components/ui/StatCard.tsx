"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { ReactNode, MouseEventHandler } from "react"

export type StatCardColor = "neutral" | "green" | "blue" | "yellow" | "red" | "purple" | "orange"
export type StatCardSize = "sm" | "md" | "lg"
export type TrendDirection = "up" | "down" | "neutral"

export interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  color?: StatCardColor
  trend?: { value: number; direction: TrendDirection }
  size?: StatCardSize
  onClick?: MouseEventHandler<HTMLDivElement>
  className?: string
}

const SIZE_CFG: Record<StatCardSize, { padding: string; label: string; value: string; trend: string }> = {
  sm: { padding: "p-2.5", label: "text-[9px]",  value: "text-xs",  trend: "text-[9px]" },
  md: { padding: "p-3",   label: "text-[10px]", value: "text-sm",  trend: "text-[10px]" },
  lg: { padding: "p-4",   label: "text-xs",     value: "text-base", trend: "text-[11px]" },
}

const COLOR_BG: Record<StatCardColor, string> = {
  neutral: "bg-white/[0.04] border-white/[0.06]",
  green:   "bg-green-400/[0.06] border-green-400/20",
  blue:    "bg-blue-400/[0.06] border-blue-400/20",
  yellow:  "bg-yellow-400/[0.06] border-yellow-400/20",
  red:     "bg-red-400/[0.06] border-red-400/20",
  purple:  "bg-purple-400/[0.06] border-purple-400/20",
  orange:  "bg-orange-400/[0.06] border-orange-400/20",
}

const COLOR_VALUE: Record<StatCardColor, string> = {
  neutral: "text-white",
  green:   "text-green-400",
  blue:    "text-blue-400",
  yellow:  "text-yellow-400",
  red:     "text-red-400",
  purple:  "text-purple-400",
  orange:  "text-orange-400",
}

const COLOR_LABEL: Record<StatCardColor, string> = {
  neutral: "text-neutral-500",
  green:   "text-green-400/80",
  blue:    "text-blue-400/80",
  yellow:  "text-yellow-400/80",
  red:     "text-red-400/80",
  purple:  "text-purple-400/80",
  orange:  "text-orange-400/80",
}

/**
 * StatCard — labeled metric/number with optional trend indicator.
 *
 * @example
 *   <StatCard label="القيمة" value="12,500,000" color="green" trend={{ value: 12.5, direction: "up" }} />
 */
export function StatCard({
  label,
  value,
  icon,
  color = "neutral",
  trend,
  size = "md",
  onClick,
  className,
}: StatCardProps) {
  const cfg = SIZE_CFG[size]
  const trendColor =
    trend?.direction === "up" ? "text-green-400" :
    trend?.direction === "down" ? "text-red-400" :
    "text-neutral-500"

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border transition-colors",
        cfg.padding,
        COLOR_BG[color],
        onClick && "cursor-pointer hover:bg-white/[0.06]",
        className,
      )}
    >
      <div className={cn(cfg.label, COLOR_LABEL[color], "mb-1 flex items-center gap-1")}>
        {icon != null && <span className="flex-shrink-0">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={cn(cfg.value, "font-bold font-mono", COLOR_VALUE[color])}>
        {value}
      </div>
      {trend && (
        <div className={cn(cfg.trend, "font-bold flex items-center gap-0.5 mt-0.5", trendColor)}>
          {trend.direction === "up" && <TrendingUp className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {trend.direction === "down" && <TrendingDown className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {trend.direction === "neutral" && <Minus className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {trend.direction !== "neutral" && (trend.value >= 0 ? "+" : "")}{trend.value}%
        </div>
      )}
    </div>
  )
}
