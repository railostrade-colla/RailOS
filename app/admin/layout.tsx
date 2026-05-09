"use client"

import { useState, Suspense } from "react"
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
  const sidebarWidth = open ? 220 : 60
  const pathname = usePathname()

  // Hide topbar on admin-login (if matched here)
  const showTopBar = pathname?.startsWith("/admin") && pathname !== "/admin-login"

  // Phase 11.31 — preload globally on admin shell mount.
  usePreloadAppData()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="rtl">
      <Suspense fallback={null}>
        <AdminSidebar open={open} onToggle={() => setOpen((v) => !v)} />
      </Suspense>
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
