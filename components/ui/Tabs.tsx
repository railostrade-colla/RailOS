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
  /** Kept for API compatibility — every variant now renders as the
   *  unified capsule (matches BottomNav). */
  variant?: TabsVariant
  size?: TabsSize
  className?: string
}

const SIZE_CFG: Record<TabsSize, { pad: string; text: string; count: string }> = {
  sm: { pad: "px-3 py-1.5",  text: "text-xs",   count: "text-[8px]" },
  md: { pad: "px-4 py-2",    text: "text-sm",   count: "text-[9px]" },
  lg: { pad: "px-6 py-2.5",  text: "text-base", count: "text-[10px]" },
}

/**
 * Tabs — Phase 14.13: unified **capsule** tab strip, same visual
 * language as the BottomNav floating pill. All three legacy variants
 * (default / pills / underline) now resolve to the single capsule
 * look so every page is consistent without touching ~15 call sites.
 *
 * Container : bg-card + border-border + rounded-full + shadow-card,
 *             horizontally scrollable (no-scrollbar) for many tabs.
 * Active    : solid bg-foreground / text-background (high contrast).
 * Inactive  : text-muted-foreground → hover text-foreground + bg-secondary.
 *
 * API unchanged (TabItem / TabsProps) — drop-in for existing callers.
 *
 * @example
 *   <Tabs tabs={[{ id: "news", label: "الأخبار" }]} activeTab={t} onChange={setT} />
 */
export function Tabs({
  tabs,
  activeTab,
  onChange,
  size = "md",
  className,
}: TabsProps) {
  const cfg = SIZE_CFG[size]

  return (
    <div
      role="tablist"
      className={cn(
        "capsule-tabs-container no-scrollbar bg-card border border-border rounded-full p-1.5 shadow-card",
        "flex items-center gap-1 overflow-x-auto",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = activeTab === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "no-shadow flex-shrink-0 whitespace-nowrap rounded-full font-medium",
              "flex items-center justify-center gap-1.5 transition-colors duration-200",
              cfg.pad,
              cfg.text,
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary",
            )}
          >
            {t.icon != null && <span className="flex-shrink-0">{t.icon}</span>}
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full font-mono",
                  cfg.count,
                  active ? "bg-black/10" : "bg-white/[0.08]",
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
