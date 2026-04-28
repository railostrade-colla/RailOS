"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  AUCTION_DETAILS,
  AUCTION_BIDS,
  getAuctionBids,
  type AuctionDetails,
  type AuctionStatus,
} from "@/lib/mock-data/auctions"
import { ALL_PROJECTS } from "@/lib/mock-data/projects"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const STATUS_META: Record<AuctionStatus, { label: string; color: "green" | "blue" | "gray" }> = {
  active: { label: "نشط", color: "green" },
  upcoming: { label: "قادم", color: "blue" },
  ended: { label: "منتهٍ", color: "gray" },
}

type ActionMode = null | "end_early" | "refund" | "cancel"

function formatDateAr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

function timeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return "انتهى"
  const mins = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} يوم ${hours % 24} ساعة`
  if (hours > 0) return `${hours} ساعة ${mins % 60} دقيقة`
  return `${mins} دقيقة`
}

export function AuctionsAdminPanel() {
  const [filter, setFilter] = useState<string>("active")
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [selected, setSelected] = useState<AuctionDetails | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")

  // Create auction form
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectId, setNewProjectId] = useState<string>(ALL_PROJECTS[0]?.id || "")
  const [newStarting, setNewStarting] = useState<number>(50_000)
  const [newShares, setNewShares] = useState<number>(50)
  const [newIncrement, setNewIncrement] = useState<number>(1_000)
  const [newStartsAt, setNewStartsAt] = useState<string>("")
  const [newEndsAt, setNewEndsAt] = useState<string>("")

  const tabs = [
    { key: "all", label: "الكل", count: AUCTION_DETAILS.length },
    { key: "active", label: "نشطة", count: AUCTION_DETAILS.filter((a) => a.status === "active").length },
    { key: "upcoming", label: "قادمة", count: AUCTION_DETAILS.filter((a) => a.status === "upcoming").length },
    { key: "ended", label: "منتهية", count: AUCTION_DETAILS.filter((a) => a.status === "ended").length },
  ]

  const today = new Date().toISOString().split("T")[0]
  const stats = {
    active: AUCTION_DETAILS.filter((a) => a.status === "active").length,
    upcoming: AUCTION_DETAILS.filter((a) => a.status === "upcoming").length,
    ended_today: AUCTION_DETAILS.filter((a) => a.status === "ended" && a.ends_at.startsWith(today)).length,
    total_bids: AUCTION_BIDS.length,
  }

  const filtered = AUCTION_DETAILS
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) => projectFilter === "all" || a.project_id === projectFilter)
    .filter((a) =>
      !search ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      a.project_name.includes(search) ||
      a.company_name.includes(search)
    )

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleAction = () => {
    if (!selected || !actionMode) return
    if ((actionMode === "cancel" || actionMode === "end_early") && !reason.trim()) {
      showError("سبب الإجراء مطلوب")
      return
    }
    if (actionMode === "end_early") showSuccess(`⏹️ تم إنهاء المزاد مبكراً + إعلان ${selected.bid_count > 0 ? "الفائز" : "إلغاء بدون فائز"}`)
    if (actionMode === "refund") showSuccess("💰 تم استرداد رسوم المزاد")
    if (actionMode === "cancel") showSuccess("❌ تم إلغاء المزاد + إشعار المشاركين")
    closeAll()
  }

  const handleCreate = () => {
    if (!newProjectId || newStarting <= 0 || newShares <= 0 || !newStartsAt || !newEndsAt) {
      showError("جميع الحقول مطلوبة وقيم موجبة")
      return
    }
    if (new Date(newEndsAt) <= new Date(newStartsAt)) {
      showError("تاريخ الانتهاء يجب أن يكون بعد البدء")
      return
    }
    const project = ALL_PROJECTS.find((p) => p.id === newProjectId)
    showSuccess(`✅ تم إنشاء مزاد جديد لمشروع ${project?.name || newProjectId}`)
    setShowCreate(false)
    setNewStartsAt("")
    setNewEndsAt("")
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <div className="text-lg font-bold text-white">🔨 إدارة المزادات</div>
          <div className="text-xs text-neutral-500 mt-0.5">إنشاء + متابعة المزادات + إنهاء مبكر + استرداد</div>
        </div>
        <ActionBtn label="+ إنشاء مزاد جديد" color="purple" onClick={() => setShowCreate(true)} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="نشطة" val={stats.active} color="#4ADE80" accent="rgba(74,222,128,0.05)" />
        <KPI label="قادمة" val={stats.upcoming} color="#60A5FA" />
        <KPI label="انتهت اليوم" val={stats.ended_today} color="#a3a3a3" />
        <KPI label="إجمالي العروض" val={fmtNum(stats.total_bids)} color="#FBBF24" />
      </div>

      {/* Search + filter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (id/مشروع/شركة)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل المشاريع</option>
          {ALL_PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد مزادات" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>ID</TH>
            <TH>المشروع</TH>
            <TH>الشركة</TH>
            <TH>الحالة</TH>
            <TH>سعر البدء</TH>
            <TH>أعلى عرض</TH>
            <TH>عروض</TH>
            <TH>الانتهاء</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((a) => {
              const st = STATUS_META[a.status]
              return (
                <TR key={a.id}>
                  <TD><span className="font-mono text-xs text-neutral-300">#{a.id}</span></TD>
                  <TD>{a.project_name}</TD>
                  <TD><span className="text-[11px] text-neutral-400">{a.company_name}</span></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(a.starting_price)}</span></TD>
                  <TD><span className="font-mono text-green-400 font-bold">{fmtNum(a.current_highest_bid)}</span></TD>
                  <TD><span className="font-mono">{a.bid_count}</span></TD>
                  <TD>
                    <span className={cn("text-[11px]", a.status === "active" ? "text-orange-400 font-bold" : "text-neutral-500")}>
                      {a.status === "active" ? timeRemaining(a.ends_at) : formatDateAr(a.ends_at)}
                    </span>
                  </TD>
                  <TD>
                    <ActionBtn label="التفاصيل" color="blue" sm onClick={() => setSelected(a)} />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Detail Modal */}
      {selected && !actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">تفاصيل المزاد</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: General info */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📋 المعلومات العامة</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">المشروع</div>
                  <div className="text-white font-bold">{selected.project_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الشركة</div>
                  <div className="text-white">{selected.company_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">النوع</div>
                  <div className="text-white">{selected.type === "english" ? "إنجليزي (تصاعدي)" : "هولندي (تنازلي)"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">سعر البدء</div>
                  <div className="font-mono text-yellow-400">{fmtNum(selected.starting_price)} د.ع</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الزيادة الدنيا</div>
                  <div className="font-mono text-white">{fmtNum(selected.min_increment)} د.ع</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">الحصص</div>
                  <div className="font-mono text-white">{fmtNum(selected.shares_offered)}</div>
                </div>
              </div>
            </div>

            {/* Section 2: Timing */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">⏱️ التوقيتات</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">بدء المزاد</div>
                  <div className="text-white font-mono">{formatDateAr(selected.starts_at)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">انتهاء المزاد</div>
                  <div className="text-white font-mono">{formatDateAr(selected.ends_at)}</div>
                </div>
              </div>
              {selected.status === "active" && (
                <div className="mt-3 pt-3 border-t border-white/[0.05]">
                  <div className="text-[10px] text-neutral-500 mb-1">الوقت المتبقي</div>
                  <div className="text-base font-bold text-orange-400 font-mono">{timeRemaining(selected.ends_at)}</div>
                </div>
              )}
            </div>

            {/* Section 3: Bids history */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold text-neutral-400">💰 سجلّ العروض ({selected.bid_count})</div>
                <Badge label={`أعلى: ${fmtNum(selected.current_highest_bid)} د.ع`} color="green" />
              </div>
              {(() => {
                const bids = getAuctionBids(selected.id, 20)
                if (bids.length === 0) {
                  return <div className="text-xs text-neutral-500 text-center py-4">لا توجد عروض بعد</div>
                }
                return (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {bids.map((b, i) => (
                      <div
                        key={b.id}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg text-xs",
                          i === 0 ? "bg-green-400/[0.08] border border-green-400/[0.25]" : "bg-white/[0.04] border border-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {i === 0 && <Badge label="🏆 أعلى" color="green" />}
                          <span className="text-white">{b.bidder_name}</span>
                          {b.is_current_user && <span className="text-[9px] text-blue-400">(أنت)</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("font-mono font-bold", i === 0 ? "text-green-400" : "text-white")}>
                            {fmtNum(b.amount)} د.ع
                          </span>
                          <span className="text-[10px] text-neutral-500">{formatDateAr(b.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Footer actions */}
            {selected.status === "active" ? (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn label="⏹️ إنهاء مبكر" color="yellow" onClick={() => setActionMode("end_early")} />
                <ActionBtn label="💰 استرداد رسوم" color="blue" onClick={() => setActionMode("refund")} />
                <ActionBtn label="❌ إلغاء" color="red" onClick={() => setActionMode("cancel")} />
              </div>
            ) : selected.status === "upcoming" ? (
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="❌ إلغاء قبل البدء" color="red" onClick={() => setActionMode("cancel")} />
                <button
                  onClick={closeAll}
                  className="py-2 rounded-md bg-white/[0.05] border border-white/[0.08] text-white text-xs hover:bg-white/[0.08]"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <button
                onClick={closeAll}
                className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {selected && actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "end_early" && "⏹️ إنهاء مبكر للمزاد"}
                {actionMode === "refund" && "💰 استرداد رسوم"}
                {actionMode === "cancel" && "❌ إلغاء المزاد"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={cn(
              "rounded-xl p-3 mb-4 text-xs border",
              actionMode === "end_early" && "bg-yellow-400/[0.05] border-yellow-400/[0.2] text-yellow-400",
              actionMode === "refund" && "bg-blue-400/[0.05] border-blue-400/[0.2] text-blue-400",
              actionMode === "cancel" && "bg-red-400/[0.05] border-red-400/[0.2] text-red-400",
            )}>
              {actionMode === "end_early" && (selected.bid_count > 0
                ? `سيُعلَن الفائز الحالي (${fmtNum(selected.current_highest_bid)} د.ع) ويُنفَّذ تحويل الحصص.`
                : "لا يوجد عروض — المزاد سيُلغى دون فائز.")
              }
              {actionMode === "refund" && "سيتم استرداد رسوم المزاد لجميع المشاركين."}
              {actionMode === "cancel" && "سيتم إلغاء المزاد وإشعار جميع المشاركين. لا يمكن التراجع."}
            </div>

            {(actionMode === "end_early" || actionMode === "cancel") && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الإجراء (إجباري)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="اكتب السبب الذي سيُسجَّل في audit_log..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setReason("") }}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border",
                  actionMode === "end_early" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                  actionMode === "refund" && "bg-blue-500/[0.15] border-blue-500/[0.3] text-blue-400 hover:bg-blue-500/[0.2]",
                  actionMode === "cancel" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                )}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create auction modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div className="text-base font-bold text-white">+ إنشاء مزاد جديد</div>
              <button onClick={() => setShowCreate(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">المشروع</label>
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-3"
            >
              {ALL_PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سعر البدء (د.ع)</label>
                <input
                  type="number"
                  value={newStarting}
                  onChange={(e) => setNewStarting(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">عدد الحصص</label>
                <input
                  type="number"
                  value={newShares}
                  onChange={(e) => setNewShares(Number(e.target.value))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
                />
              </div>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block font-bold">الزيادة الدنيا (د.ع)</label>
            <input
              type="number"
              value={newIncrement}
              onChange={(e) => setNewIncrement(Number(e.target.value))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-3"
            />

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">بدء المزاد</label>
                <input
                  type="datetime-local"
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">انتهاء المزاد</label>
                <input
                  type="datetime-local"
                  value={newEndsAt}
                  onChange={(e) => setNewEndsAt(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2]"
              >
                إنشاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(AUCTION_DETAILS.length)} مزاد
      </div>
    </div>
  )
}
