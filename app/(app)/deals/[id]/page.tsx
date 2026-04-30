"use client"

import { useState, useMemo, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import {
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Coins,
  Building2,
  ChevronLeft,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, Modal } from "@/components/ui"
import {
  getDealById,
  buyerConfirmPayment,
  sellerReleaseShares,
  sellerRequestCancellation,
  buyerAcceptCancellation,
  buyerRejectCancellation,
  openDispute,
  STATUS_META,
} from "@/lib/escrow"
import type { EscrowDeal } from "@/lib/escrow"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// "me" = current user — يُستبدل بالمصادقة الفعلية لاحقاً
const CURRENT_USER_ID = "me"

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "انتهى"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

type ModalMode =
  | null
  | "confirm_payment"
  | "release_shares"
  | "request_cancel"
  | "open_dispute"
  | "accept_cancel"
  | "reject_cancel"

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [deal, setDeal] = useState<EscrowDeal | undefined>(() => getDealById(id))
  const [modal, setModal] = useState<ModalMode>(null)
  const [agreed, setAgreed] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // tick — refresh timer كل ثانية
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const role = useMemo<"buyer" | "seller" | "viewer">(() => {
    if (!deal) return "viewer"
    if (deal.buyer_id === CURRENT_USER_ID) return "buyer"
    if (deal.seller_id === CURRENT_USER_ID) return "seller"
    return "viewer"
  }, [deal])

  if (!deal) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">
            <PageHeader title="الصفقة غير موجودة" subtitle="لم نتمكّن من العثور على هذه الصفقة" backHref="/deals" />
            <Card>
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🔍</div>
                <div className="text-sm text-neutral-400">قد تكون الصفقة محذوفة أو الرابط غير صحيح</div>
              </div>
            </Card>
          </div>
        </div>
      </AppLayout>
    )
  }

  const statusMeta = STATUS_META[deal.status]
  const timeLeftMs = new Date(deal.expires_at).getTime() - Date.now()
  const isActive = deal.status === "pending" || deal.status === "payment_confirmed" || deal.status === "cancellation_requested"

  const closeModal = () => {
    setModal(null)
    setAgreed(false)
    setReason("")
  }

  const refresh = () => setDeal(getDealById(id))

  // ────── Action handlers ──────

  const handleConfirmPayment = () => {
    if (!agreed) return showError("يجب الإقرار بإتمام الدفع")
    setSubmitting(true)
    const r = buyerConfirmPayment(deal.id, CURRENT_USER_ID)
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess("✅ تم تأكيد الدفع — بانتظار البائع")
    refresh()
    closeModal()
  }

  const handleReleaseShares = () => {
    if (!agreed) return showError("يجب الإقرار باستلام المبلغ")
    setSubmitting(true)
    const r = sellerReleaseShares(deal.id, CURRENT_USER_ID)
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess(`🎉 تم تحويل ${fmtNum(deal.shares_amount)} حصة إلى المشتري`)
    refresh()
    closeModal()
  }

  const handleRequestCancel = () => {
    if (!reason.trim() || reason.trim().length < 5) {
      return showError("اكتب سبب الإلغاء (5 أحرف على الأقل)")
    }
    setSubmitting(true)
    const r = sellerRequestCancellation(deal.id, CURRENT_USER_ID, reason.trim())
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess("📝 تم إرسال طلب الإلغاء — بانتظار المشتري")
    refresh()
    closeModal()
  }

  const handleAcceptCancel = () => {
    setSubmitting(true)
    const r = buyerAcceptCancellation(deal.id, CURRENT_USER_ID)
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess("✅ تم إلغاء الصفقة بالتراضي")
    refresh()
    closeModal()
  }

  const handleRejectCancel = () => {
    if (!agreed) return showError("يجب الإقرار بإتمام الدفع لرفض الإلغاء")
    setSubmitting(true)
    const r = buyerRejectCancellation(deal.id, CURRENT_USER_ID)
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess("⚖️ تم فتح نزاع — بانتظار قرار الإدارة")
    refresh()
    closeModal()
  }

  const handleOpenDispute = () => {
    if (!reason.trim() || reason.trim().length < 10) {
      return showError("اكتب وصف النزاع (10 أحرف على الأقل)")
    }
    setSubmitting(true)
    const r = openDispute(deal.id, CURRENT_USER_ID, reason.trim())
    setSubmitting(false)
    if (!r.success) return showError(r.reason ?? "فشل الإجراء")
    showSuccess("⚖️ تم فتح نزاع — بانتظار قرار الإدارة")
    refresh()
    closeModal()
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title={`صفقة #${deal.id.slice(-6).toUpperCase()}`}
            subtitle={`بين ${deal.buyer_name} و ${deal.seller_name}`}
            backHref="/deals"
          />

          {/* ═══ Status Banner ═══ */}
          <Card variant="gradient" color={statusMeta.color === "neutral" ? undefined : statusMeta.color as never} className="mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {deal.status === "pending" && "⏳"}
                  {deal.status === "payment_confirmed" && "💳"}
                  {deal.status === "completed" && "🎉"}
                  {deal.status === "cancellation_requested" && "🚫"}
                  {deal.status === "disputed" && "⚖️"}
                  {(deal.status === "cancelled_mutual" || deal.status === "cancelled_expired") && "❌"}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{statusMeta.label}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {role === "buyer" ? "أنت المشتري" : role === "seller" ? "أنت البائع" : "مشاهدة فقط"}
                  </div>
                </div>
              </div>
              {isActive && timeLeftMs > 0 && (
                <div className="text-left">
                  <div className="text-[10px] text-neutral-500 mb-0.5">الوقت المتبقّي</div>
                  <div className="text-base font-bold font-mono text-yellow-400" dir="ltr">
                    {formatTimeLeft(timeLeftMs)}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ═══ Section 1: Deal Info ═══ */}
          <Card className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              <div className="text-[11px] font-bold text-neutral-300">معلومات الصفقة</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">المشروع</div>
                <div className="text-sm font-bold text-white">{deal.project_name}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">الكمية</div>
                <div className="text-sm font-bold text-white font-mono">{fmtNum(deal.shares_amount)} حصة</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">السعر للحصة</div>
                <div className="text-sm font-bold text-white font-mono">{fmtNum(deal.price_per_share)} د.ع</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">الإجمالي</div>
                <div className="text-sm font-bold text-yellow-400 font-mono">{fmtNum(deal.total_amount)} د.ع</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">تاريخ الفتح</div>
                <div className="text-[11px] text-white" dir="ltr">{formatDate(deal.created_at)}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">تاريخ الانتهاء</div>
                <div className="text-[11px] text-white" dir="ltr">{formatDate(deal.expires_at)}</div>
              </div>
            </div>
          </Card>

          {/* ═══ Section 2: Escrow Status ═══ */}
          <Card className="mb-4" variant={deal.shares_locked ? "gradient" : "default"} color={deal.shares_locked ? "yellow" : undefined}>
            <div className="flex items-start gap-3">
              <Lock className={cn("w-5 h-5 mt-0.5 flex-shrink-0", deal.shares_locked ? "text-yellow-400" : "text-neutral-500")} strokeWidth={2} />
              <div className="flex-1">
                <div className="text-sm font-bold text-white mb-1">
                  {deal.shares_locked ? "🔒 الحصص مُعلَّقة في الـ Escrow" : "✅ الحصص حُرِّرت"}
                </div>
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  {deal.shares_locked
                    ? `${fmtNum(deal.shares_amount)} حصة من ${deal.project_name} محفوظة لحين إكمال الصفقة. لا يستطيع البائع بيعها لأحد آخر.`
                    : "تم تحرير الحصص ونقلها لمحفظة المشتري بنجاح."}
                </div>
              </div>
            </div>
          </Card>

          {/* ═══ Section 3: Timeline ═══ */}
          <Card className="mb-4">
            <div className="text-[11px] font-bold text-neutral-300 mb-3">📊 المسار الزمني</div>
            <div className="space-y-2.5">
              <TimelineItem done label="فُتحت الصفقة" time={deal.created_at} />
              <TimelineItem done label="تم تعليق الحصص" time={deal.locked_at} />
              <TimelineItem
                done={deal.buyer_confirmed_payment}
                pending={!deal.buyer_confirmed_payment && deal.status === "pending"}
                label="تأكيد المشتري للدفع"
                time={deal.buyer_confirmed_at}
              />
              <TimelineItem
                done={deal.seller_released_shares}
                pending={!deal.seller_released_shares && deal.status === "payment_confirmed"}
                label="تحرير الحصص للمشتري"
                time={deal.seller_released_at}
              />
              <TimelineItem
                done={deal.status === "completed"}
                pending={false}
                label="اكتمال الصفقة"
                time={deal.completed_at}
              />
            </div>
          </Card>

          {/* ═══ Section 4: Cancellation banner (if requested) ═══ */}
          {deal.status === "cancellation_requested" && (
            <Card variant="gradient" color="orange" className="mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white mb-1">
                    {deal.cancellation_requested_by === "seller" ? "البائع طلب إلغاء الصفقة" : "المشتري طلب إلغاء الصفقة"}
                  </div>
                  {deal.cancellation_reason && (
                    <div className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-2.5 text-[11px] text-neutral-200 leading-relaxed mt-2">
                      <span className="text-neutral-500">السبب: </span>
                      {deal.cancellation_reason}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ═══ Section 5: Dispute banner ═══ */}
          {deal.status === "disputed" && (
            <Card variant="gradient" color="red" className="mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white mb-1">⚖️ الصفقة في نزاع</div>
                  <div className="text-[11px] text-neutral-300 leading-relaxed">
                    الحصص مُعلَّقة لحين قرار الإدارة. سيُتواصَل معك قريباً.
                  </div>
                  {deal.dispute_id && (
                    <div className="text-[10px] text-neutral-500 mt-2 font-mono">معرّف النزاع: {deal.dispute_id}</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ═══ Section 6: Actions ═══ */}
          {role === "buyer" && deal.status === "pending" && (
            <div className="space-y-2">
              <button
                onClick={() => setModal("confirm_payment")}
                className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الدفع
              </button>
              <button
                onClick={() => setModal("open_dispute")}
                className="w-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold py-3 rounded-xl hover:bg-red-500/20 transition-colors text-sm"
              >
                ⚖️ فتح نزاع
              </button>
            </div>
          )}

          {role === "buyer" && deal.status === "payment_confirmed" && (
            <Card>
              <div className="flex items-center gap-2 text-yellow-400">
                <Clock className="w-4 h-4" strokeWidth={2} />
                <span className="text-sm font-bold">بانتظار البائع لتحرير الحصص...</span>
              </div>
            </Card>
          )}

          {role === "buyer" && deal.status === "cancellation_requested" && (
            <div className="space-y-2">
              <button
                onClick={() => setModal("accept_cancel")}
                className="w-full bg-neutral-100 text-black font-bold py-3 rounded-xl hover:bg-neutral-200 transition-colors text-sm flex items-center justify-center gap-2"
              >
                ✅ موافق على الإلغاء
              </button>
              <button
                onClick={() => setModal("reject_cancel")}
                className="w-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold py-3 rounded-xl hover:bg-red-500/20 transition-colors text-sm"
              >
                💰 قمت بالدفع — أرفض الإلغاء
              </button>
            </div>
          )}

          {role === "seller" && deal.status === "pending" && (
            <div className="space-y-2">
              <Card>
                <div className="flex items-center gap-2 text-yellow-400">
                  <Clock className="w-4 h-4" strokeWidth={2} />
                  <span className="text-sm font-bold">بانتظار تأكيد المشتري للدفع</span>
                </div>
              </Card>
              <button
                onClick={() => setModal("request_cancel")}
                className="w-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold py-3 rounded-xl hover:bg-orange-500/20 transition-colors text-sm"
              >
                🚫 طلب إلغاء
              </button>
            </div>
          )}

          {role === "seller" && deal.status === "payment_confirmed" && (
            <div className="space-y-2">
              <button
                onClick={() => setModal("release_shares")}
                className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                تحرير الحصص للمشتري
              </button>
              <button
                onClick={() => setModal("open_dispute")}
                className="w-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold py-3 rounded-xl hover:bg-red-500/20 transition-colors text-sm"
              >
                ⚖️ لم أستلم المبلغ — فتح نزاع
              </button>
            </div>
          )}

          {role === "seller" && deal.status === "cancellation_requested" && (
            <Card>
              <div className="flex items-center gap-2 text-orange-400">
                <Clock className="w-4 h-4" strokeWidth={2} />
                <span className="text-sm font-bold">بانتظار رد المشتري على طلب الإلغاء (24 ساعة)</span>
              </div>
            </Card>
          )}

          {deal.status === "completed" && (
            <Card variant="gradient" color="green">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">✅ الصفقة مكتملة بنجاح</span>
              </div>
              <div className="text-[11px] text-neutral-300 mt-2">
                {role === "buyer"
                  ? `تم نقل ${fmtNum(deal.shares_amount)} حصة إلى محفظتك.`
                  : role === "seller"
                  ? `تم نقل ${fmtNum(deal.shares_amount)} حصة من محفظتك إلى المشتري.`
                  : "تمت الصفقة."}
              </div>
            </Card>
          )}

          {(deal.status === "cancelled_mutual" || deal.status === "cancelled_expired") && (
            <Card>
              <div className="flex items-center gap-2 text-neutral-400">
                <XCircle className="w-5 h-5" strokeWidth={2} />
                <span className="text-sm font-bold">
                  {deal.status === "cancelled_mutual" ? "❌ ملغاة بالتراضي" : "⏰ ملغاة لانتهاء الوقت"}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-2">
                تم إعادة الحصص إلى البائع.
              </div>
            </Card>
          )}

          {deal.status === "disputed" && (
            <button
              onClick={() => router.push("/support")}
              className="w-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold py-3 rounded-xl hover:bg-red-500/20 transition-colors text-sm flex items-center justify-center gap-2"
            >
              عرض النزاع
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ Modals ═══ */}

      {/* Confirm Payment (buyer) */}
      <Modal
        isOpen={modal === "confirm_payment"}
        onClose={closeModal}
        title="✅ تأكيد إتمام الدفع"
        subtitle={`صفقة #${deal.id.slice(-6).toUpperCase()}`}
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleConfirmPayment} disabled={submitting || !agreed} className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-50">
              {submitting ? "جاري..." : "تأكيد"}
            </button>
          </>
        }
      >
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3 text-xs">
          <div className="flex justify-between mb-1.5"><span className="text-neutral-500">المستلم</span><span className="text-white">{deal.seller_name}</span></div>
          <div className="flex justify-between mb-1.5"><span className="text-neutral-500">المبلغ</span><span className="text-yellow-400 font-mono font-bold">{fmtNum(deal.total_amount)} د.ع</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">الكمية</span><span className="text-white">{fmtNum(deal.shares_amount)} حصة</span></div>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span className="text-[11px] text-neutral-300 leading-relaxed">
            أُقرّ بأنّني دفعت المبلغ كاملاً (<span className="text-yellow-400 font-bold">{fmtNum(deal.total_amount)} د.ع</span>) للبائع. الإقرار الكاذب يُعرِّضني للحظر.
          </span>
        </label>
      </Modal>

      {/* Release Shares (seller) */}
      <Modal
        isOpen={modal === "release_shares"}
        onClose={closeModal}
        title="🔓 تحرير الحصص للمشتري"
        subtitle="هذا الإجراء لا يمكن التراجع عنه"
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleReleaseShares} disabled={submitting || !agreed} className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-50">
              {submitting ? "جاري التحرير..." : "تحرير"}
            </button>
          </>
        }
      >
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3 text-xs">
          <div className="flex justify-between mb-1.5"><span className="text-neutral-500">المشتري</span><span className="text-white">{deal.buyer_name}</span></div>
          <div className="flex justify-between mb-1.5"><span className="text-neutral-500">المبلغ المُستلَم</span><span className="text-yellow-400 font-mono font-bold">{fmtNum(deal.total_amount)} د.ع</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">الكمية للتحرير</span><span className="text-white">{fmtNum(deal.shares_amount)} حصة</span></div>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span className="text-[11px] text-neutral-300 leading-relaxed">
            أُقرّ بأنّني استلمتُ المبلغ كاملاً (<span className="text-yellow-400 font-bold">{fmtNum(deal.total_amount)} د.ع</span>). بالتأكيد ستُنقَل الحصص للمشتري ولا يمكن التراجع.
          </span>
        </label>
      </Modal>

      {/* Request Cancellation (seller) */}
      <Modal
        isOpen={modal === "request_cancel"}
        onClose={closeModal}
        title="🚫 طلب إلغاء الصفقة"
        subtitle="سيُرسَل الطلب للمشتري"
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleRequestCancel} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50">
              {submitting ? "جاري..." : "إرسال الطلب"}
            </button>
          </>
        }
      >
        <label className="text-[11px] font-bold text-neutral-300 mb-2 block">سبب الإلغاء (سيراه المشتري)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="مثال: تغيّرت ظروفي، أعتذر..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none resize-none mb-2"
        />
        <div className="text-[10px] text-orange-400">
          ⚠️ الإلغاء المتكرّر يؤثّر سلباً على تقييمك.
        </div>
      </Modal>

      {/* Accept Cancellation (buyer) */}
      <Modal
        isOpen={modal === "accept_cancel"}
        onClose={closeModal}
        title="✅ موافقة على الإلغاء"
        subtitle="ستُرَدّ الحصص للبائع"
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">رجوع</button>
            <button onClick={handleAcceptCancel} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50">
              {submitting ? "جاري..." : "موافق"}
            </button>
          </>
        }
      >
        <p className="text-xs text-neutral-300 leading-relaxed">
          بالموافقة على الإلغاء، ستُفَكّ حصص البائع وتعود إليه. لن تُحاسَب على شيء.
        </p>
      </Modal>

      {/* Reject Cancellation = open dispute (buyer) */}
      <Modal
        isOpen={modal === "reject_cancel"}
        onClose={closeModal}
        title="💰 قمتُ بالدفع — أرفض الإلغاء"
        subtitle="سيُفتَح نزاع تلقائياً"
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">رجوع</button>
            <button onClick={handleRejectCancel} disabled={submitting || !agreed} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
              {submitting ? "جاري..." : "فتح نزاع"}
            </button>
          </>
        }
      >
        <div className="text-[11px] text-neutral-300 leading-relaxed mb-3">
          سيتم تحويل الصفقة إلى نزاع. الإدارة ستحقّق وتُحرّر الحصص للجهة المُحقّة. الحصص ستبقى مُعلَّقة لحين قرار الإدارة.
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span className="text-[11px] text-neutral-300 leading-relaxed">
            أُقرّ بأنّني دفعت المبلغ كاملاً وأمتلك دليل الدفع. الإقرار الكاذب يؤدّي للحظر الفوري.
          </span>
        </label>
      </Modal>

      {/* Open Dispute (either side) */}
      <Modal
        isOpen={modal === "open_dispute"}
        onClose={closeModal}
        title="⚖️ فتح نزاع"
        subtitle="سيُحقَّق من قبل الإدارة"
        size="sm"
        footer={
          <>
            <button onClick={closeModal} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleOpenDispute} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
              {submitting ? "جاري..." : "فتح النزاع"}
            </button>
          </>
        }
      >
        <label className="text-[11px] font-bold text-neutral-300 mb-2 block">وصف المشكلة</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          placeholder="اشرح بالتفصيل ما حدث، مع ذكر الأدلّة المتوفّرة لديك..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none resize-none mb-2"
        />
        <div className="text-[10px] text-yellow-400">
          ⚠️ يمكنك رفع أدلّة إضافية (صور إيصالات، شات...) عبر صفحة الدعم.
        </div>
      </Modal>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-component: Timeline item
// ──────────────────────────────────────────────────────────────────────────

function TimelineItem({
  done,
  pending,
  label,
  time,
}: {
  done: boolean
  pending?: boolean
  label: string
  time?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border",
          done && "bg-green-400/15 border-green-400/40 text-green-400",
          pending && "bg-yellow-400/15 border-yellow-400/40 text-yellow-400 animate-pulse",
          !done && !pending && "bg-white/[0.04] border-white/[0.08] text-neutral-600"
        )}
      >
        {done ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> : pending ? <Clock className="w-3.5 h-3.5" strokeWidth={2} /> : <Coins className="w-3 h-3" strokeWidth={2} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-xs font-bold", done ? "text-white" : pending ? "text-yellow-400" : "text-neutral-500")}>
          {label}
        </div>
        {time && (
          <div className="text-[10px] text-neutral-500 mt-0.5" dir="ltr">{formatDate(time)}</div>
        )}
      </div>
    </div>
  )
}
