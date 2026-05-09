"use client"

/**
 * Phase 12 — Commissions management panel.
 *
 * Renders the 8-row dynamic commission table. Every row supports:
 *   • Toggle is_enabled
 *   • Edit current_rate (0-10 %)
 *   • Set paused_until (optional date — auto-restore when expired)
 *   • Save → admin_update_commission RPC
 *   • Restore default → admin_update_commission(default_rate)
 *
 * Drift indicators:
 *   • Yellow badge "تعديل" when current_rate ≠ default_rate
 *   • Red badge "معطلة" when is_enabled = FALSE
 *   • Blue chip showing paused_until when set
 */

import { useEffect, useState } from "react"
import { Save, RotateCcw, AlertTriangle, Power, Calendar } from "lucide-react"
import {
  listCommissionSettings,
  adminUpdateCommission,
  adminRestoreCommissionDefault,
} from "@/lib/market/commissions"
import type { CommissionSetting, CommissionType } from "@/lib/market/phase12-types"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type DraftMap = Record<CommissionType, {
  rate: string
  enabled: boolean
  paused_until: string
  notes: string
}>

const fmtPct = (n: number) => (n * 100).toFixed(2) + "%"

export function CommissionsManagementPanel() {
  const [rows, setRows] = useState<CommissionSetting[]>([])
  const [drafts, setDrafts] = useState<DraftMap>({} as DraftMap)
  const [savingType, setSavingType] = useState<CommissionType | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const list = await listCommissionSettings()
    setRows(list)
    const map = {} as DraftMap
    for (const r of list) {
      map[r.commission_type] = {
        rate: (r.current_rate * 100).toString(),
        enabled: r.is_enabled,
        paused_until: r.paused_until ?? "",
        notes: r.notes ?? "",
      }
    }
    setDrafts(map)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  }, [])

  const handleSave = async (type: CommissionType) => {
    const draft = drafts[type]
    if (!draft) return
    const rate = parseFloat(draft.rate) / 100
    if (!Number.isFinite(rate) || rate < 0 || rate > 0.10) {
      showError("النسبة يجب أن تكون بين 0% و 10%")
      return
    }
    setSavingType(type)
    const res = await adminUpdateCommission({
      type,
      is_enabled: draft.enabled,
      rate,
      paused_until: draft.paused_until || null,
      notes: draft.notes || null,
    })
    setSavingType(null)
    if (!res.success) {
      showError(res.reason ?? "فشل الحفظ")
      return
    }
    showSuccess("تم الحفظ ✓")
    void reload()
  }

  const handleRestore = async (type: CommissionType) => {
    setSavingType(type)
    const res = await adminRestoreCommissionDefault(type)
    setSavingType(null)
    if (!res.success) {
      showError(res.reason ?? "فشل الاستعادة")
      return
    }
    showSuccess("تم الاستعادة ✓")
    void reload()
  }

  const handleRestoreAll = async () => {
    if (!confirm("هل تريد استعادة كل العمولات إلى قيمها الافتراضية؟")) return
    for (const r of rows) {
      await adminRestoreCommissionDefault(r.commission_type)
    }
    showSuccess("تم استعادة كل العمولات ✓")
    void reload()
  }

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center text-xs text-neutral-500">
        جاري التحميل...
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">إدارة العمولات</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            تشغيل/إيقاف · تعديل النسبة · تاريخ انتهاء اختياري · استعادة تلقائية بعد التاريخ
          </div>
        </div>
        <button
          onClick={handleRestoreAll}
          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-400/[0.2] hover:bg-blue-400/[0.06]"
        >
          <RotateCcw className="w-3 h-3" strokeWidth={2} />
          استعادة الكل
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {rows.map((r) => {
          const draft = drafts[r.commission_type]
          if (!draft) return null
          const drift = r.current_rate !== r.default_rate
          const isPaused = !!r.paused_until
          const saving = savingType === r.commission_type
          return (
            <div key={r.commission_type} className="p-4">
              {/* Title row */}
              <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm font-bold text-white">{r.display_name_ar}</span>
                  {!r.is_enabled && (
                    <span className="text-[10px] bg-red-500/15 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Power className="w-2.5 h-2.5" strokeWidth={2.5} />
                      معطلة
                    </span>
                  )}
                  {drift && r.is_enabled && (
                    <span className="text-[10px] bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.5} />
                      تعديل (افتراضي: {fmtPct(r.default_rate)})
                    </span>
                  )}
                  {isPaused && (
                    <span className="text-[10px] bg-blue-400/15 border border-blue-400/30 text-blue-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" strokeWidth={2.5} />
                      ينتهي: {r.paused_until}
                    </span>
                  )}
                </div>
                <code className="text-[10px] text-neutral-600 font-mono">
                  {r.commission_type}
                </code>
              </div>

              {/* Inputs row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                {/* Rate */}
                <div className="lg:col-span-3">
                  <label className="text-[10px] text-neutral-500 block mb-1">
                    النسبة (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={draft.rate}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [r.commission_type]: { ...d[r.commission_type], rate: e.target.value },
                        }))
                      }
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 font-mono"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">%</span>
                  </div>
                </div>

                {/* Enabled toggle */}
                <div className="lg:col-span-2">
                  <label className="text-[10px] text-neutral-500 block mb-1">الحالة</label>
                  <button
                    onClick={() =>
                      setDrafts((d) => ({
                        ...d,
                        [r.commission_type]: {
                          ...d[r.commission_type],
                          enabled: !d[r.commission_type].enabled,
                        },
                      }))
                    }
                    className={cn(
                      "w-full px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors",
                      draft.enabled
                        ? "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
                        : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25",
                    )}
                  >
                    <Power className="w-3 h-3" strokeWidth={2.5} />
                    {draft.enabled ? "مفعلة" : "معطلة"}
                  </button>
                </div>

                {/* Paused until */}
                <div className="lg:col-span-3">
                  <label className="text-[10px] text-neutral-500 block mb-1">
                    ينتهي بتاريخ (اختياري)
                  </label>
                  <input
                    type="date"
                    value={draft.paused_until}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [r.commission_type]: { ...d[r.commission_type], paused_until: e.target.value },
                      }))
                    }
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20 font-mono"
                  />
                </div>

                {/* Notes */}
                <div className="lg:col-span-2">
                  <label className="text-[10px] text-neutral-500 block mb-1">ملاحظة</label>
                  <input
                    type="text"
                    value={draft.notes}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [r.commission_type]: { ...d[r.commission_type], notes: e.target.value },
                      }))
                    }
                    placeholder="—"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
                  />
                </div>

                {/* Actions */}
                <div className="lg:col-span-2 flex gap-1.5">
                  <button
                    onClick={() => handleSave(r.commission_type)}
                    disabled={saving}
                    className="flex-1 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-400 disabled:opacity-50 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Save className="w-3 h-3" strokeWidth={2.5} />
                    حفظ
                  </button>
                  {drift && (
                    <button
                      onClick={() => handleRestore(r.commission_type)}
                      disabled={saving}
                      className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-neutral-300 disabled:opacity-50 px-2 py-1.5 rounded-lg text-xs"
                      title="استعادة الافتراضي"
                    >
                      <RotateCcw className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
