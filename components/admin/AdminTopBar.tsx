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
// Phase 11.34 — direct-source fetchers so each dropdown renders real
// items from its queue table, not a filtered slice of the notifications
// table that may be missing rows for items the badge already counts.
import {
  getPendingKycSubmissions,
  getOpenSupportTickets,
  getPendingFeeRequests,
  type PendingKycSubmission,
  type OpenSupportTicket,
  type PendingFeeRequest,
} from "@/lib/data/admin-requests"

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

// Phase 11.09 — Web Audio chime for new admin notifications.
// Same two-tone pattern used by the user notification hook so the
// app has a consistent sound across surfaces.
let _adminAudioCtx: AudioContext | null = null
function playAdminNotifSound(): void {
  if (typeof window === "undefined") return
  try {
    type WindowAC = Window & { webkitAudioContext?: typeof AudioContext }
    if (!_adminAudioCtx) {
      const Ctx = window.AudioContext || (window as WindowAC).webkitAudioContext
      if (!Ctx) return
      _adminAudioCtx = new Ctx()
    }
    const ctx = _adminAudioCtx
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined)
    const now = ctx.currentTime
    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }
    tone(880, now, 0.15)
    tone(1320, now + 0.12, 0.20)
  } catch {
    /* best-effort */
  }
}

interface AdminProfile {
  id: string
  full_name: string
  email: string
  role: string
  initial: string
}

/**
 * Phase 11.34 — short Arabic relative time for the dropdown items.
 * Returns "منذ Xد" / "منذ Xس" / "منذ Xي" for a recent timestamp.
 */
function relTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  return `منذ ${Math.floor(hrs / 24)} ي`
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مؤسِّس",
  admin: "أدمن",
  ambassador: "سفير",
  user: "مستخدم",
}

/** Best-effort fetch for the recent items list.
 *
 * Phase 11.20 — strategy:
 *   1. Read the admin's UNREAD notifications directly from the table
 *      (this is the source of truth — captures every type including
 *      deal_request_received which the legacy RPC doesn't index).
 *   2. Merge with whatever the RPC returns (kyc / fees / support
 *      buckets so the per-icon dropdowns stay populated).
 *
 * Items returned from #1 carry the real `notification_type` so the
 * dropdown rendering can route to the right href + show the right
 * icon. Items from #2 use the RPC's already-mapped shape.
 */
async function fetchAdminNotifications(limit: number): Promise<AdminNotification[]> {
  const supabase = createClient()
  const out = new Map<string, AdminNotification>()

  // 1. Direct unread fetch (canonical source).
  // Phase 11.22 — only surface ADMIN-side notifications here. A
  // notification is "admin" when its link_url starts with /admin
  // (those are routed to admin pages — Order Center, KYC, etc.).
  // User-individual notifications (deal_completed → /portfolio,
  // gift_received → /gifts) are handled by the user app's bell.
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (auth?.user?.id) {
      const { data } = await supabase
        .from("notifications")
        .select("id, notification_type, title, message, link_url, created_at")
        .eq("user_id", auth.user.id)
        .eq("is_read", false)
        .like("link_url", "/admin%")  // admin-targeted only
        .order("created_at", { ascending: false })
        .limit(limit)
      for (const n of (data ?? []) as Array<{
        id: string
        notification_type: string | null
        title: string | null
        message: string | null
        link_url: string | null
        created_at: string | null
      }>) {
        const t = String(n.notification_type ?? "other")
        const friendlyType =
          t === "deal_request_received" ? "shares" :
          t === "fee_request" || t === "fee_request_received" ? "fee" :
          t === "kyc_submitted" ? "kyc" :
          t === "support_message" ? "support" :
          t.startsWith("dispute") ? "dispute" :
          "other"
        const icon =
          friendlyType === "shares" ? "🛒" :
          friendlyType === "fee" ? "💎" :
          friendlyType === "kyc" ? "🛡" :
          friendlyType === "support" ? "💬" :
          friendlyType === "dispute" ? "⚖" :
          "🔔"
        out.set(n.id, {
          id: n.id,
          type: friendlyType,
          icon,
          title: n.title ?? "—",
          body: n.message ?? "",
          time: n.created_at ?? "",
          // Phase 11.22 — guarantee an admin-shell URL even if the
          // RPC ever forgets to set it. Anything not starting with
          // /admin gets rewritten to the orders hub so the click
          // never bounces the admin out of the dashboard.
          href: (n.link_url && n.link_url.startsWith("/admin"))
            ? n.link_url
            : "/admin?tab=requests_hub",
        })
      }
    }
  } catch { /* best-effort */ }

  // 2. Merge with RPC items (for buckets the table read may miss).
  try {
    const { data, error } = await supabase.rpc("get_admin_notification_items", {
      p_limit: limit,
    })
    if (!error && Array.isArray(data)) {
      for (const n of data as AdminNotification[]) {
        if (!n.id) continue
        if (!out.has(n.id)) {
          out.set(n.id, {
            id: n.id,
            type: n.type ?? "other",
            icon: n.icon ?? "🔔",
            title: n.title ?? "—",
            body: n.body ?? "",
            time: n.time ?? "",
            href: n.href ?? "/admin?tab=requests_hub",
          })
        }
      }
    }
  } catch { /* best-effort */ }

  // Newest first (the table query is already DESC, but RPC items
  // may interleave with different timestamps).
  return Array.from(out.values())
    .sort((a, b) => (b.time || "").localeCompare(a.time || ""))
    .slice(0, limit)
}

/** Phase 11.20 — mark a single notification as read so it disappears
 *  from the bell dropdown after the admin clicks it. Best-effort —
 *  the navigation always proceeds even if the update fails. */
async function markNotificationRead(id: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
  } catch {
    /* ignore — UI keeps moving */
  }
}

/** Best-effort fetch for the badge counts.
 *
 * Phase 11.09 / 11.29 — strategy:
 *   1. Try the canonical RPC `get_admin_notification_counts` for the
 *      per-icon buckets (kyc, fees, support, etc.) — those drive the
 *      Shield / Orders / Chat icon badges.
 *   2. The Bell badge `total` is derived STRICTLY from the live
 *      `notifications` table count (admin-scoped), so it always matches
 *      what the dropdown actually displays. Previously we took
 *      max(rpc.total, live) which made the bell show "1" while the
 *      dropdown was empty — the user has no way to clear that ghost
 *      badge because the count is sourced from a different table.
 *   3. Falls back to all-zeros on any failure (best-effort).
 */
async function fetchUnreadCounts(): Promise<NotificationCounts> {
  const supabase = createClient()
  let base: NotificationCounts = ZERO_COUNTS

  try {
    const { data, error } = await supabase.rpc("get_admin_notification_counts")
    if (!error && data) {
      const r = data as Partial<NotificationCounts>
      base = {
        kyc: Number(r.kyc ?? 0),
        disputes: Number(r.disputes ?? 0),
        fees: Number(r.fees ?? 0),
        support: Number(r.support ?? 0),
        ambassadors: Number(r.ambassadors ?? 0),
        healthcare: Number(r.healthcare ?? 0),
        orphans: Number(r.orphans ?? 0),
        payment_proofs: Number(r.payment_proofs ?? 0),
        // Phase 11.29 — total starts at 0 and is OVERWRITTEN below by
        // the live notifications-table count. The RPC's `total` is
        // intentionally ignored for the bell badge to keep it in sync
        // with the dropdown items.
        total: 0,
      }
    }
  } catch {
    // ignore — fall through to direct table count below
  }

  // ── Bell badge = live notifications table count ──
  // Phase 11.22 — count ONLY admin-targeted unread rows (link_url
  // starts with /admin). User-side notifications (deal_completed →
  // /portfolio etc.) must not bump the admin bell, otherwise an
  // admin who is also a user sees their own user notifications in
  // the admin shell and clicking them bounces them out.
  // Phase 11.29 — this count is now AUTHORITATIVE for the bell badge
  // (no max() with the RPC's total). When the table is empty, the
  // badge disappears.
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (auth?.user?.id) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("is_read", false)
        .like("link_url", "/admin%")
      base = { ...base, total: Number(count ?? 0) }
    }
  } catch {
    // ignore — base is already populated from the RPC (or zeros)
  }

  return base
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

  // Phase 11.34 — direct-source items per dropdown. Each list is
  // populated when its dropdown opens (and its badge is non-zero).
  // The bell still uses allNotifs since those ARE notifications-table
  // rows; the other three icons read their actual queue tables.
  const [pendingKyc, setPendingKyc] = useState<PendingKycSubmission[]>([])
  const [openTickets, setOpenTickets] = useState<OpenSupportTicket[]>([])
  const [pendingFees, setPendingFees] = useState<PendingFeeRequest[]>([])

  const totalNotifs = counts.total
  // Phase 11.01 — Orders badge now = pending fee requests only.
  // Share-modification was removed; share-purchase pending count lives
  // inside the Order Center "طلبات الحصص" tab.
  const ordersCount = counts.fees

  // Phase 11.09 — counts now combine three triggers for instant UX:
  //   1. Initial fetch on mount.
  //   2. Polling fallback every 30 s (if realtime is not available).
  //   3. Realtime INSERT subscription on `notifications` for THIS admin
  //      → refreshes counts + lazy-reloads dropdown items + plays a
  //         short chime so the admin notices a new request without
  //         having to refresh the page.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const refresh = () => {
      fetchUnreadCounts().then((c) => { if (!cancelled) setCounts(c) })
    }
    refresh()
    const pollId = setInterval(refresh, 30_000)

    // Realtime channel — only subscribes once we know the user id.
    let channel: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth?.user?.id
        if (!uid || cancelled) return
        channel = supabase
          .channel(`admin-notifs-${uid}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
            () => {
              // New notification just landed — refresh counts + items.
              refresh()
              // Refresh the items list if any dropdown is open.
              fetchAdminNotifications(20).then((rows) => {
                if (!cancelled) setAllNotifs(rows)
              })
              // Play the same Web Audio chime used elsewhere in the app.
              playAdminNotifSound()
            }
          )
          .subscribe()
      } catch {
        // Realtime is best-effort — polling above will pick it up in ≤30 s.
      }
    })()

    return () => {
      cancelled = true
      clearInterval(pollId)
      if (channel) {
        try { supabase.removeChannel(channel) } catch { /* ignore */ }
      }
    }
  }, [])

  // Fetch admin profile once on mount.
  useEffect(() => {
    let cancelled = false
    fetchAdminProfile().then((p) => { if (!cancelled) setProfile(p) })
    return () => { cancelled = true }
  }, [])

  // Lazy-load the items list when ANY action dropdown opens.
  // Phase 11.29 — reconcile the bell badge with reality: if the live
  // items list comes back empty, force counts.total = 0 so the badge
  // doesn't linger at "1" while the dropdown shows "لا إشعارات".
  // Phase 11.34 — for the kyc / messages / orders dropdowns we also
  // fetch from the SOURCE table (kyc_submissions / support_tickets /
  // fee_unit_requests) and reconcile their counts the same way, so
  // the badge always matches what the dropdown displays.
  useEffect(() => {
    if (!open || open === "profile") return
    let cancelled = false

    if (open === "notifications") {
      fetchAdminNotifications(20).then((rows) => {
        if (cancelled) return
        setAllNotifs(rows)
        if (rows.length === 0) {
          setCounts((c) => ({ ...c, total: 0 }))
        }
      })
    } else if (open === "kyc") {
      getPendingKycSubmissions(10).then((rows) => {
        if (cancelled) return
        setPendingKyc(rows)
        // Reconcile badge with the real source.
        setCounts((c) => ({ ...c, kyc: rows.length }))
      })
    } else if (open === "messages") {
      getOpenSupportTickets(10).then((rows) => {
        if (cancelled) return
        setOpenTickets(rows)
        setCounts((c) => ({ ...c, support: rows.length }))
      })
    } else if (open === "orders") {
      getPendingFeeRequests().then((rows) => {
        if (cancelled) return
        setPendingFees(rows)
        setCounts((c) => ({ ...c, fees: rows.length }))
      })
    }

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

  // Phase 11.34 — recentSupport/recentOrders/recentKyc filtered slices
  // were removed; each dropdown now reads its own SOURCE table (see
  // pendingKyc / openTickets / pendingFees state above).

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
    // Phase 11.03 — hard navigation to fully clear React state, dedup
    // caches, realtime channels, and prevent the back button from
    // returning into the admin shell with a stale session.
    if (typeof window !== "undefined") {
      window.location.replace("/admin-login")
    }
  }, [])

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
                  onClick={async () => {
                    // Phase 11.20 — mark this row read first so it
                    // disappears from the dropdown + the bell badge
                    // decrements. Optimistic UI: drop it from local
                    // state immediately, then fire the DB update +
                    // refresh counts (+ navigate) in parallel.
                    setAllNotifs((cur) => cur.filter((x) => x.id !== n.id))
                    setCounts((c) => ({
                      ...c,
                      total: Math.max(0, c.total - 1),
                    }))
                    void markNotificationRead(n.id)
                    handleNavigate(n.href)
                  }}
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

      {/* ═══ Messages dropdown — Phase 11.34 reads support_tickets directly ═══ */}
      {open === "messages" && (
        <Dropdown title={`💬 الرسائل (${openTickets.length || counts.support})`} onSeeAll={() => handleNavigate("/admin?tab=support_inbox")} ctaLabel="📥 صندوق الدعم" side="right" rightOffset="ml-32 lg:ml-44">
          {openTickets.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا تذاكر مفتوحة</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {openTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleNavigate(`/admin?tab=support_inbox&ticket=${t.id}`)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">💬</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{t.subject}</div>
                    <div className="text-[10px] text-neutral-500 truncate mt-0.5">من: {t.user_name}</div>
                    <div className="text-[9px] text-neutral-600 mt-0.5 flex items-center gap-2">
                      <span className="font-mono" dir="ltr">{relTime(t.created_at)}</span>
                      <span className="bg-white/[0.06] border border-white/[0.1] text-neutral-300 px-1.5 py-px rounded">{t.status}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ Orders dropdown — Phase 11.34 reads fee_unit_requests directly ═══ */}
      {open === "orders" && (
        <Dropdown title={`📦 الطلبات (${pendingFees.length || ordersCount})`} onSeeAll={() => handleNavigate("/admin?tab=requests_hub")} ctaLabel="مركز الطلبات ←" side="right" rightOffset="ml-20 lg:ml-32">
          <div className="px-3 pt-2 pb-1 text-[9px] text-neutral-600 flex items-center gap-2">
            <span>💎 رسوم معلّقة: <span className="text-yellow-400 font-mono">{pendingFees.length}</span></span>
          </div>
          {pendingFees.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {pendingFees.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleNavigate(`/admin?tab=requests_hub&request=${o.id}`)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">💎</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">
                      {o.user_name} · <span className="text-yellow-400 font-mono">{o.amount_requested.toLocaleString("en-US")}</span> وحدة
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate mt-0.5">طريقة الدفع: {o.payment_method}</div>
                    <div className="text-[9px] text-neutral-600 mt-0.5 font-mono" dir="ltr">{relTime(o.submitted_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}

      {/* ═══ KYC dropdown — Phase 11.34 reads kyc_submissions directly ═══ */}
      {open === "kyc" && (
        <Dropdown title={`🛡️ طلبات التوثيق (${pendingKyc.length || counts.kyc})`} onSeeAll={() => handleNavigate("/admin?tab=users")} side="right" rightOffset="ml-8 lg:ml-20">
          {pendingKyc.length === 0 ? (
            <div className="text-xs text-neutral-500 text-center py-6">لا طلبات معلّقة</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {pendingKyc.map((k) => (
                <button
                  key={k.id}
                  onClick={() => handleNavigate(`/admin?tab=users&user=${k.user_id}`)}
                  className="w-full text-right p-3 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0 transition-colors flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0">🛡️</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{k.user_name}</div>
                    <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                      {k.document_type}{k.city ? ` · ${k.city}` : ""}
                    </div>
                    <div className="text-[9px] text-neutral-600 mt-0.5 font-mono" dir="ltr">{relTime(k.submitted_at)}</div>
                  </div>
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
