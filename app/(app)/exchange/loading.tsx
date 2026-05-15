/**
 * Exchange route skeleton (Phase 14.12 P1).
 * Renders inside AppShell while the active-listings feed resolves.
 */

import { Skeleton } from "@/components/ui"

export default function ExchangeLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-4xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      {/* Sell/Buy tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Listings */}
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
