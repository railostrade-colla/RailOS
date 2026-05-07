"use client"

/**
 * AdminTopBar — Phase 10.73 (Task 1).
 *
 * Five icons (RTL: right-to-left order):
 *   1. 🔔 Bell        → all admin notifications via get_admin_notification_items
 *                       + count via get_admin_notification_counts
 *   2. 💬 Chat        → support_tickets WHERE status IN ('open','in_progress')
 *   3. 📦 Orders      → fee_unit_requests pending (share_modification removed in 11.01)
 *                       + fee_unit_requests pending (Phase 10.73 — was just fees)
 *   4. 🛡 Shield      → kyc_submissions WHERE status = 'pending'
 *   5. 👤 Profile     → real profiles row + auth.users.email (was hardcoded)
 *                       Dropdown: name + role + "ملفي الشخصي" + signOut()
 *
 * Counts refresh every 30s + items lazy-load on dropdown open.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Bell, MessageCircle, Package, Shield, ChevronDown,
  User, Sun, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/supabase/auth-helpers"
import { showSuccess } from "@/lib/utils/toast"

interface AdminNotification {
  id: string
  type: string
  icon: string
  title: string
  body: string
  time: string
  href: string
}

interface NotificationCounts {
  kyc: number
  disputes: number
  fees: number
  support: number
  ambassadors: number
  healthcare: number
  orphans: number
  payment_proofs: number
  total: number
}

const ZERO_COUNTS: NotificationCounts = {
  kyc: 0, disputes: 0, fees: 0, support: 0,
  ambassadors: 0, healthcare: 0, orphans: 0, payment_proofs: 0, total: 0,
}

interface AdminProfile {
  id: string
  full_name: string
  email: string
  role: string
  initial: string
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مؤسِّس",
  admin: "أدمن",
  ambassador: "سفير",
  user: "مستخدم",
}

/** Best-effort fetch for the recent items list. */
async function fetchAdminNotifications(limit: number): Promise<AdminNotification[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_admin_notification_items", {
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return []
    return (data as AdminNotification[]).map((n) => ({
      id: n.id,
      type: n.type ?? "other",
      icon: n.icon ?? "🔔",
      title: n.title ?? "—",
      body: n.body ?? "",
      time: n.time ?? "",
      href: n.href ?? "/admin?tab=requests_hub",
    }))
  } catch {
    return []
  }
}

/** Best-effort fetch for the badge counts. */
async function fetchUnreadCounts(): Promise<NotificationCounts> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_admin_notification_counts")
    if (error || !data) return ZERO_COUNTS
    const r = data as Partial<NotificationCounts>
    return {
      kyc: Number(r.kyc ?? 0),
      disputes: Number(r.disputes ?? 0),
      fees: Number(r.fees ?? 0),
      support: Number(r.support ?? 0),
      ambassadors: Number(r.ambassadors ?? 0),
      healthcare: Number(r.healthcare ?? 0),
      orphans: Number(r.orphans ?? 0),
      payment_proofs: Number(r.payment_proofs ?? 0),
      total: Number(r.total ?? 0),
    }
  } catch {
    return ZERO_COUNTS
  }
}

// Phase 11.01 — fetchSharesPendingCount() and the share_modification_requests
// table were removed entirely. The Orders badge now reflects only fee_requests
// pending count; share-purchase requests have their own dedicated badge in
// the Order Center (طلبات الحصص tab).

/** Phase 10.73 — current admin profile (replaces hardcoded "Admin@Main"). */
async function fetchAdminProfile(): Promise<AdminProfile | null> {
  try {
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user?.id) return null

    const [{ data: prof }, email] = [
      await supabase
        .from("profiles")
        .select("id, full_name, username, role")
        .eq("id", auth.user.id)
        .maybeSingle(),
      auth.user.email ?? "—",
    ]

    const p = prof as { id: string; full_name: string | null; username: string | null; role: string | null } | null
    if (!p) return null

    const name = p.full_name?.trim() || p.username?.trim() || (email?.split("@")[0]) || "—"
    return {
      id: p.id,
      full_name: name,
      email: email ?? "—",
      role: p.role ?? "user",
      initial: (name?.charAt(0) || "A").toUpperCase(),
    }
  } catch {
    return null
  }
}

type DropdownId = null | "notifications" | "messages" | "orders" | "kyc" | "profile"

export function AdminTopBar() {
  const router = useRouter()
  const [open, setOpen] = useState<DropdownId>(null)
  const ref = useRef<HTMLDivElement>(null)

  const [counts, setCounts] = useState<NotificationCounts>(ZERO_COUNTS)
  const [allNotifs, setAllNotifs] = useState<AdminNotification[]>([])
  const [profile, setProfile] = useState<AdminProfile | null>(null)

  const totalNotifs = counts.total
  // Phase 11.01 — Orders badge now = pending fee requests only.
  // Share-modification was removed; share-purchase pending count lives
  // inside the Order Center "طلبات الحصص" tab.
  const ordersCount = counts.fees

  // Initial fetch + polling every 30 s.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      fetchUnreadCounts().then((c) => { if (!cancelled) setCounts(c) })
    }
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Fetch admin profile once on mount.
  useEffect(() => {
    let cancelled = false
    fetchAdminProfile().then((p) => { if (!cancelled) setProfile(p) })
    return () => { cancelled = true }
  }, [])

  // Lazy-load the items list when ANY action dropdown opens.
  useEffect(() => {
    if (!open || open === "profile") return
    let cancelled = false
    fetchAdminNotifications(20).then((rows) => {
      if (!cancelled) setAllNotifs(rows)
    })
    return () => { cancelled = true }
  }, [open])

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Filtered subsets (only computed on dropdown render).
  const recentSupport = allNotifs.filter((n) => n.type === "support").slice(0, 5)
  const recentOrders = allNotifs.filter((n) => n.type === "fee" || n.type === "shares").slice(0, 8)
  const recentKyc = allNotifs.filter((n) => n.type === "kyc").slice(0, 5)

  const handleNavigate = (href: string) => {
    setOpen(null)
    router.push(href)
  }

  const handleSignOut = useCallback(async () => {
    setOpen(null)
    try {
      await signOut()
      showSuccess("تم تسجيل الخروج")
    } catch {
      // ignore — we still navigate
    }
    router.push("/admin-login")
    router.refresh()
  }, [router])

  return (
    <div ref={ref} className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06] px-5 py-2.5 flex items-center justify-between" dir="rtl">

      {/* Right side (RTL): icons */}
      <div className="flex items-center gap-1">
        {/* 1. Notifications */}
        <IconBtn
          icon={<Bell className="w-4 h-4" strokeWidth={1.5} />}
          badge={totalNotifs}
          active={open === "notifications"}
          onClick={() => setOpen(open === "notifications" ? null : "notifications")}
          ariaLabel="الإشعارات"
        />

        {/* 2. Messages */}
        <IconBtn
          icon={<MessageCircle className="w-4 h-4" strokeWidth={1.5} />}
          badge={counts.support}
          active={open === "messages"}
          onClick={() => setOpen(open === "messages" ? null : "messages")}
          ariaLabel="الرسائل"
        />

        {/* 3. Orders (shares + fees combined) — Phase 10.73 */}
        <IconBtn
          icon={<Package className="w-4 h-4" strokeWidth={1.5} />}
          badge={ordersCount}
          active={open === "orders"}
          onClick={() => setOpen(open === "orders" ? null : "orders")}
          ariaLabel="الطلبات (حصص + رسوم)"
        />

        {/* 4. KYC */}
        <IconBtn
          icon={<Shield className="w-4 h-4" strokeWidth={1.5} />}
          badge={counts.kyc}
          active={open === "kyc"}
          onClick={() => setOpen(open === "kyc" ? null : "kyc")}
          ariaLabel="طلبات التوثيق"
        />
      </div>

      {/* Left side (RTL): admin profile — Phase 10.73 real binding */}
      <button
        onClick={() => setOpen(open === "profile" ? null : "profile")}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors",
          open === "profile" ? "bg-white/[0.08] border-white/[0.15]" : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]"
        )}
      >
        <div className="w-7 h-7 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-xs font-bold text-purple-300">
          {profile?.initial ?? "A"}
        </div>
        <div className="text-right hidden lg:block">
          <div className="text-xs text-white font-bold leading-none">
            {profile?.full_name ?? "..."}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : "..."}
          </div>
        </div>
        <ChevronDown className="w-3 h-3 text-neutral-500" />
      </button>

      {/* ═══ Notifications dropdown ═══ */}
      {open === "notifications" && (
        <Dropdown title={`🔔 الإشعارات (${totalNotifs})`} onSeeAll={() => handleNavigate("/admin?tab=requests_hub")} side="right" rightOffset="ml-44 lg:ml-56">
          {allNotifs.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا إشعارات جديدة</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {allNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNavigate(n.href)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{n.title}</div>
                    {n.body && <div className="text-[10px] text-neutral-500 truncate mt-0.5">{n.body}</div>}
                    <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">{n.time}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Messages dropdown (support tickets) ═══ */}
      {open === "messages" && (
        <Dropdown title={`💬 الرسائل (${counts.support})`} onSeeAll={() => handleNavigate("/admin?tab=support_inbox")} ctaLabel="📥 صندوق الدعم" side="right" rightOffset="ml-32 lg:ml-44">
          {recentSupport.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا تذاكر جديدة</div>
          ) : (
            <div>
              {recentSupport.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleNavigate(t.href)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <div className="text-xs text-white font-bold truncate">{t.title}</div>
                  {t.body && <div className="text-[11px] text-neutral-400 truncate mt-0.5">{t.body}</div>}
                  <div className="text-[9px] text-neutral-600 mt-0.5 font-mono" dir="ltr">{t.time}</div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Orders dropdown — Phase 11.01: fees-only (share_mod removed) ═══ */}
      {open === "orders" && (
        <Dropdown title={`📦 الطلبات (${ordersCount})`} onSeeAll={() => handleNavigate("/admin?tab=requests_hub")} ctaLabel="مركز الطلبات ←" side="right" rightOffset="ml-20 lg:ml-32">
          <div className="px-3 pt-2 pb-1 text-[9px] text-neutral-600 flex items-center gap-2">
            <span>💎 رسوم معلّقة: <span className="text-yellow-400 font-mono">{counts.fees}</span></span>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {recentOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleNavigate(o.href)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">{o.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{o.title}</div>
                    {o.body && <div className="text-[11px] text-neutral-400 truncate mt-0.5">{o.body}</div>}
                    <div className="text-[9px] text-neutral-600 mt-0.5 font-mono" dir="ltr">{o.time}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ KYC dropdown ═══ */}
      {open === "kyc" && (
        <Dropdown title={`🛡️ طلبات KYC (${counts.kyc})`} onSeeAll={() => handleNavigate("/admin?tab=users")} side="right" rightOffset="ml-8 lg:ml-20">
          {recentKyc.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div>
              {recentKyc.map((k) => (
                <button
                  key={k.id}
                  onClick={() => handleNavigate(k.href)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <div className="text-xs text-white font-bold truncate">{k.title}</div>
                  {k.body && <div className="text-[11px] text-neutral-400 mt-0.5">{k.body}</div>}
                  <div className="text-[9px] text-neutral-600 mt-0.5 font-mono" dir="ltr">{k.time}</div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Profile dropdown — Phase 10.73 real DB binding ═══ */}
      {open === "profile" && (
        <div className="absolute top-full left-5 mt-2 w-64 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
              {profile?.initial ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-white font-bold truncate">
                {profile?.full_name ?? "—"}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5 truncate" dir="ltr">
                {profile?.email ?? "—"}
              </div>
              {profile?.role && (
                <div className="text-[9px] text-purple-400 mt-1 font-bold">
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </div>
              )}
            </div>
          </div>
          <div className="p-1">
            <DropdownMenuItem
              icon={<User className="w-3.5 h-3.5" />}
              label="ملفي الشخصي"
              onClick={() => handleNavigate("/admin?tab=admin_users")}
            />
            <DropdownMenuItem
              icon={<Sun className="w-3.5 h-3.5" />}
              label="تبديل الوضع"
              onClick={() => showSuccess("🌗 تبديل الوضع (قريباً)")}
            />
            <DropdownMenuItem
              icon={<LogOut className="w-3.5 h-3.5" />}
              label="تسجيل الخروج"
              onClick={handleSignOut}
              danger
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────

function IconBtn({
  icon, badge, active, onClick, ariaLabel,
}: {
  icon: React.ReactNode
  badge: number
  active: boolean
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "relative w-9 h-9 rounded-lg border flex items-center justify-center transition-colors",
        active ? "bg-white/[0.08] border-white/[0.15] text-white" : "bg-white/[0.04] border-white/[0.06] text-neutral-300 hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

function Dropdown({
  title, children, onSeeAll, ctaLabel, rightOffset,
}: {
  title: string
  children: React.ReactNode
  onSeeAll: () => void
  ctaLabel?: string
  side?: "right" | "left"
  rightOffset?: string
}) {
  return (
    <div className={cn("absolute top-full mt-2 w-80 max-w-[90vw] bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-50", rightOffset || "right-5")}>
      <div className="p-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="text-xs text-white font-bold">{title}</div>
      </div>
      {children}
      <button
        onClick={onSeeAll}
        className="w-full p-2.5 bg-white/[0.04] hover:bg-white/[0.06] text-[11px] text-blue-400 font-bold border-t border-white/[0.06] transition-colors"
      >
        {ctaLabel || "عرض الكل ←"}
      </button>
    </div>
  )
}

function DropdownMenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors text-right",
        danger ? "text-red-400 hover:bg-red-500/[0.08]" : "text-neutral-300 hover:bg-white/[0.05]"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
