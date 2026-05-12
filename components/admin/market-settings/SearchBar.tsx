"use client"

/**
 * SearchBar — Phase 14.06 step 3.
 *
 * Debounced search input. Re-renders the parent only after 300 ms of
 * keyboard quiet so filtering 18 settings doesn't churn on every
 * keystroke.
 *
 * Controlled-uncontrolled hybrid: the input holds its own draft
 * state, but exposes `value` for the parent to reset (e.g. when a
 * category filter clears the query).
 */

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"

export interface SearchBarProps {
  /** Last-applied query (after debounce). The parent owns this. */
  value: string
  /** Fires after 300 ms of keyboard quiet. */
  onChange: (next: string) => void
  placeholder?: string
  /** Tailwind className passthrough. */
  className?: string
}

const DEBOUNCE_MS = 300

export function SearchBar({
  value,
  onChange,
  placeholder = "ابحث في الإعدادات…",
  className,
}: SearchBarProps) {
  const [draft, setDraft] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep draft in sync when parent resets externally.
  useEffect(() => {
    setDraft(value)
  }, [value])

  // Debounced emit.
  useEffect(() => {
    if (draft === value) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(draft), DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const handleClear = () => {
    setDraft("")
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange("")
  }

  return (
    <div
      className={cn(
        "relative bg-black/40 border border-white/[0.08] rounded-xl focus-within:border-white/20 transition-colors",
        className,
      )}
    >
      <Search
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
        strokeWidth={2}
      />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label="بحث في الإعدادات"
        className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 px-10 py-2.5 outline-none"
      />
      {draft.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="مسح"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
