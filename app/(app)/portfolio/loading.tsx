/**
 * Portfolio route skeleton (Phase 14.12 P1).
 * Renders inside AppShell while holdings + summary resolve.
 * (The page also hydrates synchronously from the SWR cache via
 * readPersistedSync, so returning users rarely see this — it's the
 * cold-start safety net.)
 */

import { Skeleton, SkeletonStat, SkeletonCard } from "@/components/ui"

export default function PortfolioLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-5xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <Skeleton className="h-7 w-32 rounded-lg" />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Holdings table */}
      <SkeletonCard className="h-12" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
