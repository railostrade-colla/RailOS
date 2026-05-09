"use client"

/** Phase 12 — Sector caps editable table. */

import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { listSectorCaps, adminUpdateSectorCap } from "@/lib/market/sector-caps"
import type { SectorCap } from "@/lib/market/phase12-types"
import { showSuccess, showError } from "@/lib/utils/toast"

export function SectorCapsTable() {
  const [rows, setRows] = useState<SectorCap[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingSector, setSavingSector] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const list = await listSectorCaps()
    setRows(list)
    const map: Record<string, string> = {}
    for (const r of list) map[r.sector] = (r.monthly_cap_percent * 100).toString()
    setDrafts(map)
    setLoading(false)
  }
  useEffect(() => { void reload() }, [])

  const handleSave = async (sector: string) => {
    const draft = drafts[sector]
    const cap = parseFloat(draft) / 100
    if (!Number.isFinite(cap) || cap < 0 || cap > 1) {
      showError("النسبة يجب أن تكون بين 0% و 100%")
      return
    }
    setSavingSector(sector)
    const res = await adminUpdateSectorCap({ sector, newCap: cap })
    setSavingSector(null)
    if (!res.success) { showError(res.reason ?? "فشل الحفظ"); return }
    showSuccess("تم الحفظ ✓")
    void reload()
  }

  if (loading) {
    return <div className="text-xs text-neutral-500 py-4 text-center">جاري التحميل...</div>
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="text-sm font-bold text-white">السقوف الشهرية حسب القطاع</div>
        <div className="text-[10px] text-neutral-500 mt-0.5">
          الحد الأقصى لارتفاع السعر شهرياً لكل قطاع
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((r) => (
          <div key={r.sector} className="p-3 grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4 text-sm text-white">
              <div className="font-bold">{r.display_name_ar}</div>
              <code className="text-[10px] text-neutral-500 font-mono">{r.sector}</code>
            </div>
            <div className="col-span-3 text-[10px] text-neutral-500">
              الافتراضي: <span className="font-mono text-white">{(r.monthly_cap_percent * 100).toFixed(2)}%</span>
            </div>
            <div className="col-span-3">
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={drafts[r.sector] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.sector]: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20 font-mono"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">%</span>
              </div>
            </div>
            <div className="col-span-2">
              <button
                onClick={() => handleSave(r.sector)}
                disabled={savingSector === r.sector}
                className="w-full bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 text-blue-400 disabled:opacity-50 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <Save className="w-3 h-3" strokeWidth={2.5} />
                حفظ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
