"use client"

/**
 * ShareRequestsPanel — Phase 10.66 redesign.
 *
 * Shows USER share-purchase requests (deals + payment proofs), not
 * admin-side share-count modifications (those live at /admin?tab=
 * share_modification).
 *
 * Each row displays everything the admin needs to process a request:
 *   • Buyer + seller (with email + username)
 *   • Project + shares_amount + total_amount
 *   • Payment method + transaction reference + proof image (zoomable)
 *   • Deal status badge + dispute flag
 *
 * Actions per row:
 *   • فاتورة     → /deals/[id] (full invoice + timeline)
 *   • ✅ تأكيد   → admin_confirm_deal_payment (force completion)
 *   • ❌ إلغاء   → admin_cancel_deal (with reason)
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { Search, X, ZoomIn, Image as ImageIcon, AlertTriangle } from "lucide-react"
import {
  Badge, ActionBtn, Table, THead, TH, TBody, TR, TD,
  KPI, AdminEmpty, InnerTabBar,
} from "@/components/admin/ui"
import {
  getSharePurchaseRequestsAdmin,
  adminConfirmDealPayment,
  adminCancelDeal,
  type SharePurchaseRequestRow,
  type RequestStatusFilter,
} from "@/lib/data/share-purchase-requests"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import { DealInvoiceModal } from "./DealInvoiceModal"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtMoney = (n: number) => fmtNum(n) + " د.ع"
const fmtDate = (iso: string | null | undefined) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—"

const STATUS_META: Record<
  string,
  { label: string; color: "gray" | "yellow" | "blue" | "green" | "red" | "purple" }
> = {
  pending_seller_approval: { label: "بانتظار البائع",   color: "gray"   },
  accepted:                { label: "مقبولة",            color: "blue"   },
  payment_submitted:       { label: "تم رفع الإثبات",   color: "yellow" },
  completed:               { label: "مكتملة",           color: "green"  },
  disputed:                { label: "نزاع",              color: "red"    },
  rejected:                { label: "مرفوضة",            color: "red"    },
  cancelled:               { label: "ملغاة",             color: "gray"   },
  expired:                 { label: "انتهت المهلة",     color: "gray"   },
}

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  zain_cash:     { label: "زين كاش",        icon: "💰" },
  master_card:   { label: "ماستركارد",      icon: "💳" },
  bank_transfer: { label: "تحويل بنكي",     icon: "🏦" },
  asia_hawala:   { label: "حوالة آسيا",      icon: "🏧" },
  ki_card:       { label: "Ki Card",         icon: "💳" },
  other:         { label: "أخرى",            icon: "💵" },
}

type ActionMode = null | "confirm" | "cancel"

/**
 * Phase 11.21 — `compact` prop strips the title block + KPI grid for
 * the embedded Order-Center usage. The full version (Shares & Trading
 * page) keeps both. Founder spec: "اضهر فقط الطلبات فقط جدول الطلبات
 * الموشر داخل المربع الاحمر ... اما باقي البيانات تضهر في صفحة الحصص
 * والتداول لاتغير هذه الصفحة".
 */
export interface ShareRequestsPanelProps {
  /** When true, hides the page title + 6-card KPI grid. Default false. */
  compact?: boolean
}

export function ShareRequestsPanel({ compact = false }: ShareRequestsPanelProps = {}) {
  const [rows, setRows] = useState<SharePurchaseRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  // Phase 10.99f — default filter is now "pending" (بانتظار الدفع) so
  // direct-buy requests appear front-and-centre when admin opens this tab.
  const [filter, setFilter] = useState<RequestStatusFilter>("pending")
  const [search, setSearch] = useState("")

  // Detail modal
  const [selected, setSelected] = useState<SharePurchaseRequestRow | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // Phase 10.99f — invoice modal target (deal currently being printed)
  const [invoiceFor, setInvoiceFor] = useState<SharePurchaseRequestRow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getSharePurchaseRequestsAdmin("all", 500)
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Phase 10.99e — `pending_payment` is the status set by submit_direct_buy_request.
  // Treat it as a pending state alongside pending_seller_approval / accepted so
  // direct-buy requests appear in the "بانتظار الدفع" filter from the moment
  // the user submits, before the proof is reviewed.
  const PENDING_STATUSES = ["pending_payment", "pending_seller_approval", "accepted"]

  const stats = useMemo(() => {
    const isPending = (s: string) => PENDING_STATUSES.includes(s)
    const isSubmitted = (s: string) => s === "payment_submitted"
    const isDisputed = (s: string) => s === "disputed"
    const isCompleted = (s: string) => s === "completed"
    return {
      total:     rows.length,
      pending:   rows.filter((r) => isPending(r.status)).length,
      submitted: rows.filter((r) => isSubmitted(r.status)).length,
      disputed:  rows.filter((r) => isDisputed(r.status) || r.has_dispute).length,
      completed: rows.filter((r) => isCompleted(r.status)).length,
      total_volume: rows
        .filter((r) => isCompleted(r.status))
        .reduce((s, r) => s + r.total_amount, 0),
    }
  }, [rows])

  const filtered = useMemo(() => {
    const isPending = (s: string) => PENDING_STATUSES.includes(s)
    const isSubmitted = (s: string) => s === "payment_submitted"
    const isDisputed = (s: string) => s === "disputed"
    const isCompleted = (s: string) => s === "completed"
    const isCancelled = (s: string) => ["cancelled", "rejected", "expired"].includes(s)

    return rows.filter((r) => {
      if (filter === "pending" && !isPending(r.status)) return false
      if (filter === "submitted" && !isSubmitted(r.status)) return false
      if (filter === "disputed" && !isDisputed(r.status) && !r.has_dispute) return false
      if (filter === "completed" && !isCompleted(r.status)) return false
      if (filter === "cancelled" && !isCancelled(r.status)) return false

      if (search) {
        const q = search.toLowerCase()
        const hay = [
          r.id, r.buyer_name, r.buyer_email ?? "", r.buyer_username ?? "",
          r.seller_name, r.project_name ?? "",
          r.payment_proof?.transaction_reference ?? "",
        ].join(" ").toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filter, search])

  const closeDetail = () => {
    setSelected(null)
    setActionMode(null)
    setReason("")
  }

  const handleAction = async () => {
    if (!selected || !actionMode) return
    setSubmitting(true)
    let result
    if (actionMode === "confirm") {
      result = await adminConfirmDealPayment(selected.id)
    } else {
      if (!reason.trim()) {
        setSubmitting(false)
        return showError("اكتب سبب الإلغاء")
      }
      result = await adminCancelDeal(selected.id, reason.trim())
    }
    setSubmitting(false)

    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated:   "سجّل دخولك أولاً",
        not_admin:         "صلاحياتك لا تسمح",
        not_found:         "الطلب غير موجود",
        invalid_status:    "حالة الصفقة لا تسمح",
        already_completed: "الصفقة مكتملة بالفعل",
      }
      return showError(map[result.reason ?? ""] ?? "فشل الإجراء")
    }

    showSuccess(
      actionMode === "confirm"
        ? "✅ تم تأكيد الدفعة + تحويل الحصص"
        : "❌ تم إلغاء الطلب + إخطار الطرفين",
    )
    closeDetail()
    refresh()
  }

  return (
    <div className={cn("max-w-screen-2xl", compact ? "p-4" : "p-6")}>
      {/* Phase 11.21 — title + KPI grid hidden in compact mode (Order Center).
          Full version (Shares & Trading page) keeps them. */}
      {!compact && (
        <>
          <div className="flex justify-between items-start mb-4 gap-3">
            <div>
              <div className="text-lg font-bold text-white">📥 طلبات شراء الحصص</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                استقبال طلبات المستخدمين + مراجعة إثباتات الدفع + تأكيد/إلغاء
              </div>
            </div>
            <ActionBtn label="🔄 تحديث" color="gray" sm onClick={refresh} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            <KPI label="الإجمالي" val={fmtNum(stats.total)} color="#fff" />
            <KPI label="بانتظار الدفع" val={fmtNum(stats.pending)} color="#a3a3a3" />
            <KPI
              label="إثباتات معلّقة"
              val={fmtNum(stats.submitted)}
              color="#FBBF24"
              accent={stats.submitted > 0 ? "rgba(251,191,36,0.05)" : undefined}
            />
            <KPI
              label="نزاعات"
              val={fmtNum(stats.disputed)}
              color="#F87171"
              accent={stats.disputed > 0 ? "rgba(248,113,113,0.05)" : undefined}
            />
            <KPI label="مكتملة" val={fmtNum(stats.completed)} color="#4ADE80" />
            <KPI label="حجم التداول" val={fmtMoney(stats.total_volume)} color="#FBBF24" />
          </div>
        </>
      )}

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث (مشتري / بائع / مشروع / مرجع المعاملة)..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/20"
        />
      </div>

      <InnerTabBar
        tabs={[
          { key: "submitted", label: "📥 إثباتات معلّقة", count: stats.submitted },
          { key: "pending", label: "⏳ بانتظار الدفع", count: stats.pending },
          { key: "disputed", label: "⚖ نزاعات", count: stats.disputed },
          { key: "completed", label: "✅ مكتملة", count: stats.completed },
          { key: "cancelled", label: "❌ ملغاة" },
          { key: "all", label: "الكل", count: stats.total },
        ]}
        active={filter}
        onSelect={(k) => setFilter(k as RequestStatusFilter)}
      />

      {loading ? (
        <AdminEmpty title="جاري التحميل..." />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          title="لا توجد طلبات"
          body={
            rows.length === 0
              ? "لم يتقدّم أي مستخدم بطلب شراء حصص بعد. عند تنفيذ أوّل صفقة سيظهر الطلب هنا."
              : "لا تطابق نتائج للفلتر/البحث الحالي."
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>التاريخ</TH>
            <TH>المشتري</TH>
            <TH>البائع</TH>
            <TH>المشروع</TH>
            <TH>الحصص</TH>
            <TH>المبلغ</TH>
            <TH>طريقة الدفع</TH>
            <TH>الإثبات</TH>
            <TH>إجراءات</TH>
          </THead>
          <TBody>
            {filtered.map((r) => {
              const pm = r.payment_proof
                ? PAYMENT_METHOD_LABELS[r.payment_proof.payment_method] ?? PAYMENT_METHOD_LABELS.other
                : null
              return (
                <TR key={r.id}>
                  <TD>
                    <span className="text-[11px] text-neutral-500" dir="ltr">
                      {fmtDate(r.created_at)}
                    </span>
                  </TD>
                  <TD>
                    <div className="min-w-0">
                      <div className="text-xs text-white font-bold truncate">{r.buyer_name}</div>
                      <div className="text-[10px] text-neutral-500 truncate" dir="ltr">
                        {r.buyer_email ?? r.buyer_username ?? "—"}
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="text-xs text-neutral-300">{r.seller_name}</span>
                  </TD>
                  <TD>
                    <span className="text-xs text-blue-400">{r.project_name ?? "—"}</span>
                  </TD>
                  <TD>
                    <span className="font-mono text-xs text-purple-400">
                      {fmtNum(r.shares_amount)}
                    </span>
                  </TD>
                  <TD>
                    <span className="font-mono text-xs text-yellow-400">
                      {fmtMoney(r.total_amount)}
                    </span>
                  </TD>
                  <TD>
                    {pm ? (
                      <span className="text-[11px] flex items-center gap-1 text-neutral-300">
                        <span>{pm.icon}</span>
                        <span>{pm.label}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-600">—</span>
                    )}
                  </TD>
                  <TD>
                    {r.payment_proof?.proof_image_url ? (
                      <button
                        onClick={() => setZoomImage(r.payment_proof!.proof_image_url)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <ImageIcon className="w-3 h-3" />
                        عرض
                      </button>
                    ) : (
                      <span className="text-[10px] text-neutral-600">—</span>
                    )}
                  </TD>
                  <TD>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <ActionBtn
                        label="عرض"
                        color="blue"
                        sm
                        onClick={() => setSelected(r)}
                      />
                      <ActionBtn
                        label="فاتورة"
                        color="gray"
                        sm
                        onClick={() => setInvoiceFor(r)}
                      />
                      {r.has_dispute && (
                        <span title="نزاع مفتوح">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        </span>
                      )}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      {/* ═══ Detail Modal ═══ */}
      {selected && !actionMode && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          onClick={closeDetail}
        >
          <div
            className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
              <div>
                <div className="text-sm font-bold text-white">📥 تفاصيل طلب شراء الحصص</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 font-mono" dir="ltr">
                  Deal #{selected.id.slice(0, 8)}
                </div>
              </div>
              <button onClick={closeDetail} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Phase 11.02 — Proof image is ALWAYS rendered as a section.
                  When present → image with zoom-on-click.
                  When missing → friendly placeholder (so admin can see at
                  a glance that the buyer has not uploaded a proof yet). */}
              <div>
                <div className="text-[11px] font-bold text-neutral-400 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  صورة إثبات الدفع
                </div>
                {selected.payment_proof?.proof_image_url ? (
                  <button
                    onClick={() => setZoomImage(selected.payment_proof!.proof_image_url)}
                    className="block w-full bg-black border border-white/[0.06] rounded-xl overflow-hidden relative group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.payment_proof.proof_image_url}
                      alt="إثبات الدفع"
                      className="w-full h-auto max-h-80 object-contain mx-auto"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute top-2 right-2 bg-green-400/15 border border-green-400/30 rounded px-2 py-0.5">
                      <span className="text-[10px] text-green-300 font-bold">✓ تم الرفع</span>
                    </div>
                  </button>
                ) : (
                  <div className="bg-yellow-400/[0.04] border-2 border-dashed border-yellow-400/[0.2] rounded-xl p-6 text-center">
                    <ImageIcon className="w-8 h-8 text-yellow-400/60 mx-auto mb-2" strokeWidth={1.5} />
                    <div className="text-xs text-yellow-300 font-bold mb-1">
                      لم يرفع المشتري صورة إثبات الدفع بعد
                    </div>
                    <div className="text-[10px] text-neutral-500 leading-relaxed">
                      انتظر حتى يقوم المشتري بإكمال رفع الصورة، أو راجع الصفقة لمعرفة السبب.
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
                <Field label="المشتري" value={selected.buyer_name} />
                <Field label="بريد المشتري" value={selected.buyer_email ?? "—"} dir="ltr" />
                <Field label="البائع" value={selected.seller_name} />
                <Field label="المشروع" value={selected.project_name ?? "—"} />
                <Field label="عدد الحصص" value={fmtNum(selected.shares_amount)} />
                <Field label="إجمالي المبلغ"
                  value={<span className="text-yellow-400 font-mono font-bold">{fmtMoney(selected.total_amount)}</span>} />
                <Field label="تاريخ الإنشاء" value={fmtDate(selected.created_at)} dir="ltr" />
                <Field label="الحالة"
                  value={<Badge
                    label={STATUS_META[selected.status]?.label ?? selected.status}
                    color={STATUS_META[selected.status]?.color ?? "gray"} />} />
              </div>

              {/* Payment proof details */}
              {selected.payment_proof && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">🧾 بيانات الدفع</div>
                  <Field
                    label="طريقة الدفع"
                    value={
                      (PAYMENT_METHOD_LABELS[selected.payment_proof.payment_method] ?? PAYMENT_METHOD_LABELS.other).icon +
                      " " +
                      (PAYMENT_METHOD_LABELS[selected.payment_proof.payment_method] ?? PAYMENT_METHOD_LABELS.other).label
                    }
                  />
                  <Field
                    label="المبلغ المُرفق"
                    value={
                      <span className={cn(
                        "font-mono font-bold",
                        selected.payment_proof.amount_paid === selected.total_amount
                          ? "text-green-400"
                          : selected.payment_proof.amount_paid < selected.total_amount
                          ? "text-red-400"
                          : "text-yellow-400",
                      )}>
                        {fmtMoney(selected.payment_proof.amount_paid)}
                      </span>
                    }
                  />
                  {selected.payment_proof.transaction_reference && (
                    <Field
                      label="رقم المرجع"
                      value={selected.payment_proof.transaction_reference}
                      dir="ltr"
                    />
                  )}
                  <Field
                    label="تاريخ رفع الإثبات"
                    value={fmtDate(selected.payment_proof.submitted_at)}
                    dir="ltr"
                  />
                  {selected.payment_proof.notes && (
                    <Field label="ملاحظات" value={selected.payment_proof.notes} />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-white/[0.06] sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur grid grid-cols-3 gap-2">
              <ActionBtn
                label="📄 فاتورة + عقد ملكية"
                color="blue"
                onClick={() => setInvoiceFor(selected)}
              />
              {selected.status !== "completed" && (
                <>
                  <ActionBtn label="✅ تأكيد الدفع" color="green" onClick={() => setActionMode("confirm")} />
                  <ActionBtn label="❌ إلغاء" color="red" onClick={() => setActionMode("cancel")} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Confirm/Cancel modal ═══ */}
      {selected && actionMode && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !submitting && closeDetail()}
        >
          <div
            className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {actionMode === "confirm" ? "✅ تأكيد الدفع" : "❌ إلغاء الطلب"}
              </div>
              <button onClick={closeDetail} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionMode === "confirm" ? (
              <div className="bg-green-400/[0.05] border border-green-400/[0.2] rounded-xl p-3 mb-4 text-xs text-green-400 leading-relaxed">
                سيتم تأكيد الدفعة + تحويل <span className="font-bold">{fmtNum(selected.shares_amount)}</span> حصة
                إلى محفظة المشتري + إخطار الطرفين.
              </div>
            ) : (
              <>
                <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-3 text-xs text-red-400 leading-relaxed">
                  سيتم إلغاء الطلب + إعادة الحصص للبائع + إخطار الطرفين بالسبب.
                </div>
                <label className="text-xs text-neutral-400 mb-2 block font-bold">
                  سبب الإلغاء (إجباري — يُرسَل للطرفين)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="مثلاً: إثبات الدفع غير صحيح / لم يتم استلام المبلغ..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none resize-none mb-4"
                />
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeDetail}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors",
                  actionMode === "confirm"
                    ? "bg-green-500/[0.15] border-green-500/[0.3] text-green-300 hover:bg-green-500/[0.2]"
                    : "bg-red-500/[0.15] border-red-500/[0.3] text-red-300 hover:bg-red-500/[0.2]",
                  "disabled:opacity-50",
                )}
              >
                {submitting ? "جاري..." : "تأكيد"}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomImage} alt="zoom" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Phase 10.99f — printable ownership invoice */}
      {invoiceFor && (
        <DealInvoiceModal
          open
          onClose={() => setInvoiceFor(null)}
          deal={invoiceFor}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────

function Field({
  label, value, dir,
}: {
  label: string
  value: React.ReactNode
  dir?: "ltr"
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-neutral-500 text-[11px]">{label}</span>
      <span className="text-white text-[11px] truncate max-w-[60%] text-left" dir={dir}>
        {value}
      </span>
    </div>
  )
}
