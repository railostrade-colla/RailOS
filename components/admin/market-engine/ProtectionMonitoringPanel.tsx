"use client"

/** Phase 12 — Protection monitoring (circular trades, young accounts, KYC). */

import { useEffect, useState } from "react"
import { Shield, AlertCircle } from "lucide-react"
import { listRecentCircularTrades, type CircularLineageRow } from "@/lib/market/trust-score"
import { createClient } from "@/lib/supabase/client"

interface YoungAccount { id: string; full_name: string; created_at: string; trades: number }

export function ProtectionMonitoringPanel() {
  const [circular, setCircular] = useState<CircularLineageRow[]>([])
  const [young, setYoung] = useState<YoungAccount[]>([])
  const [noKyc, setNoKyc] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const supabase = createClient()
      const c = await listRecentCircularTrades(20)

      // Young accounts (< 30 days) with deals.
      const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString()
      const { data: yp } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .gte("created_at", cutoff)
        .limit(20)
      const youngWithCounts: YoungAccount[] = []
      for (const p of (yp ?? []) as Array<{ id: string; full_name: string; created_at: string }>) {
        const { count } = await supabase
          .from("deals")
          .select("id", { head: true, count: "exact" })
          .or(`buyer_id.eq.${p.id},seller_id.eq.${p.id}`)
        if ((count ?? 0) > 0) {
          youngWithCounts.push({ ...p, trades: count ?? 0 })
        }
      }

      // No-KYC count
      const { count: nk } = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .neq("kyc_status", "approved")

      if (!cancelled) {
        setCircular(c)
        setYoung(youngWithCounts)
        setNoKyc(nk ?? 0)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400" strokeWidth={2} />
        <span className="text-sm font-bold text-white">مراقبة الحماية</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 p-3 text-[11px]">
        <div className="bg-red-500/[0.06] border border-red-500/[0.2] rounded-lg p-3">
          <div className="text-red-400 mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> الصفقات الدائرية
          </div>
          <div className="text-2xl font-bold text-red-300 font-mono">
            {loading ? "—" : circular.length}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">آخر 20 صفقة مكشوفة</div>
        </div>
        <div className="bg-yellow-400/[0.06] border border-yellow-400/[0.2] rounded-lg p-3">
          <div className="text-yellow-300 mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> حسابات &lt; 30 يوم نشطة
          </div>
          <div className="text-2xl font-bold text-yellow-200 font-mono">
            {loading ? "—" : young.length}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">لها صفقات</div>
        </div>
        <div className="bg-orange-400/[0.06] border border-orange-400/[0.2] rounded-lg p-3">
          <div className="text-orange-300 mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> حسابات بدون KYC
          </div>
          <div className="text-2xl font-bold text-orange-200 font-mono">
            {loading ? "—" : noKyc}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">كل المستخدمين</div>
        </div>
      </div>
    </div>
  )
}
