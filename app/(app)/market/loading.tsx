/**
 * Market route skeleton (Phase 14.12 P1).
 * Renders inside AppShell while the market feed resolves.
 */

import { Skeleton, SkeletonCard } from "@/components/ui"

export default function MarketLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-6xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-56" />
        ))}
      </div>
    </div>
  )
}
