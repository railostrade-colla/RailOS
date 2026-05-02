"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Search, X, Plus, AlertTriangle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { ContractLimitCard } from "@/components/contracts/ContractLimitCard"
import { LEVEL_LABELS, LEVEL_ICONS, type InvestorLevel } from "@/lib/utils/contractLimits"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

import {
  mockProfileLite as mockProfile,
  mockUsersDB,
  FEE_BALANCE_CONTRACTS as mockFeeBalance,
} from "@/lib/mock-data"

// رسوم العقد - 2% من قيمة الاستثمار
const CONTRACT_FEE_PERCENT = 2

interface Partner {
  user: { id: string; name: string; reputation_score: number; is_verified: boolean; level: InvestorLevel }
  role: "creator" | "partner"
  share_percentage: number
}

export default function CreateContractPage() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [investment, setInvestment] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [partners, setPartners] = useState<Partner[]>([
    { user: { id: mockProfile.id, name: mockProfile.name, reputation_score: mockProfile.reputation_score, is_verified: true, level: mockProfile.level }, role: "creator", share_percentage: 100 },
  ])
  const [distMode, setDistMode] = useState<"equal" | "manual">("equal")
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showFeeBlock, setShowFeeBlock] = useState(false)

  // Search results
  const searchResults = searchQuery.length > 0
    ? mockUsersDB.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !partners.some((p) => p.user.id === u.id)
      ).slice(0, 5)
    : []

  // إعادة توزيع متساوية
  const redistributeEqual = (list: Partner[]) => {
    if (list.length === 0) return list
    const equalShare = parseFloat((100 / list.length).toFixed(2))
    return list.map((p) => ({ ...p, share_percentage: equalShare }))
  }

  const addPartner = (user: typeof mockUsersDB[0]) => {
    if (partners.some((p) => p.user.id === user.id)) {
      showError("هذا الشخص مضاف بالفعل")
      return
    }
    const newList = [...partners, { user, role: "partner" as const, share_percentage: 0 }]
    if (distMode === "equal") {
      setPartners(redistributeEqual(newList))
    } else {
      setPartners(newList)
    }
    setSearchQuery("")
  }

  const removePartner = (id: string) => {
    const newList = partners.filter((p) => p.user.id !== id)
    if (distMode === "equal") {
      setPartners(redistributeEqual(newList))
    } else {
      setPartners(newList)
    }
  }

  const updateShare = (id: string, value: string) => {
    const num = parseFloat(value) || 0
    setPartners((prev) =>
      prev.map((p) => (p.user.id === id ? { ...p, share_percentage: num } : p))
    )
  }

  const totalShares = partners.reduce((s, p) => s + (p.share_percentage || 0), 0)
  const sharesValid = Math.abs(totalShares - 100) < 0.1

  const investmentNum = parseFloat(investment) || 0
  const feeAmount = Math.ceil((investmentNum * CONTRACT_FEE_PERCENT) / 100)
  const hasEnoughFees = mockFeeBalance >= feeAmount

  const createContract = () => {
    if (!title.trim()) return showError("أدخل اسم العقد")
    if (!description.trim()) return showError("أدخل وصف العقد")
    if (investmentNum < 1) return showError("أدخل قيمة استثمار صحيحة")
    if (partners.length < 2) return showError("يجب إضافة شريك واحد على الأقل")
    if (!sharesValid) return showError("مجموع النسب يجب أن يساوي 100%")
    if (!agreed) return showError("يجب الموافقة على الشروط")
    if (!hasEnoughFees) {
      setShowFeeBlock(true)
      return
    }

    setLoading(true)
    setTimeout(() => {
      showSuccess("تم إنشاء العقد وإرسال الدعوات للشركاء! 🎉")
      setLoading(false)
      router.push("/contracts")
    }, 1500)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="إنشاء عقد"
            subtitle="عقد شراكة استثمارية بنسب محددة بين الشركاء"
            backHref="/contracts"
          />

          {/* معلومات تلقائية */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">منشئ العقد</span>
              <span className="text-white font-bold">{mockProfile.name}</span>
            </div>
            <div className="h-px bg-white/[0.05] my-2.5" />
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">التاريخ</span>
              <span className="text-white">{new Date().toLocaleDateString("en-US")}</span>
            </div>
            <div className="h-px bg-white/[0.05] my-2.5" />
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500">رصيد وحدات الرسوم</span>
              <span className={cn("font-bold font-mono", hasEnoughFees ? "text-green-400" : "text-red-400")}>
                {mockFeeBalance.toLocaleString("en-US")} وحدة
              </span>
            </div>
          </div>

          {/* اسم العقد */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">اسم العقد *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: عقد استثمار — مشروع الشمال"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>

          {/* وصف العقد */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">وصف العقد *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب وصف يوضح هدف الشراكة والاستثمار..."
              rows={3}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* قيمة الاستثمار */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">قيمة الاستثمار (IQD) *</label>
            <input
              type="number"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              placeholder="مثال: 1000000"
              dir="ltr"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 font-mono"
            />
            {investmentNum > 0 && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-neutral-400">
                <span>💳</span>
                <span>
                  عمولة المنصة (2%): <span className="text-blue-400 font-bold">{feeAmount.toLocaleString("en-US")}</span> وحدة رسم
                  {!hasEnoughFees && (
                    <span className="text-red-400 mr-2">— رصيدك غير كافٍ</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* إضافة شركاء */}
          <div className="mb-4">
            <label className="text-xs text-neutral-400 mb-2 block font-bold">إضافة شركاء</label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1c1c1c] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addPartner(u)}
                      className="w-full p-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3 border-b border-white/[0.04] last:border-0 text-right"
                    >
                      <div className="w-9 h-9 rounded-full bg-white/[0.09] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">{u.name}</span>
                          {u.is_verified && (
                            <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          نقاط السمعة: <span className="font-mono text-yellow-400">{u.reputation_score}</span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-white flex-shrink-0" strokeWidth={2} />
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1c1c1c] border border-white/[0.1] rounded-xl p-4 text-center text-xs text-neutral-500">
                  لا توجد نتائج
                </div>
              )}
            </div>
          </div>

          {/* قائمة الشركاء */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs text-neutral-400 font-bold">
                الشركاء <span className="text-neutral-500">({partners.length})</span>
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setDistMode("equal")
                    setPartners(redistributeEqual(partners))
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] transition-colors font-bold",
                    distMode === "equal"
                      ? "bg-white text-black"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  تساوي
                </button>
                <button
                  onClick={() => setDistMode("manual")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] transition-colors font-bold",
                    distMode === "manual"
                      ? "bg-white text-black"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  يدوي
                </button>
              </div>
            </div>

            {/* شريط التقدم */}
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className={cn("h-full rounded-full transition-all duration-300", sharesValid ? "bg-green-400" : "bg-red-400")}
                style={{ width: Math.min(totalShares, 100) + "%" }}
              />
            </div>
            {!sharesValid && (
              <div className="text-[11px] text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                مجموع النسب {totalShares.toFixed(1)}% — يجب أن يساوي 100%
              </div>
            )}

            <div className="space-y-2">
              {partners.map((p) => (
                <div
                  key={p.user.id}
                  className={cn(
                    "rounded-xl p-3 flex items-center gap-3 border",
                    p.role === "creator"
                      ? "bg-yellow-400/[0.05] border-yellow-400/[0.2]"
                      : "bg-white/[0.05] border-white/[0.08]"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-white/[0.09] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {p.user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{p.user.name}</span>
                      {p.user.is_verified && (
                        <span className="bg-green-400/10 border border-green-400/20 text-green-400 px-1 py-0.5 rounded text-[9px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {p.role === "creator" ? "👑 منشئ العقد" : "شريك"}
                    </div>
                  </div>

                  {distMode === "manual" ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number"
                        value={p.share_percentage}
                        onChange={(e) => updateShare(p.user.id, e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        dir="ltr"
                        className="w-16 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/20 text-center font-mono"
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </div>
                  ) : (
                    <span className="text-base font-bold text-white font-mono flex-shrink-0">
                      {p.share_percentage.toFixed(1)}%
                    </span>
                  )}

                  {p.role !== "creator" && (
                    <button
                      onClick={() => removePartner(p.user.id)}
                      className="bg-red-500/[0.1] border border-red-500/[0.2] text-red-400 rounded-lg px-2 py-1.5 text-[10px] font-bold hover:bg-red-500/[0.15] transition-colors flex-shrink-0"
                    >
                      حذف
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* الحد الشهري الجماعي */}
          {partners.length > 0 && (
            <div className="mb-5">
              <ContractLimitCard members={partners.map((p) => ({ name: p.user.name, level: p.user.level }))} />
            </div>
          )}

          {/* بنود الاتفاق */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-5">
            <div className="text-xs text-neutral-400 leading-relaxed mb-4">
              <div className="font-bold text-white mb-2">📋 بنود الاتفاق:</div>
              <ul className="space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>الدخول في الاستثمارات يتم عبر العقد فقط</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>لا يُفعَّل العقد إلا بعد موافقة جميع الشركاء</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>توزيع الأرباح حسب النسب المحددة</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>لا يمكن تعديل النسب بعد التفعيل</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>عمولة المنصة 2% من قيمة الاستثمار</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setAgreed(!agreed)}
              className="flex items-start gap-3 w-full text-right"
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                  agreed
                    ? "bg-white border-white"
                    : "border-white/[0.25] bg-transparent"
                )}
              >
                {agreed && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <span className="text-xs text-neutral-400 leading-relaxed">
                أوافق على شروط العقد وأتحمل المسؤولية القانونية والالتزامات المترتبة
              </span>
            </button>
          </div>

          {/* زر الإنشاء */}
          <button
            onClick={createContract}
            disabled={loading || !agreed || !sharesValid}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-bold transition-colors",
              agreed && sharesValid && !loading
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.2] text-neutral-500 cursor-not-allowed"
            )}
          >
            {loading ? "جاري الإنشاء..." : "إنشاء العقد وإرسال الدعوات"}
          </button>

        </div>
      </div>

      {/* Fee Insufficient Modal */}
      {showFeeBlock && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-500/[0.3] rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/[0.1] border-2 border-red-500/[0.3] flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white mb-1">رصيد وحدات الرسوم غير كافٍ</div>
              <div className="text-xs text-neutral-400 leading-relaxed">
                إنشاء عقد يتطلب دفع عمولة من وحدات الرسوم
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 mb-5">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">المطلوب</span>
                <span className="text-sm font-bold text-red-400 font-mono">{feeAmount.toLocaleString("en-US")} وحدة</span>
              </div>
              <div className="h-px bg-white/[0.05] my-1" />
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">رصيدك الحالي</span>
                <span className="text-sm font-bold text-white font-mono">{mockFeeBalance.toLocaleString("en-US")} وحدة</span>
              </div>
              <div className="h-px bg-white/[0.05] my-1" />
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-neutral-500">النقص</span>
                <span className="text-sm font-bold text-yellow-400 font-mono">
                  {(feeAmount - mockFeeBalance).toLocaleString("en-US")} وحدة
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFeeBlock(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
              <button
                onClick={() => router.push("/portfolio?tab=fee_units")}
                className="flex-1 py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200"
              >
                شحن وحدات
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
