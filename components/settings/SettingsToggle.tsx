"use client"

import { cn } from "@/lib/utils/cn"

/**
 * Phase 14.13 Unified UI Part 2 — labelled toggle row. Same visual
 * language as the legacy settings Toggle (green = on) so nothing
 * looks out of place during the migration. RTL-aware knob.
 */
export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        {description && (
          <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "no-shadow relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5",
          checked ? "bg-green-400" : "bg-white/[0.1]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
            checked ? "right-0.5" : "right-[18px]",
          )}
        />
      </button>
    </div>
  )
}
