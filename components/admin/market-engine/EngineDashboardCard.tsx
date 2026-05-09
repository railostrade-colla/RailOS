"use client"

/**
 * Phase 12 — Engine status overview card.
 * Shows current mode + a "تشغيل يدوي" button (with double-confirm).
 */

import { useEffect, useState } from "react"
import { Activity, Play, AlertCircle } from "lucide-react"
import {
  getGlobalEngineSettings,
  adminSwitchEngineMode,
  adminRunDailyEngineNow,
} from "@/lib/market/engine-mode"
import type { EngineSettings } from "@/lib/market/phase12-types"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

export function EngineDashboardCard() {
  const [settings, setSettings] = useState<EngineSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [switching, setSwitching] = useState(false)

  const reload = async () => {
    setLoading(true)
    setSettings(await getGlobalEngineSettings())
    setLoading(false)
  }
  useEffect(() => { void reload() }, [])

  const handleSwitch = async () => {
    if (!settings) return
    const newMode = settings.engine_mode === "initial" ? "permanent" : "initial"
    const ok = confirm(
      `تأكيد التبديل من "${settings.engine_mode}" إلى "${newMode}"؟\n` +
        `النظام الذكي يعتمد على النشاط المتنوع وصحة السوق.`,
    )
    if (!ok) return
    const notes = prompt("سبب التبديل (للسجل):") ?? "—"
    setSwitching(true)
    const res = await adminSwitchEngineMode(newMode, notes)
    setSwitching(false)
    if (!res.success) { showError(res.reason ?? "فشل التبديل"); return }
    showSuccess("تم تبديل الوضع ✓")
    void reload()
  }

  const handleRunNow = async () => {
    const ok1 = confirm("تشغيل المحرك يدوياً الآن؟ سيُحسب الارتفاع لكل المشاريع النشطة.")
    if (!ok1) return
    const ok2 = confirm("تأكيد نهائي — هذه عملية تُغيّر أسعار السوق.")
    if (!ok2) return
    setRunning(true)
    const res = await adminRunDailyEngineNow()
    setRunning(false)
    if (!res.success) { showError(res.reason ?? "فشل التشغيل"); return }
    showSuccess(`تم — ${res.processed ?? 0} مشروع`)
  }

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 text-xs text-neutral-500">
        جاري التحميل...
      </div>
    )
  }

  const mode = settings?.engine_mode ?? "initial"
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-yellow-400" strokeWidth={2} />
          <span className="text-sm font-bold text-white">حالة المحرك</span>
        </div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded border",
          mode === "permanent"
            ? "bg-green-500/15 border-green-500/30 text-green-400"
            : "bg-yellow-400/15 border-yellow-400/30 text-yellow-400",
        )}>
          {mode === "permanent" ? "النظام الذكي" : "النظام المؤقت"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
        <div className="bg-white/[0.04] rounded-lg p-2">
          <div className="text-neutral-500 mb-0.5">السقف اليومي</div>
          <div className="text-white font-mono font-bold">
            {((settings?.daily_cap ?? 0.03) * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-white/[0.04] rounded-lg p-2">
          <div className="text-neutral-500 mb-0.5">حد العمر للحساب</div>
          <div className="text-white font-mono font-bold">
            {settings?.min_account_age_days ?? 30} يوم
          </div>
        </div>
        <div className="bg-white/[0.04] rounded-lg p-2">
          <div className="text-neutral-500 mb-0.5">ارتفاع/صفقة (مؤقت)</div>
          <div className="text-white font-mono font-bold">
            {((settings?.initial_rise_per_trade ?? 0.006) * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-white/[0.04] rounded-lg p-2">
          <div className="text-neutral-500 mb-0.5">صفقات/يوم (مؤقت)</div>
          <div className="text-white font-mono font-bold">
            {settings?.initial_max_trades_per_day ?? 5}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSwitch}
          disabled={switching}
          className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          تبديل إلى {mode === "permanent" ? "المؤقت" : "الذكي"}
        </button>
        <button
          onClick={handleRunNow}
          disabled={running}
          className="flex-1 bg-yellow-400/15 border border-yellow-400/30 hover:bg-yellow-400/25 text-yellow-300 text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Play className="w-3 h-3" strokeWidth={2.5} />
          تشغيل يدوي
        </button>
      </div>

      {mode === "initial" && (
        <div className="mt-3 flex items-start gap-2 bg-yellow-400/[0.06] border border-yellow-400/20 rounded-lg p-2.5 text-[10px] text-yellow-200">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            النظام المؤقت يرفع السعر مع كل صفقة بنسبة ثابتة. التحويل للنظام الذكي يدوي
            عند جاهزية السوق.
          </span>
        </div>
      )}
    </div>
  )
}
