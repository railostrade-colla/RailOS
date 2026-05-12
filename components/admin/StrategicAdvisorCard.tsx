"use client"

/**
 * StrategicAdvisorCard — Phase 13.56.
 *
 * A reusable card that turns `get_strategic_market_advisor()` into
 * actionable intelligence for the admin. Mounted twice in the
 * admin panel:
 *   • Monitor.tsx — under 🩺 صحة السوق strip (compact mode)
 *   • MarketEnginePanelV2.tsx — Dynamic tab (full mode with
 *     snapshot KPI grid + unlock progress + recommendations)
 *
 * Auto-refreshes every 30s and exposes a manual refresh button.
 * Variant prop:
 *   • "full"    — KPIs + unlock bars + advice list (engine panel)
 *   • "compact" — just the advice list + verdict (monitor strip)
 */

import { useEffect, useState, useCallback } from "react"
import {
  RefreshCw, Users, Activity, ShieldCheck, ShoppingCart,
  Package, Banknote, TrendingUp, AlertTriangle, CheckCircle2,
  Info, Sparkles,
} from "lucide-react"
import {
  getStrategicMarketAdvisor,
  EMPTY_ADVISOR,
  type StrategicAdvisorResult,
  type AdvicePriority,
} from "@/lib/data/strategic-advisor"
import { cn } from "@/lib/utils/cn"

const REFRESH_INTERVAL_MS = 30_000

const fmtNum = (n: number): string =>
  Math.round(n || 0).toLocaleString("en-US")

const fmtCompactIqd = (n: number): string => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return Math.round(n).toLocaleString("en-US")
}

const priorityStyles: Record<AdvicePriority, { badge: string; ring: string; bg: string; iconCol: string }> = {
  critical: {
    badge: "bg-red-500/[0.15] border-red-500/[0.4] text-red-300",
    ring: "border-red-500/30", bg: "bg-red-500/[0.05]", iconCol: "text-red-300",
  },
  high: {
    badge: "bg-amber-500/[0.15] border-amber-500/[0.4] text-amber-300",
    ring: "border-amber-500/30", bg: "bg-amber-500/[0.05]", iconCol: "text-amber-300",
  },
  medium: {
    badge: "bg-blue-500/[0.12] border-blue-500/[0.35] text-blue-300",
    ring: "border-blue-500/25", bg: "bg-blue-500/[0.04]", iconCol: "text-blue-300",
  },
  good: {
    badge: "bg-[#4ADE80]/[0.15] border-[#4ADE80]/[0.4] text-[#4ADE80]",
    ring: "border-[#4ADE80]/30", bg: "bg-[#4ADE80]/[0.04]", iconCol: "text-[#4ADE80]",
  },
}

const priorityLabel: Record<AdvicePriority, string> = {
  critical: "حرج",
  high: "عاجل",
  medium: "متوسّط",
  good: "ممتاز",
}

interface Props {
  variant?: "full" | "compact"
  className?: string
}

export function StrategicAdvisorCard({ variant = "full", className }: Props) {
  const [data, setData] = useState<StrategicAdvisorResult>(EMPTY_ADVISOR)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    getStrategicMarketAdvisor().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    reload()
    const t = setInterval(reload, REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [reload])

  const healthTone =
    data.health_score >= 75 ? "text-[#4ADE80]" :
    data.health_score >= 50 ? "text-blue-400" :
    data.health_score >= 30 ? "text-amber-400" : "text-red-400"

  const verdict = (() => {
    if (!data.success) return "في انتظار البيانات…"
    if (data.health_score >= 75) return "السوق صحّي. حافظ على الإيقاع."
    if (data.health_score >= 50) return "السوق مقبول. ركّز على تحسين السيولة والتفاعل."
    if (data.health_score >= 30) return "السوق ضعيف. تحرّك في الإجراءات الحرجة الآن."
    return "السوق في حالة حرجة. تدخّل فوري مطلوب."
  })()

  // ─── Compact variant: title + verdict + advice list only ───
  if (variant === "compact") {
    return (
      <div className={cn("bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4ADE80]" strokeWidth={2} />
            <div>
              <div className="text-sm font-bold text-white">🧭 المرشد الاستراتيجي</div>
              <div className="text-[10px] text-neutral-500">{verdict}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("text-base font-bold font-mono", healthTone)}>
              {data.health_score}<span className="text-[10px] text-neutral-500">/100</span>
            </div>
            <button
              onClick={reload}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3 text-white", loading && "animate-spin")} strokeWidth={2} />
            </button>
          </div>
        </div>
        <AdviceList data={data} loading={loading} />
      </div>
    )
  }

  // ─── Full variant: snapshot + unlocks + advice ────────────
  return (
    <div className={cn("bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="w-5 h-5 text-[#4ADE80] mt-0.5" strokeWidth={2} />
          <div>
            <div className="text-sm font-bold text-white">🧭 المستشار الاقتصادي الاستراتيجي</div>
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              قراءة آنيّة للسوق + توصيات مرتَّبة حسب الأولويّة + تقدّم نحو الارتفاع التالي.
              <span className="text-neutral-500"> (تحديث كل {REFRESH_INTERVAL_MS / 1000}ث)</span>
            </div>
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

      {/* Health score banner */}
      <div className={cn(
        "border-2 rounded-xl p-4",
        data.health_score >= 75 ? "border-[#4ADE80]/40 bg-[#4ADE80]/[0.05]" :
        data.health_score >= 50 ? "border-blue-400/35 bg-blue-400/[0.05]" :
        data.health_score >= 30 ? "border-amber-400/40 bg-amber-400/[0.06]" :
                                  "border-red-400/40 bg-red-400/[0.06]",
      )}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-neutral-400 mb-0.5">حُكم المستشار</div>
            <div className="text-sm font-bold text-white leading-snug">{verdict}</div>
          </div>
          <div className="text-left flex-shrink-0">
            <div className={cn("text-3xl font-bold font-mono", healthTone)}>
              {data.health_score}
              <span className="text-sm text-neutral-500"> / 100</span>
            </div>
            <div className={cn("text-[11px] font-bold mt-0.5", healthTone)}>{data.health_label}</div>
          </div>
        </div>
      </div>

      {/* Snapshot KPI grid */}
      <div>
        <div className="text-xs font-bold text-white mb-2">📊 صورة السوق الحاليّة</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <KpiTile icon={<Users className="w-3 h-3 text-neutral-400" />} label="إجمالي المستخدمين"  value={fmtNum(data.snapshot.total_users)} />
          <KpiTile icon={<Activity className="w-3 h-3 text-emerald-400" />} label="نشط 24س"        value={fmtNum(data.snapshot.active_users_24h)} hint={`${fmtNum(data.snapshot.active_users_7d)} نشط 7 أيّام`} />
          <KpiTile icon={<ShieldCheck className="w-3 h-3 text-blue-400" />} label="موثَّقون KYC"   value={fmtNum(data.snapshot.kyc_approved)} hint={`${fmtNum(data.snapshot.kyc_pending)} بانتظار`} />
          <KpiTile icon={<Users className="w-3 h-3 text-purple-400" />} label="متداولون"          value={fmtNum(data.snapshot.dealing_users_lifetime)} hint={`${fmtNum(data.snapshot.dealing_users_7d)} هذا الأسبوع`} />
          <KpiTile icon={<TrendingUp className="w-3 h-3 text-[#4ADE80]" />} label="صفقات 24س"      value={fmtNum(data.snapshot.deals_24h)} hint={`${fmtNum(data.snapshot.deals_7d)} هذا الأسبوع`} />
          <KpiTile icon={<Banknote className="w-3 h-3 text-emerald-400" />} label="تداول 24س"      value={fmtCompactIqd(data.snapshot.traded_value_24h)} hint={`متوسّط ${fmtCompactIqd(data.snapshot.avg_deal_size)}`} unit="IQD" />
          <KpiTile icon={<ShoppingCart className="w-3 h-3 text-amber-400" />} label="طلب معلَّق" value={fmtCompactIqd(data.snapshot.open_demand_value)} hint={`${fmtNum(data.snapshot.open_demand_count)} طلب`} unit="IQD" />
          <KpiTile icon={<Package className="w-3 h-3 text-cyan-400" />} label="عرض متاح"         value={fmtCompactIqd(data.snapshot.supply_value)} hint={`${fmtNum(data.snapshot.supply_shares)} حصّة`} unit="IQD" />
        </div>
      </div>

      {/* Unlock conditions */}
      {data.unlock_conditions.length > 0 && (
        <div>
          <div className="text-xs font-bold text-white mb-2">🔓 ما يحتاجه السوق لارتفاع السعر التالي</div>
          <div className="space-y-2">
            {data.unlock_conditions.map((u) => {
              const fullyMet = u.pct_complete >= 99.9
              return (
                <div key={u.key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base flex-shrink-0">{u.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">{u.title}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {u.missing > 0 ? (
                            <>السوق يحتاج <span className="text-amber-300 font-bold font-mono">{fmtNum(u.missing)}</span> {u.unit} إضافي للوصول إلى الهدف</>
                          ) : (
                            <span className="text-[#4ADE80]">الشرط مكتمل ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className={cn(
                        "text-xs font-mono font-bold",
                        fullyMet ? "text-[#4ADE80]" : "text-white",
                      )}>
                        {fmtNum(u.current)} / {fmtNum(u.target)}
                      </div>
                      {u.unlock_rise_pct !== null && (
                        <div className="text-[10px] text-neutral-500">
                          يفتح +{u.unlock_rise_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all",
                        fullyMet ? "bg-[#4ADE80]" : "bg-blue-400")}
                      style={{ width: `${Math.min(100, u.pct_complete)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Advice */}
      <div>
        <div className="text-xs font-bold text-white mb-2">📋 خطّة العمل الموصى بها</div>
        <AdviceList data={data} loading={loading} />
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function AdviceList({ data, loading }: { data: StrategicAdvisorResult; loading: boolean }) {
  if (loading && data.advice.length === 0) {
    return <div className="text-xs text-neutral-500 text-center py-4 animate-pulse">يقرأ المرشد البيانات…</div>
  }
  if (!data.success) {
    return (
      <div className="bg-amber-400/[0.06] border border-amber-400/[0.2] rounded-xl p-3 text-xs text-amber-300">
        ⚠ تعذّر تشغيل المستشار
        {data.error ? <span className="block mt-1 font-mono text-[10px] text-amber-200" dir="ltr">{data.error}</span> : null}
        <span className="block mt-1 text-[11px] text-amber-200/80">طبّق migration <code>20260511_phase13_56</code></span>
      </div>
    )
  }
  if (data.advice.length === 0) {
    return (
      <div className="bg-[#4ADE80]/[0.06] border border-[#4ADE80]/[0.2] rounded-xl p-3 text-xs text-[#4ADE80] flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
        لا توصيات حاليّة — السوق ضمن المعايير المستهدفة.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {data.advice.map((a, i) => (
        <AdviceCard key={i} item={a} />
      ))}
    </div>
  )
}

function AdviceCard({ item }: { item: { priority: AdvicePriority; icon: string; title: string; body: string; action: string; expected_impact: string; category: string } }) {
  const s = priorityStyles[item.priority]
  return (
    <div className={cn("rounded-xl p-3 border", s.ring, s.bg)}>
      <div className="flex items-start gap-3">
        <div className="text-xl flex-shrink-0 leading-none">{item.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-white">{item.title}</span>
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", s.badge)}>
              {priorityLabel[item.priority]}
            </span>
            <span className="text-[9px] text-neutral-500">{item.category}</span>
          </div>
          <div className="text-[11px] text-neutral-300 leading-relaxed mb-1.5">
            {item.body}
          </div>
          <div className="text-[11px] text-white leading-relaxed bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 mb-1.5 flex items-start gap-1.5">
            <AlertTriangle className={cn("w-3 h-3 flex-shrink-0 mt-0.5", s.iconCol)} strokeWidth={2.5} />
            <span><b>اعمل الآن:</b> {item.action}</span>
          </div>
          <div className="text-[10px] text-neutral-400 leading-snug flex items-start gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <span><b className="text-neutral-300">الأثر المتوقَّع:</b> {item.expected_impact}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiTile({ icon, label, value, unit, hint }: {
  icon: React.ReactNode; label: string; value: string; unit?: string; hint?: string
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
      {hint && <div className="text-[9px] text-neutral-500 mt-0.5 truncate">{hint}</div>}
    </div>
  )
}
