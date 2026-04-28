"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Search, Plus, X, Filter, AlertTriangle, ShoppingCart, Lock, Star, Clock, Wallet } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import {
  MOCK_PROJECTS,
  MOCK_LISTINGS,
  PAYMENT_METHODS_PUBLIC as PAYMENT_METHODS,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

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
export default function ExchangePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectFilter = searchParams?.get("project")

  const [mode, setMode] = useState<"buy" | "sell">("buy")
  const [sort, setSort] = useState<"price" | "trust" | "speed">("price")
  const [selectedProject, setSelectedProject] = useState<typeof MOCK_PROJECTS[0] | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<string[]>([])
  const [confirmListing, setConfirmListing] = useState<typeof MOCK_LISTINGS[0] | null>(null)
  const [agreed, setAgreed] = useState(false)
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

  const handleOpenDeal = () => {
    if (!agreed) {
      showError("يجب الموافقة على القوانين أولاً")
      return
    }
    setOpening(true)
    setTimeout(() => {
      const dealId = "deal_" + Date.now()
      showSuccess("تم فتح الدردشة! 💬")
      setOpening(false)
      setConfirmListing(null)
      setAgreed(false)
      router.push("/deal-chat/" + dealId)
    }, 800)
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
                      onClick={() => setConfirmListing(l)}
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

      {/* Confirmation Modal */}
      {confirmListing && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => {
            setConfirmListing(null)
            setAgreed(false)
          }}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-base font-bold text-white">تأكيد الصفقة</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {mode === "buy" ? "شراء من" : "بيع إلى"} {confirmListing.user_name}
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmListing(null)
                  setAgreed(false)
                }}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deal summary */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2.5">
              {[
                ["المشروع", confirmListing.project_name],
                ["البائع", confirmListing.user_name + " (" + confirmListing.success_rate + "%)"],
                ["الكمية", confirmListing.shares + " حصة"],
                ["سعر الحصة", confirmListing.price.toLocaleString("en-US") + " د.ع"],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white">{v}</span>
                </div>
              ))}
              <div className="h-px bg-white/[0.05]" />
              <div className="flex justify-between gap-2">
                <span className="text-xs font-bold text-yellow-400">الإجمالي</span>
                <span className="text-base font-bold text-yellow-400 font-mono">
                  {fmtIQD(confirmListing.price * confirmListing.shares)} د.ع
                </span>
              </div>
            </div>

            {/* Laws box */}
            <div className="bg-blue-400/[0.04] border border-blue-400/15 rounded-xl p-3.5 mb-4">
              <div className="text-[11px] font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                قانون الصفقات
              </div>
              <ul className="space-y-1.5">
                {[
                  "مدة الصفقة 15 دقيقة بعد فتح الدردشة",
                  "البائع يلتزم بإتمام البيع فور موافقة المشتري",
                  "الإلغاء يؤثر على تقييمك",
                  "المشتري يرفع إثبات الدفع قبل إطلاق الحصص",
                ].map((rule, i) => (
                  <li key={i} className="text-[11px] text-neutral-300 flex gap-1.5 leading-relaxed">
                    <span className="text-blue-400 flex-shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Agreement */}
            <button
              onClick={() => setAgreed(!agreed)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-xl border mb-4 transition-all text-right",
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
                {agreed && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <span className={cn("text-[11px] leading-relaxed", agreed ? "text-green-400" : "text-neutral-400")}>
                أوافق على قوانين الصفقة وشروط الاستخدام
              </span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmListing(null)
                  setAgreed(false)
                }}
                disabled={opening}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleOpenDeal}
                disabled={!agreed || opening}
                className={cn(
                  "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  agreed && !opening
                    ? "bg-neutral-100 text-black hover:bg-neutral-200"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                {opening ? "جاري الفتح..." : "فتح الدردشة 💬"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
