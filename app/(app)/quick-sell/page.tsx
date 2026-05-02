"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Zap, ChevronDown, AlertTriangle, Lock, X } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { mockHoldingsQuickSell as mockHoldings } from "@/lib/mock-data"
import { createInvoice } from "@/lib/data/invoices"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) => {
  if (s?.includes("زراع")) return "🌾"
  if (s?.includes("تجار")) return "🏪"
  if (s?.includes("عقار")) return "🏢"
  if (s?.includes("صناع")) return "🏭"
  return "🏢"
}

const DISCOUNT = 0.15 // 15%
const QUICK_SELL_FEE_PERCENT = 2 // 2%

export default function QuickSellPage() {
  const router = useRouter()
  const [holdings] = useState(mockHoldings)
  const [selectedHolding, setSelectedHolding] = useState<typeof mockHoldings[0] | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [shares, setShares] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const feeUnitsBalance = 85000 // mock

  const sharesNum = parseInt(shares) || 0
  const marketPrice = selectedHolding?.project?.share_price || 0
  const sellPrice = Math.round(marketPrice * (1 - DISCOUNT))
  const totalValue = sellPrice * sharesNum
  const feeUnitsNeeded = Math.ceil((totalValue * QUICK_SELL_FEE_PERCENT) / 100)
  const hasEnough =
    selectedHolding && feeUnitsBalance >= feeUnitsNeeded && sharesNum <= selectedHolding.shares_owned

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const submitQuickSell = async () => {
    if (!selectedHolding) return showError("اختر الحصة")
    if (sharesNum < 1) return showError("أدخل عدد الحصص")
    if (sharesNum > selectedHolding.shares_owned) return showError("لا تملك هذا العدد من الحصص")
    if (feeUnitsBalance < feeUnitsNeeded) return showError(`رصيد وحدات الرسوم غير كافي — تحتاج ${feeUnitsNeeded} وحدة`)

    setSubmitting(true)
    setTimeout(() => {
      // ─── 📄 إنشاء الفاتورة الرسمية للبيع السريع ───
      const invoice = createInvoice({
        type: "quick_sell_sell",
        from: { id: "abc123def456", name: "أنا" },
        to: { id: "system_market", name: "السوق المباشر" },
        project_id: selectedHolding.project_id,
        project_name: selectedHolding.project.name,
        shares_amount: sharesNum,
        price_per_share: sellPrice,
        platform_fee_units: feeUnitsNeeded,
      })

      showSuccess(`⚡ تم نشر إعلان البيع السريع + إصدار الفاتورة ${invoice.id}`)
      setSubmitting(false)
      setShowConfirm(false)
      router.push(`/invoices/${invoice.id}`)
    }, 1000)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge="QUICK SELL · بيع سريع"
            title="البيع السريع"
            description="انشر حصصك بسعر مخفض لبيع أسرع"
          />

          {/* Info banner - أصفر */}
          <div className="bg-yellow-400/[0.07] border border-yellow-400/20 rounded-xl p-3.5 mb-5">
            <div className="flex gap-2.5 items-start">
              <span className="text-xl flex-shrink-0">⚡</span>
              <div>
                <div className="text-sm font-bold text-yellow-400 mb-1">ما هو البيع السريع؟</div>
                <div className="text-xs text-neutral-300 leading-relaxed">
                  ينشر حصصك في السوق فوراً بسعر مخفض{" "}
                  <strong className="text-yellow-400">15%</strong> من سعر السوق الحالي، مما يزيد فرصة البيع بسرعة.
                  السعر يُحدد تلقائياً من النظام ولا يمكن تعديله.
                </div>
              </div>
            </div>
          </div>

          {/* اختيار الحصة - Dropdown */}
          <div className="mb-4" ref={dropRef}>
            <div className="text-xs text-neutral-400 mb-2">الحصة المراد بيعها</div>
            {holdings.length === 0 ? (
              <div className="text-center py-5 text-sm text-neutral-500">لا توجد حصص في محفظتك</div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.07] transition-colors"
                >
                  <span className={cn("text-sm", selectedHolding ? "text-white" : "text-neutral-500")}>
                    {selectedHolding
                      ? `${sectorIcon(selectedHolding.project.sector)} ${selectedHolding.project.name} — ${selectedHolding.shares_owned} حصة`
                      : "اختر الحصة..."}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", showDropdown && "rotate-180")} />
                </button>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {holdings.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setSelectedHolding(h)
                          setShowDropdown(false)
                        }}
                        className={cn(
                          "w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0 text-right",
                          selectedHolding?.id === h.id && "bg-white/[0.08]"
                        )}
                      >
                        <span className="text-xl">{sectorIcon(h.project.sector)}</span>
                        <div className="flex-1 text-right">
                          <div className="text-sm font-bold text-white">{h.project.name}</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            {h.shares_owned} حصة • سعر السوق: {fmtIQD(h.project.share_price)} د.ع
                          </div>
                        </div>
                        {selectedHolding?.id === h.id && <span className="text-green-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* عدد الحصص */}
          {selectedHolding && (
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-neutral-400">عدد الحصص للبيع</span>
                <button
                  onClick={() => setShares(String(selectedHolding.shares_owned))}
                  className="text-[11px] text-neutral-400 hover:text-white"
                >
                  الحد الأقصى
                </button>
              </div>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                min="1"
                max={selectedHolding.shares_owned}
                placeholder="0"
                dir="ltr"
                className={cn(
                  "w-full bg-white/[0.05] rounded-xl px-4 py-3.5 text-2xl font-bold text-white text-center outline-none border transition-colors",
                  sharesNum > 0 && !hasEnough ? "border-red-400/40" : "border-white/[0.1]"
                )}
              />
              {sharesNum > 0 && (!hasEnough || sharesNum > selectedHolding.shares_owned) && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>
                    {sharesNum > selectedHolding.shares_owned
                      ? `لا تملك هذا العدد — لديك ${selectedHolding.shares_owned} حصة فقط`
                      : `رصيد وحدات الرسوم غير كافي — تحتاج ${feeUnitsNeeded} ولديك ${feeUnitsBalance}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* بطاقة التسعير */}
          {selectedHolding && sharesNum > 0 && (
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3 text-xs text-neutral-400 font-bold">
                <Lock className="w-3.5 h-3.5" />
                السعر محدد من النظام — لا يمكن تعديله
              </div>
              <div className="divide-y divide-white/[0.04]">
                {[
                  { label: "سعر السوق الحالي", value: `${fmtIQD(marketPrice)} د.ع / حصة`, color: "text-white" },
                  { label: "خصم البيع السريع", value: "15%", color: "text-red-400" },
                  { label: "سعر البيع الفعلي", value: `${fmtIQD(sellPrice)} د.ع / حصة`, color: "text-yellow-400", bold: true },
                  { label: "عدد الحصص", value: `${sharesNum} حصة`, color: "text-white" },
                  { label: "القيمة الإجمالية للبيع", value: `${fmtIQD(totalValue)} د.ع`, color: "text-green-400", bold: true },
                  { label: "💳 عمولة المنصة (2%)", value: `${feeUnitsNeeded} وحدة رسم`, color: "text-blue-400" },
                  { label: "رصيدك من وحدات الرسوم", value: `${feeUnitsBalance} وحدة`, color: feeUnitsBalance >= feeUnitsNeeded ? "text-green-400" : "text-red-400" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <span className="text-xs text-neutral-500">{r.label}</span>
                    <span className={cn(r.bold ? "text-sm font-bold" : "text-xs font-bold", r.color)}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* زر النشر */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!selectedHolding || sharesNum < 1 || !hasEnough}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              selectedHolding && sharesNum > 0 && hasEnough
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.06] text-neutral-500 cursor-not-allowed"
            )}
          >
            <Zap className="w-4 h-4" strokeWidth={2} />
            نشر إعلان البيع السريع
          </button>

        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && selectedHolding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-4xl mb-2">⚡</div>
                <div className="text-lg font-bold text-white mb-1">تأكيد البيع السريع</div>
                <div className="text-xs text-neutral-400">سيتم نشر إعلانك فوراً بالتفاصيل التالية</div>
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 mb-4">
              {[
                ["المشروع", selectedHolding.project.name],
                ["عدد الحصص", `${sharesNum} حصة`],
                ["سعر البيع", `${fmtIQD(sellPrice)} د.ع`],
                ["القيمة الإجمالية", `${fmtIQD(totalValue)} د.ع`],
                ["العمولة", `${feeUnitsNeeded} وحدة رسم`],
              ].map(([l, v], i, arr) => (
                <div
                  key={l}
                  className={cn(
                    "flex justify-between py-2",
                    i < arr.length - 1 && "border-b border-white/[0.04]"
                  )}
                >
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white font-mono">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={submitQuickSell}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
              >
                {submitting ? "جاري النشر..." : "تأكيد ونشر"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
