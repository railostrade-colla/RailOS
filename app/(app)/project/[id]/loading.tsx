/**
 * Project-detail route skeleton (Phase 14.12 P1).
 *
 * /project/[id] was the slowest page pre-14.10. Even after the
 * parallel-fetch + dedupCache work it still has a cold path; this
 * skeleton gives an instant structured frame instead of a blank
 * screen. Renders inside AppShell.
 */

import { Skeleton, SkeletonCard } from "@/components/ui"

export default function ProjectDetailLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-3xl mx-auto space-y-3" dir="rtl">
      {/* Header */}
      <Skeleton className="h-7 w-44 rounded-lg" />

      {/* Hero card: logo + name + price */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
        {/* price chart placeholder */}
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>

      {/* Tabs + content */}
      <Skeleton className="h-10 rounded-xl" />
      <SkeletonCard className="h-48" />
    </div>
  )
}
