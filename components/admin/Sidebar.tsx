"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { ADMIN_NAV, type AdminTab } from "@/lib/admin/types"
import { getMyAdminPermissions, type AdminPermission } from "@/lib/data/admin-permissions"
import { createClient } from "@/lib/supabase/client"
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

  // Phase 11.21 — per-tab notification badges.
  // Map a tab key → unread/pending count. Polled every 30s and also
  // updated via realtime INSERT/UPDATE on the notifications table.
  // Counts use SECURITY DEFINER queries / public reads only, no
  // admin-RPC dependency, so they show up for every admin tier.
  const [badges, setBadges] = useState<Partial<Record<AdminTab, number>>>({})
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const refresh = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth?.user?.id || cancelled) return
        const uid = auth.user.id

        // Count unread ADMIN-targeted notifications for this admin
        // (drives the requests_hub badge). Phase 11.22 filter:
        // user-side notifications (deal_completed → /portfolio,
        // gift_received → /gifts) must not appear in the admin
        // sidebar even when the admin's user_id receives them.
        const { count: unread } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("is_read", false)
          .like("link_url", "/admin%")

        if (cancelled) return
        const next: Partial<Record<AdminTab, number>> = {}
        if ((unread ?? 0) > 0) next["requests_hub"] = unread ?? 0
        setBadges(next)
      } catch {
        // best-effort
      }
    }
    refresh()
    const id = setInterval(refresh, 30_000)

    // Realtime: any new INSERT or is_read flip on notifications →
    // refresh the count immediately.
    let ch: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id
        if (!uid || cancelled) return
        ch = supabase
          .channel(`sidebar-notifs-${uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
            () => { void refresh() }
          )
          .subscribe()
      } catch { /* ignore */ }
    })()

    // Phase 13.0 — listen for AdminRealtimeNotifier badge-bump events.
    // Optimistic increment so the sidebar number ticks UP the moment
    // a new request arrives, without waiting for the next refresh().
    const onBump = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { kind?: string }
        | undefined
      if (!detail) return
      setBadges((prev) => {
        const next = { ...prev }
        // Map the realtime event kind → which sidebar tab gets bumped.
        const map: Record<string, AdminTab> = {
          kyc:           "users",
          fee_request:   "fees",
          dispute:       "shares",
          deal:          "shares",
          payment_proof: "fees",
          support:       "system",
          council:       "council_admin",
        }
        const tab = map[detail.kind ?? ""] as AdminTab | undefined
        if (tab) {
          next[tab] = (next[tab] ?? 0) + 1
        }
        // requests_hub always reflects the total unread admin notifs.
        next["requests_hub"] = (next["requests_hub"] ?? 0) + 1
        return next
      })
      // Ground-truth refresh in 500ms so optimistic count corrects
      // back to reality.
      setTimeout(() => { void refresh() }, 500)
    }
    window.addEventListener("admin:badge-bump", onBump)

    return () => {
      cancelled = true
      clearInterval(id)
      if (ch) { try { supabase.removeChannel(ch) } catch { /* ignore */ } }
      window.removeEventListener("admin:badge-bump", onBump)
    }
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
        // Phase 13.2 — slightly narrower (200 vs 220) so more horizontal
        // space is left for the main panel; subtle gradient bg + softer
        // left border for a more polished look.
        "fixed top-0 right-0 bottom-0 z-40 bg-gradient-to-b from-[#0a0a0a] to-[#070707] border-l border-white/[0.05] transition-all duration-200 flex flex-col",
        open ? "w-[200px]" : "w-[56px]"
      )}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/[0.05] flex items-center justify-between">
        {open ? (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
            onClick={() => router.push("/admin?tab=dashboard")}
            role="button"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.04] flex-shrink-0">
              <Image
                src="/logo.png"
                alt="RailOS"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-none truncate">RaiLOS</div>
              <div className="text-[9px] text-neutral-500 mt-1 truncate">لوحة الإدارة</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => router.push("/admin?tab=dashboard")}
            className="w-8 h-8 rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.04] hover:opacity-80 transition-opacity mx-auto"
            aria-label="RailOS Home"
          >
            <Image
              src="/logo.png"
              alt="RailOS"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </button>
        )}
        {open && (
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] flex items-center justify-center transition-colors text-neutral-400"
            aria-label="toggle"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Collapsed-mode toggle button (own row when sidebar is closed) */}
      {!open && (
        <button
          onClick={onToggle}
          className="mx-auto my-2 w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] flex items-center justify-center transition-colors text-neutral-400"
          aria-label="toggle"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1.5">
        {visibleSections.map((section, sIdx) => (
          <div key={section} className={cn("mb-1.5", sIdx > 0 && "mt-2")}>
            {open ? (
              <div className="px-3 py-1 text-[9px] text-neutral-600 font-bold tracking-[0.12em] uppercase flex items-center gap-2">
                <span className="truncate">{section}</span>
                <span className="flex-1 h-px bg-white/[0.05]" />
              </div>
            ) : (
              // Collapsed: a thin divider between sections (skip before
              // the first section for a cleaner top edge).
              sIdx > 0 && <div className="mx-2 h-px bg-white/[0.05] mb-1" />
            )}
            {visibleNav.filter((n) => n.section === section).map((item) => {
              const badge = badges[item.key] ?? 0
              const active = currentTab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => goTo(item.key)}
                  title={!open ? item.label : undefined}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 px-3 py-2 transition-all text-right",
                    active
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  {/* Active-state pill background — Phase 13.2: a soft
                      rounded panel instead of the hard right-border bar
                      so the active item feels integrated with the panel
                      edge but doesn't draw a sharp 2-px line. */}
                  {active && (
                    <span className="absolute inset-y-0.5 inset-x-1.5 rounded-lg bg-white/[0.08] border border-white/[0.08]" />
                  )}
                  {/* Active accent dot on the right (RTL) */}
                  {active && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-white" />
                  )}
                  <span className="relative text-base flex-shrink-0 leading-none">
                    {item.icon}
                    {!open && badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#0a0a0a]" />
                    )}
                  </span>
                  {open && (
                    <>
                      <span
                        className={cn(
                          "relative text-[12px] font-medium truncate flex-1",
                          active ? "font-semibold" : ""
                        )}
                      >
                        {item.label}
                      </span>
                      {badge > 0 && (
                        <span className="relative bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center flex-shrink-0 shadow-[0_0_0_2px_rgba(10,10,10,0.6)]">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-white/[0.05]">
        <button
          onClick={logout}
          title={!open ? "تسجيل الخروج" : undefined}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/[0.08] hover:text-red-300 transition-colors",
            !open && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          {open && <span className="text-xs">تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  )
}
