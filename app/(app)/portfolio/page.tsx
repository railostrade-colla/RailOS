"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Send, Download, Zap, CreditCard, TrendingUp, X, Coins, ArrowDownToLine, ArrowUpFromLine, Briefcase, BarChart3, History, Trophy, Sparkles, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import {
  LEVEL_LIMITS,
  LEVEL_LABELS,
  LEVEL_ICONS,
  fmtLimit,
  computeContractLimit,
  type InvestorLevel,
} from "@/lib/utils/contractLimits"
// Production mode — contracts panel hidden until per-member level
// data is exposed by the DB. The legacy mock array USER_ACTIVE_CONTRACTS
// drove the "حدود إضافية من العقود" preview; we now empty-default it.
const USER_ACTIVE_CONTRACTS: Array<{
  id: string
  name: string
  members: Array<{ name: string; level: import("@/lib/utils/contractLimits").InvestorLevel }>
}> = []
import {
  getPortfolioData,
  submitFeeRequest as apiSubmitFeeRequest,
  type PortfolioData,
} from "@/lib/data/portfolio"
import {
  getContractHoldings,
  getContractTransactions,
  type ContractHoldingRow,
  type ContractTransactionRow,
} from "@/lib/data/contracts"
import { AccountSwitcher } from "@/components/wallet/AccountSwitcher"
import { useActiveAccount } from "@/contexts/ActiveAccountContext"
import { ShareTransferModal } from "@/components/portfolio/ShareTransferModal"
import { ArrowRightLeft } from "lucide-react"

// TODO Phase 4.X — derive from this month's deals.total_amount sum.
const CURRENT_USER_USED_THIS_MONTH = 0

/** Map raw DB level → InvestorLevel supported by contractLimits. */
function safeInvestorLevel(raw: string | undefined | null): InvestorLevel {
  if (raw === "advanced" || raw === "pro") return raw
  return "basic"
}

type PortfolioTab = "holdings" | "stats" | "history" | "fee_units"

const sectorIcon = (s: string) => {
  if (s?.includes("زراع")) return "🌾"
  if (s?.includes("تجار")) return "🏪"
  if (s?.includes("عقار")) return "🏢"
  if (s?.includes("صناع")) return "🏭"
  if (s?.includes("طب")) return "🏥"
  return "🏢"
}

const fmtIQD = (n: number) => n.toLocaleString("en-US")

/** ISO timestamp → 'YYYY-MM-DD' (en-US locale, RTL-safe). */
const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
}

const reasonLabel = (reason: string) => {
  if (reason === "admin_topup") return "👨‍💼 من الإدارة"
  if (reason === "listing_fee") return "📝 رسوم إدراج"
  if (reason === "auction_fee") return "🏆 رسوم مزاد"
  if (reason === "direct_buy_fee") return "🛒 رسوم شراء"
  if (reason === "quick_sell_fee") return "⚡ بيع سريع"
  return "💳 " + reason
}

const opLabel = (op: string) => {
  // Legacy share-movement types (will be wired in Phase 4.4 /deals).
  if (op === "deal_buy") return { icon: "📈", label: "شراء حصص (صفقة)", color: "text-green-400", bg: "bg-green-400/10" }
  if (op === "deal_sell") return { icon: "📉", label: "بيع حصص (صفقة)", color: "text-red-400", bg: "bg-red-400/10" }
  if (op === "shares_sent") return { icon: "📤", label: "إرسال حصص", color: "text-orange-400", bg: "bg-orange-400/10" }
  if (op === "shares_received") return { icon: "📥", label: "استلام حصص", color: "text-blue-400", bg: "bg-blue-400/10" }
  // Phase 4.2 — fee_unit_transactions.type values.
  if (op === "deposit") return { icon: "💰", label: "إيداع وحدات", color: "text-green-400", bg: "bg-green-400/10" }
  if (op === "withdrawal") return { icon: "💸", label: "خصم وحدات", color: "text-red-400", bg: "bg-red-400/10" }
  if (op === "subscription") return { icon: "⚡", label: "اشتراك", color: "text-purple-400", bg: "bg-purple-400/10" }
  if (op === "bonus") return { icon: "🎁", label: "مكافأة", color: "text-yellow-400", bg: "bg-yellow-400/10" }
  if (op === "refund") return { icon: "↩️", label: "استرجاع", color: "text-blue-400", bg: "bg-blue-400/10" }
  if (op === "adjustment") return { icon: "🔧", label: "تعديل", color: "text-neutral-400", bg: "bg-white/[0.08]" }
  return { icon: "💼", label: op, color: "text-white", bg: "bg-white/[0.08]" }
}

const VALID_TABS: ReadonlyArray<PortfolioTab> = ["holdings", "stats", "history", "fee_units"]

function PortfolioContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (() => {
    const t = searchParams.get("tab") as PortfolioTab | null
    return t && VALID_TABS.includes(t) ? t : "holdings"
  })()
  const [tab, setTab] = useState<PortfolioTab>(initialTab)
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [feeAmount, setFeeAmount] = useState(0)
  const [feeNote, setFeeNote] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"zaincash" | "mastercard" | "bank">("zaincash")

  // Phase 4.2 — Real DB-backed portfolio data.
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingFee, setSubmittingFee] = useState(false)

  // Phase 9.3a — multi-account state.
  const { active } = useActiveAccount()
  const [contractHoldings, setContractHoldings] = useState<ContractHoldingRow[]>([])
  const [contractTxns, setContractTxns] = useState<ContractTransactionRow[]>([])

  // Phase 10 — share-transfer modal state
  const [transferTarget, setTransferTarget] = useState<{
    project_id: string
    project_name: string
    available_shares: number
    price_per_share: number
  } | null>(null)

  // Re-fetch contract-specific data whenever the active account flips.
  useEffect(() => {
    let cancelled = false
    if (active.kind !== "contract") {
      setContractHoldings([])
      setContractTxns([])
      return
    }
    Promise.all([
      getContractHoldings(active.contractId),
      getContractTransactions(active.contractId),
    ]).then(([h, t]) => {
      if (cancelled) return
      setContractHoldings(h)
      setContractTxns(t)
    })
    return () => { cancelled = true }
  }, [active])

  const refresh = async () => {
    const fresh = await getPortfolioData()
    setData(fresh)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    getPortfolioData().then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Derived state from real data (with safe zero defaults during loading).
  const holdings = data?.holdings ?? []
  const summary = data?.summary
  const feeRequests = data?.feeRequests ?? []
  const feeTransactions = data?.feeTransactions ?? []

  const totalShares = summary?.totalShares ?? 0
  const totalValue = summary?.totalValue ?? 0
  const totalInvested = summary?.totalInvested ?? 0
  const netProfit = summary?.totalProfit ?? 0
  const profitPct = totalInvested > 0
    ? ((netProfit / totalInvested) * 100).toFixed(2)
    : "0"
  const isUp = netProfit >= 0
  const bestPerformerPct = summary?.bestPerformerPct ?? 0
  const bestHolding = summary?.bestPerformerHolding ?? null

  // Fee units
  const feeBalance = data?.feeBalance.balance ?? 0
  const pendingCount = feeRequests.filter((r) => r.status === "pending").length

  // Level (DB → InvestorLevel; supports basic/advanced/pro, downgrades elite → basic)
  const userLevel: InvestorLevel = safeInvestorLevel(data?.level)

  const submitFeeRequest = async () => {
    if (!feeAmount || feeAmount < 1) {
      showError("أدخل عدداً صحيحاً موجباً")
      return
    }
    if (!paymentMethod) {
      showError("اختر طريقة الدفع")
      return
    }
    setSubmittingFee(true)
    const id = await apiSubmitFeeRequest({
      amount_requested: feeAmount,
      payment_method: paymentMethod,
      notes: feeNote || undefined,
    })
    setSubmittingFee(false)

    if (id) {
      showSuccess("✅ تم إرسال الطلب — بانتظار موافقة الإدارة")
      setShowFeeModal(false)
      setFeeAmount(0)
      setFeeNote("")
      // Refresh to show the new pending request immediately.
      void refresh()
    } else {
      showError("تعذّر إرسال الطلب — حاول مرة أخرى")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title={
              active.kind === "contract"
                ? `محفظة العقد · ${active.contractTitle}`
                : "المحفظة"
            }
            subtitle={
              active.kind === "contract"
                ? `صلاحيتك: ${
                    active.isCreator
                      ? "منشئ"
                      : active.permission === "buy_and_sell"
                        ? "شراء وبيع"
                        : active.permission === "buy_only"
                          ? "شراء فقط"
                          : "عرض فقط"
                  }`
                : "حصصك والمعاملات والوحدات في مكان واحد"
            }
            rightAction={<AccountSwitcher />}
          />

          {/* ═══ Contract-account view (Phase 9.3a) ═══════════════
             When the active account is a contract, render the
             contract's balance + holdings + transactions instead of
             the personal portfolio. The personal view is hidden in
             this branch (only shown when active.kind === "personal"). */}
          {active.kind === "contract" && (
            <ContractPortfolioPanel
              contractTitle={active.contractTitle}
              isCreator={active.isCreator}
              permission={active.permission}
              totalBalance={active.totalBalance}
              holdings={contractHoldings}
              transactions={contractTxns}
              onOpenContract={() => router.push(`/contracts/${active.contractId}`)}
            />
          )}

          {/* ═══ Personal view (only when on personal account) ═══ */}
          {active.kind === "personal" && (
          <>
          {/* بطاقة الحدود الشهرية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5 backdrop-blur">

            {/* الحد الفردي */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-neutral-400 mb-1">حدّك الشهري الفردي</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {fmtLimit(LEVEL_LIMITS[userLevel])} د.ع
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                <span className="text-base">{LEVEL_ICONS[userLevel]}</span>
                <span className="text-xs font-bold text-white">{LEVEL_LABELS[userLevel]}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-neutral-500 mb-1.5">
                <span>المستخدم هذا الشهر</span>
                <span className="font-mono">
                  {fmtLimit(CURRENT_USER_USED_THIS_MONTH)} / {fmtLimit(LEVEL_LIMITS[userLevel])}
                </span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (CURRENT_USER_USED_THIS_MONTH / LEVEL_LIMITS[userLevel]) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* بطاقات العقود النشطة */}
            {USER_ACTIVE_CONTRACTS.length > 0 && (
              <div className="border-t border-white/[0.05] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
                  <span className="text-xs font-bold text-purple-400">حدود إضافية من العقود</span>
                </div>

                <div className="space-y-2">
                  {USER_ACTIVE_CONTRACTS.map((ct) => {
                    const result = computeContractLimit(ct.members)
                    return (
                      <div
                        key={ct.id}
                        onClick={() => router.push("/contracts/" + ct.id)}
                        className="bg-purple-400/[0.06] border border-purple-400/20 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-purple-400/[0.08] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="w-4 h-4 text-purple-400 flex-shrink-0" strokeWidth={1.5} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{ct.name}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {ct.members.length} أعضاء · مكافأة 25%
                            </div>
                          </div>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <div className="text-sm font-bold text-purple-400 font-mono">
                            {fmtLimit(result.totalLimit)}
                          </div>
                          <div className="text-[9px] text-neutral-500">د.ع/شهر</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Unified Wallet Card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
            {/* القيمة الإجمالية */}
            <div className="mb-4">
              <div className="text-[11px] text-neutral-500 mb-1">القيمة الإجمالية للمحفظة</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight font-mono">
                  {fmtIQD(totalValue)}
                </span>
                <span className="text-xs text-neutral-500">IQD</span>
                <span className={cn("text-sm font-bold", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? "↑" : "↓"} {Math.abs(parseFloat(profitPct))}%
                </span>
              </div>
            </div>

            {/* 4 خلايا */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] text-neutral-500 mb-1">الحصص المملوكة</div>
                <div className="text-sm font-bold text-white">{totalShares} SHR</div>
              </div>
              <div className="bg-blue-400/[0.08] border border-blue-400/[0.2] rounded-lg p-3">
                <div className="text-[10px] text-blue-400 mb-1">💳 وحدات الرسوم</div>
                <div className="text-sm font-bold text-blue-400">{feeBalance.toLocaleString("en-US")}</div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] text-neutral-500 mb-1">صافي الربح / الخسارة</div>
                <div className={cn("text-sm font-bold", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? "+" : ""}{fmtIQD(netProfit)} IQD
                </div>
              </div>
              <div className={cn(
                "rounded-lg p-3 border",
                pendingCount > 0
                  ? "bg-yellow-400/[0.08] border-yellow-400/[0.2]"
                  : "bg-white/[0.04] border-white/[0.06]"
              )}>
                <div className={cn("text-[10px] mb-1", pendingCount > 0 ? "text-yellow-400" : "text-neutral-500")}>
                  ⏳ طلبات معلقة
                </div>
                <div className={cn("text-sm font-bold", pendingCount > 0 ? "text-yellow-400" : "text-white")}>
                  {pendingCount} طلب
                </div>
              </div>
            </div>

            {/* 4 أزرار */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "إرسال", icon: Send, onClick: () => router.push("/wallet/send") },
                { label: "استلام", icon: Download, onClick: () => router.push("/wallet/receive") },
                { label: "بيع سريع", icon: Zap, onClick: () => router.push("/quick-sale"), disabled: totalShares === 0 },
                { label: "طلب وحدات", icon: CreditCard, onClick: () => setShowFeeModal(true) },
              ].map((btn) => {
                const Icon = btn.icon
                return (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors",
                      btn.disabled
                        ? "bg-white/[0.02] border-white/[0.04] text-neutral-600 cursor-not-allowed"
                        : "bg-white/[0.04] border-white/[0.06] text-white hover:bg-white/[0.08]"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="text-[10px]">{btn.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-4">
            {[
              { key: "holdings" as const, label: "الحصص", icon: Briefcase },
              { key: "stats" as const, label: "الإحصائيات", icon: BarChart3 },
              { key: "history" as const, label: "السجل", icon: History },
              { key: "fee_units" as const, label: "💳 الرسوم", icon: Coins },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1.5",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Holdings Tab */}
          {tab === "holdings" && (
            loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 bg-white/[0.06] rounded" />
                          <div className="h-2.5 w-32 bg-white/[0.05] rounded" />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-left">
                        <div className="h-3 w-16 bg-white/[0.06] rounded ml-auto" />
                        <div className="h-2.5 w-10 bg-white/[0.05] rounded ml-auto" />
                      </div>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full" />
                  </div>
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📭</div>
                <div className="text-sm text-neutral-400 mb-4">لا توجد حصص في محفظتك</div>
                <button
                  onClick={() => router.push("/market")}
                  className="bg-neutral-100 text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-200"
                >
                  استعرض السوق
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {holdings.map((h) => {
                  const value = (h.project?.share_price || 0) * h.shares_owned
                  const pct = h.project?.total_shares
                    ? Math.round(((h.project.total_shares - (h.project.available_shares ?? 0)) / h.project.total_shares) * 100)
                    : 0
                  const change = (pct * 0.12).toFixed(1)
                  const up = parseFloat(change) >= 0
                  return (
                    <div
                      key={h.id}
                      className="relative bg-white/[0.05] border border-white/[0.08] rounded-2xl hover:bg-white/[0.07] transition-colors"
                    >
                      <button
                        onClick={() => router.push(`/project/${h.project_id}`)}
                        className="w-full p-4 text-right"
                      >
                        <div className="flex items-center justify-between mb-3 pe-9">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg">
                              {sectorIcon(h.project?.sector || "")}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{h.project?.name}</div>
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                {h.shares_owned} حصة • {fmtIQD(h.project?.share_price || 0)} IQD
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-white font-mono">{fmtIQD(value)}</div>
                            <div className={cn("text-[11px] font-bold mt-0.5", up ? "text-green-400" : "text-red-400")}>
                              {up ? "↑" : "↓"} {change}%
                            </div>
                          </div>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-white/60 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-neutral-500">مُموَّل {pct}%</span>
                          <span className={cn("text-[10px]", up ? "text-green-400" : "text-red-400")}>
                            {up ? "+" : ""}{fmtIQD((value * parseFloat(change)) / 100)} IQD
                          </span>
                        </div>
                      </button>
                      {active.kind === "personal" && h.shares_owned > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTransferTarget({
                              project_id: h.project_id,
                              project_name: h.project?.name ?? "—",
                              available_shares: h.shares_owned,
                              price_per_share: h.project?.share_price || 0,
                            })
                          }}
                          className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-purple-500/[0.12] border border-purple-500/[0.3] hover:bg-purple-500/[0.2] flex items-center justify-center transition-colors"
                          title="نقل حصص"
                          aria-label="نقل حصص"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Stats Tab */}
          {tab === "stats" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "إجمالي الاستثمار", value: fmtIQD(totalInvested), unit: "IQD" },
                  { label: "إجمالي الأرباح", value: (isUp ? "+" : "") + fmtIQD(netProfit), unit: "IQD", color: isUp ? "text-green-400" : "text-red-400" },
                  { label: "عدد الاستثمارات", value: String(holdings.length), unit: "مشروع" },
                  { label: "متوسط العائد", value: profitPct + "%", unit: "", color: isUp ? "text-green-400" : "text-red-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
                    <div className="text-[10px] text-neutral-500 mb-2">{s.label}</div>
                    <div className={cn("text-lg font-bold font-mono", s.color || "text-white")}>{s.value}</div>
                    <div className="text-[10px] text-neutral-500 mt-1">{s.unit}</div>
                  </div>
                ))}
              </div>

              {holdings.length > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
                  <div className="text-[11px] text-neutral-500 mb-3 flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    أفضل مشروع أداء
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg">
                      {sectorIcon(bestHolding?.project?.sector || "")}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{bestHolding?.project?.name}</div>
                      <div className="text-[11px] text-green-400">
                        ↑ {bestPerformerPct >= 0 ? "+" : ""}{bestPerformerPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            feeTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📋</div>
                <div className="text-sm text-neutral-400">لا توجد عمليات مسجّلة بعد</div>
              </div>
            ) : (
              <div className="space-y-2">
                {feeTransactions.map((entry) => {
                  const op = opLabel(entry.op_type)
                  return (
                    <div key={entry.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", op.bg)}>
                        <span className="text-base">{op.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">{op.label}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{entry.project_name || ""} {entry.project_name ? "•" : ""} {fmtDate(entry.created_at)}</div>
                      </div>
                      <div className={cn("text-sm font-bold font-mono", op.color)}>
                        {entry.op_type.includes("buy") || entry.op_type.includes("received") ? "+" : "-"}
                        {fmtIQD(entry.amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Fee Units Tab */}
          {tab === "fee_units" && (
            <div className="space-y-3">
              {/* Balance card أزرق */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white">
                <div className="text-xs opacity-85 mb-1.5">💳 رصيد وحدات الرسوم</div>
                <div className="text-4xl font-bold mb-1">{feeBalance.toLocaleString("en-US")}</div>
                <div className="text-xs opacity-75">وحدة رسم</div>
              </div>

              {/* 3 stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "⏳ معلقة", value: feeRequests.filter((r) => r.status === "pending").length, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
                  { label: "✅ موافق", value: feeRequests.filter((r) => r.status === "approved").length, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
                  { label: "❌ مرفوض", value: feeRequests.filter((r) => r.status === "rejected").length, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-xl p-3 text-center border", s.bg, s.border)}>
                    <div className={cn("text-[10px] mb-1", s.color)}>{s.label}</div>
                    <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Request button */}
              <button
                onClick={() => setShowFeeModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm"
              >
                💳 طلب وحدات رسوم جديد
              </button>

              {/* Requests list */}
              {feeRequests.length > 0 && (
                <div>
                  <div className="text-xs text-neutral-400 font-bold mb-2">الطلبات</div>
                  <div className="space-y-2">
                    {feeRequests.map((r) => (
                      <div key={r.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{r.amount_requested.toLocaleString("en-US")} وحدة</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{fmtDate(r.created_at)}</div>
                        </div>
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                          r.status === "pending" && "bg-yellow-400/10 border-yellow-400/20 text-yellow-400",
                          r.status === "approved" && "bg-green-400/10 border-green-400/20 text-green-400",
                          r.status === "rejected" && "bg-red-400/10 border-red-400/20 text-red-400"
                        )}>
                          {r.status === "pending" ? "⏳ معلق" : r.status === "approved" ? "✅ موافق" : "❌ مرفوض"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ledger */}
              {feeTransactions.length > 0 && (
                <div>
                  <div className="text-xs text-neutral-400 font-bold mb-2">سجل الحركات</div>
                  <div className="space-y-2">
                    {feeTransactions.map((item) => (
                      <div key={item.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-neutral-300">{reasonLabel(item.reason)}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{fmtDate(item.created_at)}</div>
                        </div>
                        <div className={cn("text-base font-bold", item.type === "addition" ? "text-green-400" : "text-red-400")}>
                          {item.type === "addition" ? "+" : "-"}{item.amount.toLocaleString("en-US")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          </>
          )}

        </div>
      </div>

      {/* Fee Request Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-lg font-bold text-white mb-1">💳 طلب وحدات رسوم</div>
                <div className="text-xs text-neutral-400">سيتم مراجعة الطلب من قِبل الإدارة</div>
              </div>
              <button onClick={() => setShowFeeModal(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-2 block font-bold">عدد الوحدات المطلوبة *</label>
              <input
                type="number"
                min="1"
                value={feeAmount || ""}
                onChange={(e) => setFeeAmount(parseInt(e.target.value) || 0)}
                placeholder="مثلاً: 50000"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <label className="text-xs text-neutral-400 mb-2 block font-bold">طريقة الدفع *</label>
              <div className="space-y-2">
                {[
                  { key: "zaincash" as const, label: "ZainCash", desc: "تحويل عبر زين كاش" },
                  { key: "mastercard" as const, label: "Master Card", desc: "بطاقة ماستركارد" },
                  { key: "bank" as const, label: "تحويل بنكي", desc: "حوالة مصرفية مباشرة" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-colors text-right",
                      paymentMethod === m.key
                        ? "bg-white/[0.08] border-white/[0.2]"
                        : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="text-sm font-bold text-white">{m.label}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mb-5">
              <label className="text-xs text-neutral-400 mb-2 block">ملاحظة (اختياري)</label>
              <textarea
                value={feeNote}
                onChange={(e) => setFeeNote(e.target.value)}
                placeholder="أي تفاصيل إضافية..."
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFeeModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={submitFeeRequest}
                disabled={submittingFee}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingFee ? "جاري الإرسال..." : "إرسال الطلب"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 10 — share transfer modal */}
      {transferTarget && (
        <ShareTransferModal
          open={true}
          onClose={() => setTransferTarget(null)}
          onSuccess={() => {
            setTransferTarget(null)
            void refresh()
          }}
          projectId={transferTarget.project_id}
          projectName={transferTarget.project_name}
          availableShares={transferTarget.available_shares}
          pricePerShare={transferTarget.price_per_share}
        />
      )}
    </AppLayout>
  )
}

// ─── ContractPortfolioPanel (Phase 9.3a) ────────────────────────
// Renders the contract-side wallet view: balance summary + per-project
// holdings + recent transactions. Read-only — trade execution from a
// contract is deferred to phase 9.3b.

interface ContractPortfolioPanelProps {
  contractTitle: string
  isCreator: boolean
  permission: "creator" | "view_only" | "buy_only" | "buy_and_sell"
  totalBalance: number
  holdings: ContractHoldingRow[]
  transactions: ContractTransactionRow[]
  onOpenContract: () => void
}

function ContractPortfolioPanel({
  contractTitle,
  isCreator,
  permission,
  totalBalance,
  holdings,
  transactions,
  onOpenContract,
}: ContractPortfolioPanelProps) {
  void contractTitle
  void isCreator
  const totalShares = holdings.reduce((s, h) => s + h.shares, 0)
  const totalInvested = holdings.reduce((s, h) => s + h.total_invested, 0)
  const currentValue = holdings.reduce(
    (s, h) => s + (h.current_market_price ?? 0) * h.shares,
    0,
  )

  const permLabel =
    permission === "creator" ? "منشئ"
    : permission === "buy_and_sell" ? "شراء وبيع"
    : permission === "buy_only" ? "شراء فقط"
    : "عرض فقط"

  return (
    <>
      {/* Balance summary */}
      <div className="bg-purple-400/[0.06] border border-purple-400/[0.25] rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="text-[11px] text-purple-400 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="font-bold">حساب عقد جماعي · {permLabel}</span>
            </div>
            <div className="text-3xl font-bold text-white font-mono">
              {fmtIQD(totalBalance)}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              الرصيد المتاح للعقد (IQD)
            </div>
          </div>
          <button
            onClick={onOpenContract}
            className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg px-3 py-2 text-[11px] text-white font-bold transition-colors"
          >
            تفاصيل العقد ←
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">حصص</div>
            <div className="text-sm font-bold text-white font-mono">
              {totalShares}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">المستثمر</div>
            <div className="text-sm font-bold text-white font-mono">
              {fmtIQD(totalInvested)}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">القيمة الحالية</div>
            <div className="text-sm font-bold text-green-400 font-mono">
              {fmtIQD(currentValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
        <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-400" strokeWidth={2} />
          حصص العقد ({holdings.length})
        </div>
        {holdings.length === 0 ? (
          <div className="text-center py-8 text-xs text-neutral-500">
            لا توجد حصص في العقد بعد
          </div>
        ) : (
          <div className="space-y-2">
            {holdings.map((h) => {
              const value = (h.current_market_price ?? 0) * h.shares
              return (
                <div
                  key={h.id}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-white font-bold truncate">
                      {h.project_name}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {h.shares} حصة · مستثمر {fmtIQD(h.total_invested)}
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-sm font-bold text-green-400 font-mono">
                      {fmtIQD(value)}
                    </div>
                    <div className="text-[10px] text-neutral-500">IQD</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
        <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-purple-400" strokeWidth={2} />
          آخر المعاملات ({transactions.length})
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-xs text-neutral-500">
            لا توجد معاملات بعد
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((t) => {
              const isOutflow = t.transaction_type === "buy" || t.transaction_type === "withdraw"
              const sign = isOutflow ? "-" : "+"
              const typeLabel =
                t.transaction_type === "buy" ? "شراء"
                : t.transaction_type === "sell" ? "بيع"
                : t.transaction_type === "deposit" ? "إيداع"
                : t.transaction_type === "withdraw" ? "سحب"
                : "توزيع"
              return (
                <div
                  key={t.id}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-white font-bold">
                      {typeLabel}
                      {t.project_name ? ` · ${t.project_name}` : ""}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      بواسطة {t.initiator_name} ·{" "}
                      <span dir="ltr">{t.created_at?.slice(0, 10)}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-sm font-bold font-mono flex-shrink-0",
                      isOutflow ? "text-red-400" : "text-green-400",
                    )}
                  >
                    {sign}
                    {fmtIQD(Math.abs(t.amount))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PortfolioContent />
    </Suspense>
  )
}
