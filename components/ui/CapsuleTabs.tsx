"use client"

/**
 * CapsuleTabs — Phase 14.13. Spec-named entry point for the unified
 * capsule tab strip. It IS the re-skinned <Tabs> (same component, so
 * the look is guaranteed identical everywhere — one source of truth).
 * Use this name for new code; existing <Tabs> callers already get the
 * capsule automatically.
 *
 *   variant: "small" | "default" | "large"  → maps to Tabs size sm/md/lg
 */
import { Tabs, type TabItem } from "./Tabs"

export interface CapsuleTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  variant?: "small" | "default" | "large"
  className?: string
}

const SIZE_MAP = { small: "sm", default: "md", large: "lg" } as const

export function CapsuleTabs({
  tabs,
  activeTab,
  onChange,
  variant = "default",
  className,
}: CapsuleTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={onChange}
      size={SIZE_MAP[variant]}
      className={className}
    />
  )
}
