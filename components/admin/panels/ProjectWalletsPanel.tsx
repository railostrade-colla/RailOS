"use client"

import { useState } from "react"
import { Search, X, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_PROJECT_WALLETS,
  WALLET_STATUS_LABELS,
  WALLET_TX_REASON_LABELS,
  getWalletTransactions,
  getProjectWalletsStats,
  type ProjectWallet,
} from "@/lib/mock-data/projectWallets"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type WalletAction = null | "freeze" | "unfreeze" | "transfer"

export function ProjectWalletsPanel() {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ProjectWallet | null>(null)
  const [action, setAction] = useState<WalletAction>(null)
  const [reason, setReason] = useState("")
  const [transferAmount, setTransferAmount] = useState("")

  const stats = getProjectWalletsStats()

  const filtered = MOCK_PROJECT_WALLETS
    .filter((w) => filter === "all" || w.status === filter)
    .filter((w) => !search || w.project_name.includes(search))

  const handleAction = () => {
    if (!selected || !action) return
    if (action === "freeze" && !reason.trim()) return showError("سبب التجميد مطلوب")
    if (action === "transfer") {
      const amt = Number(transferAmount)
      if (!amt || amt < 1000) return showError("المبلغ غير صحيح (الحدّ الأدنى 1000)")
      if (amt > selected.balance) return showError("المبلغ أكبر من الرصيد المتاح")
      showSuccess(`✅ تم تحويل ${fmtNum(amt)} د.ع من محفظة ${selected.project_name}`)
    }
    if (action === "freeze") showSuccess(`❄️ تم تجميد محفظة ${selected.project_name}`)
    if (action === "unfreeze") showSuccess(`✅ تم فكّ تجميد محفظة ${selected.project_name}`)
    setAction(null)
    setSelected(null)
    setReason("")
    setTransferAmount("")
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🏦 محافظ المشاريع"
        subtitle="إدارة المحافظ التلقائية لكل مشروع — رصيد + إيرادات + مصروفات"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="إجمالي المحافظ" val={stats.total}                                  color="#fff" />
        <KPI label="نشطة"            val={stats.active}                                 color="#4ADE80" />
        <KPI label="مُجمَّدة"        val={stats.frozen}                                 color="#FBBF24" />
        <KPI label="إجمالي الأرصدة"  val={fmtNum(stats.total_balance) + " د.ع"}        color="#60A5FA" />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن مشروع..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "all",    label: "الكل",      count: stats.total  },
          { key: "active", label: "نشطة",      count: stats.active },
          { key: "frozen", label: "مُجمَّدة",  count: stats.frozen },
        ]}
        active={filter}
        onSelect={setFilter}
      />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد محافظ" />
      ) : (
        <Table>
          <THead>
            <TH>المشروع</TH>
            <TH>الرصيد</TH>
            <TH>الإيرادات</TH>
            <TH>المصروفات</TH>
            <TH>الحالة</TH>
            <TH>الإنشاء</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((w) => {
              const st = WALLET_STATUS_LABELS[w.status]
              return (
                <TR key={w.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                      <span className="text-xs text-white font-bold">{w.project_name}</span>
                    </div>
                  </TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(w.balance)}</span></TD>
                  <TD><span className="font-mono text-green-400">+{fmtNum(w.total_inflow)}</span></TD>
                  <TD><span className="font-mono text-red-400">-{fmtNum(w.total_outflow)}</span></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-[11px] text-neutral-500">{w.created_at}</span></TD>
                  <TD>
                    <ActionBtn label="إدارة" color="blue" sm onClick={() => setSelected(w)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Detail modal */}
      {selected && !action && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">محفظة {selected.project_name}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-lg p-3 text-center">
                <div className="text-[10px] text-neutral-500 mb-1">الرصيد</div>
                <div className="text-base font-bold text-blue-400 font-mono">{fmtNum(selected.balance)}</div>
              </div>
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-lg p-3 text-center">
                <div className="text-[10px] text-neutral-500 mb-1">إيرادات</div>
                <div className="text-base font-bold text-green-400 font-mono">+{fmtNum(selected.total_inflow)}</div>
              </div>
              <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-lg p-3 text-center">
                <div className="text-[10px] text-neutral-500 mb-1">مصروفات</div>
                <div className="text-base font-bold text-red-400 font-mono">-{fmtNum(selected.total_outflow)}</div>
              </div>
            </div>

            {selected.status === "frozen" && selected.frozen_reason && (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 mb-4">
                <div className="text-[11px] font-bold text-yellow-400 mb-1">❄️ مُجمَّدة منذ {selected.frozen_at}</div>
                <div className="text-xs text-neutral-300">{selected.frozen_reason}</div>
              </div>
            )}

            {/* Transactions */}
            <SectionHeader title="📋 سجلّ الحركات" />
            {(() => {
              const txs = getWalletTransactions(selected.id)
              if (txs.length === 0) return <div className="text-xs text-neutral-500 text-center py-4">لا حركات بعد</div>
              return (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.05] mb-4">
                  {txs.map((t) => {
                    const reasonMeta = WALLET_TX_REASON_LABELS[t.reason]
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0",
                          t.type === "inflow" ? "bg-green-400/[0.08] border-green-400/[0.25]" : "bg-red-400/[0.08] border-red-400/[0.25]"
                        )}>
                          {t.type === "inflow" ? <ArrowDownLeft className="w-4 h-4 text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-bold truncate flex items-center gap-1.5">
                            <span>{reasonMeta.icon}</span>
                            <span>{t.description}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{reasonMeta.label} · {t.created_at}</div>
                        </div>
                        <div className={cn("text-sm font-bold font-mono flex-shrink-0", t.type === "inflow" ? "text-green-400" : "text-red-400")}>
                          {t.type === "inflow" ? "+" : "-"}{fmtNum(t.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
              {selected.status === "active" ? (
                <ActionBtn label="❄️ تجميد" color="yellow" onClick={() => setAction("freeze")} />
              ) : (
                <ActionBtn label="✅ فكّ تجميد" color="green" onClick={() => setAction("unfreeze")} />
              )}
              <ActionBtn label="↗️ تحويل أموال" color="blue" onClick={() => setAction("transfer")} disabled={selected.status !== "active"} />
              <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.08]">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {selected && action && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="text-base font-bold text-white mb-4">
              {action === "freeze" && "❄️ تجميد المحفظة"}
              {action === "unfreeze" && "✅ فكّ التجميد"}
              {action === "transfer" && "↗️ تحويل أموال"}
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              action === "freeze" && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
              action === "unfreeze" && "bg-green-400/[0.05] border-green-400/[0.2] text-green-400",
              action === "transfer" && "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400"
            )}>
              المحفظة: <span className="font-bold text-white">{selected.project_name}</span> ·
              رصيد متاح: <span className="font-mono font-bold">{fmtNum(selected.balance)} د.ع</span>
            </div>

            {action === "freeze" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب التجميد (إجباري)</label>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                  placeholder="مثلاً: تحت مراجعة لجنة التطوير..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            {action === "transfer" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">المبلغ (د.ع)</label>
                <input
                  type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="مثلاً: 5000000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-4"
                />
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setAction(null); setReason(""); setTransferAmount("") }} className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
              <button onClick={handleAction} className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold border",
                action === "freeze" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400",
                action === "unfreeze" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400",
                action === "transfer" && "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400"
              )}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
