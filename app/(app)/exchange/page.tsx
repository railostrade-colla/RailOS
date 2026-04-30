"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Search, Plus, X, AlertTriangle, ShoppingCart, Lock, Clock, Wallet, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  MOCK_PROJECTS,
  MOCK_LISTINGS,
  PAYMENT_METHODS_PUBLIC as PAYMENT_METHODS,
} from "@/lib/mock-data"
import { canCreateDeal, createDeal } from "@/lib/escrow"
import { cn } from "@/lib/utils/cn"

const CURRENT_USER_ID = "me"
const CURRENT_USER_NAME = "أنا"

function formatTimeLeftShort(ms: number): string {
  if (ms <= 0) return "انتهى"
  const hrs = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hrs > 0) return `${hrs}س ${mins}د`
  return `${mins}د`
}

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) =>
  s?.includes("طب") ? "🏥" :
  s?.includes("تقن") ? "💻" :
  s?.includes("زراع") ? "🌾" :
  s?.includes("تجار") ? "🏪" :
  s?.includes("صناع") ? "🏭" :
  s?.includes("عقار") ? "🏢" : "🏢"

const timeSince = (dateStr: string) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return "الآن"
  if (mins < 60) return "منذ " + mins + " د"
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return "منذ " + hrs + " س"
  return "منذ " + Math.floor(hrs / 24) + " ي"
}

// ─── Project Selector Dropdown ───
function ProjectSelector({
  projects,
  selectedProject,
  onSelect,
}: {
  projects: typeof MOCK_PROJECTS
  selectedProject: typeof MOCK_PROJECTS[0] | null
  onSelect: (p: typeof MOCK_PROJECTS[0] | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = projects.filter(
    (p) => !search || p.name.includes(search) || p.sector.includes(search)
  )

  return (
    <div className="relative mb-2.5">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.07] transition-colors flex items-center justify-between px-4 py-3 text-right",
          open ? "rounded-t-xl border-b-0" : "rounded-xl"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">
            {selectedProject ? sectorIcon(selectedProject.sector) : "🏢"}
          </span>
          <div>
            <div className="text-sm font-bold text-white">
              {selectedProject ? selectedProject.name : "كل المشاريع"}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {selectedProject
                ? selectedProject.share_price.toLocaleString("en-US") + " د.ع/حصة"
                : "اختر مشروعاً للفلترة"}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-neutral-400 transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[#0a0a0a] border border-white/[0.08] border-t-white/[0.04] rounded-b-xl max-h-80 overflow-hidden flex flex-col shadow-2xl">
          {/* Search */}
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

          {/* List */}
          <div className="overflow-y-auto flex-1">
            <button
              onClick={() => {
                onSelect(null)
                setOpen(false)
                setSearch("")
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-right border-b border-white/[0.04]"
            >
              <span className="text-xl">🏢</span>
              <div>
                <div className="text-xs font-bold text-white">كل المشاريع</div>
                <div className="text-[10px] text-neutral-500">عرض جميع الإعلانات</div>
              </div>
              {!selectedProject && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-auto" />
              )}
            </button>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p)
                  setOpen(false)
                  setSearch("")
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-right"
              >
                <span className="text-xl">{sectorIcon(p.sector)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {p.sector} • {p.share_price.toLocaleString("en-US")} د.ع
                  </div>
                </div>
                {selectedProject?.id === p.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-6 text-xs text-neutral-500">لا توجد نتائج</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment Methods Dropdown ───
function PaymentMethodFilter({
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
      ? "كل طرق الدفع"
      : selected.length === 1
      ? selected[0]
      : selected.length + " طرق دفع"

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors flex items-center justify-between px-3 py-2 text-right",
          open ? "rounded-t-lg border-b-0" : "rounded-lg"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" strokeWidth={1.5} />
          <span className={cn("text-xs truncate", selected.length > 0 ? "text-white font-bold" : "text-neutral-400")}>
            {label}
          </span>
        </div>
        <ChevronDown
          className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform flex-shrink-0", open && "rotate-180")}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-40 bg-[#0a0a0a] border border-white/[0.08] border-t-white/[0.04] rounded-b-lg max-h-72 overflow-hidden flex flex-col shadow-2xl">
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
              مسح التحديد ({selected.length})
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
                      isChecked
                        ? "bg-green-400 border-green-400"
                        : "border-neutral-600"
                    )}
                  >
                    {isChecked && <span className="text-black text-[9px] font-bold">✓</span>}
                  </div>
                  <span className={cn("text-[11px] flex-1", isChecked ? "text-white" : "text-neutral-300")}>
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
function ExchangeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectFilter = searchParams?.get("project")

  const [mode, setMode] = useState<"buy" | "sell">("buy")
  const [sort, setSort] = useState<"price" | "trust" | "speed">("price")
  const [selectedProject, setSelectedProject] = useState<typeof MOCK_PROJECTS[0] | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<string[]>([])

  // Escrow modal state
  const [confirmListing, setConfirmListing] = useState<typeof MOCK_LISTINGS[0] | null>(null)
  const [conflictDeal, setConflictDeal] = useState<{ id: string; expires_at: string } | null>(null)
  const [amount, setAmount] = useState<number>(1)
  const [duration, setDuration] = useState<24 | 48 | 72>(24)
  const [notes, setNotes] = useState("")
  const [agreed1, setAgreed1] = useState(false)  // shares lock
  const [agreed2, setAgreed2] = useState(false)  // commitment
  const [opening, setOpening] = useState(false)

  // Apply project filter from URL
  useEffect(() => {
    if (projectFilter) {
      const p = MOCK_PROJECTS.find((proj) => proj.id === projectFilter)
      if (p) setSelectedProject(p)
    }
  }, [projectFilter])

  // Filter + Sort
  const filtered = useMemo(() => {
    return MOCK_LISTINGS
      .filter((l) => l.type === (mode === "buy" ? "sell" : "buy"))
      .filter((l) => !selectedProject || l.project_id === selectedProject.id)
      .filter((l) => {
        if (paymentFilter.length === 0) return true
        return paymentFilter.some((pm) => l.payment_methods.includes(pm))
      })
      .sort((a, b) => {
        if (sort === "price") return mode === "buy" ? a.price - b.price : b.price - a.price
        if (sort === "trust") return b.reputation_score - a.reputation_score
        if (sort === "speed") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return 0
      })
  }, [mode, sort, selectedProject, paymentFilter])

  /** Triggered when user clicks "شراء/بيع" on a listing card. */
  const onClickListing = (listing: typeof MOCK_LISTINGS[0]) => {
    // 1. Check for active deal على هذا الإعلان
    const can = canCreateDeal(CURRENT_USER_ID, listing.id)
    if (!can.allowed && can.activeDeal) {
      setConflictDeal({ id: can.activeDeal.id, expires_at: can.activeDeal.expires_at })
      return
    }
    // 2. Open the new-deal modal
    setConfirmListing(listing)
    setAmount(Math.min(1, listing.shares))
    setDuration(24)
    setNotes("")
    setAgreed1(false)
    setAgreed2(false)
  }

  const closeNewDealModal = () => {
    setConfirmListing(null)
    setAmount(1)
    setNotes("")
    setAgreed1(false)
    setAgreed2(false)
  }

  const handleCreateDeal = () => {
    if (!confirmListing) return
    if (amount < 1 || amount > confirmListing.shares) {
      return showError(`الكمية يجب أن تكون بين 1 و ${confirmListing.shares}`)
    }
    if (!agreed1 || !agreed2) {
      return showError("يجب الموافقة على شروط الـ Escrow")
    }

    setOpening(true)
    // Determine buyer/seller based on listing type + mode
    const isBuyingFromSellListing = confirmListing.type === "sell"
    const buyerId = isBuyingFromSellListing ? CURRENT_USER_ID : confirmListing.user_id
    const buyerName = isBuyingFromSellListing ? CURRENT_USER_NAME : confirmListing.user_name
    const sellerId = isBuyingFromSellListing ? confirmListing.user_id : CURRENT_USER_ID
    const sellerName = isBuyingFromSellListing ? confirmListing.user_name : CURRENT_USER_NAME

    const result = createDeal({
      buyerId,
      buyerName,
      sellerId,
      sellerName,
      listingId: confirmListing.id,
      projectId: confirmListing.project_id,
      projectName: confirmListing.project_name,
      amount,
      pricePerShare: confirmListing.price,
      durationHours: duration,
      notes: notes.trim() || undefined,
    })

    setOpening(false)

    if (!result.success || !result.data) {
      return showError(result.reason ?? "تعذّر فتح الصفقة")
    }
    showSuccess(`🔒 تم تعليق ${amount} حصة وفتح الصفقة`)
    closeNewDealModal()
    router.push("/deals/" + result.data.id)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="التبادل"
            subtitle="سوق التبادل بين المستثمرين"
            rightAction={
              <button
                onClick={() => router.push("/exchange/create")}
                className="bg-neutral-100 text-black px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                إنشاء إعلان
              </button>
            }
          />

          {/* Project Selector */}
          <ProjectSelector
            projects={MOCK_PROJECTS}
            selectedProject={selectedProject}
            onSelect={setSelectedProject}
          />

          {/* Mode Toggle: شراء / بيع */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-2.5">
            <button
              onClick={() => setMode("buy")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm transition-colors",
                mode === "buy"
                  ? "bg-white text-black font-bold"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              شراء
            </button>
            <button
              onClick={() => setMode("sell")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm transition-colors",
                mode === "sell"
                  ? "bg-red-500/15 text-red-400 font-bold border border-red-500/30"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              بيع
            </button>
          </div>

          {/* Sort filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2.5 -mx-1 px-1">
            {([
              { key: "price" as const, label: "الأفضل سعراً" },
              { key: "trust" as const, label: "الأعلى موثوقية" },
              { key: "speed" as const, label: "الأسرع تنفيذاً" },
            ]).map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[11px] flex-shrink-0 transition-colors border whitespace-nowrap",
                  sort === s.key
                    ? "bg-white text-black border-transparent font-bold"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          <div className="mb-3">
            <PaymentMethodFilter selected={paymentFilter} onChange={setPaymentFilter} />
          </div>

          {/* Liquidity indicator */}
          <div
            className={cn(
              "rounded-lg p-3 mb-4 flex items-center justify-between border",
              filtered.length > 3
                ? "bg-green-400/[0.06] border-green-400/15"
                : filtered.length > 0
                ? "bg-yellow-400/[0.06] border-yellow-400/15"
                : "bg-white/[0.04] border-white/[0.06]"
            )}
          >
            <div className="text-xs text-neutral-400">
              <span className="text-white font-bold">{filtered.length}</span>{" "}
              {mode === "buy" ? "عرض بيع" : "طلب شراء"} متاح
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  filtered.length > 3
                    ? "bg-green-400"
                    : filtered.length > 0
                    ? "bg-yellow-400"
                    : "bg-neutral-600"
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-bold",
                  filtered.length > 3
                    ? "text-green-400"
                    : filtered.length > 0
                    ? "text-yellow-400"
                    : "text-neutral-500"
                )}
              >
                {filtered.length > 3
                  ? "سيولة مرتفعة"
                  : filtered.length > 0
                  ? "سيولة متوسطة"
                  : "لا توجد عروض"}
              </span>
            </div>
          </div>

          {/* Listings */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <div className="text-5xl mb-3 opacity-50">📋</div>
              <div className="text-sm text-neutral-400 mb-1">لا توجد عروض حالياً</div>
              <div className="text-[11px] text-neutral-600 mb-5">جرب تغيير الفلاتر أو أنشئ إعلانك الخاص</div>
              <button
                onClick={() => router.push("/exchange/create")}
                className="bg-neutral-100 text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
              >
                إنشاء إعلان
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((l, idx) => {
                const isBest = idx === 0
                const verified = l.reputation_score >= 80

                return (
                  <div
                    key={l.id}
                    className={cn(
                      "bg-white/[0.05] border rounded-2xl p-4 transition-colors hover:bg-white/[0.06]",
                      isBest ? "border-yellow-400/25" : "border-white/[0.08]"
                    )}
                  >
                    {/* Header: User info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                          {l.user_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{l.user_name}</span>
                            {verified && (
                              <span className="bg-green-400/[0.12] border border-green-400/25 text-green-400 px-1.5 py-px rounded text-[9px] font-bold flex items-center gap-0.5">
                                ✓ موثق
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {l.total_trades} صفقة • {l.success_rate}% نجاح
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isBest && (
                          <span className="bg-yellow-400/[0.12] border border-yellow-400/25 text-yellow-400 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5">
                            ⭐ الأفضل
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeSince(l.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Project name */}
                    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 mb-3 flex items-center gap-2">
                      <span className="text-base">{sectorIcon(l.project_name?.includes("مزرعة") ? "زراعة" : l.project_name?.includes("برج") ? "تجارة" : "عقارات")}</span>
                      <span className="text-xs text-neutral-300">{l.project_name}</span>
                    </div>

                    {/* Price + Quantity */}
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-1">سعر الحصة</div>
                        <div className="text-2xl font-bold text-white tracking-tight font-mono">
                          {l.price.toLocaleString("en-US")}{" "}
                          <span className="text-xs text-neutral-500 font-normal">د.ع</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-neutral-500 mb-1">الكمية</div>
                        <div className="text-base font-bold text-white font-mono">
                          {l.shares}{" "}
                          <span className="text-[10px] text-neutral-500">SHR</span>
                        </div>
                        <div className="text-[10px] text-green-400 mt-0.5 flex items-center gap-0.5 justify-end">
                          <Lock className="w-2.5 h-2.5" />
                          Escrow
                        </div>
                      </div>
                    </div>

                    {/* Payment methods */}
                    {l.payment_methods.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {l.payment_methods.slice(0, 3).map((pm) => (
                          <span
                            key={pm}
                            className="bg-white/[0.04] border border-white/[0.06] text-neutral-400 text-[10px] px-2 py-0.5 rounded"
                          >
                            {pm}
                          </span>
                        ))}
                        {l.payment_methods.length > 3 && (
                          <span className="bg-white/[0.04] border border-white/[0.06] text-neutral-400 text-[10px] px-2 py-0.5 rounded">
                            +{l.payment_methods.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Total + Min amount */}
                    <div className="flex items-center justify-between mb-3 text-[10px]">
                      <span className="text-neutral-500">
                        {l.min_amount > 0 ? "حد أدنى: " + l.min_amount.toLocaleString("en-US") + " د.ع" : "1-10 SHR"}
                      </span>
                      <span className="text-neutral-400">
                        الإجمالي: <span className="text-yellow-400 font-bold font-mono">{fmtIQD(l.price * l.shares)} د.ع</span>
                      </span>
                    </div>

                    {/* Action button */}
                    <button
                      onClick={() => onClickListing(l)}
                      className={cn(
                        "w-full py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2",
                        mode === "buy"
                          ? "bg-neutral-100 text-black hover:bg-neutral-200"
                          : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      )}
                    >
                      <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                      {mode === "buy" ? "شراء" : "بيع"}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* ═══ Conflict Modal — صفقة نشطة موجودة ═══ */}
      {conflictDeal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setConflictDeal(null)}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-xl">
                  ⏳
                </div>
                <div>
                  <div className="text-base font-bold text-white">صفقة نشطة موجودة</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">على هذا الإعلان</div>
                </div>
              </div>
              <button onClick={() => setConflictDeal(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl p-4 mb-4 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">الوقت المتبقّي</div>
              <div className="text-2xl font-bold text-yellow-400 font-mono mb-1" dir="ltr">
                {formatTimeLeftShort(new Date(conflictDeal.expires_at).getTime() - Date.now())}
              </div>
              <div className="text-[10px] text-neutral-400">يجب إكمال أو إلغاء الصفقة الحالية أولاً</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConflictDeal(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={() => router.push("/deals/" + conflictDeal.id)}
                className="flex-[2] py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-2"
              >
                عرض الصفقة
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ New Deal Modal — Escrow ═══ */}
      {confirmListing && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={closeNewDealModal}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-400/15 border border-blue-400/30 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-400" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-base font-bold text-white">فتح صفقة جديدة</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {mode === "buy" ? "شراء من" : "بيع إلى"} {confirmListing.user_name}
                  </div>
                </div>
              </div>
              <button onClick={closeNewDealModal} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Amount input */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-neutral-300 mb-2 block">
                الكمية {mode === "buy" ? "المُراد شراؤها" : "المُراد بيعها"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={confirmListing.shares}
                  value={amount}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(confirmListing.shares, Number(e.target.value) || 1))
                    setAmount(v)
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-base text-white font-mono outline-none focus:border-white/20"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-500 font-bold">
                  / {confirmListing.shares} متاح
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[1, Math.ceil(confirmListing.shares / 4), Math.ceil(confirmListing.shares / 2), confirmListing.shares].map((n, i) => (
                  <button
                    key={i}
                    onClick={() => setAmount(n)}
                    className={cn(
                      "py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                      amount === n
                        ? "bg-blue-400/15 border-blue-400/40 text-blue-400"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    {n} حصة
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Duration selector */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-neutral-300 mb-2 block">
                مدّة إكمال الصفقة
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([24, 48, 72] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setDuration(h)}
                    className={cn(
                      "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                      duration === h
                        ? "bg-blue-400/15 border-blue-400/40 text-blue-400"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    {h} ساعة
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Notes */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-neutral-300 mb-2 block">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="مثال: أفضّل الدفع عبر زين كاش..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none resize-none"
              />
            </div>

            {/* Total summary */}
            <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl p-3 mb-4 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-neutral-500">الإجمالي</div>
                <div className="text-[10px] text-neutral-400">{amount} × {fmtIQD(confirmListing.price)}</div>
              </div>
              <div className="text-lg font-bold text-yellow-400 font-mono">
                {fmtIQD(amount * confirmListing.price)} د.ع
              </div>
            </div>

            {/* Escrow rules */}
            <div className="bg-blue-400/[0.04] border border-blue-400/15 rounded-xl p-3.5 mb-4">
              <div className="text-[11px] font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                نظام التعليق (Escrow)
              </div>
              <ul className="space-y-1.5">
                {[
                  "ستُعلَّق الحصص فور إنشاء الصفقة (لا يستطيع البائع بيعها لأحد آخر).",
                  "بعد الدفع، تضغط زر «تأكيد الدفع».",
                  "البائع يضغط «تحرير الحصص» بعد استلام المبلغ.",
                  "إذا انتهى الوقت بدون تأكيد، الحصص ترجع للبائع تلقائياً.",
                ].map((rule, i) => (
                  <li key={i} className="text-[11px] text-neutral-300 flex gap-1.5 leading-relaxed">
                    <span className="text-blue-400 flex-shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Two checkboxes */}
            <div className="space-y-2 mb-4">
              <button
                onClick={() => setAgreed1(!agreed1)}
                className={cn(
                  "w-full flex items-start gap-3 p-2.5 rounded-xl border transition-all text-right",
                  agreed1 ? "bg-green-400/[0.06] border-green-400/30" : "bg-white/[0.04] border-white/[0.08]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    agreed1 ? "bg-green-400 border-green-400" : "border-neutral-500"
                  )}
                >
                  {agreed1 && <span className="text-black text-[9px] font-bold">✓</span>}
                </div>
                <span className={cn("text-[11px] leading-relaxed", agreed1 ? "text-green-400" : "text-neutral-400")}>
                  أوافق على تعليق الحصص فور إنشاء الصفقة
                </span>
              </button>
              <button
                onClick={() => setAgreed2(!agreed2)}
                className={cn(
                  "w-full flex items-start gap-3 p-2.5 rounded-xl border transition-all text-right",
                  agreed2 ? "bg-green-400/[0.06] border-green-400/30" : "bg-white/[0.04] border-white/[0.08]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    agreed2 ? "bg-green-400 border-green-400" : "border-neutral-500"
                  )}
                >
                  {agreed2 && <span className="text-black text-[9px] font-bold">✓</span>}
                </div>
                <span className={cn("text-[11px] leading-relaxed", agreed2 ? "text-green-400" : "text-neutral-400")}>
                  أتعهّد بإكمال الدفع/التسليم خلال {duration} ساعة
                </span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={closeNewDealModal}
                disabled={opening}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateDeal}
                disabled={!agreed1 || !agreed2 || opening}
                className={cn(
                  "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  agreed1 && agreed2 && !opening
                    ? "bg-neutral-100 text-black hover:bg-neutral-200"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                <Lock className="w-4 h-4" strokeWidth={2} />
                {opening ? "جاري التعليق..." : "فتح الصفقة + تعليق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default function ExchangePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ExchangeContent />
    </Suspense>
  )
}
