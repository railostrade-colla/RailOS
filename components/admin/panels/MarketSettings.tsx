"use client"

import { useState } from "react"
import { Save, Lock } from "lucide-react"
import { SectionHeader, KPI } from "@/components/admin/ui"
import { mockMarketSettings } from "@/lib/admin/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

export function MarketSettingsAdvancedPanel() {
  const [settings, setSettings] = useState(mockMarketSettings)
  const [saving, setSaving] = useState(false)

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={cn("relative w-12 h-6 rounded-full transition-colors", checked ? "bg-green-400" : "bg-white/[0.15]")}
    >
      <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all", checked ? "right-0.5" : "right-6")} />
    </button>
  )

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      showSuccess("تم حفظ إعدادات السوق المتقدمة")
      setSaving(false)
    }, 800)
  }

  return (
    <div className="p-6 max-w-4xl">
      <SectionHeader
        title="⚙️ إعدادات السوق المتقدمة"
        subtitle="التحكم الكامل في سلوك السوق والميزات والحدود"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-neutral-100 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        }
      />

      <div className="space-y-5">

        {/* Market State Toggles */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">🌐 حالة السوق العامة</div>
          <div className="space-y-3">
            {[
              { key: "market_open" as const, label: "السوق مفتوح", desc: "السماح بفتح صفقات جديدة" },
              { key: "auctions_enabled" as const, label: "المزادات مفعّلة", desc: "السماح بإنشاء مزادات جديدة" },
              { key: "quick_sell_enabled" as const, label: "البيع السريع", desc: "خصم 15% + بيع فوري" },
              { key: "direct_buy_enabled" as const, label: "الشراء المباشر", desc: "السماح بطلبات الشراء المباشرة" },
              { key: "contracts_enabled" as const, label: "العقود", desc: "السماح بإنشاء عقود شراكة" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{item.label}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{item.desc}</div>
                </div>
                <Toggle checked={settings[item.key]} onChange={(v) => setSettings({ ...settings, [item.key]: v })} />
              </div>
            ))}
          </div>
        </div>

        {/* Trading Hours */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">⏰ ساعات التداول</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">بداية التداول</label>
              <input
                type="time"
                value={settings.trading_hours_start}
                onChange={(e) => setSettings({ ...settings, trading_hours_start: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">نهاية التداول</label>
              <input
                type="time"
                value={settings.trading_hours_end}
                onChange={(e) => setSettings({ ...settings, trading_hours_end: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-mono"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Deal Settings */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">🤝 إعدادات الصفقات</div>
          <div className="space-y-3">
            {[
              { key: "deal_duration_minutes" as const, label: "مدة الصفقة (دقائق)", min: 5, max: 60, suffix: "دقيقة" },
              { key: "auction_min_duration_hours" as const, label: "أقل مدة مزاد (ساعات)", min: 1, max: 24, suffix: "ساعة" },
              { key: "auction_max_duration_hours" as const, label: "أقصى مدة مزاد (ساعات)", min: 24, max: 168, suffix: "ساعة" },
              { key: "max_daily_trades" as const, label: "أقصى صفقات يومية للمستخدم", min: 5, max: 100, suffix: "صفقة" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{item.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    value={settings[item.key]}
                    onChange={(e) => setSettings({ ...settings, [item.key]: parseInt(e.target.value) || 0 })}
                    className="w-24 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                  />
                  <span className="text-xs text-neutral-400 w-14">{item.suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Limits */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">💰 حدود الصفقات</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">أقل قيمة صفقة (د.ع)</label>
              <input
                type="number"
                min="1000"
                value={settings.min_trade_value}
                onChange={(e) => setSettings({ ...settings, min_trade_value: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-mono text-center"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block font-bold">أقصى قيمة صفقة (د.ع)</label>
              <input
                type="number"
                min="1000000"
                value={settings.max_trade_value}
                onChange={(e) => setSettings({ ...settings, max_trade_value: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 font-mono text-center"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Bonuses + KYC */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="text-sm font-bold text-white mb-4">🎁 المكافآت والتوثيق</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">مكافأة الترحيب</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">وحدات مجانية للمستخدم الجديد</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={settings.welcome_bonus}
                  onChange={(e) => setSettings({ ...settings, welcome_bonus: parseInt(e.target.value) || 0 })}
                  className="w-24 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                />
                <span className="text-xs text-neutral-400 w-12">وحدة</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">عمولة السفير</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">نسبة من أول استثمار للمحال</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  value={settings.referral_bonus_percent}
                  onChange={(e) => setSettings({ ...settings, referral_bonus_percent: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                />
                <span className="text-xs text-neutral-400 w-12">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">إلزامية KYC للترقية لـ Pro</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">يجب توثيق الهوية قبل الترقية</div>
              </div>
              <Toggle checked={settings.min_kyc_for_pro} onChange={(v) => setSettings({ ...settings, min_kyc_for_pro: v })} />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">قبول KYC تلقائي</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">قبول الطلبات بدون مراجعة (غير مستحسن)</div>
              </div>
              <Toggle checked={settings.auto_approve_kyc} onChange={(v) => setSettings({ ...settings, auto_approve_kyc: v })} />
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded-xl p-4 flex gap-3 items-start">
          <Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-xs text-neutral-300 leading-relaxed">
            <span className="text-yellow-400 font-bold">تنبيه: </span>
            تغيير هذه الإعدادات يؤثر فوراً على جميع المستخدمين. تأكد من فهمك للتأثيرات قبل الحفظ.
          </div>
        </div>

      </div>
    </div>
  )
}
