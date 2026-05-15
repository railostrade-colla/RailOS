/**
 * Deals route skeleton (Phase 14.12 P1).
 * Renders inside AppShell while the user's enriched deals resolve.
 */

import { Skeleton } from "@/components/ui"

export default function DealsLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-3xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <Skeleton className="h-7 w-28 rounded-lg" />

      {/* Status tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-xl" />
        ))}
      </div>

      {/* Deal cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
