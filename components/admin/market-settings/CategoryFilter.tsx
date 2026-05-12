"use client"

/**
 * CategoryFilter — Phase 14.06 step 3.
 *
 * Horizontal pill bar for filtering settings by category.
 * "all" pseudo-value clears the filter. Only renders categories
 * that actually have settings in the loaded data (no empty pills).
 */

import {
  getCategoryEmoji,
  getCategoryLabel,
  getCategoryOrder,
  type SettingCategory,
} from "@/lib/data/market-settings"
import { cn } from "@/lib/utils/cn"

export type CategoryFilterValue = "all" | SettingCategory

export interface CategoryFilterProps {
  /** All categories actually present in the loaded settings list. */
  available: SettingCategory[]
  /** Currently selected filter. */
  value: CategoryFilterValue
  /** Setter. */
  onChange: (next: CategoryFilterValue) => void
  /** Counts per category, displayed as a small badge on each pill. */
  counts?: Partial<Record<SettingCategory, number>>
  /** Total count for the "all" pill. */
  totalCount?: number
}

export function CategoryFilter({
  available,
  value,
  onChange,
  counts,
  totalCount,
}: CategoryFilterProps) {
  // Sort available categories using our stable order.
  const sorted = [...new Set(available)].sort(
    (a, b) => getCategoryOrder(a) - getCategoryOrder(b),
  )

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="فلتر حسب الفئة"
    >
      <Pill
        active={value === "all"}
        onClick={() => onChange("all")}
        label="الكل"
        emoji="🗂"
        count={totalCount}
      />
      {sorted.map((cat) => (
        <Pill
          key={cat}
          active={value === cat}
          onClick={() => onChange(cat)}
          label={getCategoryLabel(cat)}
          emoji={getCategoryEmoji(cat)}
          count={counts?.[cat]}
        />
      ))}
    </div>
  )
}

function Pill({
  active,
  onClick,
  label,
  emoji,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  emoji: string
  count?: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-colors",
        active
          ? "bg-green-400/15 border-green-400/40 text-green-300"
          : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/20",
      )}
    >
      <span className="text-sm leading-none">{emoji}</span>
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
            active ? "bg-green-400/20 text-green-200" : "bg-white/[0.06] text-neutral-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
