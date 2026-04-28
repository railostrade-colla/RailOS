"use client"

import { cn } from "@/lib/utils/cn"
import type { ReactNode } from "react"

export type TabsVariant = "default" | "pills" | "underline"
export type TabsSize = "sm" | "md" | "lg"

export interface TabItem {
  id: string
  label: string
  /** Optional icon (emoji or ReactNode) */
  icon?: ReactNode
  count?: number
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  variant?: TabsVariant
  size?: TabsSize
  className?: string
}

const SIZE_CFG: Record<TabsSize, { padY: string; text: string; count: string }> = {
  sm: { padY: "py-1.5", text: "text-xs",  count: "text-[8px]" },
  md: { padY: "py-2.5", text: "text-sm",  count: "text-[9px]" },
  lg: { padY: "py-3",   text: "text-base", count: "text-[10px]" },
}

/**
 * Tabs — keyboard-accessible tab strip with 3 visual variants.
 *
 * @example
 *   <Tabs
 *     tabs={[{ id: "trending", label: "🔥 رائج", count: 5 }, { id: "new", label: "🆕 جديد" }]}
 *     activeTab={tab}
 *     onChange={setTab}
 *   />
 */
export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "default",
  size = "md",
  className,
}: TabsProps) {
  const cfg = SIZE_CFG[size]

  // ─── Wrapper styles per variant ───────────────────────────────
  const wrapper =
    variant === "default"
      ? "flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1"
      : variant === "pills"
        ? "flex gap-2 flex-wrap"
        : /* underline */ "flex gap-1 border-b border-white/[0.08]"

  // ─── Per-button styles per variant ───────────────────────────
  const buttonBase = (active: boolean) => {
    if (variant === "default") {
      return active
        ? "bg-white text-black font-bold"
        : "text-neutral-400 hover:text-white"
    }
    if (variant === "pills") {
      return active
        ? "bg-white text-black font-bold border border-transparent"
        : "bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]"
    }
    // underline
    return active
      ? "text-white border-b-2 border-white"
      : "text-neutral-400 hover:text-white border-b-2 border-transparent"
  }

  const radius =
    variant === "default" ? "rounded-lg" :
    variant === "pills" ? "rounded-full" : ""

  return (
    <div role="tablist" className={cn(wrapper, className)}>
      {tabs.map((t) => {
        const active = activeTab === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex-1 transition-colors flex items-center justify-center gap-1.5 px-3",
              cfg.padY,
              cfg.text,
              radius,
              buttonBase(active),
            )}
          >
            {t.icon != null && <span className="flex-shrink-0">{t.icon}</span>}
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full font-mono",
                  cfg.count,
                  active ? "bg-black/10" : "bg-white/[0.05]",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
