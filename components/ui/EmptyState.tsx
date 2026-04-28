"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { ReactNode } from "react"

export type EmptyStateSize = "sm" | "md" | "lg"

export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  /** "primary" = white button, "link" = blue text link. Default "primary". */
  variant?: "primary" | "link"
}

export interface EmptyStateProps {
  /** Emoji or ReactNode icon */
  icon?: ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  size?: EmptyStateSize
  className?: string
}

const SIZE_CFG: Record<EmptyStateSize, { padding: string; icon: string; title: string; desc: string }> = {
  sm: { padding: "py-8",  icon: "text-3xl", title: "text-xs",  desc: "text-[10px]" },
  md: { padding: "py-12", icon: "text-4xl", title: "text-sm",  desc: "text-[11px]" },
  lg: { padding: "py-16", icon: "text-5xl", title: "text-base", desc: "text-xs" },
}

/**
 * EmptyState — friendly "no content" message with optional CTA.
 *
 * @example
 *   <EmptyState icon="📦" title="لا توجد استثمارات بعد" description="ابدأ رحلتك"
 *               action={{ label: "اكتشف", href: "/market" }} />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  const router = useRouter()
  const cfg = SIZE_CFG[size]

  const handleAction = () => {
    if (action?.onClick) action.onClick()
    else if (action?.href) router.push(action.href)
  }

  const isLink = action?.variant === "link"

  return (
    <div
      className={cn(
        "bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center px-4",
        cfg.padding,
        className,
      )}
    >
      {icon != null && (
        <div className={cn(cfg.icon, "mb-2 opacity-50")}>{icon}</div>
      )}
      <div className={cn(cfg.title, "text-neutral-400 mb-1 font-medium")}>{title}</div>
      {description && (
        <div className={cn(cfg.desc, "text-neutral-600 mb-3")}>{description}</div>
      )}
      {action && (
        <button
          onClick={handleAction}
          className={cn(
            isLink
              ? "text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors"
              : "bg-neutral-100 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 inline-flex items-center gap-1.5 transition-colors",
          )}
        >
          {action.label}
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
