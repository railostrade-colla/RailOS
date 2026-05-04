"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Clock, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, Tabs, EmptyState } from "@/components/ui"
import { createClient } from "@/lib/supabase/client"
// Phase 4.4: list view now reads from real `deals` table (joined with
// projects + profiles). Detail view (/deals/[id]) and the exchange flow
// still use the in-memory escrow store — they migrate in Phase 4.X
// after the deal_status enum gains a `cancellation_requested` value.
import {
  getMyDealsEnriched,
  STATUS_META_DB,
  type MyDealEnriched,
  type DBDealStatus,
} from "@/lib/data/deals"
import { useRealtimeMyDeals } from "@/lib/realtime/useRealtimeMyDeals"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type DealsTab = "active" | "cancellation" | "disputed" | "completed" | "cancelled"

/**
 * Maps each UI tab to the DB statuses it should surface.
 * `cancellation` is intentionally empty — there's no
 * `cancellation_requested` value in the DB enum yet (TODO Phase 4.X).
 */
const TAB_STATUS_MAP: Record<DealsTab, DBDealStatus[]> = {
  active:        ["pending_seller_approval", "accepted", "payment_submitted"],
  cancellation:  [], // TODO Phase 4.X — needs `cancellation_requested` enum value
  disputed:      ["disputed"],
  completed:     ["completed"],
  cancelled:     ["cancelled", "expired", "rejected"],
}

const TABS: Array<{ id: DealsTab; label: string; icon: string }> = [
  { id: "active",       label: "نشطة",         icon: "🔥" },
  { id: "cancellation", label: "إلغاء معلّق",   icon: "🚫" },
  { id: "disputed",     label: "نزاع",         icon: "⚖️" },
  { id: "completed",    label: "مكتملة",       icon: "✅" },
  { id: "cancelled",    label: "ملغاة",        icon: "❌" },
]

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "انتهى"
  const hrs = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hrs > 0) return `${hrs}س ${mins}د`
  return `${mins}د`
}

export default function DealsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<DealsTab>("active")

  // Real DB-backed state (Phase 4.4)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [allDeals, setAllDeals] = useState<MyDealEnriched[]>([])
  const [loading, setLoading] = useState(true)

  // Tick — يحدّث الـ timer كل دقيقة
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Realtime tick — increments whenever any of the user's deals change
  const { tick: realtimeTick } = useRealtimeMyDeals(currentUserId || null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      setCurrentUserId(user?.id ?? "")

      const deals = await getMyDealsEnriched()
      if (cancelled) return
      setAllDeals(deals)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // realtimeTick triggers a re-fetch whenever a deal row changes.
  }, [realtimeTick])

  const counts = useMemo(() => {
    const c = { active: 0, cancellation: 0, disputed: 0, completed: 0, cancelled: 0 }
    for (const d of allDeals) {
      for (const tabKey of Object.keys(TAB_STATUS_MAP) as DealsTab[]) {
        if ((TAB_STATUS_MAP[tabKey] as string[]).includes(d.status)) c[tabKey]++
      }
    }
    return c
  }, [allDeals])

  const filtered = useMemo(() => {
    return allDeals.filter((d) => (TAB_STATUS_MAP[tab] as string[]).includes(d.status))
  }, [allDeals, tab])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="🤝 صفقاتي"
            subtitle={loading ? "جاري التحميل..." : `${allDeals.length} صفقة على هذا الحساب`}
            backHref="/dashboard"
          />

          {/* ═══ Tabs ═══ */}
          <div className="mb-4">
            <Tabs
              tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
              activeTab={tab}
              onChange={(id) => setTab(id as DealsTab)}
            />
          </div>

          {/* ═══ Deals list ═══ */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 animate-pulse"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 bg-white/[0.06] rounded" />
                        <div className="h-2.5 w-40 bg-white/[0.05] rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-white/[0.06] rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="h-12 bg-white/[0.04] rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="لا توجد صفقات في هذا التصنيف"
              description={
                tab === "active"
                  ? "ابدأ بفتح صفقة من السوق أو التبادل"
                  : tab === "cancellation"
                    ? "لا توجد طلبات إلغاء معلّقة حالياً"
                    : "ستظهر الصفقات هنا حسب حالتها"
              }
              action={tab === "active" ? { label: "فتح السوق", onClick: () => router.push("/exchange") } : undefined}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  currentUserId={currentUserId}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-component: Single deal card
// ──────────────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  currentUserId,
  onClick,
}: {
  deal: MyDealEnriched
  currentUserId: string
  onClick: () => void
}) {
  const role: "buyer" | "seller" =
    deal.buyer_id === currentUserId ? "buyer" : "seller"
  const counterparty = role === "buyer" ? deal.seller_name : deal.buyer_name
  const statusMeta = STATUS_META_DB[deal.status]
  const timeLeft = new Date(deal.expires_at).getTime() - Date.now()
  const showTimer =
    (deal.status === "pending_seller_approval" ||
      deal.status === "accepted" ||
      deal.status === "payment_submitted") &&
    timeLeft > 0

  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
              role === "buyer"
                ? "bg-green-400/[0.1] border-green-400/30 text-green-400"
                : "bg-blue-400/[0.1] border-blue-400/30 text-blue-400",
            )}
          >
            {role === "buyer" ? (
              <ArrowDownLeft className="w-5 h-5" strokeWidth={2} />
            ) : (
              <ArrowUpRight className="w-5 h-5" strokeWidth={2} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white mb-0.5">
              {deal.project_name}
            </div>
            <div className="text-[11px] text-neutral-400">
              {role === "buyer" ? "شراء من" : "بيع إلى"}{" "}
              <span className="text-white">{counterparty}</span>
            </div>
          </div>
        </div>
        <Badge color={statusMeta.color} variant="soft" size="xs">
          {statusMeta.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-0.5">الكمية</div>
          <div className="text-xs font-bold text-white font-mono">{fmtNum(deal.shares)}</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-0.5">السعر</div>
          <div className="text-xs font-bold text-white font-mono">{fmtNum(deal.price_per_share)}</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-0.5">الإجمالي</div>
          <div className="text-xs font-bold text-yellow-400 font-mono">{fmtNum(deal.total_amount)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {showTimer ? (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold">
            <Clock className="w-3 h-3" strokeWidth={2} />
            متبقّي: {formatTimeLeft(timeLeft)}
          </div>
        ) : (
          <span className="text-[10px] text-neutral-500" dir="ltr">
            {new Date(deal.created_at).toLocaleDateString("en-GB")}
          </span>
        )}
        <span className="text-[11px] text-blue-400 font-bold flex items-center gap-1">
          التفاصيل
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        </span>
      </div>
    </Card>
  )
}
