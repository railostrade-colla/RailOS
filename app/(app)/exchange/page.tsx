"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Search, Plus, X, AlertTriangle, ShoppingCart, Clock, Wallet, ChevronLeft, Lock } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { QuantityModal, type QuantityModalListing } from "@/components/exchange/QuantityModal"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  MOCK_PROJECTS,
  MOCK_LISTINGS,
  PAYMENT_METHODS_PUBLIC as PAYMENT_METHODS,
} from "@/lib/mock-data"
import type { Listing } from "@/lib/mock-data/types"
import { canCreateDeal, createDeal } from "@/lib/escrow"
import { CURRENT_FEE_BALANCE } from "@/lib/mock-data"
import { HOLDINGS } from "@/lib/mock-data/holdings"
import {
  getExchangeListings,
  placeDealFromListing,
  type ExchangeListingRow,
} from "@/lib/data/listings"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

/**
 * Phase 10 — real listings flow
 *
 * Strategy: hybrid. We fetch active sell-listings from DB and merge
 * them with mock buy-listings (the DB schema doesn't have a separate
 * "buy" listings concept yet — that's a future migration). DB rows
 * carry UUID ids; mock rows carry "l1"/"l2" string ids — handleConfirmDeal
 * uses that distinction to route to the real RPC vs the legacy escrow
 * lib. When DB has zero rows we fall through to MOCK_LISTINGS so the
 * page never blanks during demo / staging.
 */
function dbToMockListing(row: ExchangeListingRow): Listing {
  return {
    id: row.id,
    type: "sell",
    project_id: row.project_id,
    project_name: row.project_name,
    user_id: row.seller_id,
    user_name: row.seller_name,
    // Reputation/stats are not exposed by the listings RPC yet — sensible
    // defaults that don't lie about high trust.
    reputation_score: 75,
    total_trades: 0,
    success_rate: 90,
    price: row.price_per_share,
    shares: row.shares_remaining,
    min_amount: 0,
    payment_methods: PAYMENT_METHODS.slice(0, 3) as unknown as string[],
    created_at: row.created_at,
  }
}

/** Heuristic — DB rows are UUIDs (36 chars with dashes). */
function isDbListingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

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

  // QuantityModal state (نافذة تحديد الكمية الموحَّدة)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [conflictDeal, setConflictDeal] = useState<{ id: string; expires_at: string } | null>(null)

  // ─── Phase 10: real DB listings + current user ─────────────
  const [dbSellListings, setDbSellListings] = useState<Listing[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>(CURRENT_USER_ID)
  const [loadingListings, setLoadingListings] = useState(true)

  // Apply project filter from URL
  useEffect(() => {
    if (projectFilter) {
      const p = MOCK_PROJECTS.find((proj) => proj.id === projectFilter)
      if (p) setSelectedProject(p)
    }
  }, [projectFilter])

  // Load real listings + current user on mount
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // current user (best-effort)
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data?.user?.id) setCurrentUserId(data.user.id)
    })

    // active sell-listings from DB
    getExchangeListings()
      .then((rows) => {
        if (cancelled) return
        setDbSellListings(rows.map(dbToMockListing))
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Filter + Sort — hybrid pool:
  //   - "buy" mode (مشترٍ يبحث عن إعلانات بيع): real DB rows first;
  //     fall back to mock sell-listings only if DB is empty (so the
  //     page never blanks during demo / staging).
  //   - "sell" mode (بائع يبحث عن طلبات شراء): pure mock until we
  //     migrate buy-listings to DB.
  const filtered = useMemo(() => {
    const wantType: "sell" | "buy" = mode === "buy" ? "sell" : "buy"
    const mockPool = MOCK_LISTINGS.filter((l) => l.type === wantType)
    const pool: Listing[] =
      wantType === "sell"
        ? dbSellListings.length > 0
          ? dbSellListings
          : mockPool
        : mockPool

    return pool
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
  }, [mode, sort, selectedProject, paymentFilter, dbSellListings])

  /** Triggered when user clicks "شراء/بيع" on a listing card. */
  const onClickListing = (listing: Listing) => {
    // 0. منع المستخدم من فتح صفقة على إعلانه
    if (listing.user_id === currentUserId || listing.user_id === CURRENT_USER_ID) {
      return showError("لا يمكنك فتح صفقة على إعلانك")
    }
    // 1. Check for active deal على هذا الإعلان (mock-only — DB-side
    //    enforcement happens inside place_deal_from_listing RPC)
    if (!isDbListingId(listing.id)) {
      const can = canCreateDeal(CURRENT_USER_ID, listing.id)
      if (!can.allowed && can.activeDeal) {
        setConflictDeal({ id: can.activeDeal.id, expires_at: can.activeDeal.expires_at })
        return
      }
    }
    // 2. Open QuantityModal
    setSelectedListing(listing)
  }

  /** Convert MOCK_LISTINGS shape → QuantityModal shape. */
  const modalListing: QuantityModalListing | null = useMemo(() => {
    if (!selectedListing) return null
    return {
      id: selectedListing.id,
      type: selectedListing.type,
      user_id: selectedListing.user_id,
      user_name: selectedListing.user_name,
      project_id: selectedListing.project_id,
      project_name: selectedListing.project_name,
      price_per_share: selectedListing.price,
      available_shares: selectedListing.shares,
      min_shares: selectedListing.min_amount > 0 ? Math.ceil(selectedListing.min_amount / selectedListing.price) : 1,
    }
  }, [selectedListing])

  /** حصص المستخدم في المشروع المحدّد (للبيع). */
  const userSharesInProject = useMemo(() => {
    if (!selectedListing) return 0
    return HOLDINGS
      .filter((h) => (h.user_id ?? "me") === CURRENT_USER_ID && h.project_id === selectedListing.project_id)
      .reduce((s, h) => s + h.shares_owned, 0)
  }, [selectedListing])

  /** يُنفَّذ من QuantityModal بعد التأكيد. */
  const handleConfirmDeal = async (quantity: number, durationHours: 24 | 48 | 72) => {
    if (!selectedListing) return

    // ─── Phase 10: real DB path ─────────────────────────────
    // DB rows have UUID ids; route them through the atomic
    // place_deal_from_listing RPC which: locks the listing, verifies
    // capacity, freezes seller's shares, and creates the deal row.
    if (isDbListingId(selectedListing.id)) {
      const res = await placeDealFromListing(
        selectedListing.id,
        quantity,
        durationHours,
      )
      if (!res.success) {
        const reasonMap: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول أولاً",
          invalid_quantity: "الكمية غير صحيحة",
          listing_not_found: "الإعلان غير موجود",
          listing_inactive: "الإعلان لم يعد نشطاً",
          cannot_buy_own_listing: "لا يمكنك شراء إعلانك",
          insufficient_listing_capacity: `الكمية المتاحة: ${res.available ?? "؟"}`,
          seller_holdings_missing: "البائع لا يملك حصصاً في هذا المشروع",
          seller_insufficient_unfrozen: `البائع يملك ${res.unfrozen ?? "؟"} حصة فقط غير مجمدة`,
          missing_table: "الميزة غير مفعّلة بعد على الخادم",
          rls: "ليس لديك صلاحية لإجراء هذه الصفقة",
        }
        const msg = reasonMap[res.reason ?? ""] ?? "تعذّر فتح الصفقة"
        throw new Error(msg)
      }
      showSuccess(`🔒 تم تعليق ${quantity} حصة وفتح الصفقة`)
      setSelectedListing(null)
      // Refresh DB listings so capacity reflects immediately
      getExchangeListings().then((rows) => setDbSellListings(rows.map(dbToMockListing)))
      if (res.deal_id) router.push("/deals/" + res.deal_id)
      else router.push("/deals")
      return
    }

    // ─── Legacy mock path (until buy-listings migrate) ──────
    const isBuyingFromSellListing = selectedListing.type === "sell"
    const buyerId = isBuyingFromSellListing ? CURRENT_USER_ID : selectedListing.user_id
    const buyerName = isBuyingFromSellListing ? CURRENT_USER_NAME : selectedListing.user_name
    const sellerId = isBuyingFromSellListing ? selectedListing.user_id : CURRENT_USER_ID
    const sellerName = isBuyingFromSellListing ? selectedListing.user_name : CURRENT_USER_NAME

    const result = createDeal({
      buyerId,
      buyerName,
      sellerId,
      sellerName,
      listingId: selectedListing.id,
      projectId: selectedListing.project_id,
      projectName: selectedListing.project_name,
      amount: quantity,
      pricePerShare: selectedListing.price,
      durationHours,
    })

    if (!result.success || !result.data) {
      throw new Error(result.reason ?? "تعذّر فتح الصفقة")
    }
    showSuccess(`🔒 تم تعليق ${quantity} حصة وفتح الصفقة`)
    setSelectedListing(null)
    router.push("/deals/" + result.data.id)
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

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
          {loadingListings && filtered.length === 0 ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 animate-pulse"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-full bg-white/[0.06]" />
                    <div className="flex-1">
                      <div className="h-3 w-24 bg-white/[0.06] rounded mb-1.5" />
                      <div className="h-2 w-16 bg-white/[0.04] rounded" />
                    </div>
                  </div>
                  <div className="h-9 w-full bg-white/[0.04] rounded mb-3" />
                  <div className="h-8 w-full bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
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

                    {/* Action button — يفتح QuantityModal لتحديد الكمية */}
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
                      {mode === "buy" ? "شراء — تحديد الكمية" : "بيع — تحديد الكمية"}
                      <ChevronLeft className="w-3.5 h-3.5 opacity-70" strokeWidth={2.5} />
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

          {/* Quantity Modal -- تحديد الكمية + Escrow */}
      <QuantityModal
        listing={modalListing}
        userBalance={CURRENT_FEE_BALANCE}
        userShares={userSharesInProject}
        onClose={() => setSelectedListing(null)}
        onConfirm={handleConfirmDeal}
      />
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
