"use client"

import { useState } from "react"
import { AlertTriangle, Save, X } from "lucide-react"
import { ActionBtn, KPI } from "@/components/admin/ui"
import {
  LEVEL_SETTINGS_STORE,
  type LevelSetting,
  type LevelId,
} from "@/lib/mock-data/levels"
import { updateLevelSettings } from "@/lib/data/levels"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function LevelSettingsPanel() {
  // Local state — يبدأ بنسخة من LEVEL_SETTINGS_STORE
  const [settings, setSettings] = useState<LevelSetting[]>(() =>
    LEVEL_SETTINGS_STORE.map((l) => ({ ...l }))
  )
  const [showConfirm, setShowConfirm] = useState(false)

  const updateField = <K extends keyof LevelSetting>(
    levelId: LevelId,
    field: K,
    value: LevelSetting[K]
  ) => {
    setSettings((prev) =>
      prev.map((l) => (l.level === levelId ? { ...l, [field]: value } : l))
    )
  }

  const handleSave = () => {
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    updateLevelSettings(settings)
    setShowConfirm(false)
    showSuccess("✅ تم تحديث إعدادات المستويات — ستُطبَّق على الفحص التلقائي القادم")
  }

  const handleReset = () => {
    setSettings(LEVEL_SETTINGS_STORE.map((l) => ({ ...l })))
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      {/* Header */}
      <div className="mb-5">
        <div className="text-lg font-bold text-white">⚙️ إعدادات المستويات</div>
        <div className="text-xs text-neutral-500 mt-0.5">
          تحديد شروط الترقية والتنزيل التلقائي + المزايا لكل مستوى
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-400/[0.06] border border-yellow-400/[0.25] rounded-xl p-3.5 mb-5 flex gap-3 items-start">
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
        <div className="text-[11px] text-yellow-300 leading-relaxed">
          <span className="font-bold">تنبيه:</span> التغييرات تُطبَّق على جميع المستخدمين في فحص
          الترقية التالي. قد يؤدّي ذلك لترقية أو تنزيل عدد كبير من الحسابات. تأكّد من المعايير قبل
          الحفظ.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {settings.map((l) => (
          <KPI
            key={l.level}
            label={`${l.icon} ${l.display_name_ar}`}
            val={fmtNum(l.monthly_trade_limit)}
            color={l.color}
          />
        ))}
      </div>

      {/* Editable cards (one per level) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {settings.map((l) => (
          <div
            key={l.level}
            className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5"
            style={{ borderColor: `${l.color}33` }}
          >
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
              <span className="text-2xl">{l.icon}</span>
              <div>
                <div className="text-base font-bold text-white">{l.display_name_ar}</div>
                <div className="text-[10px] text-neutral-500 font-mono">level: {l.level}</div>
              </div>
              <div
                className="mr-auto w-3 h-3 rounded-full"
                style={{ backgroundColor: l.color }}
              />
            </div>

            {/* الشروط الأساسية */}
            <div className="text-[11px] font-bold text-neutral-400 mb-2">📊 شروط التداول</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <NumberField
                label="حجم تداول (د.ع)"
                value={l.min_volume}
                onChange={(v) => updateField(l.level, "min_volume", v)}
              />
              <NumberField
                label="عدد الصفقات"
                value={l.min_total_trades}
                onChange={(v) => updateField(l.level, "min_total_trades", v)}
              />
              <NumberField
                label="معدل النجاح %"
                value={l.min_success_rate}
                onChange={(v) => updateField(l.level, "min_success_rate", v)}
                max={100}
              />
              <NumberField
                label="أيام النشاط"
                value={l.min_days_active}
                onChange={(v) => updateField(l.level, "min_days_active", v)}
              />
            </div>

            {/* النزاعات + البلاغات */}
            <div className="text-[11px] font-bold text-neutral-400 mb-2">⚖️ النزاعات والبلاغات</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <NumberField
                label="أقصى نزاعات خاسرة"
                value={l.max_disputes_lost}
                onChange={(v) => updateField(l.level, "max_disputes_lost", v)}
              />
              <NumberField
                label="أقصى بلاغات"
                value={l.max_reports_received}
                onChange={(v) => updateField(l.level, "max_reports_received", v)}
              />
              <NumberField
                label="أقصى نزاعات %"
                value={l.max_dispute_rate}
                onChange={(v) => updateField(l.level, "max_dispute_rate", v)}
                max={100}
              />
              <NumberField
                label="أدنى تقييم (0-5)"
                value={l.min_rating}
                onChange={(v) => updateField(l.level, "min_rating", v)}
                max={5}
                step={0.1}
              />
            </div>

            {/* المزايا */}
            <div className="text-[11px] font-bold text-neutral-400 mb-2">🎁 المزايا</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <NumberField
                label="حد التداول الشهري (د.ع)"
                value={l.monthly_trade_limit}
                onChange={(v) => updateField(l.level, "monthly_trade_limit", v)}
              />
              <div>
                <label className="text-[10px] text-neutral-500 mb-1 block">KYC المطلوب</label>
                <select
                  value={l.required_kyc}
                  onChange={(e) =>
                    updateField(l.level, "required_kyc", e.target.value as LevelSetting["required_kyc"])
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/20"
                >
                  <option value="basic">أساسي</option>
                  <option value="advanced">متقدّم</option>
                  <option value="pro">محترف</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleReset}
          className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
        >
          🔄 استعادة الافتراضي
        </button>
        <ActionBtn
          label="💾 حفظ كل المستويات"
          color="green"
          onClick={handleSave}
        />
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" strokeWidth={2} />
                <div className="text-base font-bold text-white">تأكيد التحديث</div>
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-neutral-300 leading-relaxed mb-4">
              هل أنت متأكّد من تطبيق هذه التغييرات؟
              <br />
              <span className="text-yellow-400 font-bold">
                ستُطبَّق على جميع المستخدمين في فحص الترقية التالي.
              </span>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 text-[11px] text-neutral-400 leading-relaxed">
              قد يؤدي ذلك لترقية مستخدمين كانوا أدنى من الشروط، أو تنزيل من لم يعودوا يستوفون
              الشروط. التغيير قابل للتراجع بحفظ القيم القديمة.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2] flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                تأكيد الحفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-component: NumberField
// ──────────────────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  max,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  max?: number
  step?: number
}) {
  return (
    <div>
      <label className="text-[10px] text-neutral-500 mb-1 block">{label}</label>
      <input
        type="number"
        value={value}
        min={0}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
        className={cn(
          "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-white/20"
        )}
      />
    </div>
  )
}
