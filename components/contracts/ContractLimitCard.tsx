"use client"

import { Users, Sparkles, TrendingUp } from "lucide-react"
import {
  computeContractLimit,
  LEVEL_LABELS,
  LEVEL_ICONS,
  LEVEL_COLORS,
  LEVEL_LIMITS,
  fmtLimit,
  type InvestorLevel,
} from "@/lib/utils/contractLimits"
import { cn } from "@/lib/utils/cn"

interface ContractLimitCardProps {
  members: Array<{ name: string; level: InvestorLevel }>
  variant?: "full" | "compact"
}

export function ContractLimitCard({ members, variant = "full" }: ContractLimitCardProps) {

  if (members.length === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 text-center">
        <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" strokeWidth={1.5} />
        <div className="text-sm text-neutral-500">أضف أعضاء لحساب الحد الجماعي</div>
      </div>
    )
  }

  const result = computeContractLimit(members)

  // النسخة المختصرة - للأماكن الضيقة
  if (variant === "compact") {
    return (
      <div className="bg-purple-400/[0.06] border border-purple-400/25 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
          <span className="text-xs text-neutral-300">الحد الشهري للعقد</span>
        </div>
        <div className="text-base font-bold text-purple-400 font-mono">
          {fmtLimit(result.totalLimit)} د.ع
        </div>
      </div>
    )
  }

  // النسخة الكاملة - مع كل التفاصيل
  return (
    <div className="bg-gradient-to-br from-purple-400/[0.08] to-blue-400/[0.04] border border-purple-400/25 rounded-2xl p-5">

      {/* العنوان */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">الحد الشهري الجماعي</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {result.memberCount} عضو + مكافأة {result.bonusPercent}%
            </div>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xl font-bold text-purple-400 font-mono leading-none">
            {fmtLimit(result.totalLimit)}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1 font-mono">د.ع/شهر</div>
        </div>
      </div>

      {/* قائمة الأعضاء */}
      <div className="space-y-1.5 mb-4">
        {members.map((m, i) => (
          <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{LEVEL_ICONS[m.level]}</span>
              <span className="text-xs text-white truncate">{m.name}</span>
              <span className="text-[10px] text-neutral-500">· {LEVEL_LABELS[m.level]}</span>
            </div>
            <span
              className="text-[11px] font-bold font-mono flex-shrink-0"
              style={{ color: LEVEL_COLORS[m.level] }}
            >
              +{fmtLimit(LEVEL_LIMITS[m.level])}
            </span>
          </div>
        ))}
      </div>

      {/* الحساب التفصيلي */}
      <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-neutral-500">مجموع حدود الأعضاء</span>
          <span className="text-xs font-bold text-white font-mono">
            {fmtLimit(result.sumLimit)} د.ع
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-green-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" strokeWidth={2} />
            مكافأة العقد ({result.bonusPercent}%)
          </span>
          <span className="text-xs font-bold text-green-400 font-mono">
            +{fmtLimit(result.bonus)} د.ع
          </span>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-purple-400">الإجمالي الشهري</span>
          <span className="text-sm font-bold text-purple-400 font-mono">
            {fmtLimit(result.totalLimit)} د.ع
          </span>
        </div>
      </div>

    </div>
  )
}
