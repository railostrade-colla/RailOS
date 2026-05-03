"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { LEVEL_SETTINGS_STORE, type LevelSetting } from "@/lib/mock-data/levels"
import { getLevelSettings } from "@/lib/data/levels"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtVolume = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} مليار د.ع`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} مليون د.ع`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} ألف د.ع`
  return `${fmtNum(n)} د.ع`
}

export default function LevelsPage() {
  // البيانات تأتي من DB أولاً، مع mock fallback إذا لم يتمّ تطبيق migration 10
  // أو فشل الاتصال. ترتيب نهائي حسب `level_order`.
  const [levels, setLevels] = useState<LevelSetting[]>(
    [...LEVEL_SETTINGS_STORE].sort((a, b) => a.level_order - b.level_order),
  )

  useEffect(() => {
    let cancelled = false
    getLevelSettings()
      .then((rows) => {
        if (cancelled) return
        if (rows.length > 0) {
          setLevels([...rows].sort((a, b) => a.level_order - b.level_order))
        }
      })
      .catch(() => {
        /* keep mock */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">
          <PageHeader
            title="🏆 مستويات المستثمرين"
            subtitle="ارتقِ في المستويات واحصل على مزايا أكثر — كل مستوى يعكس ثقة وخبرة"
          />

          {/* Intro */}
          <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-2xl p-4 mb-6">
            <div className="text-sm text-white font-bold mb-1.5">💡 كيف تعمل المستويات؟</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              تتمّ ترقية المستويات تلقائياً عند استيفاء جميع الشروط. كلّما زاد مستواك، زادت قدرتك
              على التداول والمزايا التي تحصل عليها. النزاعات الخاسرة والبلاغات قد تؤدّي للتنزيل.
            </div>
          </div>

          {/* Levels grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {levels.map((level) => (
              <LevelCard key={level.level} level={level} />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-8 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-[11px] text-neutral-400 leading-relaxed">
            <div className="font-bold text-white mb-1">📋 ملاحظات هامّة:</div>
            <ul className="space-y-1 list-disc pr-5">
              <li>التقييم يأتي من تقييمات المستخدمين الآخرين بعد الصفقات.</li>
              <li>"النزاعات الخاسرة" = نزاع حُسم لصالح الطرف الآخر.</li>
              <li>الأرقام أعلاه قابلة للتعديل من إدارة المنصّة عند الحاجة.</li>
              <li>لتفاصيل مستواك الحالي وتقدّمك:{" "}
                <a href="/profile/level" className="text-blue-400 hover:underline">صفحة مستواي</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Level Card
// ──────────────────────────────────────────────────────────────────────────

function LevelCard({ level }: { level: LevelSetting }) {
  const requirements = [
    level.min_volume > 0 && `${fmtVolume(level.min_volume)} حجم تداول`,
    level.min_total_trades > 0 && `${level.min_total_trades} صفقة`,
    level.min_success_rate > 0 && `${level.min_success_rate}% معدّل نجاح`,
    level.min_days_active > 0 && `${level.min_days_active} يوم نشاط`,
    level.max_disputes_lost < 999 && `أقل من ${level.max_disputes_lost} نزاع خاسر`,
    level.min_rating > 0 && `تقييم ${level.min_rating}+`,
    `KYC: ${level.required_kyc === "basic" ? "أساسي" : level.required_kyc === "advanced" ? "متقدّم" : "محترف"}`,
  ].filter(Boolean) as string[]

  // إذا أساسي — لا شروط
  const showRequirements = level.level !== "basic"

  return (
    <div
      className="rounded-2xl p-5 border-2 transition-all"
      style={{
        backgroundColor: `${level.color}08`,
        borderColor: `${level.color}40`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: `${level.color}30` }}>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{
            backgroundColor: `${level.color}20`,
            border: `1px solid ${level.color}50`,
          }}
        >
          {level.icon}
        </div>
        <div className="flex-1">
          <div className="text-base font-bold text-white mb-0.5">{level.display_name_ar}</div>
          <div className="text-[10px] text-neutral-500 font-mono uppercase">{level.level}</div>
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: level.color, boxShadow: `0 0 8px ${level.color}` }}
        />
      </div>

      {/* Requirements */}
      {showRequirements && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">📋 الشروط</div>
          <ul className="space-y-1.5">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300">
                <Check
                  className="w-3 h-3 flex-shrink-0 mt-0.5"
                  style={{ color: level.color }}
                  strokeWidth={2.5}
                />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Benefits */}
      <div>
        <div className="text-[10px] font-bold text-neutral-500 uppercase mb-2">🎁 المزايا</div>
        <ul className="space-y-1.5">
          {level.benefits.map((benefit, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-white">
              <span style={{ color: level.color }}>•</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trade limit highlight */}
      <div
        className={cn(
          "mt-4 pt-3 border-t flex justify-between items-center"
        )}
        style={{ borderColor: `${level.color}30` }}
      >
        <span className="text-[10px] text-neutral-500">الحد الشهري</span>
        <span className="text-sm font-bold font-mono" style={{ color: level.color }}>
          {fmtVolume(level.monthly_trade_limit)}
        </span>
      </div>
    </div>
  )
}
