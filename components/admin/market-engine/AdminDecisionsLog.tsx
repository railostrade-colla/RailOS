"use client"

/** Phase 12 — Admin market decisions log. */

import { useEffect, useState } from "react"
import { History } from "lucide-react"
import { listAdminDecisions } from "@/lib/market/decisions-log"
import type { AdminDecisionRow } from "@/lib/market/phase12-types"

const TYPE_LABELS: Record<string, string> = {
  update_commission: "تعديل عمولة",
  switch_engine_mode: "تبديل وضع المحرك",
  update_sector_cap: "تعديل سقف قطاع",
  freeze_project: "تجميد مشروع",
  unfreeze_project: "إلغاء تجميد",
}

export function AdminDecisionsLog() {
  const [rows, setRows] = useState<AdminDecisionRow[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAdminDecisions({ decisionType: filter || undefined, limit: 100 })
      .then((data) => { if (!cancelled) setRows(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filter])

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-400" strokeWidth={2} />
          <span className="text-sm font-bold text-white">سجل القرارات الإدارية</span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-white outline-none"
        >
          <option value="">الكل</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-6 text-xs text-neutral-500">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500">لا قرارات مسجَّلة</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-3 text-[11px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-bold">
                  {TYPE_LABELS[r.decision_type] ?? r.decision_type}
                </span>
                <span className="text-neutral-500 font-mono" dir="ltr">
                  {new Date(r.created_at).toLocaleString("en-GB")}
                </span>
              </div>
              {r.decision_target && (
                <div className="text-neutral-400 mb-1">
                  الهدف: <code className="text-[10px]">{r.decision_target}</code>
                </div>
              )}
              {r.rationale && (
                <div className="text-neutral-300">{r.rationale}</div>
              )}
              {(r.before_state || r.after_state) && (
                <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
                  {r.before_state && (
                    <div className="bg-red-500/[0.05] border border-red-500/[0.15] rounded p-1.5">
                      <div className="text-red-400 mb-0.5">قبل</div>
                      <pre className="text-neutral-300 font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(r.before_state)}
                      </pre>
                    </div>
                  )}
                  {r.after_state && (
                    <div className="bg-green-500/[0.05] border border-green-500/[0.15] rounded p-1.5">
                      <div className="text-green-400 mb-0.5">بعد</div>
                      <pre className="text-neutral-300 font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(r.after_state)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
