"use client"

/**
 * MarketEnginePanelV2 — Phase 13.46.
 *
 * The single, canonical place for the founder to control how
 * project share prices move. Two questions, two sections:
 *
 *   1. هل يتحرّك السعر تلقائياً مع كل صفقة؟
 *      → ON/OFF toggle + 3 conditions (daily cap %, cooldown,
 *        minimum deals threshold). Wired to market_engine_config
 *        via set_market_engine_state RPC.
 *
 *   2. هل أريد تعديل السعر الآن يدوياً؟
 *      → existing RaiseMarketPricePanel (admin_force_market_rise).
 *
 * The dynamic side reads + writes a single row (id=1) in
 * market_engine_config; the trigger on `deals` consults this row
 * before applying any auto-update, so toggling enabled=false stops
 * all dynamic price moves immediately.
 */

import { useEffect, useState } from "react"
import { Power, Settings as SettingsIcon, TrendingUp, Save } from "lucide-react"
import { SectionHeader } from "@/components/admin/ui"
import { RaiseMarketPricePanel } from "@/components/admin/market-engine/RaiseMarketPricePanel"
import {
  getMarketEngineConfig,
  setMarketEngineState,
  type MarketEngineConfig,
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

  useEffect(() => {
    let cancelled = false
    getMarketEngineConfig().then((c) => {
      if (cancelled) return
      setCfg(c)
      setEnabled(c.enabled)
      setDailyCap(String(c.daily_pct_cap))
      setCooldownMin(String(c.cooldown_minutes))
      setMinDeals(String(c.min_deals_threshold))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const dirty = !cfg
    ? false
    : (enabled !== cfg.enabled
       || Number(dailyCap) !== cfg.daily_pct_cap
       || Number(cooldownMin) !== cfg.cooldown_minutes
       || Number(minDeals) !== cfg.min_deals_threshold)

  const handleSave = async () => {
    const cap = Number(dailyCap)
    const cd = Number(cooldownMin)
    const md = Number(minDeals)
    if (!Number.isFinite(cap) || cap <= 0 || cap > 100) {
      return showError("السقف اليومي يجب أن يكون بين 0 و 100")
    }
    if (!Number.isFinite(cd) || cd < 0) {
      return showError("مدة التهدئة لا يمكن أن تكون سالبة")
    }
    if (!Number.isFinite(md) || md < 0) {
      return showError("الحد الأدنى للصفقات لا يمكن أن يكون سالباً")
    }
    setSaving(true)
    const r = await setMarketEngineState({
      enabled,
      daily_pct_cap: cap,
      cooldown_minutes: cd,
      min_deals_threshold: md,
    })
    setSaving(false)
    if (!r.success) return showError(r.error ?? "فشل الحفظ")
    showSuccess("✅ تم حفظ إعدادات المحرّك")
    // Refresh canonical state.
    const fresh = await getMarketEngineConfig()
    setCfg(fresh)
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

      {/* Conditions */}
      <div
        className={cn(
          "bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4",
          !enabled && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-neutral-300" strokeWidth={2} />
          <div className="text-sm font-bold text-white">شروط التحكّم</div>
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

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
          <div className="text-[11px] text-neutral-300 leading-relaxed">
            💡 المنطق: عند اكتمال أي صفقة، الـ trigger يقرأ هذه الإعدادات
            ويُحدِّث <span className="font-mono">projects.current_market_price</span> فقط
            لو الحركة الديناميكيّة <b>مُفعَّلة</b> + التغيير ضمن السقف +
            مرّت مهلة التهدئة + عدد صفقات اليوم بلغ الحدّ الأدنى.
            وإلّا تُتخطّى الصفقة بدون تأثير على السعر.
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
  label, unit, hint, value, onChange, min, max,
}: {
  label: string
  unit: string
  hint?: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <label className="text-[10px] text-neutral-400 font-bold block mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
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
