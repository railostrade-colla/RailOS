"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Send, Download, Zap, CreditCard, TrendingUp, X, Coins, ArrowDownToLine, ArrowUpFromLine, Briefcase, BarChart3, History, Trophy, Sparkles, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
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
import {
  CURRENT_USER_LEVEL,
  CURRENT_USER_USED_THIS_MONTH,
  USER_ACTIVE_CONTRACTS,
  mockHoldings,
  mockWalletLog,
  mockFeeRequests,
  mockFeeLedger,
} from "@/lib/mock-data"

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

const reasonLabel = (reason: string) => {
  if (reason === "admin_topup") return "👨‍💼 من الإدارة"
  if (reason === "listing_fee") return "📝 رسوم إدراج"
  if (reason === "auction_fee") return "🏆 رسوم مزاد"
  if (reason === "direct_buy_fee") return "🛒 رسوم شراء"
  if (reason === "quick_sell_fee") return "⚡ بيع سريع"
  return "💳 " + reason
}

const opLabel = (op: string) => {
  if (op === "deal_buy") return { icon: "📈", label: "شراء حصص (صفقة)", color: "text-green-400", bg: "bg-green-400/10" }
  if (op === "deal_sell") return { icon: "📉", label: "بيع حصص (صفقة)", color: "text-red-400", bg: "bg-red-400/10" }
  if (op === "shares_sent") return { icon: "📤", label: "إرسال حصص", color: "text-orange-400", bg: "bg-orange-400/10" }
  if (op === "shares_received") return { icon: "📥", label: "استلام حصص", color: "text-blue-400", bg: "bg-blue-400/10" }
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

  // إحصائيات المحفظة
  const totalShares = mockHoldings.reduce((s, h) => s + h.shares_owned, 0)
  const totalValue = mockHoldings.reduce((s, h) => s + (h.project?.share_price || 0) * h.shares_owned, 0)
  const totalInvested = totalValue * 0.92 // يفترض أن سعر الشراء كان 92% من الحالي
  const netProfit = totalValue - totalInvested
  const profitPct = totalInvested > 0 ? ((netProfit / totalInvested) * 100).toFixed(2) : "0"
  const isUp = netProfit >= 0

  // وحدات الرسوم
  const feeBalance = 85000
  const pendingCount = mockFeeRequests.filter((r) => r.status === "pending").length

  const submitFeeRequest = () => {
    if (!feeAmount || feeAmount < 1) {
      showError("أدخل عدداً صحيحاً موجباً")
      return
    }
    if (!paymentMethod) {
      showError("اختر طريقة الدفع")
      return
    }
    showSuccess("✅ تم إرسال الطلب — بانتظار موافقة الإدارة")
    setShowFeeModal(false)
    setFeeAmount(0)
    setFeeNote("")
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="المحفظة"
            subtitle="حصصك والمعاملات والوحدات في مكان واحد"
            showBack={false}
          />

          {/* بطاقة الحدود الشهرية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5 backdrop-blur">

            {/* الحد الفردي */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-neutral-400 mb-1">حدّك الشهري الفردي</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {fmtLimit(LEVEL_LIMITS[CURRENT_USER_LEVEL])} د.ع
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                <span className="text-base">{LEVEL_ICONS[CURRENT_USER_LEVEL]}</span>
                <span className="text-xs font-bold text-white">{LEVEL_LABELS[CURRENT_USER_LEVEL]}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-neutral-500 mb-1.5">
                <span>المستخدم هذا الشهر</span>
                <span className="font-mono">
                  {fmtLimit(CURRENT_USER_USED_THIS_MONTH)} / {fmtLimit(LEVEL_LIMITS[CURRENT_USER_LEVEL])}
                </span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (CURRENT_USER_USED_THIS_MONTH / LEVEL_LIMITS[CURRENT_USER_LEVEL]) * 100)}%`,
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
                { label: "بيع سريع", icon: Zap, onClick: () => router.push("/quick-sell"), disabled: totalShares === 0 },
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
            mockHoldings.length === 0 ? (
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
                {mockHoldings.map((h) => {
                  const value = (h.project?.share_price || 0) * h.shares_owned
                  const pct = h.project?.total_shares
                    ? Math.round(((h.project.total_shares - (h.project.available_shares ?? 0)) / h.project.total_shares) * 100)
                    : 0
                  const change = (pct * 0.12).toFixed(1)
                  const up = parseFloat(change) >= 0
                  return (
                    <button
                      key={h.id}
                      onClick={() => router.push(`/project/${h.project_id}`)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-colors text-right"
                    >
                      <div className="flex items-center justify-between mb-3">
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
                  { label: "عدد الاستثمارات", value: String(mockHoldings.length), unit: "مشروع" },
                  { label: "متوسط العائد", value: profitPct + "%", unit: "", color: isUp ? "text-green-400" : "text-red-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
                    <div className="text-[10px] text-neutral-500 mb-2">{s.label}</div>
                    <div className={cn("text-lg font-bold font-mono", s.color || "text-white")}>{s.value}</div>
                    <div className="text-[10px] text-neutral-500 mt-1">{s.unit}</div>
                  </div>
                ))}
              </div>

              {mockHoldings.length > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
                  <div className="text-[11px] text-neutral-500 mb-3 flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    أفضل مشروع أداء
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-lg">
                      {sectorIcon(mockHoldings[0]?.project?.sector || "")}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{mockHoldings[0]?.project?.name}</div>
                      <div className="text-[11px] text-green-400">↑ +12%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            mockWalletLog.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📋</div>
                <div className="text-sm text-neutral-400">لا توجد عمليات مسجّلة بعد</div>
              </div>
            ) : (
              <div className="space-y-2">
                {mockWalletLog.map((entry) => {
                  const op = opLabel(entry.op_type)
                  return (
                    <div key={entry.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", op.bg)}>
                        <span className="text-base">{op.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">{op.label}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{entry.project_name} • {entry.created_at}</div>
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
                  { label: "⏳ معلقة", value: mockFeeRequests.filter((r) => r.status === "pending").length, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
                  { label: "✅ موافق", value: mockFeeRequests.filter((r) => r.status === "approved").length, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
                  { label: "❌ مرفوض", value: mockFeeRequests.filter((r) => r.status === "rejected").length, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
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
              {mockFeeRequests.length > 0 && (
                <div>
                  <div className="text-xs text-neutral-400 font-bold mb-2">الطلبات</div>
                  <div className="space-y-2">
                    {mockFeeRequests.map((r) => (
                      <div key={r.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{r.amount_requested.toLocaleString("en-US")} وحدة</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{r.created_at}</div>
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
              {mockFeeLedger.length > 0 && (
                <div>
                  <div className="text-xs text-neutral-400 font-bold mb-2">سجل الحركات</div>
                  <div className="space-y-2">
                    {mockFeeLedger.map((item) => (
                      <div key={item.id} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-neutral-300">{reasonLabel(item.reason)}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{item.created_at}</div>
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
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PortfolioContent />
    </Suspense>
  )
}
