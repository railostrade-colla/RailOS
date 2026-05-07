"use client"

/**
 * Read-only details view for a project/company row.
 * Used inline by Projects.tsx when user clicks a row.
 */

import { useEffect, useState } from "react"
import { ArrowRight, Edit2, Wallet as WalletIcon, MapPin, Calendar, TrendingUp, TrendingDown, Users, AlertTriangle } from "lucide-react"
import { Badge, ActionBtn, KPI } from "@/components/admin/ui"
import { getAllProjectWalletsAdmin } from "@/lib/data/admin-utilities"
import { getProjectByIdAdmin } from "@/lib/data/projects"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

// Phase 10.89 — wallet container values per the founder's spec:
//   • balance  = offering_available × current_market_price
//   • revenue  = SUM(deals.total_amount) where status='completed'
//                (covers both primary "direct" + auction sales)
//   • expenses = SUM(ambassador_commissions.commission_value)
//                (gifts paid out from the offering wallet)
// Plus the offering wallet's raw counts so the sale-progress card
// can show the right percentages (sold / offering_total instead of
// sold / total_shares).
interface ProjectWalletAggregate {
  balance:        number  // offering_available × market_price
  total_inflow:   number  // ∑ deals.total_amount (completed)
  total_outflow:  number  // ∑ ambassador_commissions.commission_value
  status:         "active" | "frozen" | "closed"
  offering_total:     number
  offering_available: number
  sold_from_offering: number
  market_price:       number
}

interface ProjectPrices {
  launch_price: number       // Initial price at creation (immutable)
  market_price: number       // Current dynamic price
  change_pct: number         // (market - launch) / launch × 100
}

// Phase 10.88 — wallet split percentages from the project row.
// Read straight off the `projects` table so we don't depend on the
// 3-wallet aggregate landing first.
interface WalletSplit {
  offering_pct: number
  reserve_pct: number
  offering_shares: number
  reserve_shares: number
}

// Loose entity-detail row shape — matches Projects.tsx EntityRow.
// Kept here so this component doesn't import from a panel that
// imports it (would create a cycle).
interface EntityDetailRow {
  id: string
  name: string
  sector: string
  entity_type: "project" | "company"
  status: "active" | "pending" | "paused"
  quality: "low" | "medium" | "high"
  share_price: number
  total_shares: number
  available_shares: number
  project_value: number
  /** Optional metadata — populated when row came from a richer DB query. */
  description?: string
  city?: string
  created_at?: string
  founded_year?: number | string
  offering_start?: string
  offering_end?: string
  /** Phase 10.93 — trading & offering suspension state */
  trading_suspended?: boolean
  trading_suspension_reason?: string | null
  offering_suspended?: boolean
  offering_suspension_reason?: string | null
}

const fmtNum = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) => {
  if (s?.includes("زراع")) return "🌾"
  if (s?.includes("تجار")) return "🏪"
  if (s?.includes("عقار")) return "🏢"
  if (s?.includes("صناع")) return "🏭"
  if (s?.includes("تقن")) return "💻"
  return "🏢"
}

export interface EntityDetailsViewProps {
  entity: EntityDetailRow
  onEdit: () => void
  onBack: () => void
}

export function EntityDetailsView({ entity, onEdit, onBack }: EntityDetailsViewProps) {
  const isProject = entity.entity_type === "project"

  // Fetch real wallet aggregate from DB. Empty until the async fetch
  // resolves; if no wallets exist for this project, stays null.
  const [wallet, setWallet] = useState<ProjectWalletAggregate | null>(null)
  // Phase 10.58: fetch project's launch + current prices
  const [prices, setPrices] = useState<ProjectPrices | null>(null)
  // Phase 10.84 — project's uploaded logo so the hero icon shows the
  // real brand image instead of the generic sector emoji.
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  // Phase 10.88 — wallet split read off the `projects` row. Used to
  // tag the "available shares" card with its offering % and to render
  // the reserve-shares card ("never sold").
  const [walletSplit, setWalletSplit] = useState<WalletSplit | null>(null)

  useEffect(() => {
    if (!isProject) return
    let cancelled = false

    // Phase 10.89 — fan out three queries in parallel:
    //   1. project_wallets aggregate (per-wallet shares + market_price)
    //   2. deals: ∑ total_amount where status='completed'  → revenue
    //   3. ambassador_commissions: ∑ commission_value      → expenses
    const supabase = createClient()
    const walletsP = getAllProjectWalletsAdmin(500)
    const revenueP = supabase
      .from("deals")
      .select("total_amount")
      .eq("project_id", entity.id)
      .eq("status", "completed")
    const expensesP = supabase
      .from("ambassador_commissions")
      .select("commission_value")
      .eq("project_id", entity.id)

    Promise.all([walletsP, revenueP, expensesP]).then(([rows, dealsRes, ambRes]) => {
      if (cancelled) return
      const match = rows.find((r) => r.project_id === entity.id || r.id === entity.id)

      // Sum revenue (deals) — best-effort; missing column / RLS = 0.
      let revenue = 0
      const deals = (dealsRes?.data ?? []) as Array<{ total_amount: number | string | null }>
      for (const d of deals) revenue += Number(d.total_amount ?? 0)

      // Sum expenses (ambassador commissions). Table may not exist on
      // older DBs (Phase 10.86 migration not applied) → treat as 0.
      let expenses = 0
      const amb = (ambRes?.data ?? []) as Array<{ commission_value: number | string | null }>
      for (const a of amb) expenses += Number(a.commission_value ?? 0)

      if (match) {
        const offeringTotal     = match.offering_total ?? 0
        const offeringAvailable = match.offering_available ?? 0
        const soldFromOffering  = Math.max(0, offeringTotal - offeringAvailable)
        const marketPrice       = match.market_price ?? 0
        const balance           = offeringAvailable * marketPrice

        setWallet({
          balance,
          total_inflow:       revenue,
          total_outflow:      expenses,
          status:             match.status,
          offering_total:     offeringTotal,
          offering_available: offeringAvailable,
          sold_from_offering: soldFromOffering,
          market_price:       marketPrice,
        })
      } else {
        // Project still has revenue/expenses even if wallets aren't
        // wired yet — surface them with an empty offering split.
        setWallet(null)
      }
    })
    // Fetch full project for launch_price (share_price) + market_price (current_market_price)
    getProjectByIdAdmin(entity.id).then((row) => {
      if (cancelled || !row) return
      const launch = Number(row.share_price ?? 0)
      const market = Number(row.current_market_price ?? row.share_price ?? 0)
      const change = launch > 0 ? ((market - launch) / launch) * 100 : 0
      setPrices({ launch_price: launch, market_price: market, change_pct: change })
      // Phase 10.84 — pull whichever logo column is populated. The
      // project schema has used several names over phases (logo_url,
      // logo, image_url) so we accept any of them.
      const r = row as Record<string, unknown>
      const logo =
        (r.logo_url as string | undefined) ??
        (r.logo as string | undefined) ??
        (r.image_url as string | undefined) ??
        null
      setLogoUrl(logo && logo.trim() ? logo : null)

      // Phase 10.88: derive wallet split percentages + share counts.
      // The form persists offering_percentage/reserve_percentage on
      // the project row; ambassador_percentage is now retired (10.86).
      const totalShares = Number(r.total_shares ?? entity.total_shares ?? 0)
      const offPct = Number(r.offering_percentage ?? 0)
      const resPct = Number(r.reserve_percentage ?? 0)
      setWalletSplit({
        offering_pct:    offPct,
        reserve_pct:     resPct,
        // Math.round prevents floating-point drift (e.g. 40000 × 0.4 ≈
        // 16000.000000000002 in IEEE 754 → Math.floor gave 16000, but the
        // inverse case (…9999…) would silently drop 1).
        offering_shares: Math.round(totalShares * (offPct / 100)),
        reserve_shares:  Math.round(totalShares * (resPct / 100)),
      })
    })
    return () => { cancelled = true }
  }, [entity.id, entity.total_shares, isProject])

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <button
          onClick={onBack}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          العودة لقائمة المشاريع
        </button>
        <ActionBtn label="✏️ تعديل" color="blue" onClick={onEdit} />
      </div>

      {/* Hero */}
      <div className={cn(
        "rounded-2xl p-5 mb-5 border",
        isProject
          ? "bg-gradient-to-br from-blue-500/[0.08] to-transparent border-blue-400/[0.25]"
          : "bg-gradient-to-br from-purple-500/[0.08] to-transparent border-purple-400/[0.25]"
      )}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden",
              isProject ? "bg-blue-400/[0.1] border-blue-400/[0.3]" : "bg-purple-400/[0.1] border-purple-400/[0.3]"
            )}>
              {/* Phase 10.84 — show uploaded project/company logo when
                  available; fall back to the sector emoji. */}
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={entity.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Hide the broken-image so the parent's fallback
                    // (sector emoji) becomes visible. We achieve this
                    // by clearing logoUrl on next paint.
                    setLogoUrl(null)
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                sectorIcon(entity.sector)
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-white">{entity.name}</div>
              <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <Badge label={isProject ? "مشروع" : "شركة"} color={isProject ? "blue" : "purple"} />
                <span>•</span>
                <span>{entity.sector}</span>
                <span>•</span>
                <span className="font-mono">#{entity.id}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              label={entity.status === "active" ? "نشط" : entity.status === "pending" ? "مراجعة" : "متوقف"}
              color={entity.status === "active" ? "green" : entity.status === "pending" ? "yellow" : "gray"}
            />
            <Badge
              label={entity.quality === "high" ? "★ عالية" : entity.quality === "medium" ? "متوسطة" : "منخفضة"}
              color={entity.quality === "high" ? "purple" : entity.quality === "medium" ? "blue" : "gray"}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="سعر الإطلاق" val={prices ? fmtNum(prices.launch_price) : (entity.share_price ? fmtNum(entity.share_price) : "—")} color="#FBBF24" />
        <KPI label="إجمالي الحصص" val={fmtNum(entity.total_shares)} color="#fff" />
        <KPI label="حصص متاحة" val={fmtNum(entity.available_shares)} color="#4ADE80" />
        <KPI label="القيمة الإجمالية" val={fmtNum(entity.project_value) + " د.ع"} color="#60A5FA" />
      </div>

      {/* Phase 10.58 — Launch vs Market price comparison */}
      {isProject && prices && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            {prices.change_pct >= 0
              ? <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={1.5} />
              : <TrendingDown className="w-4 h-4 text-red-400" strokeWidth={1.5} />
            }
            <div className="text-sm font-bold text-white">سعر الإطلاق مقابل سعر السوق</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">سعر الإطلاق (مرجعي)</div>
              <div className="text-base font-bold text-yellow-400 font-mono">{fmtNum(prices.launch_price)} د.ع</div>
              <div className="text-[9px] text-neutral-600 mt-1">ثابت — وقت الإنشاء</div>
            </div>
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
              <div className="text-[10px] text-neutral-500 mb-1">سعر السوق الحالي</div>
              <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(prices.market_price)} د.ع</div>
              <div className="text-[9px] text-neutral-600 mt-1">ديناميكي — يتحدّث مع السوق</div>
            </div>
            <div className={cn(
              "rounded-lg p-3 text-center border",
              prices.change_pct > 0 && "bg-green-400/[0.05] border-green-400/[0.2]",
              prices.change_pct < 0 && "bg-red-400/[0.05] border-red-400/[0.2]",
              prices.change_pct === 0 && "bg-neutral-400/[0.05] border-neutral-400/[0.2]",
            )}>
              <div className="text-[10px] text-neutral-500 mb-1">نسبة التغيّر</div>
              <div className={cn(
                "text-base font-bold font-mono",
                prices.change_pct > 0 && "text-green-400",
                prices.change_pct < 0 && "text-red-400",
                prices.change_pct === 0 && "text-neutral-400",
              )}>
                {prices.change_pct > 0 ? "+" : ""}{prices.change_pct.toFixed(2)}%
              </div>
              <div className="text-[9px] text-neutral-600 mt-1">منذ الإطلاق</div>
            </div>
          </div>
        </div>
      )}

      {/* Shares progress — Phase 10.89: percentages are now relative
          to the OFFERING total (not project total), per the founder's
          spec: «النسبة تمثل الحصص المطروحة للبيع — كم بيع منها». */}
      {(() => {
        const offeringTotal     = wallet?.offering_total
          ?? walletSplit?.offering_shares
          ?? 0
        const offeringAvailable = wallet?.offering_available
          ?? entity.available_shares
          ?? 0
        const soldShares = wallet?.sold_from_offering
          ?? Math.max(0, offeringTotal - offeringAvailable)
        const soldPct = offeringTotal > 0
          ? Math.round((soldShares / offeringTotal) * 100)
          : 0
        return (
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={1.5} />
          <div className="text-sm font-bold text-white">تقدّم البيع</div>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-white font-mono">{soldPct}%</span>
          <span className="text-xs text-neutral-500">من الحصص المطروحة بِيعت</span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-green-400 transition-all"
            style={{ width: `${Math.min(100, soldPct)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
            <div className="text-[10px] text-neutral-500 mb-1">حصص مُباعة للمستخدمين</div>
            <div className="text-base font-bold text-green-400 font-mono">{fmtNum(soldShares)}</div>
            {offeringTotal > 0 && (
              <div className="text-[9px] text-neutral-600 mt-1">من أصل {fmtNum(offeringTotal)} مطروحة</div>
            )}
          </div>
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-3 text-center">
            <div className="text-[10px] text-neutral-500 mb-1 flex items-center justify-center gap-1.5">
              <span>حصص متاحة</span>
              {walletSplit && walletSplit.offering_pct > 0 && (
                <span className="text-[9px] bg-yellow-400/[0.15] border border-yellow-400/[0.3] text-yellow-400 px-1.5 py-0.5 rounded font-mono">
                  {walletSplit.offering_pct}%
                </span>
              )}
            </div>
            <div className="text-base font-bold text-yellow-400 font-mono">{fmtNum(offeringAvailable)}</div>
            <div className="text-[9px] text-neutral-600 mt-1">المطروح ناقص المُباع</div>
          </div>
        </div>
        {/* Reserve shares — never tradable. Always shown so the admin
            knows how many shares are held back from the market. */}
        {walletSplit && walletSplit.reserve_pct > 0 && (
          <div className="bg-red-400/[0.04] border border-red-400/[0.2] rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold text-red-400">🔒 حصص الاحتياطي</span>
                <span className="text-[9px] bg-red-400/[0.15] border border-red-400/[0.3] text-red-400 px-1.5 py-0.5 rounded font-mono">
                  {walletSplit.reserve_pct}%
                </span>
              </div>
              <div className="text-base font-bold text-red-400 font-mono">{fmtNum(walletSplit.reserve_shares)}</div>
            </div>
            <div className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
              ⚠️ حصص الاحتياطي لا تُعرض للبيع أبداً ولا تُتداول في السوق. تبقى محجوزة بشكل دائم لحماية الكيان.
            </div>
          </div>
        )}
      </div>
        )
      })()}

      {/* Wallet — Phase 10.89:
            • balance  = available_for_public × current_market_price
            • inflow   = ∑ deals.total_amount (completed)
            • outflow  = ∑ ambassador_commissions.commission_value */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
          <div className="text-sm font-bold text-white">المحفظة المرتبطة</div>
        </div>
        {wallet ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center" title="الحصص المتاحة للجمهور × سعر السوق الحالي">
              <div className="text-[10px] text-neutral-500 mb-1">الرصيد</div>
              <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(Math.round(wallet.balance))}</div>
              <div className="text-[9px] text-neutral-600 mt-1">
                {fmtNum(wallet.offering_available)} × {fmtNum(Math.round(wallet.market_price))} د.ع
              </div>
            </div>
            <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center" title="إجمالي قيمة الصفقات المُكتملة (مباشر + مزاد)">
              <div className="text-[10px] text-neutral-500 mb-1">إيرادات</div>
              <div className="text-base font-bold text-green-400 font-mono">+{fmtNum(Math.round(wallet.total_inflow))}</div>
              <div className="text-[9px] text-neutral-600 mt-1">من الصفقات المُكتملة</div>
            </div>
            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-3 text-center" title="عمولات السفراء + الحصص الموزَّعة كهدايا من محفظة العرض">
              <div className="text-[10px] text-neutral-500 mb-1">مصروفات</div>
              <div className="text-base font-bold text-red-400 font-mono">-{fmtNum(Math.round(wallet.total_outflow))}</div>
              <div className="text-[9px] text-neutral-600 mt-1">عمولات + هدايا</div>
            </div>
          </div>
        ) : isProject && entity.status === "active" ? (
          <div className="bg-orange-400/[0.05] border border-orange-400/[0.25] rounded-xl p-3 flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-orange-400 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-orange-400 font-bold mb-1">⚠ المحافظ غير منشَأة بعد</div>
              <div className="text-neutral-300 leading-relaxed">
                المشروع منشور لكن محافظه (عرض / احتياطي) لم تُنشَأ.
                طبّق <span className="font-mono bg-black/30 px-1 rounded">Migration 10.52</span> في
                Supabase SQL Editor لإنشائها تلقائياً.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>لا توجد محفظة مرتبطة بعد. ستُنشأ تلقائياً عند نشر {isProject ? "المشروع" : "الشركة"}.</span>
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white">معلومات إضافية</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">تاريخ الإنشاء</span>
              <span className="text-white font-mono">{entity.created_at}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">القطاع</span>
              <span className="text-white">{sectorIcon(entity.sector)} {entity.sector}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">الجودة</span>
              <span className="text-white">{entity.quality === "high" ? "★ عالية" : entity.quality === "medium" ? "متوسطة" : "منخفضة"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">{isProject ? "المشروع" : "الشركة"}</span>
              <span className="text-white">{isProject ? "تابع لشركة" : "كيان مستقلّ"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-orange-400" strokeWidth={1.5} />
            <div className="text-sm font-bold text-white">التداول</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">حالة التداول</span>
              <Badge
                label={
                  entity.trading_suspended
                    ? "تداول معلق"
                    : entity.status === "active"
                      ? "نشط للتداول"
                      : "غير منشور"
                }
                color={
                  entity.trading_suspended
                    ? "red"
                    : entity.status === "active"
                      ? "green"
                      : "yellow"
                }
              />
            </div>
            {entity.trading_suspended && entity.trading_suspension_reason && (
              <div className="text-[10px] text-red-400/80 bg-red-400/[0.06] border border-red-400/[0.15] rounded-lg px-2.5 py-1.5 leading-relaxed">
                ⏸️ {entity.trading_suspension_reason}
              </div>
            )}
            {entity.offering_suspended && (
              <div className="flex justify-between">
                <span className="text-neutral-500">الحصص المتبقية</span>
                <Badge label="شراء معلق" color="yellow" />
              </div>
            )}
            {entity.offering_suspended && entity.offering_suspension_reason && (
              <div className="text-[10px] text-yellow-400/80 bg-yellow-400/[0.06] border border-yellow-400/[0.15] rounded-lg px-2.5 py-1.5 leading-relaxed">
                🔒 {entity.offering_suspension_reason}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-500">حصص قابلة للتداول</span>
              <span className="text-white font-mono">
                {fmtNum(wallet?.offering_available ?? entity.available_shares)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">القيمة السوقية</span>
              <span className="text-yellow-400 font-mono font-bold">
                {fmtNum(Math.round(
                  (prices?.market_price ?? entity.share_price) * entity.total_shares
                ))} د.ع
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
        >
          العودة للقائمة
        </button>
        <ActionBtn label="✏️ تعديل البيانات" color="blue" onClick={onEdit} />
      </div>
    </div>
  )
}
