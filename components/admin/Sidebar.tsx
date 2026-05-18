"use client"

import { memo, useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { ADMIN_NAV, type AdminTab, type AdminNavItem } from "@/lib/admin/types"
import { getMyAdminPermissions, type AdminPermission } from "@/lib/data/admin-permissions"
import { getDashboardOverview } from "@/lib/data/admin-utilities"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

/**
 * AdminSidebar — wrapped in React.memo at the bottom of this file
 * (Phase 14.09 B). The two props `open` and `onToggle` are stable
 * across layout re-renders (open is React state, onToggle is wrapped
 * in useCallback in app/admin/layout.tsx) so the memo short-circuits
 * on every page navigation. The sidebar keeps its mount + realtime
 * channel + permissions cache untouched — no more flicker on nav.
 */
function AdminSidebarImpl({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = (searchParams?.get("tab") || "dashboard") as AdminTab
  // Phase 14.07c — for href-based items (App-Router pages outside the
  // tab router), active state matches when the current pathname starts
  // with the item's href.
  const isItemActive = (item: AdminNavItem): boolean => {
    if (item.href) {
      return Boolean(pathname && pathname.startsWith(item.href))
    }
    // Default: tab-based active state — but only when we're on the
    // /admin tab-router page (not on a deeper App-Router page).
    return pathname === "/admin" && currentTab === item.key
  }

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

  // ─── Phase 13.5 — comprehensive per-tab pending counts ──────────
  //
  // Every sidebar entry that has admin-actionable items shows a red
  // badge with the live count. The count is computed from the real
  // DB on mount + every 30s, and also bumped optimistically when
  // AdminRealtimeNotifier fires an `admin:badge-bump` window event.
  //
  // Mapping (source → sidebar tab):
  //   • KYC pending          → users
  //   • support open         → users
  //   • disputes open        → users (the panel lives in Users hub)
  //   • fee_unit_requests    → fees
  //   • payment_proofs       → fees
  //   • deals pending        → shares
  //   • council proposals    → council_admin
  //   • ambassador pending   → ambassadors_admin
  //
  // The number on each sidebar item is the SUM of every pending bucket
  // that lives under it. Click → opens that hub; the sub-tab counts
  // inside the hub guide the admin to the exact queue.
  const [badges, setBadges] = useState<Partial<Record<AdminTab, number>>>({})

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient()
      const ov = await getDashboardOverview()

      // Two extra counts not covered by get_dashboard_overview RPC.
      // Best-effort — failures (missing table / RLS) silently drop to 0.
      const [proofsRes, councilRes] = await Promise.all([
        supabase
          .from("payment_proofs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("council_proposals")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
      ])
      const proofsPending = proofsRes?.count ?? 0
      const councilOpen = councilRes?.count ?? 0

      const next: Partial<Record<AdminTab, number>> = {}
      const add = (tab: AdminTab, n: number) => {
        if (n > 0) next[tab] = (next[tab] ?? 0) + n
      }
      add("users", ov.kyc_pending ?? 0)
      add("users", ov.support_open ?? 0)
      add("users", ov.disputes_open ?? 0)
      add("fees", ov.fee_requests_pending ?? 0)
      add("fees", proofsPending)
      add("shares", ov.deals_pending ?? 0)
      add("council_admin", councilOpen)
      add("ambassadors_admin", ov.ambassador_pending ?? 0)
      setBadges(next)
    } catch {
      // best-effort — leave badges as-is on transient failures
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void refresh()
    const id = setInterval(() => { if (!cancelled) void refresh() }, 30_000)

    // Realtime — any change on a queue table refreshes the counts
    // immediately (no waiting for the 30s poll).
    const channel = supabase
      .channel("admin-sidebar-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" },     () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_unit_requests" },   () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" },      () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" },            () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" },               () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" },     () => { void refresh() })
      .on("postgres_changes", { event: "*", schema: "public", table: "council_proposals" },   () => { void refresh() })
      .subscribe()

    // Optimistic bump on the badge-bump window event so the number
    // ticks UP the moment AdminRealtimeNotifier shows a toast,
    // without waiting for the realtime channel to round-trip.
    const onBump = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { kind?: string }
        | undefined
      if (!detail) return
      const map: Record<string, AdminTab> = {
        kyc:           "users",
        support:       "users",
        dispute:       "users",
        fee_request:   "fees",
        payment_proof: "fees",
        council:       "council_admin",
      }
      const tab = map[detail.kind ?? ""] as AdminTab | undefined
      if (tab) {
        setBadges((prev) => ({ ...prev, [tab]: (prev[tab] ?? 0) + 1 }))
      }
      // Ground-truth reconcile shortly after.
      setTimeout(() => { if (!cancelled) void refresh() }, 800)
    }
    window.addEventListener("admin:badge-bump", onBump)

    return () => {
      cancelled = true
      clearInterval(id)
      try { supabase.removeChannel(channel) } catch { /* ignore */ }
      window.removeEventListener("admin:badge-bump", onBump)
    }
  }, [refresh])

  const allowed = (item: typeof ADMIN_NAV[number]): boolean => {
    if (perms === null) return true              // still loading — render all (avoids flicker)
    if (perms === "*") return true               // super_admin
    if (!item.requiredPermission) return true    // public/admin-default item
    return perms.includes(item.requiredPermission)
  }
  const visibleNav = ADMIN_NAV.filter(allowed)
  const visibleSections = Array.from(new Set(visibleNav.map((n) => n.section)))

  const goTo = (item: AdminNavItem) => {
    // Phase 14.07c — items with an explicit href push the full path
    // (App-Router pages like /admin/market-settings). Otherwise fall
    // back to the legacy ?tab=<key> routing on /admin.
    if (item.href) {
      router.push(item.href)
    } else {
      router.push(`/admin?tab=${item.key}`)
    }
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
        "admin-sidebar fixed top-0 right-0 bottom-0 z-40 bg-gradient-to-b from-[#0a0a0a] to-[#070707] border-l border-white/[0.05] transition-all duration-200 flex flex-col",
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
            <div className="w-8 h-8 overflow-hidden flex-shrink-0">
              {/* Dual mark: logo.png in dark, logo1.png in light —
                  globals.css toggles .logo-img-* by [data-theme]. */}
              <Image
                src="/logo.png"
                alt="RailOS"
                width={32}
                height={32}
                className="logo-img-dark w-full h-full object-contain"
              />
              <Image
                src="/logo1.png"
                alt="RailOS"
                width={32}
                height={32}
                className="logo-img-light w-full h-full object-contain"
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
            className="w-8 h-8 overflow-hidden hover:opacity-80 transition-opacity mx-auto"
            aria-label="RailOS Home"
          >
            <Image
              src="/logo.png"
              alt="RailOS"
              width={32}
              height={32}
              className="logo-img-dark w-full h-full object-contain"
            />
            <Image
              src="/logo1.png"
              alt="RailOS"
              width={32}
              height={32}
              className="logo-img-light w-full h-full object-contain"
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
              const active = isItemActive(item)
              return (
                <button
                  key={item.key}
                  onClick={() => goTo(item)}
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
                    <span className="admin-nav-active absolute inset-y-0.5 inset-x-1.5 rounded-lg bg-white/[0.08] border border-white/[0.08]" />
                  )}
                  {/* Active accent dot on the right (RTL) */}
                  {active && (
                    <span className="admin-nav-accent absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-white" />
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

/**
 * Phase 14.09 B — memo'd export. Re-renders of the parent layout
 * caused by `usePathname()` ticking on every admin navigation now
 * short-circuit here, so the sidebar's realtime channel + permissions
 * cache + badge counts all survive the navigation untouched.
 *
 * Default shallow comparison is enough because both props are stable:
 *   • `open`     — React state in app/admin/layout.tsx
 *   • `onToggle` — wrapped in useCallback in app/admin/layout.tsx
 */
export const AdminSidebar = memo(AdminSidebarImpl)
