"use client"

import { useState, Suspense } from "react"
import { usePathname } from "next/navigation"
import { AdminSidebar } from "@/components/admin/Sidebar"
import { AdminTopBar } from "@/components/admin/AdminTopBar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const sidebarWidth = open ? 220 : 60
  const pathname = usePathname()

  // Hide topbar on admin-login (if matched here)
  const showTopBar = pathname?.startsWith("/admin") && pathname !== "/admin-login"

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
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  )
}
