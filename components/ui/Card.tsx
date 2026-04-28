"use client"

import { cn } from "@/lib/utils/cn"
import type { ReactNode, MouseEventHandler } from "react"

export type CardColor = "neutral" | "green" | "blue" | "yellow" | "red" | "purple" | "orange"
export type CardVariant = "default" | "gradient" | "highlighted" | "ghost"
export type CardPadding = "sm" | "md" | "lg" | "none"

export interface CardProps {
  variant?: CardVariant
  color?: CardColor
  padding?: CardPadding
  onClick?: MouseEventHandler<HTMLDivElement>
  className?: string
  children: ReactNode
}

// ─── Variant × color → bg/border classes ────────────────────────
const VARIANT_BG: Record<CardVariant, Record<CardColor, string>> = {
  default: {
    neutral: "bg-white/[0.05] border border-white/[0.08]",
    green:   "bg-white/[0.05] border border-white/[0.08]",
    blue:    "bg-white/[0.05] border border-white/[0.08]",
    yellow:  "bg-white/[0.05] border border-white/[0.08]",
    red:     "bg-white/[0.05] border border-white/[0.08]",
    purple:  "bg-white/[0.05] border border-white/[0.08]",
    orange:  "bg-white/[0.05] border border-white/[0.08]",
  },
  gradient: {
    neutral: "bg-gradient-to-br from-white/[0.06] to-white/[0.04] border border-white/[0.08]",
    green:   "bg-gradient-to-br from-green-400/[0.06] to-transparent border border-green-400/20",
    blue:    "bg-gradient-to-br from-blue-400/[0.06] to-transparent border border-blue-400/20",
    yellow:  "bg-gradient-to-br from-yellow-400/[0.06] to-transparent border border-yellow-400/20",
    red:     "bg-gradient-to-br from-red-400/[0.06] to-transparent border border-red-400/20",
    purple:  "bg-gradient-to-br from-purple-400/[0.06] to-transparent border border-purple-400/20",
    orange:  "bg-gradient-to-br from-orange-400/[0.06] to-transparent border border-orange-400/20",
  },
  highlighted: {
    neutral: "bg-white/[0.06] border border-white/[0.12]",
    green:   "bg-green-400/[0.06] border border-green-400/25",
    blue:    "bg-blue-400/[0.06] border border-blue-400/25",
    yellow:  "bg-yellow-400/[0.06] border border-yellow-400/25",
    red:     "bg-red-400/[0.06] border border-red-400/25",
    purple:  "bg-purple-400/[0.06] border border-purple-400/25",
    orange:  "bg-orange-400/[0.06] border border-orange-400/25",
  },
  ghost: {
    neutral: "bg-transparent hover:bg-white/[0.04] border border-transparent",
    green:   "bg-transparent hover:bg-green-400/[0.04] border border-transparent",
    blue:    "bg-transparent hover:bg-blue-400/[0.04] border border-transparent",
    yellow:  "bg-transparent hover:bg-yellow-400/[0.04] border border-transparent",
    red:     "bg-transparent hover:bg-red-400/[0.04] border border-transparent",
    purple:  "bg-transparent hover:bg-purple-400/[0.04] border border-transparent",
    orange:  "bg-transparent hover:bg-orange-400/[0.04] border border-transparent",
  },
}

const PADDING: Record<CardPadding, string> = {
  none: "p-0",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-5",
}

/**
 * Card — generic container primitive.
 *
 * Replaces the repeated `bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5` pattern.
 *
 * @example
 *   <Card>simple</Card>
 *   <Card variant="gradient" color="purple">premium banner</Card>
 *   <Card variant="highlighted" color="green" onClick={...}>clickable</Card>
 */
export function Card({
  variant = "default",
  color = "neutral",
  padding = "lg",
  onClick,
  className,
  children,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl transition-colors backdrop-blur",
        VARIANT_BG[variant][color],
        PADDING[padding],
        onClick && "cursor-pointer hover:bg-white/[0.06]",
        className,
      )}
    >
      {children}
    </div>
  )
}
