"use client"

import { useState } from "react"
import { Save, History, AlertTriangle } from "lucide-react"
import { SectionHeader, Table, THead, TH, TBody, TR, TD } from "@/components/admin/ui"
import { mockFeeConfigAdvanced, mockFeeConfigHistory } from "@/lib/admin/mock-data"
import { showSuccess, showError } from "@/lib/utils/toast"

export function FeeConfigAdvancedPanel() {
  const [config, setConfig] = useState(mockFeeConfigAdvanced)
  const [editing, setEditing] = useState(config)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const fields = [
    { key: "listing_fee_percent" as const, label: "رسوم إدراج عرض", desc: "نسبة من قيمة العرض" },
    { key: "direct_buy_fee_percent" as const, label: "رسوم الشراء المباشر", desc: "نسبة من قيمة العملية" },
    { key: "auction_fee_percent" as const, label: "رسوم المزادات", desc: "نسبة من السعر النهائي" },
    { key: "contract_fee_percent" as const, label: "رسوم العقود", desc: "نسبة من قيمة الاستثمار" },
    { key: "quick_sell_fee_percent" as const, label: "رسوم البيع السريع", desc: "نسبة من قيمة البيع" },
  ]

  const handleSave = () => {
    // Validation
    for (const f of fields) {
      const num = editing[f.key]
      if (isNaN(num) || num < 0 || num > 5) {
        showError("يجب أن تكون النسب بين 0% و 5%")
        return
      }
    }

    setSaving(true)
    setTimeout(() => {
      setConfig(editing)
      showSuccess("تم حفظ تكوين الرسوم")
      setSaving(false)
    }, 800)
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(editing)

  return (
    <div className="p-6 max-w-3xl">
      <SectionHeader
        title="💰 تكوين الرسوم المتقدم"
        subtitle="إعداد نسب جميع رسوم المنصة"
        action={
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="bg-white/[0.05] border border-white/[0.08] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/[0.08] flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? "إخفاء السجل" : "عرض السجل"}
          </button>
        }
      />

      {/* Fields */}
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">
        <div className="space-y-3">
          {fields.map((f) => {
            const oldVal = config[f.key]
            const newVal = editing[f.key]
            const changed = oldVal !== newVal

            return (
              <div
                key={f.key}
                className={
                  "flex items-center justify-between gap-3 p-3 rounded-xl border " +
                  (changed
                    ? "bg-yellow-400/[0.04] border-yellow-400/20"
                    : "bg-white/[0.04] border-white/[0.06]")
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">{f.label}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{f.desc}</div>
                  {changed && (
                    <div className="text-[10px] text-yellow-400 mt-1 font-mono">
                      {oldVal}% → {newVal}%
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={editing[f.key]}
                    onChange={(e) => setEditing({ ...editing, [f.key]: parseFloat(e.target.value) || 0 })}
                    className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 text-center font-mono"
                  />
                  <span className="text-xs text-neutral-400">%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Warning */}
        <div className="mt-4 bg-red-400/[0.04] border border-red-400/20 rounded-xl p-3 flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-[11px] text-neutral-300 leading-relaxed">
            <span className="text-red-400 font-bold">تنبيه: </span>
            النسب يجب أن تكون بين 0% و 5%. التغييرات تطبق فوراً على جميع العمليات الجديدة.
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={
            "w-full mt-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 " +
            (hasChanges && !saving
              ? "bg-neutral-100 text-black hover:bg-neutral-200"
              : "bg-white/[0.05] text-neutral-600 cursor-not-allowed")
          }
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "جاري الحفظ..." : hasChanges ? "حفظ التغييرات" : "لا توجد تغييرات"}
        </button>
      </div>

      {/* History */}
      {showHistory && (
        <div>
          <div className="text-sm font-bold text-white mb-3">📜 سجل التغييرات</div>
          <Table>
            <THead>
              <TH>التغيير</TH>
              <TH>القيمة القديمة</TH>
              <TH>القيمة الجديدة</TH>
              <TH>بواسطة</TH>
              <TH>التاريخ</TH>
            </THead>
            <TBody>
              {mockFeeConfigHistory.map((h) => (
                <TR key={h.id}>
                  <TD>
                    <span className="text-[11px] text-neutral-300">
                      {fields.find((f) => f.key === h.field)?.label || h.field}
                    </span>
                  </TD>
                  <TD><span className="font-mono text-red-400">{h.old_value}%</span></TD>
                  <TD><span className="font-mono text-green-400">{h.new_value}%</span></TD>
                  <TD><span className="text-[11px]">{h.changed_by}</span></TD>
                  <TD><span className="text-neutral-500 text-[11px]">{h.changed_at}</span></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  )
}
