"use client"

import { cn } from "@/lib/utils/cn"
import type { ReactNode } from "react"

export type BadgeColor = "neutral" | "green" | "blue" | "yellow" | "red" | "purple" | "orange"
export type BadgeVariant = "solid" | "soft" | "outline"
export type BadgeSize = "xs" | "sm" | "md"

export interface BadgeProps {
  color?: BadgeColor
  variant?: BadgeVariant
  size?: BadgeSize
  /** Emoji string or ReactNode (lucide icon, etc.) */
  icon?: ReactNode
  className?: string
  children: ReactNode
}

// ─── Variant × color → classes ─────────────────────────────────────
const SOLID: Record<BadgeColor, string> = {
  neutral: "bg-white/[0.08] text-white",
  green:   "bg-green-500 text-white",
  blue:    "bg-blue-500 text-white",
  yellow:  "bg-yellow-500 text-black",
  red:     "bg-red-500 text-white",
  purple:  "bg-purple-500 text-white",
  orange:  "bg-orange-500 text-white",
}

const SOFT: Record<BadgeColor, string> = {
  neutral: "bg-white/[0.08] border border-white/[0.12] text-neutral-200",
  green:   "bg-green-400/[0.12] border border-green-400/30 text-green-400",
  blue:    "bg-blue-400/[0.12] border border-blue-400/30 text-blue-400",
  yellow:  "bg-yellow-400/[0.12] border border-yellow-400/30 text-yellow-400",
  red:     "bg-red-400/[0.12] border border-red-400/30 text-red-400",
  purple:  "bg-purple-400/[0.12] border border-purple-400/30 text-purple-400",
  orange:  "bg-orange-400/[0.12] border border-orange-400/30 text-orange-400",
}

const OUTLINE: Record<BadgeColor, string> = {
  neutral: "bg-transparent border border-white/[0.2] text-neutral-300",
  green:   "bg-transparent border border-green-400/40 text-green-400",
  blue:    "bg-transparent border border-blue-400/40 text-blue-400",
  yellow:  "bg-transparent border border-yellow-400/40 text-yellow-400",
  red:     "bg-transparent border border-red-400/40 text-red-400",
  purple:  "bg-transparent border border-purple-400/40 text-purple-400",
  orange:  "bg-transparent border border-orange-400/40 text-orange-400",
}

const VARIANT_CLASS = { solid: SOLID, soft: SOFT, outline: OUTLINE }

const SIZE_CFG: Record<BadgeSize, string> = {
  xs: "text-[8px] px-1.5 py-0.5",
  sm: "text-[9px] px-2 py-0.5",
  md: "text-[10px] px-2.5 py-1",
}

/**
 * Badge — small pill for tags, status, counters.
 *
 * @example
 *   <Badge color="green" variant="soft">جديد</Badge>
 *   <Badge color="red" variant="soft" icon="🔥">رائج</Badge>
 */
export function Badge({
  color = "neutral",
  variant = "soft",
  size = "sm",
  icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full font-bold inline-flex items-center gap-1",
        SIZE_CFG[size],
        VARIANT_CLASS[variant][color],
        className,
      )}
    >
      {icon != null && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
