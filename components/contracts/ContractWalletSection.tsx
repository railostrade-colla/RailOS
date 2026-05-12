"use client"

/**
 * ContractWalletSection — Phase 13.71.
 *
 * Embedded inside /contracts/[id] as a "💼 محفظة العقد" card.
 * Two tabs:
 *   • نظرة عامة  — wallet aggregates + per-source breakdown
 *   • النشاطات   — newest 100 events on this contract
 *
 * Realtime: parent page already subscribes to contract_activities
 * (via the realtime publication enabled in this phase), so a
 * passthrough `reload` lets the section refresh in place.
 */

import { useEffect, useState, useCallback } from "react"
import {
  Wallet, Activity, RefreshCw, Banknote, Users as UsersIcon,
  TrendingUp, Package, Gavel, Zap, Building2, ArrowLeftRight,
  Sparkles, Settings as SettingsIcon, CheckCircle2, XCircle,
  AlertTriangle, FilePlus,
} from "lucide-react"
import {
  getContractWallet,
  EMPTY_CONTRACT_WALLET,
  type ContractWallet,
  type ContractActivity,
  type ContractActivityType,
  type ContractActivitySource,
} from "@/lib/data/contract-wallet"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"

const fmtIqd = (n: number | null) =>
  Math.round(n ?? 0).toLocaleString("en-US")
const fmtCompactIqd = (n: number | null): string => {
  const v = n ?? 0
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B"
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K"
  return Math.round(v).toLocaleString("en-US")
}

const fmtRelative = (s: string): string => {
  if (!s) return ""
  try {
    const diff = Date.now() - new Date(s).getTime()
    if (diff < 60_000) return "الآن"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} دقيقة`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ساعة`
    if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} يوم`
    return new Date(s).toLocaleDateString("en-GB")
  } catch { return s }
}

const ACTIVITY_META: Record<ContractActivityType, { label: string; Icon: typeof FilePlus; tone: string }> = {
  contract_created:    { label: "أُنشئ العقد",            Icon: FilePlus,       tone: "text-blue-400" },
  member_invited:      { label: "دعوة شريك",              Icon: UsersIcon,      tone: "text-yellow-400" },
  member_accepted:     { label: "موافقة شريك",            Icon: CheckCircle2,   tone: "text-green-400" },
  member_declined:     { label: "رفض شريك",               Icon: XCircle,        tone: "text-red-400" },
  member_removed:      { label: "إزالة شريك",             Icon: AlertTriangle,  tone: "text-orange-400" },
  contract_activated:  { label: "تفعيل العقد",            Icon: Sparkles,       tone: "text-[#4ADE80]" },
  contract_ended:      { label: "إنهاء العقد",            Icon: CheckCircle2,   tone: "text-neutral-300" },
  contract_cancelled:  { label: "إلغاء العقد",            Icon: XCircle,        tone: "text-red-400" },
  investment_recorded: { label: "استثمار جديد",           Icon: Banknote,       tone: "text-emerald-400" },
  share_purchased:     { label: "شراء حصص",               Icon: TrendingUp,     tone: "text-blue-400" },
  share_sold:          { label: "بيع حصص",                Icon: TrendingUp,     tone: "text-red-400" },
  distribution_paid:   { label: "توزيع أرباح",            Icon: Banknote,       tone: "text-purple-400" },
}

const SOURCE_META: Record<ContractActivitySource, { label: string; Icon: typeof Package; tone: string }> = {
  auction:    { label: "مزاد",         Icon: Gavel,           tone: "text-orange-400" },
  quick_sale: { label: "بيع سريع",     Icon: Zap,             tone: "text-yellow-400" },
  direct_buy: { label: "شراء مباشر",   Icon: Building2,       tone: "text-blue-400" },
  exchange:   { label: "تبادل",        Icon: ArrowLeftRight,  tone: "text-purple-400" },
  deal:       { label: "صفقة",         Icon: Package,         tone: "text-cyan-400" },
  admin:      { label: "إدارة",        Icon: SettingsIcon,    tone: "text-neutral-400" },
  manual:     { label: "تسجيل يدوي",   Icon: FilePlus,        tone: "text-neutral-400" },
  system:     { label: "نظام",         Icon: SettingsIcon,    tone: "text-neutral-500" },
}

interface Props {
  contractId: string
}

export function ContractWalletSection({ contractId }: Props) {
  const [data, setData] = useState<ContractWallet>(EMPTY_CONTRACT_WALLET)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"overview" | "activities">("overview")

  const reload = useCallback(() => {
    setLoading(true)
    getContractWallet(contractId).then((r) => {
      setData(r)
      setLoading(false)
    })
  }, [contractId])

  useEffect(() => {
    if (!contractId) return
    reload()

    // Realtime — refresh on every new activity / member / status change.
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const debouncedReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => reload(), 250)
    }
    const channel = supabase
      .channel(`wallet:${contractId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_activities", filter: `contract_id=eq.${contractId}` },
        () => debouncedReload(),
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [contractId, reload])

  const { wallet, sources, activities } = data
  const fundedPct = wallet.planned_investment > 0
    ? Math.min(100, Math.round((wallet.invested_iqd / wallet.planned_investment) * 100))
    : 0

  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#4ADE80]/[0.12] border border-[#4ADE80]/[0.3] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-4 h-4 text-[#4ADE80]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">💼 محفظة العقد</div>
            <div className="text-[10px] text-neutral-500">الاستثمارات والنشاطات داخل هذا العقد</div>
          </div>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} strokeWidth={2} />
          تحديث
        </button>
      </div>

      {/* Error */}
      {!loading && !data.success && (
        <div className="bg-amber-400/[0.06] border border-amber-400/[0.2] rounded-xl p-3 text-xs text-amber-300">
          ⚠ تعذّر قراءة بيانات المحفظة
          {data.error ? <span className="block mt-1 font-mono text-[10px] text-amber-200" dir="ltr">{data.error}</span> : null}
          <span className="block mt-1 text-[11px] text-amber-200/80">طبّق migration <code>20260512_phase13_71</code></span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 mb-4 max-w-md">
        <button
          onClick={() => setTab("overview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors",
            tab === "overview"
              ? "bg-white/[0.1] text-white"
              : "text-neutral-400 hover:text-white",
          )}
        >
          <Wallet className="w-3 h-3" strokeWidth={2} />
          نظرة عامة
        </button>
        <button
          onClick={() => setTab("activities")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors",
            tab === "activities"
              ? "bg-white/[0.1] text-white"
              : "text-neutral-400 hover:text-white",
          )}
        >
          <Activity className="w-3 h-3" strokeWidth={2} />
          النشاطات ({activities.length})
        </button>
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiTile
              icon={<Banknote className="w-3 h-3 text-emerald-400" />}
              label="استُثمر"
              value={fmtCompactIqd(wallet.invested_iqd)}
              unit="IQD"
            />
            <KpiTile
              icon={<Package className="w-3 h-3 text-blue-400" />}
              label="حصص محفوظة"
              value={(wallet.shares_count ?? 0).toLocaleString("en-US")}
            />
            <KpiTile
              icon={<UsersIcon className="w-3 h-3 text-purple-400" />}
              label="شركاء فعّالون"
              value={(wallet.members_count ?? 0).toLocaleString("en-US")}
            />
            <KpiTile
              icon={<TrendingUp className="w-3 h-3 text-[#4ADE80]" />}
              label="مخطّط"
              value={fmtCompactIqd(wallet.planned_investment)}
              unit="IQD"
            />
          </div>

          {/* Funding progress */}
          {wallet.planned_investment > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-neutral-400">نسبة التمويل</span>
                <span className="text-xs font-mono font-bold text-[#4ADE80]">
                  {fundedPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full bg-[#4ADE80] transition-all"
                  style={{ width: `${fundedPct}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                المتبقّي: <span className="font-mono text-amber-300">{fmtIqd(wallet.remaining_to_invest)} IQD</span>
              </div>
            </div>
          )}

          {/* Source breakdown */}
          <div>
            <div className="text-xs font-bold text-white mb-2">📊 الحصص حسب المصدر</div>
            {Object.keys(sources).length === 0 ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <div className="text-[11px] text-neutral-500">
                  لم تُسجَّل عمليّات شراء بعد. ستظهر هنا الحصص المشتراة من المزاد، البيع السريع، الشراء المباشر، أو التبادل.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(sources).map(([src, e]) => {
                  const meta = SOURCE_META[src as ContractActivitySource] ?? SOURCE_META.system
                  const Icon = meta.Icon
                  return (
                    <div key={src} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={cn("w-3.5 h-3.5", meta.tone)} strokeWidth={2} />
                        <span className="text-xs font-bold text-white">{meta.label}</span>
                        <span className="text-[10px] text-neutral-500 mr-auto">×{e.count}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[9px] text-neutral-500">إجمالي القيمة</div>
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            {fmtCompactIqd(e.total_amount)} <span className="text-[8px] text-neutral-500">IQD</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-neutral-500">إجمالي الحصص</div>
                          <div className="text-xs font-mono font-bold text-blue-400">
                            {(e.total_shares ?? 0).toLocaleString("en-US")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "activities" && (
        <div className="space-y-2">
          {activities.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center">
              <Activity className="w-8 h-8 text-neutral-600 mx-auto mb-2" strokeWidth={1.5} />
              <div className="text-xs text-neutral-500">لا توجد نشاطات بعد</div>
            </div>
          ) : (
            activities.map((a) => <ActivityRow key={a.id} a={a} />)
          )}
        </div>
      )}
    </div>
  )
}

function KpiTile({ icon, label, value, unit }: {
  icon: React.ReactNode; label: string; value: string; unit?: string
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-neutral-500">{label}</span>
      </div>
      <div className="text-sm font-bold text-white font-mono leading-tight">
        {value}
        {unit && <span className="text-[9px] text-neutral-500 font-sans"> {unit}</span>}
      </div>
    </div>
  )
}

function ActivityRow({ a }: { a: ContractActivity }) {
  const meta = ACTIVITY_META[a.activity_type] ?? ACTIVITY_META.contract_created
  const Icon = meta.Icon
  const srcMeta = a.source_type ? SOURCE_META[a.source_type] : null
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-start gap-3">
      <div className={cn(
        "w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0",
      )}>
        <Icon className={cn("w-4 h-4", meta.tone)} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-bold text-white">{meta.label}</span>
          {srcMeta && (
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded border bg-white/[0.04] border-white/[0.08]",
              srcMeta.tone,
            )}>
              {srcMeta.label}
            </span>
          )}
          <span className="text-[10px] text-neutral-500 mr-auto">{fmtRelative(a.created_at)}</span>
        </div>
        <div className="text-[11px] text-neutral-300 leading-snug">
          {a.actor_name && (
            <span className="text-neutral-400">بواسطة: <span className="text-white font-bold">{a.actor_name}</span></span>
          )}
          {a.amount_iqd != null && a.amount_iqd > 0 && (
            <span> · <span className="font-mono text-emerald-400">{fmtIqd(a.amount_iqd)} IQD</span></span>
          )}
          {a.shares_count != null && a.shares_count > 0 && (
            <span> · <span className="font-mono text-blue-400">{(a.shares_count ?? 0).toLocaleString("en-US")} حصّة</span></span>
          )}
        </div>
        {/* Metadata extras */}
        {Boolean(a.metadata && Object.keys(a.metadata).length > 0) && (
          <div className="text-[10px] text-neutral-500 mt-1 leading-snug">
            {renderMetadataNote(a)}
          </div>
        )}
      </div>
    </div>
  )
}

function renderMetadataNote(a: ContractActivity): React.ReactNode {
  const m = a.metadata as Record<string, unknown>
  if (a.activity_type === "member_invited" && typeof m.share_percent === "number") {
    return <>حصّة مقترَحة: <span className="font-mono text-yellow-400">{(m.share_percent as number).toFixed(1)}%</span></>
  }
  if (a.activity_type === "member_declined" && typeof m.decline_reason === "string" && m.decline_reason) {
    return <>السبب: {m.decline_reason}</>
  }
  if (a.activity_type === "contract_cancelled" && typeof m.reason === "string" && m.reason) {
    return <>السبب: {m.reason}</>
  }
  return null
}
