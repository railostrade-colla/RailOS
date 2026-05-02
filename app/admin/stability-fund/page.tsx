"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Settings } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge } from "@/components/ui"
import { MOCK_FUND_BALANCE, MOCK_FUND_TRANSACTIONS } from "@/lib/mock-data/market"
import type { FundTransaction, FundTxType } from "@/lib/market/types"
import { cn } from "@/lib/utils/cn"

const fmt = (n: number) => n.toLocaleString("en-US")

const TX_META: Record<FundTxType, { label: string; color: "green" | "red" | "blue" | "yellow"; icon: "in" | "out" | "neutral" }> = {
  commission_inflow: { label: "إيرادات",       color: "green",  icon: "in" },
  buy_intervention:  { label: "تدخل بالشراء",  color: "red",    icon: "out" },
  sell_release:      { label: "إطلاق بيع",     color: "blue",   icon: "in" },
  adjustment:        { label: "تسوية",         color: "yellow", icon: "neutral" },
}

export default function StabilityFundPage() {
  const balance = MOCK_FUND_BALANCE
  const transactions = useMemo(
    () => [...MOCK_FUND_TRANSACTIONS].sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1)),
    [],
  )

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="💰 صندوق الاستقرار"
            subtitle="إدارة احتياطي السوق"
            backHref="/admin"
          />

          {/* ═══ § 1: 3 main balances ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <Card variant="gradient" color="green">
              <div className="text-[11px] text-green-400/80 mb-1">الرصيد المتاح</div>
              <div className="text-3xl font-bold text-green-400 font-mono mb-1">
                {fmt(balance.available_balance)}
              </div>
              <div className="text-[10px] text-neutral-500">د.ع</div>
            </Card>

            <Card>
              <div className="text-[11px] text-neutral-500 mb-1">إجمالي الإيرادات</div>
              <div className="text-2xl font-bold text-white font-mono mb-1">
                {fmt(balance.total_inflow)}
              </div>
              <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 text-green-400" />
                إجمالي تدفق
              </div>
            </Card>

            <Card>
              <div className="text-[11px] text-neutral-500 mb-1">إجمالي التدخلات</div>
              <div className="text-2xl font-bold text-white font-mono mb-1">
                {fmt(balance.total_interventions)}
              </div>
              <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                مصروف على المشاريع
              </div>
            </Card>
          </div>

          {/* ═══ § 2: Profit highlight ═══ */}
          <Card variant="highlighted" color="blue" className="mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] text-blue-400/80 mb-1">الأرباح من حركة السوق</div>
                <div className="text-3xl font-bold text-blue-400 font-mono">
                  +{fmt(balance.total_profit)}
                  <span className="text-xs text-blue-400/70 font-sans font-normal mr-2">د.ع</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-400/[0.08] border border-blue-400/25 rounded-full px-3 py-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" strokeWidth={2.5} />
                <span className="text-[11px] text-blue-400 font-bold">صافي الربح</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <StatCard size="sm" label="رصيد إجمالي" value={fmt(balance.total_balance)} color="blue" />
              <StatCard size="sm" label="رصيد محجوز" value={fmt(balance.reserved_balance)} />
            </div>
          </Card>

          {/* ═══ § 3: Transactions log ═══ */}
          <SectionHeader
            title="📋 سجل الحركات"
            subtitle={`${transactions.length} حركة مسجّلة`}
          />
          <Card padding="sm">
            <div className="space-y-1">
              {transactions.map((tx, i) => (
                <TransactionRow key={tx.id} tx={tx} isLast={i === transactions.length - 1} />
              ))}
            </div>
          </Card>

        </div>
      </div>
    </AppLayout>
  )
}

function TransactionRow({ tx, isLast }: { tx: FundTransaction; isLast: boolean }) {
  const meta = TX_META[tx.type]
  const Icon = meta.icon === "in" ? ArrowUpRight : meta.icon === "out" ? ArrowDownRight : Settings
  const sign = meta.icon === "in" ? "+" : meta.icon === "out" ? "-" : ""
  const colorClass =
    meta.color === "green" ? "text-green-400" :
    meta.color === "red" ? "text-red-400" :
    meta.color === "blue" ? "text-blue-400" : "text-yellow-400"

  return (
    <div className={cn("flex items-center gap-3 p-3", !isLast && "border-b border-white/[0.04]")}>
      <div className={cn(
        "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0",
        meta.color === "green" && "bg-green-400/[0.08] border-green-400/25",
        meta.color === "red"   && "bg-red-400/[0.08] border-red-400/25",
        meta.color === "blue"  && "bg-blue-400/[0.08] border-blue-400/25",
        meta.color === "yellow" && "bg-yellow-400/[0.08] border-yellow-400/25",
      )}>
        <Icon className={cn("w-4 h-4", colorClass)} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <Badge color={meta.color} variant="soft" size="xs">{meta.label}</Badge>
          {tx.project_name && (
            <span className="text-[11px] text-white truncate">· {tx.project_name}</span>
          )}
        </div>
        <div className="text-[10px] text-neutral-500 flex items-center gap-2 flex-wrap">
          <span dir="ltr">{tx.recorded_at.slice(0, 10)}</span>
          {tx.shares_count !== undefined && (
            <>
              <span>·</span>
              <span className="font-mono">{tx.shares_count} حصة</span>
            </>
          )}
          {tx.notes && (
            <>
              <span>·</span>
              <span>{tx.notes}</span>
            </>
          )}
        </div>
      </div>

      <div className={cn("text-sm font-bold font-mono flex-shrink-0", colorClass)}>
        {sign}{fmt(tx.amount)}
      </div>
    </div>
  )
}
