"use client"

/**
 * LiveActivityFeed — Phase 13.1.
 *
 * A streaming feed of admin-relevant DB events. Instead of polling,
 * subscribes to the Supabase Realtime channel directly and pushes
 * each event into a capped list (50 entries, FIFO eviction).
 *
 * Each row shows: icon · title · subtitle · relative time · click → page.
 * Visually echoes Discord/Slack activity panes — admins instantly see
 * what's happening across the platform.
 */

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  Briefcase,
  Receipt,
  HelpCircle,
  Vote,
  TrendingUp,
  UserPlus,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

type EventKind =
  | "kyc"
  | "fee_request"
  | "payment_proof"
  | "dispute"
  | "deal"
  | "support"
  | "council"
  | "signup"
  | "deal_completed"

interface ActivityEvent {
  id: string
  kind: EventKind
  title: string
  subtitle?: string
  link: string
  ts: number
}

const META: Record<
  EventKind,
  { icon: typeof Briefcase; tone: string }
> = {
  kyc:            { icon: ShieldCheck,    tone: "text-blue-400 bg-blue-400/10" },
  fee_request:    { icon: CreditCard,     tone: "text-yellow-400 bg-yellow-400/10" },
  payment_proof:  { icon: Receipt,        tone: "text-blue-400 bg-blue-400/10" },
  dispute:        { icon: AlertTriangle,  tone: "text-red-400 bg-red-400/10" },
  deal:           { icon: Briefcase,      tone: "text-green-400 bg-green-400/10" },
  support:        { icon: HelpCircle,     tone: "text-purple-400 bg-purple-400/10" },
  council:        { icon: Vote,           tone: "text-purple-400 bg-purple-400/10" },
  signup:         { icon: UserPlus,       tone: "text-cyan-400 bg-cyan-400/10" },
  deal_completed: { icon: TrendingUp,     tone: "text-emerald-400 bg-emerald-400/10" },
}

const MAX_EVENTS = 50

function relTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  if (diff < 60_000) return "الآن"
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} د`
  if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} س`
  return new Date(ms).toLocaleDateString("ar-IQ")
}

const fmtNum = (n: number | null | undefined): string =>
  n != null ? n.toLocaleString("en-US") : "—"

export function LiveActivityFeed() {
  const router = useRouter()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const idRef = useRef(0)

  const push = (ev: Omit<ActivityEvent, "id" | "ts">) => {
    setEvents((prev) => {
      const next: ActivityEvent[] = [
        { ...ev, id: `e-${idRef.current++}`, ts: Date.now() },
        ...prev,
      ]
      return next.slice(0, MAX_EVENTS)
    })
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kyc_submissions" },
        (p) => {
          const r = p.new as { id: string }
          push({
            kind: "kyc",
            title: "طلب تحقّق KYC جديد",
            subtitle: `#${(r.id ?? "").slice(0, 8)}`,
            link: "/admin?tab=kyc",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fee_unit_requests" },
        (p) => {
          const r = p.new as { amount_requested?: number }
          push({
            kind: "fee_request",
            title: "طلب شحن وحدات",
            subtitle: `${fmtNum(r.amount_requested)} وحدة`,
            link: "/admin?tab=fees",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_proofs" },
        (p) => {
          const r = p.new as { amount_paid?: number }
          push({
            kind: "payment_proof",
            title: "إثبات دفع جديد",
            subtitle: `${fmtNum(r.amount_paid)} د.ع`,
            link: "/admin?tab=fees",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "disputes" },
        () => {
          push({
            kind: "dispute",
            title: "نزاع جديد",
            subtitle: "بانتظار المراجعة",
            link: "/admin?tab=disputes",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals" },
        (p) => {
          const r = p.new as { shares?: number; total_amount?: number }
          push({
            kind: "deal",
            title: "صفقة جديدة",
            subtitle: `${r.shares ?? "—"} حصة · ${fmtNum(r.total_amount)} د.ع`,
            link: "/admin?tab=shares",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals" },
        (p) => {
          const r = p.new as { status?: string; shares?: number }
          if (r.status !== "completed") return
          push({
            kind: "deal_completed",
            title: "صفقة اكتملت",
            subtitle: `${r.shares ?? "—"} حصة سُلِّمت`,
            link: "/admin?tab=shares",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (p) => {
          const r = p.new as { subject?: string }
          push({
            kind: "support",
            title: "تذكرة دعم",
            subtitle: r.subject?.slice(0, 50) ?? "—",
            link: "/admin?tab=support_inbox",
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "council_proposals" },
        (p) => {
          const r = p.new as { title?: string }
          push({
            kind: "council",
            title: "اقتراح مجلس",
            subtitle: r.title?.slice(0, 50) ?? "—",
            link: "/admin?tab=council_admin",
          })
        },
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch { /* ignore */ }
    }
  }, [])

  // Re-render every 30s so relative timestamps update.
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            🌊 النشاط المباشر
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            تدفّق لحظي للأحداث على المنصة
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-3xl mb-2 opacity-40">⏳</div>
          <div className="text-xs text-neutral-500">
            بانتظار أحداث جديدة...
          </div>
          <div className="text-[10px] text-neutral-600 mt-1">
            (سيظهر هنا أيّ نشاط جديد فور حدوثه)
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {events.map((e) => {
            const meta = META[e.kind]
            const Icon = meta.icon
            return (
              <button
                key={e.id}
                onClick={() => router.push(e.link)}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.1] transition-colors text-right"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    meta.tone,
                  )}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {e.title}
                  </div>
                  {e.subtitle && (
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {e.subtitle}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 flex-shrink-0 mt-1">
                  {relTime(e.ts)}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
