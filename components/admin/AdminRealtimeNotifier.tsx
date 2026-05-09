"use client"

/**
 * AdminRealtimeNotifier — Phase 13.0.
 *
 * Sits at the top of /admin layout. Subscribes via Supabase Realtime
 * to every admin-relevant table. The MOMENT any new row arrives:
 *   1. plays a sound (different per event type)
 *   2. shows a stackable toast in the top-right
 *   3. emits a window event "admin:badge-bump" so the sidebar can
 *      bump the right badge counter without a full re-fetch.
 *
 * No polling. No page refresh required. The user's browser stays
 * connected via WebSocket and gets pushed events from Supabase.
 *
 * Tables watched:
 *   • notifications       — admin-targeted notifications
 *   • fee_unit_requests   — new fee charge requests
 *   • kyc_submissions     — new KYC applications
 *   • disputes            — new disputes opened
 *   • deals               — new pending deals
 *   • payment_proofs      — new payment proofs uploaded
 *   • support_tickets     — new support tickets
 *   • council_proposals   — new council proposals
 *
 * Each event is throttled — if the same kind fires twice within 2s
 * (rapid burst), only the first toast appears (the badge still counts
 * both).
 */

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  X,
  AlertCircle,
  Briefcase,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Vote,
  Receipt,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { playNotification } from "@/lib/sounds"
import { cn } from "@/lib/utils/cn"

interface AdminToast {
  id: string
  kind: AdminEventKind
  title: string
  body: string
  link: string
  createdAt: number
}

type AdminEventKind =
  | "kyc"
  | "fee_request"
  | "dispute"
  | "deal"
  | "payment_proof"
  | "support"
  | "council"
  | "notification"

const KIND_META: Record<
  AdminEventKind,
  { icon: typeof Bell; color: string; label: string }
> = {
  kyc:           { icon: ShieldCheck,    color: "blue",   label: "تحقّق KYC جديد" },
  fee_request:   { icon: CreditCard,     color: "yellow", label: "طلب شحن وحدات" },
  dispute:       { icon: AlertTriangle,  color: "red",    label: "نزاع جديد" },
  deal:          { icon: Briefcase,      color: "green",  label: "صفقة جديدة" },
  payment_proof: { icon: Receipt,        color: "blue",   label: "إثبات دفع جديد" },
  support:       { icon: HelpCircle,     color: "purple", label: "تذكرة دعم" },
  council:       { icon: Vote,           color: "purple", label: "اقتراح مجلس" },
  notification:  { icon: Bell,           color: "neutral", label: "إشعار" },
}

const TONE_CLASS: Record<string, string> = {
  blue:    "bg-blue-400/10 border-blue-400/30 text-blue-300",
  yellow:  "bg-yellow-400/10 border-yellow-400/30 text-yellow-300",
  red:     "bg-red-400/10 border-red-400/30 text-red-300",
  green:   "bg-green-400/10 border-green-400/30 text-green-300",
  purple:  "bg-purple-400/10 border-purple-400/30 text-purple-300",
  neutral: "bg-white/[0.05] border-white/[0.15] text-neutral-200",
}

const TOAST_TTL_MS = 8_000   // auto-dismiss after 8s
const THROTTLE_MS = 2_000    // suppress same-kind toasts within 2s

export function AdminRealtimeNotifier() {
  const router = useRouter()
  const [toasts, setToasts] = useState<AdminToast[]>([])
  const lastFiredRef = useRef<Map<AdminEventKind, number>>(new Map())
  const initialLoadedRef = useRef(false)

  // Helper: push a toast + emit window event for sidebar.
  const pushToast = (kind: AdminEventKind, title: string, body: string, link: string) => {
    // Throttle rapid bursts of the same kind.
    const last = lastFiredRef.current.get(kind) ?? 0
    const now = Date.now()
    if (now - last < THROTTLE_MS) {
      // Still emit the badge event even if we suppress the toast.
      window.dispatchEvent(new CustomEvent("admin:badge-bump", { detail: { kind } }))
      return
    }
    lastFiredRef.current.set(kind, now)

    const id = `${kind}-${now}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, kind, title, body, link, createdAt: now }])
    try {
      playNotification()
    } catch { /* ignore */ }

    // Emit for sidebar
    window.dispatchEvent(new CustomEvent("admin:badge-bump", { detail: { kind } }))

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_TTL_MS)
  }

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // Wait one tick before binding so initial-mount events from
    // table replication don't fire toasts retroactively.
    const startupGuard = setTimeout(() => {
      initialLoadedRef.current = true
    }, 1500)

    const channel = supabase
      .channel("admin-realtime-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kyc_submissions" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { id: string; user_id?: string }
          pushToast(
            "kyc",
            "🛡️ طلب تحقّق KYC جديد",
            `بانتظار المراجعة (${(row.id ?? "").slice(0, 8)}...)`,
            "/admin?tab=kyc",
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fee_unit_requests" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { amount_requested?: number }
          pushToast(
            "fee_request",
            "💎 طلب شحن وحدات",
            `${(row.amount_requested ?? 0).toLocaleString("en-US")} وحدة`,
            "/admin?tab=fees",
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "disputes" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { id: string; reason?: string }
          pushToast(
            "dispute",
            "⚖ نزاع جديد",
            row.reason?.slice(0, 60) ?? "بانتظار المراجعة",
            `/admin?tab=disputes`,
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { shares?: number; total_amount?: number }
          pushToast(
            "deal",
            "🤝 صفقة جديدة",
            `${row.shares ?? "—"} حصة · ${(row.total_amount ?? 0).toLocaleString("en-US")} د.ع`,
            "/admin?tab=shares",
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_proofs" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { amount_paid?: number }
          pushToast(
            "payment_proof",
            "🧾 إثبات دفع جديد",
            `${(row.amount_paid ?? 0).toLocaleString("en-US")} د.ع — راجع المطابقة`,
            "/admin?tab=fees",
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { subject?: string }
          pushToast(
            "support",
            "💬 تذكرة دعم جديدة",
            row.subject?.slice(0, 60) ?? "بدون عنوان",
            "/admin?tab=support_inbox",
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "council_proposals" },
        (payload) => {
          if (cancelled || !initialLoadedRef.current) return
          const row = payload.new as { title?: string }
          pushToast(
            "council",
            "🗳 اقتراح مجلس جديد",
            row.title?.slice(0, 60) ?? "—",
            "/admin?tab=council_admin",
          )
        },
      )
      .subscribe((status) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // eslint-disable-next-line no-console
          console.warn("[admin-realtime] status:", status)
        }
      })

    return () => {
      cancelled = true
      clearTimeout(startupGuard)
      try {
        supabase.removeChannel(channel)
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─────────────────────────────────────────────────────────────────

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 left-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const meta = KIND_META[t.kind]
        const Icon = meta.icon
        return (
          <div
            key={t.id}
            className={cn(
              "border rounded-xl shadow-2xl backdrop-blur-md p-3 flex items-start gap-3 pointer-events-auto animate-in slide-in-from-left",
              TONE_CLASS[meta.color],
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" strokeWidth={2} />
            </div>
            <button
              onClick={() => {
                router.push(t.link)
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }}
              className="flex-1 min-w-0 text-right"
            >
              <div className="text-xs font-bold text-white truncate">{t.title}</div>
              <div className="text-[10px] text-white/70 mt-0.5 truncate">{t.body}</div>
            </button>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-white/50 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
