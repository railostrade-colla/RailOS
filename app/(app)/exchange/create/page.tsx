"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Search, X, AlertTriangle, Check, Wallet, ShoppingCart, Tag, Clock, FileText, Info, Lock, Coins } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) =>
  s?.includes("طب") ? "🏥" :
  s?.includes("تقن") ? "💻" :
  s?.includes("زراع") ? "🌾" :
  s?.includes("تجار") ? "🏪" :
  s?.includes("صناع") ? "🏭" :
  s?.includes("عقار") ? "🏢" : "🏢"

// ─── Mock Data (centralized) ───
import {
  MOCK_HOLDINGS_EXCHANGE as MOCK_HOLDINGS,
  MOCK_PROJECTS,
  MOCK_PREVIOUS_ADS,
  CURRENT_FEE_BALANCE as MOCK_FEE_BALANCE,
  PAYMENT_METHODS_FULL as PAYMENT_METHODS,
} from "@/lib/mock-data"
// Phase 10 — real DB listing creation (sell mode only; buy listings
// will get their own schema in a follow-up).
import { createListingDB } from "@/lib/data/portfolio-analytics"

// إعدادات الرسوم
const REPEAT_LISTING_FEE_PERCENT = 0.25 // 0.25% للإعلان المكرر

// ─── Project Selector Dropdown ───
function ProjectDropdown({
  projectList,
  selectedProjectId,
  onSelect,
  adType,
}: {
  projectList: Array<{ id: string; name: string; sector: string; share_price: number; available?: number }>
  selectedProjectId: string
  onSelect: (id: string) => void
  adType: "sell" | "buy"
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selected = projectList.find((p) => p.id === selectedProjectId)
  const filtered = projectList.filter(
    (p) => !search || p.name.includes(search) || p.sector.includes(search)
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={projectList.length === 0}
        className={cn(
          "w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.07] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between px-4 py-3 text-right transition-colors",
          open ? "rounded-t-xl border-b-0" : "rounded-xl"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">
            {selected ? sectorIcon(selected.sector) : "🏢"}
          </span>
          <div className="min-w-0 text-right">
            <div className="text-sm font-bold text-white truncate">
              {selected ? selected.name : "اختر الشركة أو المشروع..."}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {selected ? (
                <>
                  <span className="font-mono">{selected.share_price.toLocaleString("en-US")}</span> د.ع/حصة
                  {adType === "sell" && selected.available !== undefined && (
                    <span className="mr-2">• متاح: <span className="font-mono text-yellow-400">{selected.available}</span></span>
                  )}
                </>
              ) : (
                projectList.length === 0 ? "لا توجد خيارات متاحة" : "اضغط للاختيار"
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[#0a0a0a] border border-white/[0.08] border-t-white/[0.04] rounded-b-xl max-h-80 overflow-hidden flex flex-col shadow-2xl">
          <div className="p-2 border-b border-white/[0.04]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pr-8 pl-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500">لا توجد نتائج</div>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedProjectId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelect(p.id)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-right"
                  >
                    <span className="text-xl flex-shrink-0">{sectorIcon(p.sector)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        <span className="font-mono">{p.share_price.toLocaleString("en-US")}</span> د.ع
                        {adType === "sell" && p.available !== undefined && (
                          <span className="mr-1.5">• متاح: <span className="text-yellow-400 font-mono">{p.available}</span></span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-black" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment Methods Multi-Select ───
function PaymentMethodSelector({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = PAYMENT_METHODS.filter(
    (m) => !search || m.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (m: string) => {
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m])
  }

  const label =
    selected.length === 0
      ? "اختر طرق الدفع..."
      : selected.length === 1
      ? selected[0]
      : selected.length + " طرق دفع"

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.07] flex items-center justify-between px-4 py-3 text-right transition-colors",
          open ? "rounded-t-xl border-b-0" : "rounded-xl"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="w-4 h-4 text-neutral-400 flex-shrink-0" strokeWidth={1.5} />
          <span className={cn("text-sm truncate", selected.length > 0 ? "text-white font-bold" : "text-neutral-500")}>
            {label}
          </span>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-40 bg-[#0a0a0a] border border-white/[0.08] border-t-white/[0.04] rounded-b-xl max-h-72 overflow-hidden flex flex-col shadow-2xl">
          <div className="p-2 border-b border-white/[0.04]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في طرق الدفع..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 outline-none"
            />
          </div>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[11px] text-blue-400 py-1.5 border-b border-white/[0.04] hover:bg-white/[0.04]"
            >
              مسح ({selected.length})
            </button>
          )}
          <div className="overflow-y-auto flex-1">
            {filtered.map((m) => {
              const isChecked = selected.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggle(m)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors text-right border-b border-white/[0.02] last:border-0"
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                      isChecked ? "bg-green-400 border-green-400" : "border-neutral-600"
                    )}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                  </div>
                  <span className={cn("text-xs flex-1", isChecked ? "text-white" : "text-neutral-300")}>
                    {m}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───
export default function CreateAdPage() {
  const router = useRouter()

  // State
  const [adType, setAdType] = useState<"sell" | "buy">("sell")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [sharesInput, setSharesInput] = useState("")
  const [priceInput, setPriceInput] = useState("")
  const [duration, setDuration] = useState<24 | 48>(24)
  const [note, setNote] = useState("")
  const [minAmountInput, setMinAmountInput] = useState("")
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Calculations
  const sharesNum = parseInt(sharesInput) || 0
  const priceNum = parseInt(priceInput) || 0
  const minAmountNum = parseInt(minAmountInput) || 0
  const total = sharesNum * priceNum

  const selectedHolding = MOCK_HOLDINGS.find((h) => h.project_id === selectedProjectId)
  const availableShares = selectedHolding?.shares_owned || 0

  const selectedProject = useMemo(() => {
    if (adType === "sell") return MOCK_HOLDINGS.find((h) => h.project_id === selectedProjectId)?.project
    return MOCK_PROJECTS.find((p) => p.id === selectedProjectId)
  }, [adType, selectedProjectId])

  const marketPrice = selectedProject?.share_price || 0
  const maxPrice = marketPrice

  // Project list
  const projectList = useMemo(() => {
    if (adType === "sell") {
      return MOCK_HOLDINGS.map((h) => ({
        id: h.project_id,
        name: h.project.name,
        sector: h.project.sector,
        share_price: h.project.share_price,
        available: h.shares_owned,
      }))
    }
    return MOCK_PROJECTS.map((p) => ({
      id: p.id,
      name: p.name,
      sector: p.sector,
      share_price: p.share_price,
    }))
  }, [adType])

  // ─── Repeat Ad Detection ───
  const isRepeatAd = useMemo(() => {
    if (!selectedProjectId || adType !== "sell" || sharesNum < 1) return false
    return MOCK_PREVIOUS_ADS.some(
      (ad) => ad.project_id === selectedProjectId && ad.shares === sharesNum
    )
  }, [selectedProjectId, adType, sharesNum])

  // رسوم الإعلان (مجاني للمرة الأولى، 0.25% للمكرر)
  const listingFee = useMemo(() => {
    if (!isRepeatAd) return 0
    return Math.ceil((total * REPEAT_LISTING_FEE_PERCENT) / 100)
  }, [isRepeatAd, total])

  const hasEnoughFeeBalance = MOCK_FEE_BALANCE >= listingFee

  // ─── Validation Errors (per field) ───
  // ✦ القاعدة: لا توجد عمولة بالحصص — الإعلانات لا تخصم من الحصص نفسها.
  //   رسوم الإعلان (إن وُجدت) مدفوعة من رصيد وحدات الرسوم.
  const sharesError = useMemo(() => {
    if (sharesInput === "") return null
    if (sharesNum < 1) return "يجب أن يكون عدد الحصص 1 على الأقل"
    if (adType === "sell" && sharesNum > availableShares) {
      return "تجاوزت رصيدك المتاح — لديك " + availableShares + " حصة فقط"
    }
    return null
  }, [sharesInput, sharesNum, adType, availableShares])

  const priceError = useMemo(() => {
    if (priceInput === "") return null
    if (priceNum < 1) return "يجب إدخال سعر أكبر من صفر"
    if (marketPrice > 0 && priceNum > maxPrice) {
      return "السعر تجاوز سعر السوق — الحد الأعلى: " + maxPrice.toLocaleString("en-US") + " د.ع"
    }
    return null
  }, [priceInput, priceNum, marketPrice, maxPrice])

  // Reset on type change
  const handleTypeChange = (t: "sell" | "buy") => {
    setAdType(t)
    setSelectedProjectId("")
    setSharesInput("")
    setPriceInput("")
  }

  // Handle shares input - منع تجاوز الرصيد
  const handleSharesChange = (v: string) => {
    if (v === "") {
      setSharesInput("")
      return
    }
    const num = parseInt(v) || 0
    if (adType === "sell" && availableShares > 0 && num > availableShares) {
      setSharesInput(String(availableShares))
      return
    }
    setSharesInput(v)
  }

  // Handle price input - منع تجاوز سعر السوق
  const handlePriceChange = (v: string) => {
    if (v === "") {
      setPriceInput("")
      return
    }
    if (maxPrice > 0 && parseInt(v) > maxPrice) {
      setPriceInput(String(maxPrice))
    } else {
      setPriceInput(v)
    }
  }

  // فتح المودال للمراجعة النهائية
  const handleOpenReview = () => {
    if (!selectedProjectId) {
      showError("يرجى اختيار الشركة أو المشروع")
      return
    }
    if (sharesNum < 1) {
      showError("يرجى إدخال عدد الحصص")
      return
    }
    if (priceNum < 1) {
      showError("يرجى إدخال سعر الحصة")
      return
    }
    if (sharesError || priceError) {
      showError("يرجى تصحيح الأخطاء قبل المتابعة")
      return
    }
    if (!hasEnoughFeeBalance) {
      showError("رصيد وحدات الرسوم غير كافٍ")
      return
    }
    setShowConfirmModal(true)
  }

  // النشر النهائي
  const handleFinalSubmit = async () => {
    if (!agreed) {
      showError("يجب الموافقة على شروط النشر")
      return
    }

    setSubmitting(true)
    try {
      // Insert into the real `listings` table via the create_listing
      // RPC. Both sell and buy types are supported as of phase 10.5;
      // when the project_id isn't a UUID (mock projects in dev) we
      // fall back to the legacy mock path so /exchange/create still
      // works in stand-alone demos.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedProjectId)
      if (isUuid) {
        const res = await createListingDB(
          selectedProjectId,
          sharesNum,
          priceNum,
          // Notes blob: pack duration + payment methods so the page
          // displaying the listing later can show what the creator chose.
          JSON.stringify({
            duration_hours: duration,
            payment_methods: paymentMethods,
          }),
          false,
          adType,
        )
        if (!res.success) {
          const reasonMap: Record<string, string> = {
            unauthenticated: "يجب تسجيل الدخول أولاً",
            invalid_shares: "عدد الحصص غير صحيح",
            invalid_price: "السعر غير صحيح",
            invalid_type: "نوع الإعلان غير صحيح",
            no_holdings: "لا تملك حصصاً في هذا المشروع",
            insufficient_unfrozen: `متاح للبيع: ${res.available ?? "؟"} حصة فقط`,
            missing_table: "الميزة غير مفعّلة بعد على الخادم",
            rls: "ليس لديك صلاحية لنشر إعلان",
          }
          showError(reasonMap[res.reason ?? ""] ?? "تعذّر نشر الإعلان")
          setSubmitting(false)
          return
        }
        if (listingFee > 0) {
          showSuccess("تم نشر الإعلان! خُصم " + listingFee + " وحدة رسوم")
        } else {
          showSuccess("تم نشر الإعلان مجاناً! 🎉")
        }
        setTimeout(() => router.replace("/exchange"), 800)
        return
      }

      // Legacy mock path (non-UUID mock projects in dev)
      await new Promise((resolve) => setTimeout(resolve, 1200))
      if (listingFee > 0) {
        showSuccess("تم نشر الإعلان! خُصم " + listingFee + " وحدة رسوم")
      } else {
        showSuccess("تم نشر الإعلان مجاناً! 🎉")
      }
      setTimeout(() => router.replace("/exchange"), 800)
    } catch (e) {
      showError("فشل النشر — حاول مرة أخرى")
      setSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="إنشاء إعلان"
            subtitle="انشر طلبك في سوق التبادل"
            backHref="/exchange"
          />

          {/* رصيد وحدات الرسوم */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/[0.1] border border-yellow-400/25 flex items-center justify-center">
                <Coins className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">رصيد وحدات الرسوم</div>
                <div className="text-sm font-bold text-white font-mono">
                  {MOCK_FEE_BALANCE.toLocaleString("en-US")} وحدة
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/wallet")}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              شحن الرصيد ←
            </button>
          </div>

          <div className="space-y-5">

            {/* 1. Ad Type */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1.5">
                <Tag className="w-3 h-3" strokeWidth={2} />
                نوع الإعلان
              </div>
              <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                <button
                  onClick={() => handleTypeChange("sell")}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5",
                    adType === "sell"
                      ? "bg-red-500/15 text-red-400 font-bold border border-red-500/30"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <span className="text-xs">🔴</span>
                  بيع حصص
                </button>
                <button
                  onClick={() => handleTypeChange("buy")}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5",
                    adType === "buy"
                      ? "bg-green-500/15 text-green-400 font-bold border border-green-500/30"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <span className="text-xs">🟢</span>
                  شراء حصص
                </button>
              </div>
            </div>

            {/* 2. Project Dropdown */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center justify-between">
                <span>الشركة أو المشروع</span>
                {adType === "sell" && projectList.length === 0 && (
                  <span className="text-red-400 text-[10px]">لا توجد حصص في محفظتك</span>
                )}
              </div>
              <ProjectDropdown
                projectList={projectList}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
                adType={adType}
              />
            </div>

            {/* 3. Shares + Price */}
            <div className="grid grid-cols-2 gap-3">
              {/* Shares */}
              <div>
                <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center justify-between">
                  <span>عدد الحصص</span>
                  {adType === "sell" && selectedHolding && (
                    <button
                      onClick={() => setSharesInput(String(availableShares))}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-normal"
                    >
                      الحد الأقصى
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={sharesInput}
                  onChange={(e) => handleSharesChange(e.target.value)}
                  placeholder="0"
                  min="1"
                  max={adType === "sell" && availableShares > 0 ? availableShares : undefined}
                  className={cn(
                    "w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-base font-bold text-white outline-none text-center font-mono transition-colors",
                    sharesError
                      ? "border-red-500/60 focus:border-red-500 bg-red-500/[0.04]"
                      : "border-white/[0.08] focus:border-white/20"
                  )}
                  dir="ltr"
                />
                {sharesError ? (
                  <div className="flex items-start gap-1 mt-1.5 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="leading-tight">{sharesError}</span>
                  </div>
                ) : adType === "sell" && availableShares > 0 ? (
                  <div className="text-[10px] text-neutral-500 mt-1.5">
                    المتاح: <span className="text-yellow-400 font-mono font-bold">{availableShares}</span> حصة
                    <span className="text-neutral-600"> (لا توجد عمولة بالحصص)</span>
                  </div>
                ) : null}
              </div>

              {/* Price */}
              <div>
                <div className="text-[11px] text-neutral-400 mb-2 font-bold">سعر الحصة (د.ع)</div>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="0"
                  min="1"
                  max={maxPrice > 0 ? maxPrice : undefined}
                  className={cn(
                    "w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-base font-bold text-white outline-none text-center font-mono transition-colors",
                    priceError
                      ? "border-red-500/60 focus:border-red-500 bg-red-500/[0.04]"
                      : "border-white/[0.08] focus:border-white/20"
                  )}
                  dir="ltr"
                />
                {priceError ? (
                  <div className="flex items-start gap-1 mt-1.5 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="leading-tight">{priceError}</span>
                  </div>
                ) : marketPrice > 0 ? (
                  <div className="text-[10px] text-neutral-500 mt-1.5">
                    سعر السوق: <span className="text-yellow-400 font-mono font-bold">{marketPrice.toLocaleString("en-US")}</span> د.ع
                  </div>
                ) : null}
              </div>
            </div>

            {/* 4. Min amount */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1">
                الحد الأدنى لمبلغ المعاملة
                <span className="text-[10px] text-neutral-600 font-normal">(اختياري)</span>
              </div>
              <input
                type="number"
                value={minAmountInput}
                onChange={(e) => setMinAmountInput(e.target.value)}
                placeholder="0 — بدون حد أدنى"
                min="0"
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                dir="ltr"
              />
            </div>

            {/* 5. Payment Methods */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1">
                طرق الدفع المفضلة
                <span className="text-[10px] text-neutral-600 font-normal">(اختياري)</span>
              </div>
              <PaymentMethodSelector selected={paymentMethods} onChange={setPaymentMethods} />

              {paymentMethods.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm}
                      onClick={() => setPaymentMethods(paymentMethods.filter((x) => x !== pm))}
                      className="bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.08] rounded-full px-2.5 py-1 text-[10px] text-white flex items-center gap-1 transition-colors"
                    >
                      {pm}
                      <X className="w-2.5 h-2.5 text-neutral-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Duration */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1.5">
                <Clock className="w-3 h-3" strokeWidth={2} />
                مدة الإعلان
              </div>
              <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                {([24, 48] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm transition-colors",
                      duration === d
                        ? "bg-white/[0.08] text-white font-bold"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    {d} ساعة
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Note */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-2 font-bold flex items-center gap-1.5">
                <FileText className="w-3 h-3" strokeWidth={2} />
                ملاحظات
                <span className="text-[10px] text-neutral-600 font-normal">(اختياري)</span>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: تسوية خلال 24 ساعة، تحويل بنكي فقط..."
                maxLength={120}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              />
              {note.length > 0 && (
                <div className="text-[10px] text-neutral-600 mt-1 text-left font-mono">
                  {note.length} / 120
                </div>
              )}
            </div>

            {/* تنبيه إعلان مكرر */}
            {isRepeatAd && (
              <div className="bg-yellow-400/[0.06] border border-yellow-400/25 rounded-xl p-3.5 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="text-[11px] leading-relaxed">
                  <div className="font-bold text-yellow-400 mb-1">إعلان مكرّر</div>
                  <div className="text-neutral-300">
                    سبق ونشرت إعلان لهذا المشروع بنفس عدد الحصص. ستُحتسب رسوم نشر <span className="font-bold text-yellow-400 font-mono">{listingFee}</span> وحدة (0.25% من الإجمالي).
                  </div>
                </div>
              </div>
            )}

            {/* تنبيه رصيد غير كافٍ */}
            {listingFee > 0 && !hasEnoughFeeBalance && (
              <div className="bg-red-500/[0.06] border border-red-500/30 rounded-xl p-3.5 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="text-[11px] leading-relaxed flex-1">
                  <div className="font-bold text-red-400 mb-1">رصيد وحدات الرسوم غير كافٍ</div>
                  <div className="text-neutral-300">
                    تحتاج <span className="font-bold text-red-400 font-mono">{listingFee}</span> وحدة، رصيدك <span className="font-bold font-mono">{MOCK_FEE_BALANCE}</span>.
                  </div>
                  <button
                    onClick={() => router.push("/wallet")}
                    className="mt-2 text-blue-400 hover:text-blue-300 font-bold"
                  >
                    شحن الرصيد ←
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-3">
              <button
                onClick={() => router.push("/exchange")}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-3.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleOpenReview}
                disabled={!selectedProjectId || sharesNum < 1 || priceNum < 1 || !!sharesError || !!priceError || (listingFee > 0 && !hasEnoughFeeBalance)}
                className={cn(
                  "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  !selectedProjectId || sharesNum < 1 || priceNum < 1 || !!sharesError || !!priceError || (listingFee > 0 && !hasEnoughFeeBalance)
                    ? "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                    : "bg-neutral-100 text-black hover:bg-neutral-200"
                )}
              >
                <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                مراجعة ونشر
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Modal: المراجعة النهائية ─── */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => {
            if (!submitting) {
              setShowConfirmModal(false)
              setAgreed(false)
            }
          }}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">مراجعة نهائية</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">تأكد من البيانات قبل النشر</div>
              </div>
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setAgreed(false)
                }}
                disabled={submitting}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* تفاصيل الإعلان */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2.5">
              {[
                ["نوع الإعلان", adType === "sell" ? "🔴 بيع حصص" : "🟢 شراء حصص"],
                ["الشركة / المشروع", selectedProject?.name || "—"],
                ["عدد الحصص", sharesNum.toLocaleString("en-US") + " حصة"],
                ["سعر الحصة", priceNum.toLocaleString("en-US") + " د.ع"],
                ...(minAmountNum > 0 ? [["الحد الأدنى", minAmountNum.toLocaleString("en-US") + " د.ع"] as [string, string]] : []),
                ["مدة النشر", duration + " ساعة"],
                ...(paymentMethods.length > 0 ? [["طرق الدفع", paymentMethods.length + " طريقة"] as [string, string]] : []),
                ...(note ? [["ملاحظات", note] as [string, string]] : []),
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[11px] text-neutral-500 flex-shrink-0">{l}</span>
                  <span className="text-xs font-bold text-white text-left">{v}</span>
                </div>
              ))}
              <div className="h-px bg-white/[0.05]" />
              <div className="flex justify-between gap-2">
                <span className="text-xs font-bold text-yellow-400">الإجمالي</span>
                <span className="text-base font-bold text-yellow-400 font-mono">
                  {fmtIQD(total)} د.ع
                </span>
              </div>
            </div>

            {/* رسوم النشر */}
            <div className={cn(
              "rounded-xl p-3.5 mb-4 border",
              listingFee > 0
                ? "bg-yellow-400/[0.06] border-yellow-400/25"
                : "bg-green-400/[0.06] border-green-400/25"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Coins className={cn("w-4 h-4", listingFee > 0 ? "text-yellow-400" : "text-green-400")} strokeWidth={1.5} />
                <span className={cn("text-xs font-bold", listingFee > 0 ? "text-yellow-400" : "text-green-400")}>
                  رسوم النشر
                </span>
              </div>
              {listingFee > 0 ? (
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  هذا الإعلان <span className="font-bold text-yellow-400">مكرّر</span> لنفس المشروع وعدد الحصص.
                  ستُخصم <span className="font-bold text-yellow-400 font-mono">{listingFee}</span> وحدة رسوم (0.25%).
                  <div className="text-[10px] text-neutral-500 mt-1.5 font-mono">
                    رصيدك الحالي: {MOCK_FEE_BALANCE} → بعد الخصم: {MOCK_FEE_BALANCE - listingFee} وحدة
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  هذا الإعلان <span className="font-bold text-green-400">مجاني</span> — لم تنشر إعلاناً مماثلاً سابقاً.
                </div>
              )}
            </div>

            {/* تنبيه عدم التعديل/الحذف */}
            <div className="bg-red-500/[0.04] border border-red-500/20 rounded-xl p-3.5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-red-400" strokeWidth={2} />
                <span className="text-xs font-bold text-red-400">تنبيه مهم</span>
              </div>
              <ul className="space-y-1.5">
                {[
                  "لا يمكن تعديل الإعلان بعد النشر",
                  "لا يمكن حذف الإعلان قبل انتهاء مدته (" + duration + " ساعة)",
                  "الإلغاء المبكر قد يؤثر على تقييمك في المنصة",
                  "تأكد من جميع البيانات قبل التأكيد",
                ].map((rule, i) => (
                  <li key={i} className="text-[11px] text-neutral-300 flex gap-1.5 leading-relaxed">
                    <span className="text-red-400 flex-shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* الموافقة */}
            <button
              onClick={() => setAgreed(!agreed)}
              disabled={submitting}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-xl border mb-4 transition-all text-right disabled:opacity-50",
                agreed
                  ? "bg-green-400/[0.06] border-green-400/30"
                  : "bg-white/[0.04] border-white/[0.08]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                  agreed ? "bg-green-400 border-green-400" : "border-neutral-500"
                )}
              >
                {agreed && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
              </div>
              <span className={cn("text-[11px] leading-relaxed", agreed ? "text-green-400" : "text-neutral-400")}>
                أؤكد قراءة الشروط، وأوافق على عدم تعديل أو حذف الإعلان قبل انتهاء مدته
                {listingFee > 0 && (
                  <span> وعلى خصم <span className="font-bold font-mono">{listingFee}</span> وحدة رسوم من رصيدي</span>
                )}
              </span>
            </button>

            {/* أزرار الإجراء */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setAgreed(false)
                }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                رجوع
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={!agreed || submitting}
                className={cn(
                  "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  agreed && !submitting
                    ? "bg-neutral-100 text-black hover:bg-neutral-200"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                    جاري النشر...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" strokeWidth={2} />
                    تأكيد النشر
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
