/**
 * Dashboard route skeleton (Phase 14.12 P1).
 *
 * Next.js App Router renders this as the Suspense fallback while the
 * dashboard page's data resolves. It mounts INSIDE AppShell (route
 * layout, Phase 14.10 A) so the header + BottomNav stay put — only
 * the page body shows the skeleton, no full-screen flash.
 */

import { Skeleton, SkeletonStat, SkeletonCard } from "@/components/ui"

export default function DashboardLoading() {
  return (
    <div className="px-3 lg:px-8 py-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>

      {/* Hero / active project card */}
      <SkeletonCard className="h-44" />

      {/* Quick actions grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>

      {/* Discover + news */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard className="h-64 lg:col-span-2" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  )
}
