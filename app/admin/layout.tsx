"use client"

import { useState, useCallback, Suspense } from "react"
import { usePathname } from "next/navigation"
import { AdminSidebar } from "@/components/admin/Sidebar"
import { AdminTopBar } from "@/components/admin/AdminTopBar"
import { AdminDiagnosticBanner } from "@/components/admin/AdminDiagnosticBanner"
// Phase 11.31 — also warm the cache for admins. Common reads share
// keys with the user shell, so the same hook benefits both.
import { usePreloadAppData } from "@/lib/data/preload"
// Phase 13.0 — global realtime notifier for admins. Subscribes to
// every admin-relevant table and shows toast + plays sound + emits
// a window event the sidebar listens to for badge updates.
import { AdminRealtimeNotifier } from "@/components/admin/AdminRealtimeNotifier"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  // Phase 13.2 — sidebar widths trimmed (220 → 200, 60 → 56) for a
  // less heavy chrome and a wider main panel.
  const sidebarWidth = open ? 200 : 56
  const pathname = usePathname()

  // Hide topbar on admin-login (if matched here)
  const showTopBar = pathname?.startsWith("/admin") && pathname !== "/admin-login"

  // Phase 11.31 — preload globally on admin shell mount.
  usePreloadAppData()

  // Phase 14.09 B — stable toggle handler so AdminSidebar's React.memo
  // can short-circuit on every layout re-render that doesn't actually
  // change `open`. Without useCallback, the lambda is recreated on
  // every render and the memo'd Sidebar still receives a new prop,
  // re-renders, and the perceived flicker stays.
  const toggleSidebar = useCallback(() => setOpen((v) => !v), [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="rtl">
      {/* Phase 14.09 B — Sidebar is mounted WITHOUT a Suspense wrapper.
          Suspense around a client component that has no async children
          / no React.lazy still re-mounts its subtree when the parent
          layout re-renders during streaming navigations on React 19 +
          Next 16. That re-mount restarts the sidebar's realtime
          subscription, which is what caused the visual flicker on
          every admin-page navigation. The component itself is
          React.memo'd in its own file so prop-stable navigations
          short-circuit before they touch its tree. */}
      <AdminSidebar open={open} onToggle={toggleSidebar} />
      <main
        className="min-h-screen transition-all duration-200 relative"
        style={{ marginRight: sidebarWidth }}
      >
        {showTopBar && (
          <Suspense fallback={null}>
            <AdminTopBar />
          </Suspense>
        )}
        {/* Renders only when admin auth/role is broken — invisible
            on the happy path. */}
        {showTopBar && (
          <Suspense fallback={null}>
            <AdminDiagnosticBanner />
          </Suspense>
        )}
        {/* Children stay inside a Suspense boundary because admin
            pages can be heavier and may suspend on server data. */}
        <Suspense fallback={null}>{children}</Suspense>
      </main>

      {/* Phase 13.0 — global realtime notifier (toasts + sound) */}
      {showTopBar && (
        <Suspense fallback={null}>
          <AdminRealtimeNotifier />
        </Suspense>
      )}
    </div>
  )
}
