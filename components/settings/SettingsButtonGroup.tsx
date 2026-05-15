"use client"

import { cn } from "@/lib/utils/cn"
import type { LucideIcon } from "lucide-react"

export interface ButtonGroupOption {
  id: string
  label: string
  icon?: LucideIcon
}

/**
 * Phase 14.13 Unified UI Part 2 — segmented control. Active item gets
 * the green selection treatment (border + text + bg) matching the
 * founder spec. `.no-shadow` keeps the inner buttons flat (the parent
 * card already carries depth).
 */
export function SettingsButtonGroup({
  options,
  value,
  onChange,
}: {
  options: ButtonGroupOption[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "no-shadow flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs transition-colors",
              active
                ? "bg-green-400/[0.1] border-green-400/40 text-green-400 font-medium"
                : "bg-white/[0.03] border-white/[0.08] text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200",
            )}
          >
            {Icon && <Icon className="w-4 h-4" strokeWidth={2} />}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
