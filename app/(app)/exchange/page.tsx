"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, Search, Plus, X, AlertTriangle, ShoppingCart, Clock, Wallet, ChevronLeft, Lock, History, Trash2, Loader2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { QuantityModal, type QuantityModalListing } from "@/components/exchange/QuantityModal"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  MOCK_LISTINGS,
  PAYMENT_METHODS_PUBLIC as PAYMENT_METHODS,
} from "@/lib/mock-data"
import type { Listing, Project } from "@/lib/mock-data/types"
import { canCreateDeal, createDeal } from "@/lib/escrow"
import { HOLDINGS } from "@/lib/mock-data/holdings"
import {
  getExchangeListings,
  getMyExchangeListings,
  cancelMyListing,
  placeDealFromListing,
  acceptBuyListing,
  type ExchangeListingRow,
} from "@/lib/data/listings"
// Phase 11.23 — real projects feed for the filter dropdown.
import { getAllProjects } from "@/lib/data/projects"
// Phase 11.24 — real fee-units balance for the QuantityModal cap.
import { getCurrentFeeBalanceSimple } from "@/lib/data/wallet"
// Phase 12.12 — monthly investment limit enforcement.
import { getMyMonthlySpent } from "@/lib/data/monthly-limit"
import { getCurrentUserProfile } from "@/lib/data/profile"
import { LEVEL_LIMITS, type InvestorLevel } from "@/lib/utils/contractLimits"
import { dedupCache, readPersistedSync, invalidateCache } from "@/lib/data/cache"
import { useRealtimeListings } from "@/lib/realtime/useRealtimeListings"
import { createClient } from "@/lib/supabase/client"
// Phase 12.8 — show online/last-seen badge next to each listing's owner.
import {
  UserPresenceDot,
  UserPresenceText,
} from "@/components/presence/UserPresence"
// Phase 12.8 — synthetic sound effects on key transitions.
import { playRequestSent } from "@/lib/sounds"
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
    type: row.type,
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
  projects: Project[]
  selectedProject: Project | null
  onSelect: (p: Project | null) => void
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
        <div className="flex items-center gap-3 min-w-0">
          {selectedProject?.logo_url ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.04] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedProject.logo_url} alt={selectedProject.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="text-2xl flex-shrink-0">
              {selectedProject ? sectorIcon(selectedProject.sector) : "🏢"}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {selectedProject ? selectedProject.name : "كل المشاريع"}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {selectedProject
                ? (selectedProject.share_price ?? 0).toLocaleString("en-US") + " د.ع/حصة"
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
                {p.logo_url ? (
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-xl">{sectorIcon(p.sector)}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {p.sector} • {(p.share_price ?? 0).toLocaleString("en-US")} د.ع
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

// ─── My Listings panel (Phase 11.30 — السجل tab) ───
function MyListingsPanel({
  loading,
  listings,
  cancellingId,
  onCancel,
  onCreate,
  onBackToMarket,
}: {
  loading: boolean
  listings: ExchangeListingRow[]
  cancellingId: string | null
  onCancel: (id: string) => void
  onCreate: () => void
  onBackToMarket: () => void
}) {
  // Status → Arabic label + color class.
  const statusMeta = (status: string): { label: string; cls: string } => {
    switch (status) {
      case "active":
        return { label: "نشط", cls: "bg-green-400/[0.12] border-green-400/25 text-green-400" }
      case "paused":
        return { label: "مُعلَّق", cls: "bg-yellow-400/[0.12] border-yellow-400/25 text-yellow-400" }
      case "cancelled":
        return { label: "مُلغى", cls: "bg-red-400/[0.10] border-red-400/25 text-red-400" }
      case "sold":
        return { label: "مكتمل (بيع)", cls: "bg-blue-400/[0.12] border-blue-400/25 text-blue-300" }
      case "completed":
        return { label: "مكتمل", cls: "bg-blue-400/[0.12] border-blue-400/25 text-blue-300" }
      case "expired":
        return { label: "منتهٍ", cls: "bg-neutral-500/[0.12] border-neutral-500/25 text-neutral-400" }
      default:
        return { label: status, cls: "bg-white/[0.06] border-white/[0.1] text-neutral-300" }
    }
  }

  // Group counts so the user sees the breakdown at a glance.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: listings.length }
    for (const l of listings) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [listings])

  if (loading && listings.length === 0) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
        <div className="text-5xl mb-3 opacity-50">📋</div>
        <div className="text-sm text-neutral-400 mb-1">لم تنشر إعلاناً بعد</div>
        <div className="text-[11px] text-neutral-600 mb-5">انشر أول إعلان لك في السوق</div>
        <button
          onClick={onCreate}
          className="bg-neutral-100 text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
        >
          إنشاء إعلان
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Phase 11.32 — back-to-market link so the user can return to
          the feed without hunting for the toggle button up top. */}
      <button
        onClick={onBackToMarket}
        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-1"
      >
        <ChevronLeft className="w-3 h-3 rotate-180" />
        ← العودة إلى السوق
      </button>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="bg-white/[0.06] border border-white/[0.1] text-neutral-300 text-[10px] px-2 py-1 rounded-full">
          الإجمالي: <span className="font-mono font-bold text-white">{counts.all}</span>
        </span>
        {counts.active > 0 && (
          <span className="bg-green-400/[0.08] border border-green-400/20 text-green-400 text-[10px] px-2 py-1 rounded-full">
            نشط: <span className="font-mono font-bold">{counts.active}</span>
          </span>
        )}
        {counts.sold > 0 && (
          <span className="bg-blue-400/[0.08] border border-blue-400/20 text-blue-300 text-[10px] px-2 py-1 rounded-full">
            مكتمل: <span className="font-mono font-bold">{counts.sold}</span>
          </span>
        )}
        {counts.cancelled > 0 && (
          <span className="bg-red-400/[0.06] border border-red-400/20 text-red-400 text-[10px] px-2 py-1 rounded-full">
            مُلغى: <span className="font-mono font-bold">{counts.cancelled}</span>
          </span>
        )}
        {counts.expired > 0 && (
          <span className="bg-neutral-500/[0.06] border border-neutral-500/20 text-neutral-400 text-[10px] px-2 py-1 rounded-full">
            منتهٍ: <span className="font-mono font-bold">{counts.expired}</span>
          </span>
        )}
      </div>

      {listings.map((l) => {
        const meta = statusMeta(l.status)
        const remaining = Math.max(0, Number(l.shares_offered) - Number(l.shares_sold ?? 0))
        const total = Number(l.price_per_share) * Number(l.shares_offered)
        const isActive = l.status === "active" || l.status === "paused"
        const isCancelling = cancellingId === l.id
        return (
          <div
            key={l.id}
            className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4"
          >
            {/* Header — type + status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded border",
                    l.type === "sell"
                      ? "bg-red-500/[0.12] border-red-500/25 text-red-400"
                      : "bg-green-500/[0.12] border-green-500/25 text-green-400"
                  )}
                >
                  {l.type === "sell" ? "🔴 بيع" : "🟢 شراء"}
                </span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", meta.cls)}>
                  {meta.label}
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {timeSince(l.created_at)}
              </span>
            </div>

            {/* Project + price */}
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 mb-3">
              <div className="text-xs font-bold text-white truncate mb-1">{l.project_name}</div>
              <div className="text-[10px] text-neutral-500">
                <span className="font-mono">{Number(l.price_per_share).toLocaleString("en-US")}</span> د.ع/حصة
              </div>
            </div>

            {/* Shares progress */}
            <div className="flex items-center justify-between text-[11px] mb-2">
              <span className="text-neutral-400">
                مُباع: <span className="text-white font-mono font-bold">{Number(l.shares_sold ?? 0)}</span>
                {" / "}
                <span className="text-white font-mono">{Number(l.shares_offered)}</span>
              </span>
              <span className="text-neutral-400">
                المتبقي: <span className="text-yellow-400 font-mono font-bold">{remaining}</span>
              </span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-green-400 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (Number(l.shares_sold ?? 0) / Math.max(1, Number(l.shares_offered))) * 100)}%`,
                }}
              />
            </div>

            {/* Total + cancel */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">
                الإجمالي: <span className="text-yellow-400 font-bold font-mono">{total.toLocaleString("en-US")}</span> د.ع
              </span>
              {isActive && (
                <button
                  onClick={() => onCancel(l.id)}
                  disabled={isCancelling}
                  className="bg-red-500/[0.10] border border-red-500/25 hover:bg-red-500/[0.18] text-red-400 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      جاري الإلغاء...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" strokeWidth={2} />
                      إلغاء الإعلان
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )
      })}
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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<string[]>([])
  // Phase 11.23 — real projects from DB (replaces MOCK_PROJECTS).
  const [dbProjects, setDbProjects] = useState<Project[]>([])
  // Phase 11.24 — real fee-units balance (replaces mock CURRENT_FEE_BALANCE).
  // Hydrate synchronously from the SWR cache to avoid a 0-flash on first paint.
  const [feeBalance, setFeeBalance] = useState<number>(
    () => readPersistedSync<number>("wallet:feeBalance") ?? 0,
  )
  // Phase 12.12 — monthly limit (level-based) + already-spent this month.
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0)
  const [monthlySpent, setMonthlySpent] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAllProjects(),
      dedupCache("wallet:feeBalance", getCurrentFeeBalanceSimple, 30_000),
      getCurrentUserProfile(),
      getMyMonthlySpent(),
    ]).then(([rows, fb, prof, spent]) => {
      if (cancelled) return
      setDbProjects(rows)
      setFeeBalance(fb)
      setMonthlySpent(spent)
      const lvlRaw = prof?.level
      const lvl: InvestorLevel =
        lvlRaw === "advanced" || lvlRaw === "pro" ? lvlRaw : "basic"
      setMonthlyLimit(LEVEL_LIMITS[lvl] ?? 0)
    })
    return () => { cancelled = true }
  }, [])

  // QuantityModal state (نافذة تحديد الكمية الموحَّدة)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [conflictDeal, setConflictDeal] = useState<{ id: string; expires_at: string } | null>(null)

  // ─── Phase 10: real DB listings + current user ─────────────
  const [dbSellListings, setDbSellListings] = useState<Listing[]>([])
  const [dbBuyListings, setDbBuyListings] = useState<Listing[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>(CURRENT_USER_ID)
  const [loadingListings, setLoadingListings] = useState(true)

  // Phase 11.30 — "السجل" tab state. Shows the user's own listings
  // across all statuses (active / cancelled / completed / paused) so
  // they can audit what they've posted and what got fulfilled.
  const [view, setView] = useState<"market" | "my_listings">("market")
  const [myListings, setMyListings] = useState<ExchangeListingRow[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Apply project filter from URL — uses real projects.
  useEffect(() => {
    if (projectFilter && dbProjects.length > 0) {
      const p = dbProjects.find((proj) => proj.id === projectFilter)
      if (p) setSelectedProject(p)
    }
  }, [projectFilter, dbProjects])

  // Realtime tick — increments whenever any listing row changes
  const { tick: listingsTick } = useRealtimeListings()

  // Phase 11.30 — fetch the user's own listings on initial mount
  // (so the badge count shows immediately) AND on every realtime tick.
  // Phase 11.32 — always invalidate before refetching so a freshly
  // posted/cancelled listing appears without waiting for the TTL.
  useEffect(() => {
    let cancelled = false
    if (view === "my_listings") setLoadingMine(true)
    invalidateCache("listings:mine:all")
    getMyExchangeListings()
      .then((rows) => { if (!cancelled) setMyListings(rows) })
      .finally(() => { if (!cancelled) setLoadingMine(false) })
    return () => { cancelled = true }
  }, [view, listingsTick])

  // Phase 11.30 — cancel a still-active listing the user posted.
  const handleCancelMyListing = async (listingId: string) => {
    if (cancellingId) return
    setCancellingId(listingId)
    try {
      const ok = await cancelMyListing(listingId)
      if (ok) {
        showSuccess("تم إلغاء الإعلان")
        // Optimistic local update so the badge flips immediately even
        // before realtime fires.
        setMyListings((cur) =>
          cur.map((l) => (l.id === listingId ? { ...l, status: "cancelled" } : l)),
        )
      } else {
        showError("تعذّر إلغاء الإعلان")
      }
    } finally {
      setCancellingId(null)
    }
  }

  // Load real listings + current user on mount, and re-fetch listings
  // whenever realtime fires.
  // Phase 11.32 — always invalidate the listings cache before fetching
  // so a listing the user just posted (or cancelled) on a different
  // page shows up the moment they land on /exchange. The cost is one
  // DB roundtrip per page visit; the benefit is a freshness guarantee
  // that overrides the 10s TTL of the SWR cache.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // current user (only on first run)
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data?.user?.id) setCurrentUserId(data.user.id)
    })

    invalidateCache("listings:exchange:active")

    // active listings from DB (both sell and buy in one round-trip)
    getExchangeListings()
      .then((rows) => {
        if (cancelled) return
        const sells: Listing[] = []
        const buys: Listing[] = []
        rows.forEach((r) => {
          const l = dbToMockListing(r)
          if (l.type === "sell") sells.push(l)
          else buys.push(l)
        })
        setDbSellListings(sells)
        setDbBuyListings(buys)
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false)
      })

    return () => {
      cancelled = true
    }
  }, [listingsTick])

  // Filter + Sort — DB-only pool (production mode).
  //   - "buy" mode  → DB sell-listings
  //   - "sell" mode → DB buy-listings
  // Empty states are shown when DB returns []. No mock fallback.
  const filtered = useMemo(() => {
    const wantType: "sell" | "buy" = mode === "buy" ? "sell" : "buy"
    const pool: Listing[] = wantType === "sell" ? dbSellListings : dbBuyListings

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
  }, [mode, sort, selectedProject, paymentFilter, dbSellListings, dbBuyListings])

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
    // DB rows have UUID ids. Route based on listing type:
    //   - sell listing → place_deal_from_listing (caller is buyer)
    //   - buy listing  → accept_buy_listing      (caller is seller)
    if (isDbListingId(selectedListing.id)) {
      const isBuyListing = selectedListing.type === "buy"
      const res = isBuyListing
        ? await acceptBuyListing(selectedListing.id, quantity, durationHours)
        : await placeDealFromListing(selectedListing.id, quantity, durationHours)

      if (!res.success) {
        const reasonMap: Record<string, string> = {
          unauthenticated: "يجب تسجيل الدخول أولاً",
          invalid_quantity: "الكمية غير صحيحة",
          listing_not_found: "الإعلان غير موجود",
          listing_inactive: "الإعلان لم يعد نشطاً",
          cannot_buy_own_listing: "لا يمكنك شراء إعلانك",
          cannot_accept_own_listing: "لا يمكنك قبول طلبك الخاص",
          not_a_buy_listing: "هذا الإعلان ليس طلب شراء",
          insufficient_listing_capacity: `الكمية المتاحة: ${res.available ?? "؟"}`,
          seller_holdings_missing: "البائع لا يملك حصصاً في هذا المشروع",
          seller_insufficient_unfrozen: `البائع يملك ${res.unfrozen ?? "؟"} حصة فقط غير مجمدة`,
          no_holdings: "لا تملك حصصاً في هذا المشروع",
          insufficient_unfrozen: `لديك ${res.unfrozen ?? "؟"} حصة فقط غير مجمدة`,
          missing_table: "الميزة غير مفعّلة بعد على الخادم",
          rls: "ليس لديك صلاحية لإجراء هذه الصفقة",
        }
        // Log the full payload so we can diagnose unmapped reasons.
        // eslint-disable-next-line no-console
        console.error("[exchange] place/accept failed:", res)
        const reasonKey = res.reason ?? ""
        let msg = reasonMap[reasonKey]
        if (!msg) {
          // Surface the real DB error / reason instead of a generic
          // "تعذّر فتح الصفقة". This is what unblocks debugging when
          // the RPC raises an unexpected SQLSTATE.
          const detail = res.error || reasonKey || "خطأ غير معروف"
          msg = `تعذّر فتح الصفقة: ${detail}`
        }
        throw new Error(msg)
      }
      // Phase 12.8: deals open in pending_seller_approval. The seller
      // sees a global popup (DealRequestNotifier) anywhere in the app
      // and decides accept/reject. We tell the buyer to wait.
      playRequestSent()
      showSuccess(
        isBuyListing
          ? `📤 تم إرسال طلب الشراء — بانتظار موافقة البائع`
          : `📤 تم إرسال طلب البيع — بانتظار موافقة المشتري`,
      )
      setSelectedListing(null)
      // Refresh DB listings so capacity reflects immediately. Wrap in
      // catch so a transient network blip doesn't bubble up to the
      // global error boundary right after a successful deal.
      invalidateCache("listings:exchange:active")
      getExchangeListings()
        .then((rows) => {
          const sells: Listing[] = []
          const buys: Listing[] = []
          rows.forEach((r) => {
            const l = dbToMockListing(r)
            if (l.type === "sell") sells.push(l)
            else buys.push(l)
          })
          setDbSellListings(sells)
          setDbBuyListings(buys)
        })
        .catch(() => { /* swallow — capacity will refresh on next mount */ })
      // Phase 12 — defensive redirect: if anything throws (rare), fall
      // back to the deals list so the user lands somewhere sensible.
      try {
        if (res.deal_id) router.push("/deals/" + res.deal_id)
        else router.push("/deals")
      } catch {
        router.push("/deals")
      }
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
              <div className="flex items-center gap-2">
                {/* Phase 11.32 — log button mirrors the create button's
                    visual weight, sits next to it in the header. The
                    market view is now the default with no extra tab bar. */}
                <button
                  onClick={() => setView(view === "my_listings" ? "market" : "my_listings")}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border",
                    view === "my_listings"
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                      : "bg-white/[0.05] border-white/[0.1] text-neutral-200 hover:bg-white/[0.08]"
                  )}
                >
                  <History className="w-3.5 h-3.5" />
                  سجلي
                  {myListings.length > 0 && (
                    <span className={cn(
                      "text-[10px] font-mono px-1.5 py-px rounded-full",
                      view === "my_listings"
                        ? "bg-blue-300/20 text-blue-200"
                        : "bg-white/[0.12] text-white"
                    )}>
                      {myListings.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => router.push("/exchange/create")}
                  className="bg-neutral-100 text-black px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إنشاء إعلان
                </button>
              </div>
            }
          />

          {view === "my_listings" ? (
            <MyListingsPanel
              loading={loadingMine}
              listings={myListings}
              cancellingId={cancellingId}
              onCancel={handleCancelMyListing}
              onCreate={() => router.push("/exchange/create")}
              onBackToMarket={() => setView("market")}
            />
          ) : (
          <>

          {/* Project Selector */}
          <ProjectSelector
            projects={dbProjects}
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
                // Phase 11.30 — flag the user's own listings so they
                // get a recognizable badge + a "view in log" CTA
                // instead of the buy/sell button.
                const isOwn = l.user_id === currentUserId

                return (
                  <div
                    key={l.id}
                    className={cn(
                      "bg-white/[0.05] border rounded-2xl p-4 transition-colors hover:bg-white/[0.06]",
                      isOwn
                        ? "border-blue-400/25"
                        : isBest
                          ? "border-yellow-400/25"
                          : "border-white/[0.08]"
                    )}
                  >
                    {/* Header: User info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white">
                            {l.user_name.charAt(0)}
                          </div>
                          {/* Phase 12.8 — online dot anchored to the avatar
                              (classic chat-app pattern). Skip on own listings. */}
                          {!isOwn && l.user_id && (
                            <UserPresenceDot
                              userId={l.user_id}
                              size="md"
                              className="absolute -bottom-0.5 -left-0.5"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">
                              {isOwn ? "أنا" : l.user_name}
                            </span>
                            {isOwn && (
                              <span className="bg-blue-400/[0.12] border border-blue-400/30 text-blue-300 px-1.5 py-px rounded text-[9px] font-bold">
                                إعلانك
                              </span>
                            )}
                            {!isOwn && verified && (
                              <span className="bg-green-400/[0.12] border border-green-400/25 text-green-400 px-1.5 py-px rounded text-[9px] font-bold flex items-center gap-0.5">
                                ✓ موثق
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{l.total_trades} صفقة</span>
                            <span className="text-neutral-700">•</span>
                            <span>{l.success_rate}% نجاح</span>
                            {!isOwn && l.user_id && (
                              <>
                                <span className="text-neutral-700">•</span>
                                <UserPresenceText userId={l.user_id} />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isBest && !isOwn && (
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

                    {/* Action button — own listing routes to log; others open QuantityModal. */}
                    {isOwn ? (
                      <button
                        onClick={() => setView("my_listings")}
                        className="w-full py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                      >
                        <History className="w-4 h-4" strokeWidth={2} />
                        إدارة الإعلان في السجل
                        <ChevronLeft className="w-3.5 h-3.5 opacity-70" strokeWidth={2.5} />
                      </button>
                    ) : (
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
                    )}
                  </div>
                )
              })}
            </div>
          )}

          </>
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
        userBalance={feeBalance}
        userShares={userSharesInProject}
        monthlyLimit={monthlyLimit}
        monthlySpent={monthlySpent}
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
