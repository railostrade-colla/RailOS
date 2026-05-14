"use client"

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter, useParams } from "next/navigation"
import { ShoppingCart, Heart, X, Image as ImageIcon, Clock, TrendingUp, TrendingDown, AlertCircle, Building2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { CreateDealModal } from "@/components/deals/CreateDealModal"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")
const sectorIcon = (s: string) => s?.includes("طب") ? "🏥" : s?.includes("تقن") ? "💻" : s?.includes("زراع") ? "🌾" : s?.includes("تجار") ? "🏪" : "🏢"
const riskLabel = (r: string) => r === "low" ? "منخفض" : r === "medium" ? "متوسط" : "مرتفع"
const riskColor = (r: string) => r === "low" ? "text-green-400" : r === "medium" ? "text-yellow-400" : "text-red-400"

// Mock projects — fallback ONLY (Phase 14.07.1: chart + history now real).
import {
  projectsById as mockProjects,
  type Project as MockProject,
} from "@/lib/mock-data"
import { getProjectById } from "@/lib/data"
import { getProjectUpdates, type ProjectUpdate } from "@/lib/data/projects"
// Phase 12.11 — live wallet stats so حصص متاحة + نسبة التمويل +
// المبلغ الممول + المتبقي للتمويل all reflect REAL sold count.
import {
  getProjectWalletStats,
  type ProjectWalletStats,
} from "@/lib/data/project-wallet-stats"
// Phase 14.07.1 — real price-history timeline (creation anchor + completed
// deals + admin price changes + "now" snapshot). Replaces the legacy
// genChart() sine wave that misled investors with synthetic data.
import {
  getProjectPriceTimeline,
  type PriceHistoryPoint,
} from "@/lib/data/price-history"
// Phase 14.07.1 — real follow/unfollow against `follows` table.
// Replaces the local-only useState toggle that lied to the user
// (showed "متابَع" but never persisted).
import {
  isFollowing as isFollowingDB,
  followTarget,
  unfollowTarget,
} from "@/lib/data/follows"
import { SkeletonCard } from "@/components/ui"
// Phase 14.10 C — recharts is ~65 KB. Code-split it via next/dynamic
// so the bundle is only fetched when /project/[id] is rendered, not
// shipped with every other user-side page. ssr:false because the
// chart depends on window measurements (ResponsiveContainer).
const ProjectPriceChart = dynamic(
  () =>
    import("@/components/project/ProjectPriceChart").then(
      (m) => m.ProjectPriceChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 flex items-center justify-center text-[11px] text-neutral-500">
        جاري تحميل الرسم البيانيّ...
      </div>
    ),
  },
)
import { createClient } from "@/lib/supabase/client"

const galleryEmojis = ["🏗️", "🏛️", "📊", "🌾"]

/**
 * Phase 14.07.1 — recent completed deals for the History tab.
 * Shape mirrors what we render: who/when/how-many/at-what-price.
 */
interface RecentDealRow {
  id: string
  shares: number
  price_per_share: number
  total_amount: number
  completed_at: string | null
  buyer_name: string | null
  seller_name: string | null
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [project, setProject] = useState<MockProject | null>(mockProjects[id] || null)
  const [loading, setLoading] = useState(true)

  // Phase 14.07.1 — real price timeline (replaces the legacy genChart()
  // sine wave) and real recent deals (replaces mockTrades). Loaded once
  // per project id; the chart re-filters in-memory when the user picks
  // a different period (1D/7D/30D/كل) so we don't hit the DB on each tab.
  const [priceTimeline, setPriceTimeline] = useState<PriceHistoryPoint[]>([])
  const [priceTimelineLoading, setPriceTimelineLoading] = useState(true)
  const [recentDeals, setRecentDeals] = useState<RecentDealRow[]>([])
  const [recentDealsLoading, setRecentDealsLoading] = useState(true)
  // Phase 10.80 (Task 20) — investor count + my shares now from real
  // DB instead of the hardcoded `247` and `0` placeholders.
  const [investors, setInvestors] = useState(0)
  const [myShares, setMyShares] = useState(0)
  // Phase 12.11 — live wallet stats. Falls back to 0s when migration
  // not applied; the page then degrades to legacy `project.available_shares`.
  const [walletStats, setWalletStats] = useState<ProjectWalletStats | null>(null)

  // Phase 13.11 — direct-buy suspension state for this project.
  // Read straight off `projects` columns (Phase 10.93 schema). When
  // true, the "طلب شراء مباشر" button on the buy-options modal is
  // disabled with an inline "غير متوفر حالياً" message.
  const [offeringSuspended, setOfferingSuspended] = useState(false)
  const [offeringSuspensionReason, setOfferingSuspensionReason] = useState<string | null>(null)

  // Real DB-backed project updates (Phase O). Fetched in parallel with
  // the project itself so the "تحديثات" tab is ready when the user
  // clicks it. Empty array ⇒ section renders an empty-state.
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])

  // Try DB first; fall back to mock projectsById on miss/error
  useEffect(() => {
    let cancelled = false
    Promise.all([getProjectById(id), getProjectUpdates(id, 20)])
      .then(([p, ups]) => {
        if (cancelled) return
        if (p) setProject(p)
        else if (!project) setProject(mockProjects[id] || mockProjects["1"])
        setUpdates(ups)
        setLoading(false)
        // Phase 12.11 — fire wallet stats query in parallel with the
        // project load. Falls back to ZERO_STATS if the DB doesn't
        // yet have a wallet row, in which case the legacy display
        // path kicks in (project.available_shares).
        if (p) {
          const sp = p.share_price || 0
          getProjectWalletStats(id, sp).then((stats) => {
            if (!cancelled) setWalletStats(stats)
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        if (!project) setProject(mockProjects[id] || mockProjects["1"])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  // Phase 14.10 C — investor count + my shares + suspension flags all
  // run in parallel now. Before this, they were three sequential
  // awaits inside one async block; with Supabase round-trips of
  // ~80-150ms each, that was a 300-500ms tax on cold load. The new
  // Promise.all approach pays the cost of the slowest of the three
  // instead of the sum.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      // Resolve auth.uid() once up front so the holdings query knows
      // whether to fire. If the user is anonymous, we still want the
      // other two fetches to proceed in parallel.
      const { data: auth } = await sb.auth.getUser()
      if (cancelled) return
      const uid = auth?.user?.id ?? null

      // (1) Distinct investor count — public RPC with a count fallback.
      const investorsPromise = (async () => {
        try {
          const { data: rpcRows, error: rpcErr } = await sb.rpc(
            "get_public_investor_counts",
            { p_project_ids: [id] },
          )
          if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
            const row = rpcRows[0] as { investor_count: number | string }
            return Number(row.investor_count ?? 0)
          }
          const { count } = await sb
            .from("holdings")
            .select("user_id", { count: "exact", head: true })
            .eq("project_id", id)
            .gt("shares", 0)
          return count ?? 0
        } catch {
          return 0
        }
      })()

      // (2) My holding row for this project.
      const mySharesPromise = uid
        ? (async () => {
            try {
              const { data: my } = await sb
                .from("holdings")
                .select("shares")
                .eq("project_id", id)
                .eq("user_id", uid)
                .maybeSingle()
              return Number(
                (my as { shares?: number } | null)?.shares ?? 0,
              )
            } catch {
              return 0
            }
          })()
        : Promise.resolve(0)

      // (3) Direct-buy suspension flags from `projects`.
      const flagsPromise = (async () => {
        try {
          const { data: pflags } = await sb
            .from("projects")
            .select("offering_suspended, offering_suspension_reason")
            .eq("id", id)
            .maybeSingle()
          return pflags as {
            offering_suspended?: boolean
            offering_suspension_reason?: string | null
          } | null
        } catch {
          return null
        }
      })()

      const [investorsCount, myShareCount, flags] = await Promise.all([
        investorsPromise,
        mySharesPromise,
        flagsPromise,
      ])

      if (cancelled) return
      setInvestors(investorsCount)
      setMyShares(myShareCount)
      if (flags) {
        setOfferingSuspended(Boolean(flags.offering_suspended))
        setOfferingSuspensionReason(flags.offering_suspension_reason ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // ─── Phase 14.07.1 — load real price timeline + recent deals ────
  // The timeline drives the "حركة السعر" chart (no more genChart sine
  // wave). The deals list drives the "السجل" tab (no more mockTrades).
  // Both fall back to empty arrays so the UI shows the right empty
  // state when the project has no trading history yet.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setPriceTimelineLoading(true)
    getProjectPriceTimeline(id, 200)
      .then((points) => {
        if (!cancelled) setPriceTimeline(points)
      })
      .finally(() => {
        if (!cancelled) setPriceTimelineLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setRecentDealsLoading(true)
    ;(async () => {
      try {
        const sb = createClient()
        // Pull the last 20 completed deals for this project. We pick up
        // buyer/seller display names from profiles via two separate
        // selects to dodge a Supabase embed that can be NULL under
        // strict RLS (Phase 13.52 lesson learned).
        const { data: rows } = await sb
          .from("deals")
          .select("id, shares, total_amount, completed_at, buyer_id, seller_id")
          .eq("project_id", id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(20)
        if (cancelled || !rows) {
          if (!cancelled) setRecentDeals([])
          return
        }
        const deals = rows as Array<{
          id: string
          shares: number | string
          total_amount: number | string
          completed_at: string | null
          buyer_id: string | null
          seller_id: string | null
        }>
        const userIds = Array.from(
          new Set(deals.flatMap((d) => [d.buyer_id, d.seller_id].filter(Boolean) as string[])),
        )
        let names: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: ppl } = await sb
            .from("profiles_public")
            .select("id, full_name, username")
            .in("id", userIds)
          if (Array.isArray(ppl)) {
            names = Object.fromEntries(
              (ppl as Array<{ id: string; full_name?: string | null; username?: string | null }>).map(
                (p) => [p.id, p.full_name?.trim() || p.username?.trim() || "—"],
              ),
            )
          }
        }
        if (cancelled) return
        setRecentDeals(
          deals.map((d) => {
            const shares = Number(d.shares ?? 0)
            const total = Number(d.total_amount ?? 0)
            return {
              id: d.id,
              shares,
              price_per_share: shares > 0 ? Math.round(total / shares) : 0,
              total_amount: total,
              completed_at: d.completed_at,
              buyer_name: d.buyer_id ? names[d.buyer_id] ?? null : null,
              seller_name: d.seller_id ? names[d.seller_id] ?? null : null,
            }
          }),
        )
      } catch {
        if (!cancelled) setRecentDeals([])
      } finally {
        if (!cancelled) setRecentDealsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  const [period, setPeriod] = useState<"1D" | "7D" | "30D" | "كل">("7D")
  const [tab, setTab] = useState<"info" | "updates" | "gallery" | "history">("info")
  // Phase 14.07.1 — real follow state. `following` reflects the
  // `follows` table; `followBusy` blocks double-taps while the RPC
  // is in flight (and lets the button render a spinner).
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [showBuyOptions, setShowBuyOptions] = useState(false)
  const [showCreateDeal, setShowCreateDeal] = useState(false)

  // ─── Phase 14.07.1 — load real follow state on mount ────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false
    isFollowingDB("project", id).then((v) => {
      if (!cancelled) setFollowing(v)
    })
    return () => { cancelled = true }
  }, [id])

  // Toggle handler with optimistic update + rollback on RPC failure.
  const handleToggleFollow = async () => {
    if (!id || followBusy) return
    const next = !following
    setFollowing(next)            // optimistic
    setFollowBusy(true)
    const result = next
      ? await followTarget("project", id)
      : await unfollowTarget("project", id)
    setFollowBusy(false)
    if (!result.success) {
      // Roll back the optimistic flip.
      setFollowing(!next)
      const code = result.reason ?? ""
      const map: Record<string, string> = {
        unauthenticated: "يجب تسجيل الدخول",
        missing_target: "المشروع غير صالح",
        missing_table:  "ميزة المتابعة غير منشورة بعد",
        already_following: "أنت تتابع المشروع بالفعل",
        not_following: "أنت لا تتابع المشروع",
      }
      showError(map[code] ?? "تعذّر حفظ المتابعة")
      return
    }
    showSuccess(next ? "✅ تمت متابعة المشروع" : "تم إلغاء المتابعة")
  }

  if (loading || !project) {
    return (
      <AppLayout>
        <div className="relative">
          {/* Phase 10.82 — solid black background per founder request
              (was a grid+dots pattern). Keep DOM structure intact. */}
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20 space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </AppLayout>
    )
  }

  // offering_shares = total public-offering bucket (never shrinks with sales)
  // available_shares = unsold offering shares (decreases as shares are bought)
  // sold% = (offering_shares - available_shares) / offering_shares
  //
  // Phase 11.19 — keep the percentage as a float so a small sale
  // (35 of 16,000 ≈ 0.22%) doesn't round to 0% and the green bar
  // doesn't disappear. Bar width is also clamped to ≥2% when there
  // ─── Phase 12.11 — live numbers from project_wallets ─────────────
  // walletStats has the authoritative offering total/available/sold.
  // Fall back to project columns when the wallet row isn't there.
  const offeringTotal =
    walletStats?.offering_total ??
    project.offering_shares ??
    project.available_shares ??
    0
  const soldFromOffering =
    walletStats?.offering_sold ??
    Math.max(0, offeringTotal - (project.available_shares ?? 0))
  const liveAvailable =
    walletStats?.offering_available ??
    Math.max(0, offeringTotal - soldFromOffering)

  const pctRaw = offeringTotal > 0
    ? Math.min(100, (soldFromOffering / offeringTotal) * 100)
    : 0
  const pct =
    pctRaw === 0 ? 0 :
    pctRaw < 10 ? Number(pctRaw.toFixed(2)) :
    Math.round(pctRaw)
  const pctBarWidth = pctRaw === 0 ? 0 : Math.max(2, pctRaw)

  // Phase 10.82 — market cap = share_price × total_shares (whole project).
  const marketCap = project.share_price * (project.total_shares ?? 0)

  // Phase 12.11 — funded amount = sold × share_price (real money raised).
  // Remaining funding = available × share_price.
  const fundedAmount = walletStats
    ? walletStats.funded_amount
    : project.share_price * soldFromOffering
  const remainingAmount = walletStats
    ? walletStats.remaining_amount
    : project.share_price * liveAvailable

  // Phase 12.11 — REAL price change: (current − share_price) / share_price × 100.
  const livePrice = project.current_market_price ?? project.share_price
  const priceChange =
    project.share_price > 0
      ? (((livePrice - project.share_price) / project.share_price) * 100).toFixed(2)
      : "0.00"
  const isUp = parseFloat(priceChange) >= 0

  // ─── Phase 14.07.1 — period filter for real timeline ────────────
  // Window the loaded timeline based on the user's period selection.
  // "كل" returns everything; the others cap relative to "now".
  const chartData = useMemo(() => {
    if (priceTimeline.length === 0) return [] as Array<{ ts: number; price: number; label: string }>
    const now = Date.now()
    const windowMs: Record<typeof period, number> = {
      "1D": 86_400_000,
      "7D": 7 * 86_400_000,
      "30D": 30 * 86_400_000,
      "كل": Number.POSITIVE_INFINITY,
    }
    const cutoff = now - (windowMs[period] ?? Number.POSITIVE_INFINITY)
    const filtered = priceTimeline.filter((p) => {
      const t = new Date(p.recorded_at).getTime()
      return Number.isFinite(t) && t >= cutoff
    })
    // Ensure chart still renders even when the window is empty — we
    // anchor on the latest known point so the user sees the live price.
    const points = filtered.length > 0 ? filtered : priceTimeline.slice(-1)
    return points.map((p) => ({
      ts: new Date(p.recorded_at).getTime(),
      price: Math.round(Number(p.new_price) || 0),
      label: new Date(p.recorded_at).toLocaleString("ar-IQ", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }))
  }, [priceTimeline, period])

  return (
    <AppLayout>
      <div className="relative">
        {/* Phase 10.95 — solid black background per founder spec
            (was GridBackground, didn't match the rest of the app). */}
        <div className="absolute inset-0 bg-black -z-0" />

        <div className="relative z-10 px-3 lg:px-8 py-6 max-w-3xl mx-auto">

          <PageHeader
            title="تفاصيل المشروع"
            subtitle={project.name}
            rightAction={
              <button
                onClick={handleToggleFollow}
                disabled={followBusy}
                aria-pressed={following}
                aria-busy={followBusy}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border",
                  following
                    ? "bg-white/[0.05] border-white/[0.15] text-white hover:bg-white/[0.08]"
                    : "bg-neutral-100 text-black border-transparent hover:bg-neutral-200",
                  followBusy && "opacity-70 cursor-wait",
                )}
              >
                {followBusy ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" />
                ) : (
                  <Heart
                    className={cn("w-3.5 h-3.5", following && "fill-current")}
                    strokeWidth={1.5}
                  />
                )}
                {following ? "متابَع" : "متابعة"}
              </button>
            }
          />

          {/* Hero */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
            <div className="flex items-center gap-3 mb-3">
              {/* Phase 10.99c — show uploaded project logo when available;
                  fall back to the sector emoji otherwise. */}
              {(project.logo_url || project.logo) ? (
                <div className="w-14 h-14 rounded-2xl border border-white/[0.1] overflow-hidden bg-white/[0.06] flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.logo_url || project.logo}
                    alt={project.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-3xl flex-shrink-0">
                  {sectorIcon(project.sector)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold text-white truncate">{project.name}</div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="bg-white/[0.06] border border-white/[0.08] text-neutral-300 px-2 py-0.5 rounded text-[10px]">{project.sector}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border",
                    project.risk_level === "low" ? "bg-green-400/10 border-green-400/20 text-green-400" :
                    project.risk_level === "medium" ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" :
                    "bg-red-400/10 border-red-400/20 text-red-400"
                  )}>
                    خطر {riskLabel(project.risk_level)}
                  </span>
                </div>
              </div>
            </div>

            {/* Price (Phase 12.9 — prefer current_market_price) */}
            <div className="mb-3">
              <div className="text-[11px] text-neutral-500 mb-1">السعر الحالي للحصة</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tracking-tight font-mono">
                  {(project.current_market_price ?? project.share_price).toLocaleString("en-US")}
                </span>
                <span className="text-xs text-neutral-500">IQD</span>
                <span className={cn("text-sm font-bold flex items-center gap-0.5 mr-2", isUp ? "text-green-400" : "text-red-400")}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(parseFloat(priceChange))}%
                </span>
              </div>
              {project.current_market_price &&
               project.current_market_price !== project.share_price && (
                <div className="text-[10px] text-neutral-600 mt-1">
                  السعر الاسمي: {project.share_price.toLocaleString("en-US")} د.ع
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-neutral-500">نسبة التمويل</span>
                <span className="text-[11px] font-bold text-white">{pct}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    pct > 70 ? "bg-green-400" : pct > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: pctBarWidth + "%" }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "القيمة السوقية", value: fmtIQD(marketCap) + " IQD" },
                { label: "المستثمرين", value: investors.toLocaleString("en-US") },
                {
                  label: "حصص متاحة",
                  value: liveAvailable.toLocaleString("en-US"),
                },
                { label: "إجمالي الحصص", value: project.total_shares.toLocaleString("en-US") },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                  <div className="text-[10px] text-neutral-500 mb-0.5">{s.label}</div>
                  <div className="text-sm font-bold text-white font-mono">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Chart — Phase 14.07.1: real price_history timeline ═══
              Replaces the legacy genChart() sine-wave + the mock
              "💹 حركة سعر الحصة" Card. Both fed synthetic data that
              misled investors. Now: every point is a real datum from
              creation, completed deals, or admin price changes. */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-3">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="text-sm font-bold text-white">حركة السعر</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  بيانات حقيقية من سجل التداول
                </div>
              </div>
              <div className="flex gap-1">
                {(["1D", "7D", "30D", "كل"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      period === p
                        ? "bg-white text-black font-bold"
                        : "bg-white/[0.04] text-neutral-400 hover:text-white",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {priceTimelineLoading ? (
              <div className="h-32 flex items-center justify-center text-[11px] text-neutral-500">
                جاري تحميل سجل السعر...
              </div>
            ) : chartData.length < 2 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center px-4">
                <div className="text-2xl mb-1 opacity-50">📉</div>
                <div className="text-[11px] text-neutral-500 leading-relaxed">
                  لا توجد بيانات تداول كافية لرسم المنحنى{" "}
                  {period !== "كل" && "في هذه الفترة"}
                </div>
                {period !== "كل" && (
                  <button
                    onClick={() => setPeriod("كل")}
                    className="mt-2 text-[10px] text-green-400 hover:text-green-300 underline underline-offset-2"
                  >
                    عرض السجل الكامل
                  </button>
                )}
              </div>
            ) : (
              <ProjectPriceChart data={chartData} isUp={isUp} />
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-3">
            {([
              { key: "info", label: "المعلومات" },
              { key: "updates", label: `التحديثات${updates.length > 0 ? ` (${updates.length})` : ""}` },
              { key: "gallery", label: "معرض الصور" },
              { key: "history", label: "السجل" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs transition-colors",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Info Tab */}
          {tab === "info" && (
            <>
              {project.description && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-2">عن المشروع</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">{project.description}</div>
                </div>
              )}

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="text-sm font-bold text-white mb-3">البيانات المالية</div>
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { label: "رأس المال الكلي", value: fmtIQD(project.share_price * project.total_shares) + " IQD" },
                    // Phase 12.11 — funded = sold × share_price (real money raised).
                    { label: "المبلغ الممول", value: fmtIQD(fundedAmount) + " IQD" },
                    // Remaining = available × share_price (still on the market).
                    { label: "المتبقي للتمويل", value: fmtIQD(remainingAmount) + " IQD" },
                    { label: "الحد الأدنى للاستثمار", value: project.share_price.toLocaleString("en-US") + " IQD" },
                    { label: "إجمالي الحصص", value: project.total_shares.toLocaleString("en-US") + " SHR" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <span className="text-xs text-neutral-500">{item.label}</span>
                      <span className="text-xs font-bold text-white font-mono">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="text-sm font-bold text-white mb-3">العوائد المتوقعة</div>
                {/* Phase 10.87 — Monthly + annual side-by-side cards.
                    DB stores annual; monthly = annual / 12. */}
                {(() => {
                  const annualMin = project.return_min ?? 0
                  const annualMax = project.return_max ?? 0
                  const monthlyMin = annualMin / 12
                  const monthlyMax = annualMax / 12
                  const fmt = (v: number) =>
                    Number.isInteger(v) ? String(v) : v.toFixed(2)
                  return (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-green-400/[0.06] border border-green-400/[0.2] rounded-xl p-3 text-center">
                        <div className="text-[10px] text-neutral-400 mb-1">العائد الشهري المتوقع</div>
                        <div className="text-base font-bold text-green-400 font-mono">
                          {fmt(monthlyMin)}% — {fmt(monthlyMax)}%
                        </div>
                      </div>
                      <div className="bg-emerald-400/[0.06] border border-emerald-400/[0.2] rounded-xl p-3 text-center">
                        <div className="text-[10px] text-neutral-400 mb-1">العائد السنوي المتوقع</div>
                        <div className="text-base font-bold text-emerald-400 font-mono">
                          {fmt(annualMin)}% — {fmt(annualMax)}%
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <div className="divide-y divide-white/[0.04]">
                  {[
                    {
                      label: "مستوى المخاطر",
                      value:
                        project.risk_level === "low" ? "🟢 منخفض" :
                        project.risk_level === "medium" ? "🟡 متوسط" :
                        project.risk_level === "high" ? "🔴 مرتفع" : "—",
                    },
                    { label: "آلية التوزيع", value: project.distribution_type === "monthly" ? "شهري" : project.distribution_type === "quarterly" ? "ربع سنوي" : project.distribution_type === "semi_annual" ? "نصف سنوي" : "سنوي" },
                    { label: "مصدر العوائد", value: project.profit_source || "أرباح التشغيل" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <span className="text-xs text-neutral-500">{item.label}</span>
                      <span className="text-xs font-bold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-white/[0.04] border-r-2 border-white/[0.15] rounded-lg p-2.5 text-[10px] text-neutral-400">
                  ⚠️ العوائد تقديرية وتعتمد على الأداء الفعلي
                </div>
              </div>

              {/* ═══ Extended classification (admin form data) ═══ */}
              {(project.symbol || project.entity_type || project.build_status || project.quality) && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">التصنيف</div>
                  <div className="grid grid-cols-2 gap-2">
                    {project.symbol && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">الرمز</div>
                        <div className="text-sm font-bold text-blue-400 font-mono" dir="ltr">{project.symbol}</div>
                      </div>
                    )}
                    {project.entity_type && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">نوع الكيان</div>
                        <div className="text-sm font-bold text-white">
                          {project.entity_type === "company" ? "🏢 شركة"
                            : project.entity_type === "project" ? "🏗️ مشروع"
                            : project.entity_type === "individual" ? "👤 فرد"
                            : "🤝 شراكة"}
                        </div>
                      </div>
                    )}
                    {project.build_status && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">حالة الإنشاء</div>
                        <div className="text-sm font-bold text-white">
                          {project.build_status === "planning" ? "قيد الإنشاء"
                            : project.build_status === "active" ? "نشط" : "منجز"}
                        </div>
                      </div>
                    )}
                    {project.quality && (
                      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                        <div className="text-[10px] text-neutral-500 mb-0.5">الجودة</div>
                        <div className="text-sm font-bold">
                          <span className={
                            project.quality === "high" ? "text-green-400"
                            : project.quality === "medium" ? "text-yellow-400" : "text-red-400"
                          }>
                            {project.quality === "high" ? "🟢 عالي"
                              : project.quality === "medium" ? "🟡 متوسط" : "🔴 منخفض"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Capital progress (admin form data) ═══ */}
              {project.capital_needed && project.capital_needed > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">رأس المال</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">رأس المال المطلوب</span>
                      <span className="text-white font-bold font-mono">{fmtIQD(project.capital_needed)} د.ع</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">المُحقَّق حتى الآن</span>
                      <span className="text-yellow-400 font-bold font-mono">{fmtIQD(project.capital_raised ?? 0)} د.ع</span>
                    </div>
                    <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all"
                        style={{
                          width: `${Math.min(100, ((project.capital_raised ?? 0) / project.capital_needed) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-neutral-500">نسبة التحقيق</span>
                      <span className="text-yellow-400 font-mono">
                        {(((project.capital_raised ?? 0) / project.capital_needed) * 100).toFixed(1)}%
                      </span>
                    </div>
                    {(project.owner_percent || project.offer_percent) && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.04]">
                        {project.owner_percent !== undefined && (
                          <div>
                            <div className="text-[10px] text-neutral-500">نسبة المالك</div>
                            <div className="text-sm font-bold text-white font-mono">{project.owner_percent}%</div>
                          </div>
                        )}
                        {project.offer_percent !== undefined && (
                          <div>
                            <div className="text-[10px] text-neutral-500">نسبة المطروح</div>
                            <div className="text-sm font-bold text-white font-mono">{project.offer_percent}%</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Owner contact (admin form data) ═══ */}
              {(project.owner_name || project.address) && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">المالك</div>
                  <div className="space-y-2">
                    {project.owner_name && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">اسم المالك</span>
                        <span className="text-xs font-bold text-white">{project.owner_name}</span>
                      </div>
                    )}
                    {project.owner_phone && myShares > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">الهاتف</span>
                        <span className="text-xs font-bold text-white font-mono" dir="ltr">{project.owner_phone}</span>
                      </div>
                    )}
                    {project.owner_email && myShares > 0 && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-xs text-neutral-500">البريد</span>
                        <span className="text-xs font-bold text-white font-mono" dir="ltr">{project.owner_email}</span>
                      </div>
                    )}
                    {project.address && (
                      <div className="py-1.5">
                        <div className="text-xs text-neutral-500 mb-1">العنوان</div>
                        <div className="text-xs text-white leading-relaxed">{project.address}</div>
                      </div>
                    )}
                    {!myShares && (project.owner_phone || project.owner_email) && (
                      <div className="bg-blue-400/[0.05] border border-blue-400/20 rounded-lg p-2.5 text-[10px] text-blue-400 leading-relaxed">
                        🔒 بيانات التواصل (هاتف/بريد) متاحة للمستثمرين فقط
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ Documents (Phase 10.90 — uploaded files OR external links) ═══ */}
              {project.documents && project.documents.length > 0 && (
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-white mb-3">📁 الأوراق الرسمية</div>
                  <div className="space-y-2">
                    {project.documents.map((doc, i) => {
                      const isUpload = doc.url?.startsWith("data:")
                      const sizeKb =
                        (doc as { size?: number }).size != null
                          ? ((doc as { size?: number }).size! / 1024).toFixed(1)
                          : null
                      return (
                        <a
                          key={i}
                          href={doc.url}
                          download={isUpload ? doc.name : undefined}
                          target={isUpload ? undefined : "_blank"}
                          rel={isUpload ? undefined : "noopener noreferrer"}
                          className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] rounded-lg p-2.5 transition-colors"
                        >
                          <span className="text-blue-400">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white truncate">{doc.name}</div>
                            {sizeKb && (
                              <div className="text-[10px] text-neutral-500">{sizeKb} KB</div>
                            )}
                          </div>
                          <span className="text-[10px] text-blue-400">
                            {isUpload ? "↓ تنزيل" : "↗ فتح"}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {myShares > 0 && (
                <div className="bg-green-400/[0.06] border border-green-400/20 rounded-2xl p-4 mb-3">
                  <div className="text-sm font-bold text-green-400 mb-3">استثماري الشخصي</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "الحصص المملوكة", value: myShares + " SHR" },
                      { label: "القيمة الحالية", value: fmtIQD(myShares * project.share_price) + " IQD" },
                      { label: "العائد التقديري", value: "+" + priceChange + "%", color: "text-green-400" },
                      { label: "نسبة المشروع", value: ((myShares / project.total_shares) * 100).toFixed(2) + "%" },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/[0.04] border border-green-400/[0.15] rounded-lg p-2.5">
                        <div className="text-[10px] text-green-400/70 mb-0.5">{item.label}</div>
                        <div className={cn("text-sm font-bold", item.color || "text-white")}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Updates Tab — real project_updates rows */}
          {tab === "updates" && (
            <div className="space-y-3 mb-3">
              {updates.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center py-12">
                  <div className="text-3xl mb-2 opacity-50">📰</div>
                  <div className="text-sm font-bold text-white mb-1">لا توجد تحديثات بعد</div>
                  <div className="text-xs text-neutral-500">
                    ستظهر هنا عند نشر تحديثات جديدة من قِبل صاحب المشروع
                  </div>
                </div>
              ) : (
                updates.map((u) => {
                  const date = new Date(u.created_at)
                  const dateStr = Number.isNaN(date.getTime())
                    ? "—"
                    : date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                  return (
                    <div
                      key={u.id}
                      className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white leading-tight">
                            {u.title}
                          </div>
                          <div
                            className="text-[10px] text-neutral-500 mt-1 font-mono"
                            dir="ltr"
                          >
                            {dateStr}
                          </div>
                        </div>
                        {u.progress_percentage !== null && (
                          <div className="bg-green-400/[0.08] border border-green-400/30 rounded-lg px-2 py-1 text-[10px] font-bold text-green-400 font-mono flex-shrink-0">
                            {u.progress_percentage}%
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {u.content}
                      </div>
                      {u.progress_percentage !== null && (
                        <div className="mt-3 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 transition-all"
                            style={{ width: `${Math.min(100, u.progress_percentage)}%` }}
                          />
                        </div>
                      )}
                      {u.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {u.images.slice(0, 4).map((img, i) => (
                            // Image URLs in project_updates are admin-uploaded
                            // public Supabase Storage paths — render as plain
                            // <img> to avoid Next/image domain config drift.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={img}
                              alt={u.title}
                              className="aspect-[4/3] object-cover rounded-xl bg-white/[0.04] border border-white/[0.06]"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Gallery Tab — Phase 10.90: real gallery_images from admin form */}
          {tab === "gallery" && (() => {
            const realImages =
              project.gallery_images ??
              project.project_images ??
              project.company_images ??
              []
            if (realImages.length === 0) {
              return (
                <div className="mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    {galleryEmojis.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-[4/3] bg-white/[0.05] border border-white/[0.08] rounded-2xl flex items-center justify-center text-5xl"
                      >
                        {img}
                      </div>
                    ))}
                  </div>
                  <div className="text-center mt-3 text-[11px] text-neutral-500">
                    <ImageIcon className="w-4 h-4 mx-auto mb-1.5 opacity-40" />
                    لا توجد صور بعد — أضِفها من لوحة التحكم
                  </div>
                </div>
              )
            }
            return (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {realImages.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-[4/3] bg-white/[0.05] border border-white/[0.08] rounded-2xl overflow-hidden block hover:border-white/[0.2] transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`صورة ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )
          })()}

          {/* History Tab — Phase 14.07.1: real completed deals for
              this project. Replaces the legacy mockTrades constant.
              Buyer/seller names come from profiles_public to respect
              RLS (Phase 13.52 — the embed-join pattern returns NULL
              under strict RLS, so we split into two queries). */}
          {tab === "history" && (
            <div className="space-y-2 mb-3">
              {recentDealsLoading ? (
                <div className="text-center py-12 text-sm text-neutral-500">
                  جاري تحميل سجل الصفقات...
                </div>
              ) : recentDeals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-2 opacity-50">📜</div>
                  <div className="text-sm text-neutral-400 mb-1">
                    لا توجد صفقات مسجلة بعد
                  </div>
                  <div className="text-[11px] text-neutral-500 leading-relaxed">
                    ستظهر هنا كل الصفقات المكتملة على هذا المشروع
                  </div>
                </div>
              ) : (
                recentDeals.map((d) => {
                  const when = d.completed_at
                    ? new Date(d.completed_at).toLocaleString("ar-IQ", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"
                  return (
                    <div
                      key={d.id}
                      className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">
                            {d.shares.toLocaleString("en-US")} حصة
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{when}</div>
                          {(d.buyer_name || d.seller_name) && (
                            <div className="text-[10px] text-neutral-500 mt-1 truncate">
                              {d.seller_name ?? "—"}
                              <span className="mx-1 text-neutral-600">←</span>
                              {d.buyer_name ?? "—"}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-yellow-400 font-mono">
                            {fmtIQD(d.total_amount)} د.ع
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {d.price_per_share.toLocaleString("en-US")} /حصة
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Phase 13.11 — Page-level banner when direct buy is suspended */}
          {offeringSuspended && (
            <div className="mt-4 bg-red-400/[0.06] border-2 border-red-400/30 rounded-xl p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-400/[0.12] border border-red-400/30 flex items-center justify-center flex-shrink-0 text-base">
                🔒
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-red-300 mb-0.5">
                  البيع المباشر معلَّق حالياً
                </div>
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  لا يمكن طلب شراء مباشر من المنصة بالوقت الحالي.
                  {offeringSuspensionReason ? ` السبب: ${offeringSuspensionReason}.` : ""}
                  {" "}لا يزال بإمكانك الشراء من المستثمرين الآخرين عبر سوق التبادل.
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowBuyOptions(true)}
              disabled={project.available_shares === 0}
              className={cn(
                "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                project.available_shares > 0
                  ? "bg-neutral-100 text-black hover:bg-neutral-200"
                  : "bg-white/[0.08] text-neutral-500 cursor-not-allowed"
              )}
            >
              <ShoppingCart className="w-4 h-4" strokeWidth={2} />
              {project.available_shares === 0 ? "نفذت الحصص" : "شراء حصص"}
            </button>
            {myShares > 0 && (
              <button
                onClick={() => router.push("/market/new")}
                className="flex-1 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.08]"
              >
                بيع
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Buy Options Modal */}
      {showBuyOptions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-base font-bold text-white">اختر طريقة الشراء</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">{project.name} • {(project.current_market_price ?? project.share_price).toLocaleString("en-US")} IQD/حصة</div>
              </div>
              <button onClick={() => setShowBuyOptions(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option 1: Direct buy from system — Phase 13.11:
                disabled when admin set offering_suspended=true. */}
            <button
              onClick={() => {
                if (offeringSuspended) return
                setShowBuyOptions(false)
                setShowCreateDeal(true)
              }}
              disabled={offeringSuspended}
              className={cn(
                "w-full mt-4 border rounded-xl p-4 text-right transition-colors",
                offeringSuspended
                  ? "bg-white/[0.02] border-white/[0.05] opacity-60 cursor-not-allowed"
                  : "bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.06]"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xl flex-shrink-0">
                  {offeringSuspended ? "🔒" : "🏦"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">طلب شراء مباشر</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {offeringSuspended
                      ? "غير متوفر حالياً"
                      : "الشراء مباشرةً من المنصة"}
                  </div>
                </div>
              </div>
              {offeringSuspended ? (
                <div className="bg-red-400/[0.06] border border-red-400/20 rounded-lg p-2.5 text-[11px] text-red-300 leading-relaxed">
                  ⛔ <span className="font-bold">البيع المباشر غير متوفر بالوقت الحالي.</span>
                  {" "}يمكنك الشراء من المستثمرين عبر الخيار أدناه.
                  {offeringSuspensionReason && (
                    <div className="mt-1 text-neutral-400">
                      السبب: {offeringSuspensionReason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded-lg p-2.5 text-[11px] text-yellow-400 leading-relaxed">
                  <Clock className="w-3 h-3 inline ml-1" />
                  الطلب يذهب للبائع فوراً، يحتاج رد خلال 5 دقائق
                </div>
              )}
            </button>

            {/* Option 2: From investors */}
            <button
              onClick={() => {
                setShowBuyOptions(false)
                router.push("/exchange?project=" + project.id)
              }}
              className="w-full mt-3 bg-green-400/[0.04] border border-green-400/20 rounded-xl p-4 text-right hover:bg-green-400/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-400/[0.1] border border-green-400/20 flex items-center justify-center text-xl flex-shrink-0">
                  ⚡
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-green-400">شراء من المستثمرين</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">سوق التبادل بين المستثمرين</div>
                </div>
              </div>
              <div className="bg-green-400/[0.06] border border-green-400/20 rounded-lg p-2.5 text-[11px] text-green-400 leading-relaxed">
                ✅ يتم بسرعة حسب الإعلانات المتاحة
              </div>
            </button>

            <button
              onClick={() => setShowBuyOptions(false)}
              className="w-full mt-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      <CreateDealModal
        open={showCreateDeal}
        onClose={() => setShowCreateDeal(false)}
        project={{
          id: project.id,
          name: project.name,
          share_price: project.share_price,
          available_shares: project.available_shares,
        }}
        seller={{
          id: project.seller_id || "seller_main",
          name: project.seller_name || "إدارة المنصة",
        }}
      />
    </AppLayout>
  )
}
