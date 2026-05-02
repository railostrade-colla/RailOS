"use client"

import { useState } from "react"
import {
  TrendingUp,
  AlertTriangle,
  Flag,
  Star,
  Shield,
  X,
} from "lucide-react"
import { Badge, ActionBtn, KPI } from "@/components/admin/ui"
import {
  MOCK_USER_STATS,
  LEVEL_SETTINGS_STORE,
  getLevelSetting,
  getNextLevel,
  getRequirementChecklist,
  type LevelId,
} from "@/lib/mock-data/levels"
import {
  setLevelOverride,
  removeLevelOverride,
  checkAutoLevelUpgrade,
  getUserLevelHistory,
  CHANGE_TYPE_META,
} from "@/lib/data/levels"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// In a real app, this would come from URL param + Supabase fetch.
// For mock, we use MOCK_USER_STATS.
const ADMIN_ID = "founder-1"

export function UserStatsPanel() {
  const [stats, setStats] = useState(MOCK_USER_STATS)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideLevel, setOverrideLevel] = useState<LevelId>("pro")
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideLock, setOverrideLock] = useState(false)
  const [, force] = useState({})
  const refresh = () => force({})

  const levelSetting = getLevelSetting(stats.level)
  const nextLevel = getNextLevel(stats.level)
  const checklist = nextLevel ? getRequirementChecklist(stats, nextLevel.level) : []
  const history = getUserLevelHistory(stats.id, 20)

  const handleSetOverride = () => {
    const result = setLevelOverride(stats, overrideLevel, overrideReason, ADMIN_ID, overrideLock)
    if (!result.success) return showError(result.error ?? "فشل")
    setStats({ ...stats })
    setShowOverride(false)
    setOverrideReason("")
    showSuccess(`✅ تم تطبيق التجاوز اليدوي إلى ${overrideLevel}`)
  }

  const handleRemoveOverride = () => {
    removeLevelOverride(stats, ADMIN_ID)
    setStats({ ...stats })
    showSuccess("✅ تم إزالة التجاوز — العودة للحساب التلقائي")
  }

  const handleRecheck = () => {
    const result = checkAutoLevelUpgrade(stats)
    setStats({ ...stats })
    if (result.changed) {
      showSuccess(`🎉 تم ${result.type === "upgrade" ? "ترقية" : "تنزيل"} المستوى من ${result.from} إلى ${result.to}`)
    } else {
      showSuccess("ℹ️ لا تغيير — المستوى الحالي مناسب")
    }
    refresh()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      {/* Header */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{
              backgroundColor: `${levelSetting?.color ?? "#60A5FA"}1a`,
              border: `1px solid ${levelSetting?.color ?? "#60A5FA"}40`,
            }}
          >
            {levelSetting?.icon ?? "🌱"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white">{stats.display_name}</div>
            <div className="text-xs text-neutral-500" dir="ltr">{stats.email}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{
                  backgroundColor: `${levelSetting?.color}15`,
                  color: levelSetting?.color,
                  border: `1px solid ${levelSetting?.color}40`,
                }}
              >
                {levelSetting?.icon} {levelSetting?.display_name_ar}
              </span>
              {stats.level_override && (
                <Badge color="purple" label="🛡️ تجاوز يدوي" />
              )}
              {stats.level_locked && (
                <Badge color="yellow" label="🔒 مقفل" />
              )}
              <Badge color="blue" label={`KYC: ${stats.kyc_status}`} />
            </div>
          </div>
          <div className="flex gap-2">
            <ActionBtn label="🔄 إعادة فحص" color="blue" onClick={handleRecheck} />
            {stats.level_override ? (
              <ActionBtn label="إزالة التجاوز" color="red" onClick={handleRemoveOverride} />
            ) : (
              <ActionBtn label="🛡️ تجاوز يدوي" color="yellow" onClick={() => setShowOverride(true)} />
            )}
          </div>
        </div>
      </div>

      {/* Section 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI
          label="حجم التداول"
          val={`${fmtNum(stats.total_trade_volume)}`}
          color="#4ADE80"
        />
        <KPI
          label="صافي الصفقات"
          val={`${stats.total_trades}`}
          color="#60A5FA"
        />
        <KPI
          label="نسبة النزاعات"
          val={`${stats.dispute_rate}%`}
          color={stats.dispute_rate > 5 ? "#F87171" : "#FBBF24"}
        />
        <KPI
          label="التقييم"
          val={`${stats.rating_average} / 5`}
          color="#C084FC"
        />
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Card: Trading stats */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
            <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">إحصائيات التداول</div>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="حجم التداول" value={`${fmtNum(stats.total_trade_volume)} د.ع`} />
            <Row label="إجمالي الصفقات" value={fmtNum(stats.total_trades)} />
            <Row label="ناجحة" value={fmtNum(stats.successful_trades)} color="text-green-400" />
            <Row label="فاشلة" value={fmtNum(stats.failed_trades)} color="text-red-400" />
            <Row label="ملغاة" value={fmtNum(stats.cancelled_trades)} color="text-neutral-400" />
            <Row label="معدّل النجاح" value={`${stats.success_rate}%`} color={stats.success_rate >= 95 ? "text-green-400" : "text-yellow-400"} />
          </div>
        </div>

        {/* Card: Disputes */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
            <AlertTriangle className="w-4 h-4 text-yellow-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">النزاعات</div>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="إجمالي النزاعات" value={fmtNum(stats.disputes_total)} />
            <Row label="ربحها" value={fmtNum(stats.disputes_won)} color="text-green-400" />
            <Row label="خسرها" value={fmtNum(stats.disputes_lost)} color="text-red-400" />
            <Row label="نسبة النزاعات" value={`${stats.dispute_rate}%`} color={stats.dispute_rate > 5 ? "text-red-400" : "text-yellow-400"} />
          </div>
        </div>

        {/* Card: Reports */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
            <Flag className="w-4 h-4 text-red-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">البلاغات</div>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="بلاغات استلمها" value={fmtNum(stats.reports_received)} color={stats.reports_received > 0 ? "text-red-400" : "text-green-400"} />
            <Row label="بلاغات أرسلها" value={fmtNum(stats.reports_against_others)} />
          </div>
        </div>

        {/* Card: Rating + age */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
            <Star className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">التقييم والنشاط</div>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="التقييم" value={`${stats.rating_average} / 5`} color="text-purple-400" />
            <Row label="عدد التقييمات" value={fmtNum(stats.rating_count)} />
            <Row label="أيام النشاط" value={fmtNum(stats.days_active)} />
            <Row label="عمر الحساب" value={`${fmtNum(stats.account_age_days)} يوم`} />
          </div>
        </div>
      </div>

      {/* Requirements checklist */}
      {nextLevel && (
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
            <Shield className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <div className="text-sm font-bold text-white">
              متطلّبات الترقية إلى {nextLevel.icon} {nextLevel.display_name_ar}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {checklist.map((req, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border",
                  req.met
                    ? "bg-green-400/[0.04] border-green-400/[0.2]"
                    : "bg-red-400/[0.04] border-red-400/[0.2]"
                )}
              >
                <span className={cn("text-base", req.met ? "text-green-400" : "text-red-400")}>
                  {req.met ? "✓" : "✗"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-bold">{req.label}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    الحالي: <span className="font-mono text-white">{fmtNum(req.current)}</span>
                    <span className="mx-1.5">•</span>
                    {req.inverse ? "حد أقصى" : "مطلوب"}:{" "}
                    <span className="font-mono text-white">{fmtNum(req.required)}</span> {req.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level history */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
        <div className="text-sm font-bold text-white mb-3 pb-3 border-b border-white/[0.06]">
          📅 تاريخ المستويات
        </div>
        {history.length === 0 ? (
          <div className="text-xs text-neutral-500 py-4 text-center">— لا تغييرات —</div>
        ) : (
          <div className="space-y-2.5">
            {history.map((h) => {
              const meta = CHANGE_TYPE_META[h.change_type]
              return (
                <div
                  key={h.id}
                  className="flex items-start gap-3 p-3 bg-white/[0.04] border border-white/[0.06] rounded-lg"
                >
                  <div className="text-xl flex-shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge color={meta.color} label={meta.label} />
                      <span className="text-xs text-white font-bold">
                        {h.from_level ? getLevelSetting(h.from_level)?.display_name_ar : "—"}
                        {" → "}
                        {getLevelSetting(h.to_level)?.display_name_ar}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-relaxed">{h.reason}</div>
                    <div className="text-[10px] text-neutral-600 mt-1" dir="ltr">
                      {new Date(h.created_at).toLocaleString("en-GB")}
                      {h.changed_by && <span> • Admin: {h.changed_by}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-yellow-400/[0.3] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-400" />
                <div className="text-base font-bold text-white">🛡️ تجاوز يدوي</div>
              </div>
              <button onClick={() => setShowOverride(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">المستوى الجديد</label>
                <select
                  value={overrideLevel}
                  onChange={(e) => setOverrideLevel(e.target.value as LevelId)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                >
                  {LEVEL_SETTINGS_STORE.map((l) => (
                    <option key={l.level} value={l.level}>
                      {l.icon} {l.display_name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">سبب التجاوز * (إجباري)</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="مثال: مستثمر VIP — شراكة استراتيجية"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/20 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideLock}
                  onChange={(e) => setOverrideLock(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs text-neutral-300">🔒 قفل المستوى (لا يتغيّر تلقائياً)</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowOverride(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleSetOverride}
                disabled={!overrideReason.trim()}
                className="flex-1 py-3 rounded-xl bg-yellow-500/[0.15] border border-yellow-500/[0.3] text-yellow-400 text-sm font-bold hover:bg-yellow-500/[0.2] disabled:opacity-50"
              >
                حفظ التجاوز
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-neutral-500">{label}</span>
      <span className={cn("font-bold font-mono", color ?? "text-white")}>{value}</span>
    </div>
  )
}
