"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, X, ZoomIn } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_FEE_REQUESTS,
  FEE_REQUEST_PAYMENT_LABELS,
  FEE_REQUEST_STATUS_LABELS,
  USER_LEVEL_LABELS,
  type FeeUnitRequest,
} from "@/lib/mock-data/feeUnits"
import {
  getFeeRequestsAdmin,
  approveFeeRequest,
  rejectFeeRequest,
} from "@/lib/data/fee-requests-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = null | "approve" | "approve_modified" | "reject"

const DAY_MS = 86_400_000

function computeStats(list: FeeUnitRequest[]) {
  let pendingCount = 0
  let pendingAmount = 0
  let approvedToday = 0
  let totalInflow = 0
  const now = Date.now()
  for (const r of list) {
    if (r.status === "pending") {
      pendingCount++
      pendingAmount += r.requested_units
    }
    if (r.status === "approved") {
      const credited = r.approved_units ?? r.requested_units
      totalInflow += credited
      const t = new Date(r.submitted_at).getTime()
      if (Number.isFinite(t) && now - t < DAY_MS) approvedToday++
    }
  }
  return {
    pending_count: pendingCount,
    pending_amount: pendingAmount,
    approved_today: approvedToday,
    total_inflow: totalInflow,
  }
}

export function FeeUnitsRequestsPanel() {
  const [filter, setFilter] = useState<string>("pending")
  const [search, setSearch] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [selected, setSelected] = useState<FeeUnitRequest | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")
  const [modifiedAmount, setModifiedAmount] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  // Production mode — DB only.
  const [requests, setRequests] = useState<FeeUnitRequest[]>([])

  const refresh = useCallback(async () => {
    const rows = await getFeeRequestsAdmin(500)
    setRequests(rows)
  }, [])

  useEffect(() => {
    let cancelled = false
    getFeeRequestsAdmin(500).then((rows) => {
      if (cancelled) return
      setRequests(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeStats(requests), [requests])

  const tabs = [
    { key: "all", label: "الكل", count: requests.length },
    { key: "pending", label: "معلّقة", count: requests.filter((r) => r.status === "pending").length },
    { key: "approved", label: "مُوافَق", count: requests.filter((r) => r.status === "approved").length },
    { key: "rejected", label: "مرفوض", count: requests.filter((r) => r.status === "rejected").length },
  ]

  const filtered = requests
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => methodFilter === "all" || r.payment_method === methodFilter)
    .filter((r) =>
      !search ||
      r.user_name.includes(search) ||
      r.user_email.toLowerCase().includes(search.toLowerCase()) ||
      r.reference_number.toLowerCase().includes(search.toLowerCase())
    )

  const openReview = (r: FeeUnitRequest) => {
    setSelected(r)
    setActionMode(null)
    setReason("")
    setModifiedAmount(r.requested_units)
  }

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleConfirm = async () => {
    if (!selected || !actionMode || submitting) return
    if (actionMode === "reject" && !reason.trim()) {
      showError("اكتب سبب الرفض")
      return
    }
    if (actionMode === "approve_modified" && modifiedAmount <= 0) {
      showError("الرقم المُعدَّل يجب أن يكون موجباً")
      return
    }

    setSubmitting(true)
    try {
      if (actionMode === "approve") {
        const r = await approveFeeRequest(selected.id)
        if (!r.success) {
          showError(r.error || "تعذّر تنفيذ الموافقة")
          return
        }
        showSuccess(`✅ تمت الموافقة + شحن ${fmtNum(r.amount_credited ?? selected.requested_units)} وحدة`)
      } else if (actionMode === "approve_modified") {
        const r = await approveFeeRequest(selected.id, modifiedAmount)
        if (!r.success) {
          showError(r.error || "تعذّر تنفيذ الموافقة المعدّلة")
          return
        }
        showSuccess(`✅ تمت الموافقة بـ ${fmtNum(r.amount_credited ?? modifiedAmount)} وحدة`)
      } else if (actionMode === "reject") {
        const r = await rejectFeeRequest(selected.id, reason)
        if (!r.success) {
          showError(r.error || "تعذّر تنفيذ الرفض")
          return
        }
        showSuccess("❌ تم رفض الطلب + إرسال السبب للمستخدم")
      }
      await refresh()
      closeAll()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="💎 طلبات شحن وحدات الرسوم"
        subtitle="مراجعة طلبات الشحن من المستخدمين والتحقق من إثباتات الدفع"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPI label="معلّقة (طلبات)" val={stats.pending_count} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="مبلغ مُعلَّق" val={fmtNum(stats.pending_amount) + " د.ع"} color="#FBBF24" />
        <KPI label="مُوافَق اليوم" val={stats.approved_today} color="#4ADE80" />
        <KPI label="إجمالي الوحدات المُحوَّلة" val={fmtNum(stats.total_inflow)} color="#60A5FA" />
      </div>

      {/* Search + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (اسم/بريد/رقم مرجع)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="all">كل طرق الدفع</option>
          {Object.entries(FEE_REQUEST_PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد طلبات" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>المستخدم</TH>
            <TH>المستوى</TH>
            <TH>الوحدات</TH>
            <TH>المبلغ</TH>
            <TH>طريقة الدفع</TH>
            <TH>المرجع</TH>
            <TH>الحالة</TH>
            <TH>تاريخ التقديم</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((r) => {
              const lvl = USER_LEVEL_LABELS[r.user_level]
              const pm = FEE_REQUEST_PAYMENT_LABELS[r.payment_method]
              const st = FEE_REQUEST_STATUS_LABELS[r.status]
              return (
                <TR key={r.id}>
                  <TD>
                    <div>
                      <div className="text-xs text-white font-bold">{r.user_name}</div>
                      <div className="text-[10px] text-neutral-500" dir="ltr">{r.user_email}</div>
                    </div>
                  </TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{lvl.icon}</span>
                      <span>{lvl.label}</span>
                    </span>
                  </TD>
                  <TD><span className="font-mono text-blue-400 font-bold">{fmtNum(r.requested_units)}</span></TD>
                  <TD><span className="font-mono text-yellow-400">{fmtNum(r.amount_paid)} د.ع</span></TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </span>
                  </TD>
                  <TD><span className="font-mono text-[10px] text-neutral-400">{r.reference_number}</span></TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD><span className="text-neutral-500 text-[11px]">{r.submitted_at}</span></TD>
                  <TD>
                    <ActionBtn
                      label={r.status === "pending" ? "مراجعة" : "عرض"}
                      color={r.status === "pending" ? "blue" : "gray"}
                      sm
                      onClick={() => openReview(r)}
                    />
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* Review Modal */}
      {selected && !actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-base font-bold text-white">مراجعة طلب الشحن</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info + balance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-[11px] font-bold text-neutral-400 mb-2">👤 المستخدم</div>
                <div className="text-sm text-white font-bold">{selected.user_name}</div>
                <div className="text-[11px] text-neutral-500 mb-2" dir="ltr">{selected.user_email}</div>
                <div className="text-[11px] flex items-center gap-1">
                  <span>{USER_LEVEL_LABELS[selected.user_level].icon}</span>
                  <span className="text-neutral-300">{USER_LEVEL_LABELS[selected.user_level].label}</span>
                </div>
              </div>
              <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-4">
                <div className="text-[11px] font-bold text-purple-400 mb-2">💎 الرصيد الحالي</div>
                <div className="text-2xl font-bold text-white font-mono">{fmtNum(selected.current_balance)}</div>
                <div className="text-[10px] text-neutral-500">وحدة</div>
              </div>
            </div>

            {/* Request details */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2.5">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📋 تفاصيل الطلب</div>
              {[
                ["الوحدات المطلوبة", fmtNum(selected.requested_units) + " وحدة"],
                ["المبلغ المدفوع", fmtNum(selected.amount_paid) + " د.ع"],
                ["طريقة الدفع", FEE_REQUEST_PAYMENT_LABELS[selected.payment_method].icon + " " + FEE_REQUEST_PAYMENT_LABELS[selected.payment_method].label],
                ["رقم المرجع", selected.reference_number],
                ["تاريخ التقديم", selected.submitted_at],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white text-left font-mono">{v}</span>
                </div>
              ))}
              {selected.approved_units !== undefined && selected.approved_units !== selected.requested_units && (
                <div className="flex justify-between gap-3 pt-2 border-t border-white/[0.05]">
                  <span className="text-[11px] text-yellow-400">المبلغ المُوافَق</span>
                  <span className="text-xs font-bold text-yellow-400 font-mono">{fmtNum(selected.approved_units)} وحدة</span>
                </div>
              )}
              {selected.rejection_reason && (
                <div className="pt-2 border-t border-white/[0.05]">
                  <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض:</div>
                  <div className="text-xs text-neutral-300">{selected.rejection_reason}</div>
                </div>
              )}
            </div>

            {/* Proof image */}
            <div className="mb-5">
              <div className="text-[11px] font-bold text-neutral-400 mb-2">🧾 صورة الإثبات</div>
              <button
                onClick={() => setZoomImage(selected.proof_image_url)}
                className="block w-full max-w-sm mx-auto bg-black border border-white/[0.06] rounded-xl overflow-hidden relative group"
              >
                <img src={selected.proof_image_url} alt="proof" className="w-full h-auto" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                  <ZoomIn className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>

            {/* Footer actions */}
            {selected.status === "pending" ? (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn label="✅ موافقة" color="green" onClick={() => setActionMode("approve")} />
                <ActionBtn label="✏️ تعديل المبلغ" color="yellow" onClick={() => setActionMode("approve_modified")} />
                <ActionBtn label="❌ رفض" color="red" onClick={() => setActionMode("reject")} />
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

      {/* Confirm Modal */}
      {selected && actionMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "approve" && "✅ تأكيد الموافقة"}
                {actionMode === "approve_modified" && "✏️ موافقة بمبلغ مُعدَّل"}
                {actionMode === "reject" && "❌ تأكيد الرفض"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionMode === "approve_modified" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">المبلغ المُوافَق (وحدة)</label>
                <input
                  type="number"
                  value={modifiedAmount}
                  onChange={(e) => setModifiedAmount(Number(e.target.value))}
                  min={1}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-3"
                />
                <div className="text-[11px] text-neutral-500 mb-4">
                  المطلوب: <span className="font-mono">{fmtNum(selected.requested_units)}</span> ·
                  المُعدَّل: <span className="font-mono text-yellow-400">{fmtNum(modifiedAmount)}</span>
                </div>
              </>
            )}

            {actionMode === "reject" && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">سبب الرفض (إجباري)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="اكتب السبب الذي سيُرسل للمستخدم..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
                />
              </>
            )}

            {actionMode === "approve" && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
                سيتم إضافة <span className="font-bold font-mono">{fmtNum(selected.requested_units)}</span> وحدة لرصيد <span className="font-bold">{selected.user_name}</span>. الرصيد الجديد: <span className="font-bold font-mono">{fmtNum(selected.current_balance + selected.requested_units)}</span> وحدة.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setActionMode(null); setReason("") }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border disabled:opacity-50",
                  actionMode === "approve" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "approve_modified" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]",
                  actionMode === "reject" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]"
                )}
              >
                {submitting ? "جاري التنفيذ..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 left-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={zoomImage} alt="zoom" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <div className="mt-6 text-[10px] text-neutral-600 font-mono">
        {fmtNum(filtered.length)} من {fmtNum(requests.length)} طلب
      </div>
    </div>
  )
}
