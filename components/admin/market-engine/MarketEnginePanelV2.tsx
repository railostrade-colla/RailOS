"use client"

/**
 * MarketEnginePanelV2 — Phase 13.47.
 *
 * The single, canonical place for the founder to control how
 * project share prices move. Two top sections:
 *
 *   1. هل يتحرّك السعر تلقائياً مع كل صفقة؟
 *      → ON/OFF toggle + foundational gates (daily cap %, cooldown,
 *        minimum deals threshold) + two new "rise unlock" conditions
 *        (مشاركة المستخدمين، توازن العرض/الطلب) + Market Watch
 *        advisor card showing live progress + recommendations.
 *
 *   2. هل أريد تعديل السعر الآن يدوياً؟
 *      → existing RaiseMarketPricePanel (admin_force_market_rise).
 *
 * Phase 13.47 — added participation + supply/demand conditions
 * with proportional rise (progress × max_rise_pct) and a strategic
 * advisor card driven by get_market_watch_advice() RPC.
 */

import { useEffect, useState, useCallback } from "react"
import {
  Power, Settings as SettingsIcon, TrendingUp, Save,
  Users, Scale, Eye, RefreshCw,
} from "lucide-react"
import { SectionHeader } from "@/components/admin/ui"
import { RaiseMarketPricePanel } from "@/components/admin/market-engine/RaiseMarketPricePanel"
import { StrategicAdvisorCard } from "@/components/admin/StrategicAdvisorCard"
import {
  getMarketEngineConfig,
  setMarketEngineState,
  getMarketWatchAdvice,
  type MarketEngineConfig,
  type MarketWatchAdvice,
} from "@/lib/data/market-engine-config"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type Section = "dynamic" | "manual"

export function MarketEnginePanelV2() {
  const [section, setSection] = useState<Section>("dynamic")

  return (
    <div className="space-y-4">
      <SectionHeader
        title="⚙️ محرّك التسعير"
        subtitle="مكان واحد للتحكّم بكل ما يخصّ سعر السوق — تلقائي ويدوي"
      />

      {/* Section pills */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 max-w-md">
        <SectionPill
          icon={<Power className="w-3.5 h-3.5" />}
          label="🔄 الحركة الديناميكيّة"
          active={section === "dynamic"}
          onClick={() => setSection("dynamic")}
        />
        <SectionPill
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="📈 رفع يدوي"
          active={section === "manual"}
          onClick={() => setSection("manual")}
        />
      </div>

      {section === "dynamic" && <DynamicSection />}
      {section === "manual" && <ManualSection />}
    </div>
  )
}

// ─── Sub-component: dynamic mode ──────────────────────────────────
function DynamicSection() {
  const [cfg, setCfg] = useState<MarketEngineConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local form draft (separate from `cfg` so unsaved edits don't
  // mutate the canonical state).
  const [enabled, setEnabled] = useState(true)
  const [dailyCap, setDailyCap] = useState("10")
  const [cooldownMin, setCooldownMin] = useState("0")
  const [minDeals, setMinDeals] = useState("0")
  // Phase 13.47 — two new conditions
  const [partRequiredPct, setPartRequiredPct] = useState("30")
  const [partMaxRisePct, setPartMaxRisePct] = useState("1.5")
  const [sdTargetPct, setSdTargetPct] = useState("40")
  const [sdMaxRisePct, setSdMaxRisePct] = useState("1.5")

  // Market Watch advisor state
  const [advice, setAdvice] = useState<MarketWatchAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(true)

  const reloadAdvice = useCallback(() => {
    setAdviceLoading(true)
    getMarketWatchAdvice().then((a) => {
      setAdvice(a)
      setAdviceLoading(false)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    getMarketEngineConfig().then((c) => {
      if (cancelled) return
      setCfg(c)
      setEnabled(c.enabled)
      setDailyCap(String(c.daily_pct_cap))
      setCooldownMin(String(c.cooldown_minutes))
      setMinDeals(String(c.min_deals_threshold))
      setPartRequiredPct(String(c.user_participation_required_pct))
      setPartMaxRisePct(String(c.participation_max_rise_pct))
      setSdTargetPct(String(c.supply_demand_balance_target_pct))
      setSdMaxRisePct(String(c.supply_demand_max_rise_pct))
      setLoading(false)
    })
    reloadAdvice()
    return () => { cancelled = true }
  }, [reloadAdvice])

  const dirty = !cfg
    ? false
    : (enabled !== cfg.enabled
       || Number(dailyCap) !== cfg.daily_pct_cap
       || Number(cooldownMin) !== cfg.cooldown_minutes
       || Number(minDeals) !== cfg.min_deals_threshold
       || Number(partRequiredPct) !== cfg.user_participation_required_pct
       || Number(partMaxRisePct) !== cfg.participation_max_rise_pct
       || Number(sdTargetPct) !== cfg.supply_demand_balance_target_pct
       || Number(sdMaxRisePct) !== cfg.supply_demand_max_rise_pct)

  const handleSave = async () => {
    const cap = Number(dailyCap)
    const cd = Number(cooldownMin)
    const md = Number(minDeals)
    const pr = Number(partRequiredPct)
    const pm = Number(partMaxRisePct)
    const st = Number(sdTargetPct)
    const sm = Number(sdMaxRisePct)
    if (!Number.isFinite(cap) || cap <= 0 || cap > 100) {
      return showError("السقف اليومي يجب أن يكون بين 0 و 100")
    }
    if (!Number.isFinite(cd) || cd < 0) {
      return showError("مدة التهدئة لا يمكن أن تكون سالبة")
    }
    if (!Number.isFinite(md) || md < 0) {
      return showError("الحد الأدنى للصفقات لا يمكن أن يكون سالباً")
    }
    if (!Number.isFinite(pr) || pr <= 0 || pr > 100) {
      return showError("نسبة المشاركة المطلوبة يجب أن تكون بين 0 و 100")
    }
    if (!Number.isFinite(pm) || pm < 0 || pm > 100) {
      return showError("ارتفاع المشاركة الأقصى يجب أن يكون بين 0 و 100")
    }
    if (!Number.isFinite(st) || st <= 0 || st > 200) {
      return showError("هدف توازن العرض/الطلب يجب أن يكون بين 0 و 200")
    }
    if (!Number.isFinite(sm) || sm < 0 || sm > 100) {
      return showError("ارتفاع توازن العرض/الطلب الأقصى يجب أن يكون بين 0 و 100")
    }
    setSaving(true)
    const r = await setMarketEngineState({
      enabled,
      daily_pct_cap: cap,
      cooldown_minutes: cd,
      min_deals_threshold: md,
      user_participation_required_pct: pr,
      participation_max_rise_pct: pm,
      supply_demand_balance_target_pct: st,
      supply_demand_max_rise_pct: sm,
    })
    setSaving(false)
    if (!r.success) return showError(r.error ?? "فشل الحفظ")
    showSuccess("✅ تم حفظ إعدادات المحرّك")
    // Refresh canonical state + advisor.
    const fresh = await getMarketEngineConfig()
    setCfg(fresh)
    reloadAdvice()
  }

  if (loading) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
        <div className="text-xs text-neutral-500 animate-pulse">جاري تحميل الإعدادات...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Master toggle */}
      <div
        className={cn(
          "border-2 rounded-2xl p-5 transition-colors",
          enabled
            ? "bg-[#deff9a]/[0.04] border-[#deff9a]/30"
            : "bg-white/[0.03] border-white/[0.08]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Power
                className={cn("w-4 h-4", enabled ? "text-[#deff9a]" : "text-neutral-500")}
                strokeWidth={2}
              />
              <div className="text-sm font-bold text-white">
                {enabled ? "🟢 الحركة الديناميكيّة مُفعَّلة" : "⛔ الحركة الديناميكيّة متوقّفة"}
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              {enabled
                ? "السعر يتبع كلّ صفقة مكتملة وفق الشروط أدناه."
                : "السعر لا يتغيّر تلقائياً. لرفع السعر استعمل تبويب 'رفع يدوي'."}
            </p>
          </div>
          {/* Toggle button */}
          <button
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors flex-shrink-0",
              enabled ? "bg-[#deff9a]" : "bg-white/[0.1]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-6 h-6 rounded-full transition-all shadow-md",
                enabled ? "right-0.5 bg-black" : "right-7 bg-neutral-400",
              )}
            />
          </button>
        </div>
      </div>

      {/* Phase 13.56 — strategic advisor (full mode: snapshot + unlocks
          + prioritised advice). Replaces the standalone Market Watch
          card; the legacy MarketWatchCard sub-component below is kept
          for the lightweight progress preview inside the conditions
          block. */}
      <StrategicAdvisorCard variant="full" />

      {/* Market Watch advisor (legacy small preview) */}
      <MarketWatchCard
        advice={advice}
        loading={adviceLoading}
        onRefresh={reloadAdvice}
      />

      {/* Foundational gates */}
      <div
        className={cn(
          "bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4",
          !enabled && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-neutral-300" strokeWidth={2} />
          <div className="text-sm font-bold text-white">شروط أساسيّة</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ConditionInput
            label="السقف اليومي"
            unit="%"
            hint="أقصى نسبة تغيّر يومياً (في أي اتجاه)"
            value={dailyCap}
            onChange={setDailyCap}
            min={0}
            max={100}
            step="0.1"
          />
          <ConditionInput
            label="مهلة التهدئة"
            unit="دقيقة"
            hint="أقل فاصل زمني بين تحديثَين"
            value={cooldownMin}
            onChange={setCooldownMin}
            min={0}
            max={1440}
          />
          <ConditionInput
            label="حدّ أدنى للصفقات"
            unit="صفقة/يوم"
            hint="عدد صفقات اليوم قبل احتساب التغيّر"
            value={minDeals}
            onChange={setMinDeals}
            min={0}
            max={1000}
          />
        </div>
      </div>

      {/* Phase 13.47 — Rise unlock conditions */}
      <div
        className={cn(
          "bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4",
          !enabled && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#deff9a]" strokeWidth={2} />
            <div className="text-sm font-bold text-white">شروط فتح الارتفاع</div>
          </div>
          <span className="text-[10px] text-neutral-500">
            الارتفاع المطبَّق = (تقدّم الشرط × ارتفاع الشرط) لكلّ شرط، مجموعاً ومحدوداً بالسقف اليومي.
          </span>
        </div>

        {/* Condition 1 — User participation */}
        <ConditionGroup
          icon={<Users className="w-4 h-4 text-blue-400" strokeWidth={2} />}
          title="مشاركة المستخدمين"
          subtitle="يجب أن يكمل X% من إجمالي المستخدمين صفقة على الأقل لفتح الارتفاع كاملاً."
          progress={advice?.progress.participation_progress ?? 0}
          progressLabel={
            advice
              ? `${advice.progress.dealing_users} / ${advice.progress.required_dealers} متداول`
              : "—"
          }
          unlockPct={advice?.progress.participation_unlock_pct ?? 0}
          maxRisePct={Number(partMaxRisePct) || 0}
        >
          <ConditionInput
            label="نسبة المشاركة المطلوبة"
            unit="%"
            hint="مثلاً 30 = ثلث المستخدمين"
            value={partRequiredPct}
            onChange={setPartRequiredPct}
            min={1}
            max={100}
            step="0.1"
          />
          <ConditionInput
            label="ارتفاع عند 100%"
            unit="%"
            hint="الحدّ الأقصى لإسهام هذا الشرط في الارتفاع"
            value={partMaxRisePct}
            onChange={setPartMaxRisePct}
            min={0}
            max={100}
            step="0.1"
          />
        </ConditionGroup>

        {/* Condition 2 — Supply / demand balance */}
        <ConditionGroup
          icon={<Scale className="w-4 h-4 text-purple-400" strokeWidth={2} />}
          title="توازن العرض والطلب"
          subtitle="نسبة قيمة الطلبات المعلّقة إلى قيمة الصفقات المنجزة في 24 ساعة."
          progress={advice?.progress.supply_demand_progress ?? 0}
          progressLabel={
            advice
              ? `${advice.progress.demand_ratio_pct.toFixed(1)}% / ${advice.progress.demand_target_pct}%`
              : "—"
          }
          unlockPct={advice?.progress.supply_demand_unlock_pct ?? 0}
          maxRisePct={Number(sdMaxRisePct) || 0}
        >
          <ConditionInput
            label="هدف نسبة الطلب/التداول"
            unit="%"
            hint="مثلاً 40 = الطلب يساوي 40% من قيمة التداول"
            value={sdTargetPct}
            onChange={setSdTargetPct}
            min={1}
            max={200}
            step="0.1"
          />
          <ConditionInput
            label="ارتفاع عند 100%"
            unit="%"
            hint="الحدّ الأقصى لإسهام هذا الشرط في الارتفاع"
            value={sdMaxRisePct}
            onChange={setSdMaxRisePct}
            min={0}
            max={100}
            step="0.1"
          />
        </ConditionGroup>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <div className="text-[11px] text-neutral-300 leading-relaxed">
            💡 المنطق: عند اكتمال أي صفقة، الـ trigger يجمع
            (تقدّم المشاركة × ارتفاعها) + (تقدّم العرض/الطلب × ارتفاعه)
            ثم يطبّق الناتج على <span className="font-mono">projects.current_market_price</span>،
            مع احترام السقف اليومي ومهلة التهدئة والحدّ الأدنى للصفقات.
            إذا كان سعر الصفقة <b>أقل</b> من سعر السوق، يتبع المحرّك سعر الصفقة (نزولاً)
            محدوداً بالسقف اليومي.
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={cn(
            "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors",
            dirty && !saving
              ? "bg-[#deff9a] text-black hover:bg-[#c9eb78] active:scale-[0.98]"
              : "bg-white/[0.05] border border-white/[0.08] text-neutral-500 cursor-not-allowed",
          )}
        >
          <Save className="w-4 h-4" strokeWidth={2.5} />
          {saving ? "جاري الحفظ..." : dirty ? "حفظ الإعدادات" : "لا تغييرات للحفظ"}
        </button>
      </div>
    </div>
  )
}

// ─── Sub-component: manual rise ────────────────────────────────────
function ManualSection() {
  return (
    <div className="space-y-3">
      <RaiseMarketPricePanel />
    </div>
  )
}

// ─── Market Watch advisor ─────────────────────────────────────────
function MarketWatchCard({
  advice, loading, onRefresh,
}: {
  advice: MarketWatchAdvice | null
  loading: boolean
  onRefresh: () => void
}) {
  const healthStyles = (() => {
    const h = advice?.health ?? "good"
    if (h === "great") return { ring: "border-[#deff9a]/40", bg: "bg-[#deff9a]/[0.05]", icon: "text-[#deff9a]" }
    if (h === "warn")  return { ring: "border-amber-400/40", bg: "bg-amber-400/[0.05]", icon: "text-amber-400" }
    return { ring: "border-blue-400/30", bg: "bg-blue-400/[0.04]", icon: "text-blue-400" }
  })()

  return (
    <div className={cn("border-2 rounded-2xl p-5", healthStyles.ring, healthStyles.bg)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Eye className={cn("w-4 h-4", healthStyles.icon)} strokeWidth={2} />
          <div>
            <div className="text-sm font-bold text-white">🔭 مراقبة السوق</div>
            <div className="text-[11px] text-neutral-400">المرشد الاستراتيجي يقرأ التقدم الحيّ ويوصي.</div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} strokeWidth={2} />
          تحديث
        </button>
      </div>

      {loading && !advice ? (
        <div className="text-xs text-neutral-500 animate-pulse text-center py-6">
          جاري قياس نشاط السوق...
        </div>
      ) : !advice || !advice.success ? (
        <div className="text-xs text-amber-300 bg-amber-400/[0.08] border border-amber-400/[0.2] rounded-xl p-3">
          ⚠️ تعذّر قراءة بيانات السوق
          {advice?.error ? <span className="block mt-1 text-amber-200/80 font-mono text-[10px]" dir="ltr">{advice.error}</span> : null}
          <span className="block mt-1 text-amber-200/80 text-[11px]">طبّق migration <code>20260510_phase13_47</code></span>
        </div>
      ) : (
        <>
          {/* Live KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <KpiTile
              label="إجمالي المستخدمين"
              value={advice.progress.total_users.toLocaleString("en-US")}
            />
            <KpiTile
              label="متداولون"
              value={`${advice.progress.dealing_users}/${advice.progress.required_dealers}`}
            />
            <KpiTile
              label="تداول 24س"
              value={fmtMoney(advice.progress.traded_value_24h)}
            />
            <KpiTile
              label="طلب معلّق"
              value={fmtMoney(advice.progress.pending_demand_value)}
            />
          </div>

          {/* Combined unlock summary */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-neutral-400">الارتفاع المُفتَّح حالياً</div>
              <div className="text-base font-bold text-[#deff9a] font-mono">
                +{advice.progress.combined_unlock_pct.toFixed(2)}%
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 leading-snug max-w-[60%] text-left" dir="ltr">
              participation {(advice.progress.participation_unlock_pct).toFixed(2)}% +
              s/d {(advice.progress.supply_demand_unlock_pct).toFixed(2)}%
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            {advice.messages.length === 0 ? (
              <div className="text-[11px] text-neutral-500 text-center py-2">
                لا توصيات حالياً.
              </div>
            ) : advice.messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-3 border flex gap-3",
                  m.kind === "good" && "bg-[#deff9a]/[0.06] border-[#deff9a]/20",
                  m.kind === "info" && "bg-blue-400/[0.06] border-blue-400/20",
                  m.kind === "warn" && "bg-amber-400/[0.06] border-amber-400/20",
                )}
              >
                <div className="text-base flex-shrink-0">{m.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white mb-0.5">{m.title}</div>
                  <div className="text-[11px] text-neutral-300 leading-relaxed">{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className="text-sm font-bold text-white font-mono mt-0.5 truncate" dir="ltr">{value}</div>
    </div>
  )
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return n.toLocaleString("en-US")
}

// ─── helpers ──────────────────────────────────────────────────────
function SectionPill({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
        active
          ? "bg-white/[0.1] text-white"
          : "text-neutral-400 hover:text-white",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ConditionInput({
  label, unit, hint, value, onChange, min, max, step,
}: {
  label: string
  unit: string
  hint?: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step?: string
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <label className="text-[10px] text-neutral-400 font-bold block mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#deff9a]/40"
        />
        <span className="text-[10px] text-neutral-500 flex-shrink-0">{unit}</span>
      </div>
      {hint && (
        <div className="text-[10px] text-neutral-500 mt-1.5 leading-snug">{hint}</div>
      )}
    </div>
  )
}

function ConditionGroup({
  icon, title, subtitle, progress, progressLabel, unlockPct, maxRisePct, children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  progress: number          // 0..1
  progressLabel: string
  unlockPct: number
  maxRisePct: number
  children: React.ReactNode
}) {
  const pct = Math.max(0, Math.min(100, progress * 100))
  const fullyMet = pct >= 99.9
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="mt-0.5 flex-shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">{title}</div>
            <div className="text-[10px] text-neutral-400 leading-relaxed mt-0.5">{subtitle}</div>
          </div>
        </div>
        <div className="text-left flex-shrink-0" dir="ltr">
          <div className="text-[10px] text-neutral-500">unlock</div>
          <div className={cn("text-xs font-mono font-bold", fullyMet ? "text-[#deff9a]" : "text-white")}>
            +{unlockPct.toFixed(2)}% / {maxRisePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-neutral-400">التقدّم: {progressLabel}</span>
          <span className={cn("text-[10px] font-mono font-bold", fullyMet ? "text-[#deff9a]" : "text-neutral-300")}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              fullyMet ? "bg-[#deff9a]" : "bg-blue-400",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {children}
      </div>
    </div>
  )
}
