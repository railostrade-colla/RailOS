"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { ReactNode } from "react"

export type SectionHeaderSize = "sm" | "md" | "lg"

export interface SectionHeaderAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** Optional icon node — emoji string or ReactNode (lucide icon, etc.) */
  icon?: ReactNode
  action?: SectionHeaderAction
  size?: SectionHeaderSize
  className?: string
}

const SIZE_TITLE: Record<SectionHeaderSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
}

const SIZE_SUB: Record<SectionHeaderSize, string> = {
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
}

/**
 * SectionHeader — title + optional subtitle + optional CTA on the left.
 *
 * @example
 *   <SectionHeader title="🌟 اكتشف" subtitle="فرص استثمارية مختارة" action={{ label: "كل المشاريع", href: "/market" }} />
 */
export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  size = "md",
  className,
}: SectionHeaderProps) {
  const router = useRouter()

  const handleAction = () => {
    if (action?.onClick) action.onClick()
    else if (action?.href) router.push(action.href)
  }

  return (
    <div className={cn("flex justify-between items-end mb-4 gap-2", className)}>
      <div className="min-w-0">
        <h2 className={cn(SIZE_TITLE[size], "font-bold text-white flex items-center gap-1.5")}>
          {icon != null && <span className="flex-shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && (
          <p className={cn(SIZE_SUB[size], "text-neutral-500 mt-0.5")}>{subtitle}</p>
        )}
      </div>

      {action && (
        <button
          onClick={handleAction}
          className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-white px-3 py-1.5 rounded-full text-[11px] transition-colors flex-shrink-0"
        >
          <span>{action.label}</span>
          <ChevronLeft className="w-3 h-3" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
