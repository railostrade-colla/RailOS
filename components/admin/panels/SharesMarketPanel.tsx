"use client"

/**
 * SharesMarketPanel — overview of every project's market activity:
 *   • shares for sale + sold
 *   • most active / most-traded
 *   • offering / ambassador / reserve splits
 *
 * Powered by `get_project_wallets_admin` so the same RPC drives both
 * the wallets table and this aggregated stats view.
 */

import { useEffect, useState } from "react"
import { TrendingUp, Search } from "lucide-react"
import {
  Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty,
} from "@/components/admin/ui"
import {
  getAllProjectWalletsAdmin,
  type ProjectWalletAdminRow,
} from "@/lib/data/admin-utilities"

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function SharesMarketPanel() {
  const [rows, setRows] = useState<ProjectWalletAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    getAllProjectWalletsAdmin(500).then((data) => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const filtered = rows.filter(
    (r) => !search || r.project_name.includes(search),
  )

  // Sort by activity (most-sold first)
  const ranked = [...filtered].sort((a, b) => b.sold_shares - a.sold_shares)

  const stats = {
    total_projects: rows.length,
    total_shares: rows.reduce((s, r) => s + r.total_shares, 0),
    total_offering: rows.reduce((s, r) => s + r.offering_total, 0),
    total_sold: rows.reduce((s, r) => s + r.sold_shares, 0),
    total_market_value: rows.reduce((s, r) => s + r.total_market_value, 0),
    total_investors: rows.reduce((s, r) => s + r.investors_count, 0),
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-green-400" strokeWidth={2} />
        <div className="text-lg font-bold text-white">📊 الحصص في السوق</div>
      </div>
      <div className="text-xs text-neutral-500 mb-5">
        نظرة موحَّدة على كل المشاريع — الحصص المعروضة، المباعة، عدد المستثمرين، النشاط
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <KPI label="إجمالي المشاريع" val={fmtNum(stats.total_projects)} color="#60A5FA" />
        <KPI label="إجمالي الحصص" val={fmtNum(stats.total_shares)} color="#C084FC" />
        <KPI label="حصص معروضة" val={fmtNum(stats.total_offering)} color="#FBBF24" />
        <KPI label="حصص مباعة" val={fmtNum(stats.total_sold)} color="#4ADE80" />
        <KPI label="إجمالي المستثمرين" val={fmtNum(stats.total_investors)} color="#a3a3a3" />
        <KPI label="القيمة السوقية" val={fmtNum(stats.total_market_value) + " د.ع"} color="#F472B6" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن مشروع..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : ranked.length === 0 ? (
        <AdminEmpty title="لا توجد بيانات" body="بمجرد إنشاء مشاريع ومحافظ، ستظهر هنا" />
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>السعر</TH>
            <TH>إجمالي الحصص</TH>
            <TH>معروضة</TH>
            <TH>مباعة</TH>
            <TH>المستثمرون</TH>
            <TH>قيمة المباعة</TH>
            <TH>قيمة غير المباعة</TH>
            <TH>النشاط</TH>
          </THead>
          <TBody>
            {ranked.map((r, idx) => {
              const activityPct = r.offering_total > 0
                ? Math.round((r.sold_shares / r.offering_total) * 100)
                : 0
              return (
                <TR key={r.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <span className="text-[10px] bg-yellow-400/[0.15] border border-yellow-400/[0.3] text-yellow-400 rounded px-1.5 py-0.5 font-mono">
                          #{idx + 1}
                        </span>
                      )}
                      <span className="text-xs text-white">{r.project_name}</span>
                    </div>
                  </TD>
                  <TD><span className="font-mono text-yellow-400 text-xs">{fmtNum(r.market_price)}</span></TD>
                  <TD><span className="font-mono text-xs">{fmtNum(r.total_shares)}</span></TD>
                  <TD><span className="font-mono text-purple-400 text-xs">{fmtNum(r.offering_total)}</span></TD>
                  <TD><span className="font-mono text-green-400 text-xs font-bold">{fmtNum(r.sold_shares)}</span></TD>
                  <TD><span className="font-mono text-blue-400 text-xs">{fmtNum(r.investors_count)}</span></TD>
                  <TD><span className="font-mono text-emerald-400 text-xs">{fmtNum(r.sold_value)}</span></TD>
                  <TD><span className="font-mono text-neutral-400 text-xs">{fmtNum(r.unsold_offering_value)}</span></TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-green-400"
                          style={{ width: `${Math.min(100, activityPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">{activityPct}%</span>
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}
