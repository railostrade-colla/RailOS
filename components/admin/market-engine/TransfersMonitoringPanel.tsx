"use client"

/** Phase 12 — Transfers monitoring panel (admin view). */

import { useEffect, useState } from "react"
import { Send, AlertTriangle } from "lucide-react"
import { listRecentTransfers, listSuspiciousTransfers } from "@/lib/market/transfers"
import type { ShareTransferRow } from "@/lib/market/phase12-types"

const TIER_LABEL: Record<string, string> = {
  transfer_first: "الفئة 1 (الأول)",
  transfer_second: "الفئة 2 (الثاني)",
  transfer_third: "الفئة 3 (الثالث+)",
}

export function TransfersMonitoringPanel() {
  const [recent, setRecent] = useState<ShareTransferRow[]>([])
  const [suspicious, setSuspicious] = useState<ShareTransferRow[]>([])
  const [tab, setTab] = useState<"recent" | "suspicious">("recent")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listRecentTransfers(50), listSuspiciousTransfers()]).then(
      ([r, s]) => {
        if (cancelled) return
        setRecent(r); setSuspicious(s); setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [])

  const rows = tab === "recent" ? recent : suspicious

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" strokeWidth={2} />
          <span className="text-sm font-bold text-white">إدارة الإرسالات</span>
        </div>
        <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
          <button
            onClick={() => setTab("recent")}
            className={`text-[11px] px-3 py-1 rounded ${tab === "recent" ? "bg-white text-black font-bold" : "text-neutral-400"}`}
          >
            الأخيرة ({recent.length})
          </button>
          <button
            onClick={() => setTab("suspicious")}
            className={`text-[11px] px-3 py-1 rounded flex items-center gap-1 ${tab === "suspicious" ? "bg-red-500 text-white font-bold" : "text-neutral-400"}`}
          >
            <AlertTriangle className="w-3 h-3" />
            مشبوهة ({suspicious.length})
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-6 text-xs text-neutral-500">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500">لا توجد إرسالات</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="bg-white/[0.02] text-neutral-500 text-[10px]">
              <tr>
                <th className="text-right px-3 py-2">التاريخ</th>
                <th className="text-right px-3 py-2">الحصص</th>
                <th className="text-right px-3 py-2">القيمة</th>
                <th className="text-right px-3 py-2">الفئة</th>
                <th className="text-right px-3 py-2">العمولة</th>
                <th className="text-right px-3 py-2">إشارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-neutral-400 font-mono" dir="ltr">
                    {new Date(t.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-3 py-2 text-white font-mono">{t.shares_count}</td>
                  <td className="px-3 py-2 text-yellow-400 font-mono">
                    {Number(t.market_value).toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-neutral-300">
                    {TIER_LABEL[t.commission_type] ?? t.commission_type}
                  </td>
                  <td className="px-3 py-2 text-blue-400 font-mono">
                    {Number(t.commission_amount).toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2">
                    {t.is_mutual_pattern_penalty && (
                      <span className="text-[10px] bg-red-500/15 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded">
                        نمط متبادل
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
