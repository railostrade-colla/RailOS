"use client"

/**
 * BooleanToggle — Phase 14.06 step 3.
 *
 * Two-state switch for `count`-typed settings with bounds [0, 1]
 * (currently only `engine_enabled`). The parent component owns the
 * "open ConfirmDialog before toggling" logic — this component is
 * presentational only.
 */

import { Power, PowerOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils/cn"

export interface BooleanToggleProps {
  /** Current value: 1 = on, 0 = off. */
  value: number
  /** Click handler — receives the NEW value (1 if currently 0, 0 otherwise). */
  onToggle: (newValue: number) => void
  /** Disable interaction (e.g. while another save is in flight). */
  disabled?: boolean
  /** Show spinner instead of icon while save is in flight. */
  submitting?: boolean
  /** Optional Arabic label rendered next to the state badge. */
  onLabel?: string
  offLabel?: string
}

export function BooleanToggle({
  value,
  onToggle,
  disabled = false,
  submitting = false,
  onLabel = "مفعّل",
  offLabel = "موقّف",
}: BooleanToggleProps) {
  const isOn = value === 1
  const handleClick = () => {
    if (disabled || submitting) return
    onToggle(isOn ? 0 : 1)
  }

  return (
    <div className="flex items-center gap-3">
      {/* Track + thumb */}
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-busy={submitting}
        onClick={handleClick}
        disabled={disabled || submitting}
        className={cn(
          "relative inline-flex h-7 w-14 items-center rounded-full transition-colors border",
          isOn
            ? "bg-green-500/20 border-green-400/40"
            : "bg-red-500/15 border-red-400/30",
          (disabled || submitting) && "opacity-60 cursor-not-allowed",
          !disabled && !submitting && "cursor-pointer hover:brightness-110",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full shadow-lg transition-transform duration-200 flex items-center justify-center",
            isOn ? "translate-x-1 bg-green-400" : "translate-x-8 bg-red-400",
          )}
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 text-black animate-spin" strokeWidth={2.5} />
          ) : isOn ? (
            <Power className="w-3 h-3 text-black" strokeWidth={3} />
          ) : (
            <PowerOff className="w-3 h-3 text-white" strokeWidth={3} />
          )}
        </span>
      </button>

      {/* Text badge */}
      <span
        className={cn(
          "text-xs font-bold flex items-center gap-1.5",
          isOn ? "text-green-400" : "text-red-400",
        )}
      >
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            isOn
              ? "bg-green-400 animate-pulse motion-reduce:animate-none"
              : "bg-red-400",
          )}
        />
        {isOn ? `🟢 ${onLabel}` : `🔴 ${offLabel}`}
      </span>
    </div>
  )
}
