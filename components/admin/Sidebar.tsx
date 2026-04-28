"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { ADMIN_NAV, ADMIN_SECTIONS, type AdminTab } from "@/lib/admin/types"
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
        {open && (
          <div>
            <div className="text-sm font-bold text-white">RaiLOS</div>
            <div className="text-[9px] text-neutral-500">لوحة الإدارة</div>
          </div>
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
        {ADMIN_SECTIONS.map((section) => (
          <div key={section} className="mb-2">
            {open && (
              <div className="px-3 py-1.5 text-[9px] text-neutral-600 font-bold tracking-wider uppercase">
                {section}
              </div>
            )}
            {ADMIN_NAV.filter((n) => n.section === section).map((item) => (
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
