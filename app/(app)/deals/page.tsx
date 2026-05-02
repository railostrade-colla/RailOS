"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Clock, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, Tabs, EmptyState } from "@/components/ui"
import {
  getDealsByUser,
  STATUS_META,
  checkAndExpireDeals,
} from "@/lib/escrow"
import type { EscrowDeal, EscrowDealStatus } from "@/lib/escrow"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const CURRENT_USER_ID = "me"

type DealsTab = "active" | "cancellation" | "disputed" | "completed" | "cancelled"

const TAB_STATUS_MAP: Record<DealsTab, EscrowDealStatus[]> = {
  active:        ["pending", "payment_confirmed"],
  cancellation:  ["cancellation_requested"],
  disputed:      ["disputed"],
  completed:     ["completed"],
  cancelled:     ["cancelled_mutual", "cancelled_expired"],
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

  // Tick — لتحديث الـ timer كل دقيقة
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Auto-expire pass on mount
  useEffect(() => {
    const allMine = getDealsByUser(CURRENT_USER_ID)
    checkAndExpireDeals(allMine)
  }, [])

  const allDeals = useMemo(() => getDealsByUser(CURRENT_USER_ID), [])

  const counts = useMemo(() => {
    const c = { active: 0, cancellation: 0, disputed: 0, completed: 0, cancelled: 0 }
    for (const d of allDeals) {
      for (const tabKey of Object.keys(TAB_STATUS_MAP) as DealsTab[]) {
        if (TAB_STATUS_MAP[tabKey].includes(d.status)) c[tabKey]++
      }
    }
    return c
  }, [allDeals])

  const filtered = useMemo(() => {
    return allDeals.filter((d) => TAB_STATUS_MAP[tab].includes(d.status))
  }, [allDeals, tab])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="🤝 صفقاتي"
            subtitle={`${allDeals.length} صفقة على هذا الحساب`}
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
          {filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title="لا توجد صفقات في هذا التصنيف"
              description={tab === "active" ? "ابدأ بفتح صفقة من السوق أو التبادل" : "ستظهر الصفقات هنا حسب حالتها"}
              action={tab === "active" ? { label: "فتح السوق", onClick: () => router.push("/exchange") } : undefined}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
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

function DealCard({ deal, onClick }: { deal: EscrowDeal; onClick: () => void }) {
  const role: "buyer" | "seller" = deal.buyer_id === CURRENT_USER_ID ? "buyer" : "seller"
  const counterparty = role === "buyer" ? deal.seller_name : deal.buyer_name
  const statusMeta = STATUS_META[deal.status]
  const timeLeft = new Date(deal.expires_at).getTime() - Date.now()
  const showTimer = (deal.status === "pending" || deal.status === "payment_confirmed" || deal.status === "cancellation_requested") && timeLeft > 0

  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
              role === "buyer"
                ? "bg-green-400/[0.1] border-green-400/30 text-green-400"
                : "bg-blue-400/[0.1] border-blue-400/30 text-blue-400"
            )}
          >
            {role === "buyer" ? <ArrowDownLeft className="w-5 h-5" strokeWidth={2} /> : <ArrowUpRight className="w-5 h-5" strokeWidth={2} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white mb-0.5">{deal.project_name}</div>
            <div className="text-[11px] text-neutral-400">
              {role === "buyer" ? "شراء من" : "بيع إلى"} <span className="text-white">{counterparty}</span>
            </div>
          </div>
        </div>
        <Badge color={statusMeta.color === "neutral" ? "neutral" : statusMeta.color as never} variant="soft" size="xs">
          {statusMeta.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-0.5">الكمية</div>
          <div className="text-xs font-bold text-white font-mono">{fmtNum(deal.shares_amount)}</div>
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
