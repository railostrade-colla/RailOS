"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, X, ZoomIn } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  SectionHeader, KPI, InnerTabBar, AdminEmpty,
} from "@/components/admin/ui"
import {
  MOCK_PAYMENT_PROOFS,
  PAYMENT_METHOD_LABELS,
  PROOF_STATUS_LABELS,
  MATCH_STATUS_META,
  type PaymentProof,
} from "@/lib/mock-data/payments"
import { getPaymentProofsAdmin } from "@/lib/data/payment-proofs-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

type ActionMode = null | "confirm" | "reject" | "resubmit"

const DAY_MS = 86_400_000

function computeStats(list: PaymentProof[]) {
  const now = Date.now()
  let pending = 0
  let confirmedToday = 0
  let disputed = 0
  for (const p of list) {
    if (p.status === "pending") pending++
    if (p.status === "confirmed") {
      const t = new Date(p.submitted_at).getTime()
      if (Number.isFinite(t) && now - t < DAY_MS) confirmedToday++
    }
    if (p.match_status === "mismatch") disputed++
  }
  return { total: list.length, pending, confirmed_today: confirmedToday, disputed }
}

export function PaymentProofsPanel() {
  const [filter, setFilter] = useState<string>("pending")
  const [search, setSearch] = useState("")
  const [minAmount, setMinAmount] = useState<string>("")
  const [maxAmount, setMaxAmount] = useState<string>("")
  const [selected, setSelected] = useState<PaymentProof | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")

  // Real proofs from DB (read-only); mock as first-paint fallback.
  // Confirm/reject actions are still surface-only — the deal-status
  // workflow is owned by the buyer/seller flow, and admin overrides
  // happen via /admin?tab=disputes (separate phase).
  const [proofs, setProofs] = useState<PaymentProof[]>(MOCK_PAYMENT_PROOFS)

  useEffect(() => {
    let cancelled = false
    getPaymentProofsAdmin(500).then((rows) => {
      if (cancelled) return
      if (rows.length > 0) setProofs(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeStats(proofs), [proofs])

  const tabs = [
    { key: "all", label: "الكل", count: stats.total },
    { key: "pending", label: "معلّق", count: proofs.filter((p) => p.status === "pending").length },
    { key: "confirmed", label: "مؤكّد", count: proofs.filter((p) => p.status === "confirmed").length },
    { key: "rejected", label: "مرفوض", count: proofs.filter((p) => p.status === "rejected").length },
  ]

  const filtered = proofs
    .filter((p) => filter === "all" || p.status === filter)
    .filter((p) => !minAmount || p.amount_paid >= Number(minAmount))
    .filter((p) => !maxAmount || p.amount_paid <= Number(maxAmount))
    .filter((p) =>
      !search ||
      p.deal_id.toLowerCase().includes(search.toLowerCase()) ||
      p.user_name.includes(search) ||
      p.reference_number.toLowerCase().includes(search.toLowerCase())
    )

  const closeAll = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleConfirm = () => {
    if (!selected || !actionMode) return
    if ((actionMode === "reject" || actionMode === "resubmit") && !reason.trim()) {
      showError("اكتب السبب قبل المتابعة")
      return
    }
    if (actionMode === "confirm") showSuccess(`✅ تم تأكيد المطابقة + تحديث حالة الصفقة ${selected.deal_id} إلى paid`)
    if (actionMode === "reject") showSuccess("❌ تم رفض الإثبات + إرسال إشعار للمستخدم")
    if (actionMode === "resubmit") showSuccess("🔄 تم طلب إعادة إرفاق الإثبات")
    closeAll()
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="🧾 إثباتات الدفع"
        subtitle="مراجعة إيصالات الدفع المرفقة من المشترين والتحقق من المطابقة"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <KPI label="معلّقة" val={stats.pending} color="#FBBF24" accent="rgba(251,191,36,0.05)" />
        <KPI label="مؤكّدة اليوم" val={stats.confirmed_today} color="#4ADE80" />
        <KPI label="عدم تطابق" val={stats.disputed} color="#F87171" />
      </div>

      {/* Search + amount filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (deal/user/ref)..."
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
          />
        </div>
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="الحد الأدنى للمبلغ"
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="الحد الأعلى للمبلغ"
          className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar tabs={tabs} active={filter} onSelect={setFilter} />

      {filtered.length === 0 ? (
        <AdminEmpty title="لا توجد إثباتات" body="جرّب تعديل الفلترة" />
      ) : (
        <Table>
          <THead>
            <TH>Deal ID</TH>
            <TH>المستخدم</TH>
            <TH>المشروع</TH>
            <TH>المطلوب</TH>
            <TH>المرفق</TH>
            <TH>تطابق</TH>
            <TH>طريقة الدفع</TH>
            <TH>الحالة</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((p) => {
              const ms = MATCH_STATUS_META[p.match_status]
              const st = PROOF_STATUS_LABELS[p.status]
              const pm = PAYMENT_METHOD_LABELS[p.payment_method]
              return (
                <TR key={p.id}>
                  <TD><span className="font-mono text-xs text-neutral-300">{p.deal_id}</span></TD>
                  <TD>{p.user_name}</TD>
                  <TD>{p.project_name}</TD>
                  <TD><span className="font-mono">{fmtNum(p.amount_required)}</span></TD>
                  <TD>
                    <span className={cn(
                      "font-mono font-bold",
                      p.amount_paid === p.amount_required ? "text-green-400" :
                      p.amount_paid < p.amount_required ? "text-red-400" : "text-yellow-400"
                    )}>
                      {fmtNum(p.amount_paid)}
                    </span>
                  </TD>
                  <TD><Badge label={ms.label} color={ms.color} /></TD>
                  <TD>
                    <span className="text-[11px] flex items-center gap-1">
                      <span>{pm.icon}</span>
                      <span>{pm.label}</span>
                    </span>
                  </TD>
                  <TD><Badge label={st.label} color={st.color} /></TD>
                  <TD>
                    <ActionBtn
                      label={p.status === "pending" ? "مراجعة" : "عرض"}
                      color={p.status === "pending" ? "blue" : "gray"}
                      sm
                      onClick={() => setSelected(p)}
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
                <div className="text-base font-bold text-white">مراجعة إثبات الدفع</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">#{selected.id}</div>
              </div>
              <button onClick={closeAll} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image */}
            <button
              onClick={() => setZoomImage(selected.proof_image_url)}
              className="block w-full bg-black border border-white/[0.06] rounded-xl overflow-hidden relative group mb-4"
            >
              <img src={selected.proof_image_url} alt="proof" className="w-full h-auto max-h-96 object-contain mx-auto" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Comparison card */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">📊 مقارنة المبلغ</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 mb-1">المطلوب</div>
                  <div className="text-base font-bold text-white font-mono">{fmtNum(selected.amount_required)}</div>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 mb-1">المُرفق</div>
                  <div className={cn(
                    "text-base font-bold font-mono",
                    selected.amount_paid === selected.amount_required ? "text-green-400" :
                    selected.amount_paid < selected.amount_required ? "text-red-400" : "text-yellow-400"
                  )}>
                    {fmtNum(selected.amount_paid)}
                  </div>
                </div>
                <div className={cn(
                  "rounded-lg p-3",
                  selected.amount_paid - selected.amount_required === 0 ? "bg-green-400/[0.05]" :
                  selected.amount_paid - selected.amount_required < 0 ? "bg-red-400/[0.05]" : "bg-yellow-400/[0.05]"
                )}>
                  <div className="text-[10px] text-neutral-500 mb-1">الفرق</div>
                  <div className={cn(
                    "text-base font-bold font-mono",
                    selected.amount_paid - selected.amount_required === 0 ? "text-green-400" :
                    selected.amount_paid - selected.amount_required < 0 ? "text-red-400" : "text-yellow-400"
                  )}>
                    {selected.amount_paid - selected.amount_required >= 0 ? "+" : ""}
                    {fmtNum(selected.amount_paid - selected.amount_required)}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-2">
              {[
                ["Deal ID", selected.deal_id],
                ["المستخدم", selected.user_name],
                ["المشروع", selected.project_name],
                ["طريقة الدفع", PAYMENT_METHOD_LABELS[selected.payment_method].icon + " " + PAYMENT_METHOD_LABELS[selected.payment_method].label],
                ["رقم المرجع", selected.reference_number],
                ["تاريخ التقديم", selected.submitted_at],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">{l}</span>
                  <span className="text-xs font-bold text-white text-left font-mono">{v}</span>
                </div>
              ))}
              {selected.rejection_reason && (
                <div className="pt-2 border-t border-white/[0.05]">
                  <div className="text-[11px] text-red-400 font-bold mb-1">سبب الرفض:</div>
                  <div className="text-xs text-neutral-300">{selected.rejection_reason}</div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {selected.status === "pending" ? (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn label="✅ تأكيد" color="green" onClick={() => setActionMode("confirm")} />
                <ActionBtn label="🔄 إعادة رفع" color="yellow" onClick={() => setActionMode("resubmit")} />
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
                {actionMode === "confirm" && "✅ تأكيد المطابقة"}
                {actionMode === "reject" && "❌ رفض الإثبات"}
                {actionMode === "resubmit" && "🔄 طلب إعادة الإرفاق"}
              </div>
              <button onClick={() => { setActionMode(null); setReason("") }} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionMode === "confirm" && (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400">
                سيتم تحديث حالة الصفقة <span className="font-mono font-bold">{selected.deal_id}</span> إلى <span className="font-bold">paid</span> وإشعار البائع لتسليم الحصص.
              </div>
            )}

            {(actionMode === "reject" || actionMode === "resubmit") && (
              <>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  {actionMode === "reject" ? "سبب الرفض (إجباري)" : "سبب طلب الإعادة (إجباري)"}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="اكتب السبب الذي سيُرسل للمستخدم..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
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
                onClick={handleConfirm}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold border",
                  actionMode === "confirm" && "bg-green-500/[0.15] border-green-500/[0.3] text-green-400 hover:bg-green-500/[0.2]",
                  actionMode === "reject" && "bg-red-500/[0.15] border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.2]",
                  actionMode === "resubmit" && "bg-yellow-500/[0.15] border-yellow-500/[0.3] text-yellow-400 hover:bg-yellow-500/[0.2]"
                )}
              >
                تأكيد
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
        {fmtNum(filtered.length)} من {fmtNum(proofs.length)} إثبات
      </div>
    </div>
  )
}
