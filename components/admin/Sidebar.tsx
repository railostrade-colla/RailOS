"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { ADMIN_NAV, type AdminTab } from "@/lib/admin/types"
import { getMyAdminPermissions, type AdminPermission } from "@/lib/data/admin-permissions"
import { cn } from "@/lib/utils/cn"

export function AdminSidebar({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = (searchParams?.get("tab") || "dashboard") as AdminTab

  // Phase 11.00 — load the caller's permissions once and filter the
  // sidebar so a regular admin only sees the sections they were granted.
  // super_admin gets "*" → all items visible.
  const [perms, setPerms] = useState<AdminPermission[] | "*" | null>(null)
  useEffect(() => {
    let cancelled = false
    getMyAdminPermissions().then((p) => {
      if (!cancelled) setPerms(p)
    })
    return () => { cancelled = true }
  }, [])

  const allowed = (item: typeof ADMIN_NAV[number]): boolean => {
    if (perms === null) return true              // still loading — render all (avoids flicker)
    if (perms === "*") return true               // super_admin
    if (!item.requiredPermission) return true    // public/admin-default item
    return perms.includes(item.requiredPermission)
  }
  const visibleNav = ADMIN_NAV.filter(allowed)
  const visibleSections = Array.from(new Set(visibleNav.map((n) => n.section)))

  const goTo = (tab: AdminTab) => {
    router.push(`/admin?tab=${tab}`)
  }

  const logout = () => {
    router.push("/admin-login")
  }

  return (
    <aside
      className={cn(
        "fixed top-0 right-0 bottom-0 z-40 bg-[#0a0a0a] border-l border-white/[0.06] transition-all duration-200 flex flex-col",
        open ? "w-[220px]" : "w-[60px]"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
        {open ? (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push("/admin?tab=dashboard")}
            role="button"
          >
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.04] flex-shrink-0">
              <Image
                src="/logo.png"
                alt="RailOS"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">RaiLOS</div>
              <div className="text-[9px] text-neutral-500 mt-1">لوحة الإدارة</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => router.push("/admin?tab=dashboard")}
            className="w-9 h-9 rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.04] hover:opacity-80 transition-opacity"
            aria-label="RailOS Home"
          >
            <Image
              src="/logo.png"
              alt="RailOS"
              width={36}
              height={36}
              className="w-full h-full object-contain"
            />
          </button>
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center transition-colors text-neutral-400"
          aria-label="toggle"
        >
          {open ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2">
        {visibleSections.map((section) => (
          <div key={section} className="mb-2">
            {open && (
              <div className="px-3 py-1.5 text-[9px] text-neutral-600 font-bold tracking-wider uppercase">
                {section}
              </div>
            )}
            {visibleNav.filter((n) => n.section === section).map((item) => (
              <button
                key={item.key}
                onClick={() => goTo(item.key)}
                title={!open ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-right",
                  currentTab === item.key
                    ? "bg-white/[0.08] text-white border-r-2 border-white"
                    : "text-neutral-400 hover:bg-white/[0.04] hover:text-white border-r-2 border-transparent"
                )}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {open && <span className="text-xs font-medium truncate">{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="p-2 border-t border-white/[0.06]">
        <button
          onClick={logout}
          title={!open ? "تسجيل الخروج" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/[0.08] transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          {open && <span className="text-xs">تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  )
}
