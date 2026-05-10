"use client"

/**
 * ProjectCardSkeleton — Phase 13.13.
 *
 * A static, low-jank placeholder shaped like ProjectCard. Used by
 * useStaleData consumers when the cache is cold (first-ever visit).
 * Subsequent visits hit warm-cache and skip this entirely.
 *
 * No spinning circle: that pattern is jarring on slow connections.
 * Instead we render the card silhouette and a subtle pulse animation
 * so the user sees layout structure immediately and the fresh data
 * fades in without a layout shift.
 */

import { cn } from "@/lib/utils/cn"

interface Props {
  /** Number of skeleton cards to render. Match the expected list length. */
  count?: number
  /** Vertical spacing class — defaults to typical card stack. */
  className?: string
}

export function ProjectCardSkeleton({ count = 1, className }: Props) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 animate-pulse"
        >
          {/* Header: logo + name + sector */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="h-4 w-32 bg-white/[0.08] rounded mb-2" />
              <div className="h-3 w-20 bg-white/[0.05] rounded" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex-shrink-0" />
          </div>

          {/* Two columns: price + return */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="h-3 w-16 bg-white/[0.05] rounded mb-2" />
              <div className="h-5 w-24 bg-white/[0.08] rounded" />
            </div>
            <div>
              <div className="h-3 w-16 bg-white/[0.05] rounded mb-2" />
              <div className="h-5 w-24 bg-white/[0.08] rounded" />
            </div>
          </div>

          {/* Funding bar */}
          <div className="mb-4">
            <div className="h-3 w-20 bg-white/[0.05] rounded mb-2" />
            <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-white/[0.08] rounded-full" />
            </div>
            <div className="h-3 w-28 bg-white/[0.05] rounded mt-2" />
          </div>

          {/* Three pills: closes-in / risk / investors */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="bg-white/[0.04] border border-white/[0.04] rounded-xl p-3"
              >
                <div className="h-3 w-12 bg-white/[0.05] rounded mb-2 mx-auto" />
                <div className="h-4 w-10 bg-white/[0.08] rounded mx-auto" />
              </div>
            ))}
          </div>

          {/* Action row */}
          <div className="flex gap-2 mt-3">
            <div className="flex-[2] h-12 rounded-xl bg-white/[0.06]" />
            <div className="flex-1 h-12 rounded-xl bg-white/[0.04]" />
            <div className="w-12 h-12 rounded-xl bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  )
}
