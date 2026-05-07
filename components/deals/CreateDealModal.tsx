"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, ShoppingCart, AlertTriangle, Loader2 } from "lucide-react"
import { useRealtime } from "@/lib/realtime/RealtimeProvider"
import { submitDirectBuyRequest, submitPaymentProof } from "@/lib/data/direct-buy"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import { PaymentInstructionsBlock } from "@/components/payment/PaymentInstructionsBlock"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface Props {
  open: boolean
  onClose: () => void
  project: {
    id: string
    name: string
    share_price: number
    available_shares: number
  }
  seller: {
    id: string
    name: string
  }
}

export function CreateDealModal({ open, onClose, project, seller }: Props) {
  const router = useRouter()
  const { createDeal } = useRealtime()
  const [shares, setShares] = useState("1")
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // Phase 10.97 — payment proof captured inside the modal
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null)

  if (!open) return null

  const sharesNum = parseInt(shares) || 0
  const total = sharesNum * project.share_price
  const isValid =
    sharesNum > 0 && sharesNum <= project.available_shares && agreed && proofDataUrl !== null

  const handleSubmit = async () => {
    if (!isValid) {
      if (sharesNum < 1) return showError("أدخل عدد حصص صحيح")
      if (sharesNum > project.available_shares) return showError("لا يوجد عدد كافٍ من الحصص")
      if (!proofDataUrl) return showError("يجب رفع صورة إثبات الدفع")
      if (!agreed) return showError("يجب الموافقة على القوانين")
      return
    }

    setSubmitting(true)
    try {
      // Phase 10.67 — write the request to the real `deals` table via
      // the SECURITY DEFINER RPC so the admin panel sees it. The
      // legacy mock createDeal() is kept as a no-op fallback for
      // environments where the RPC isn't deployed yet.
      const dbResult = await submitDirectBuyRequest(project.id, sharesNum)

      if (!dbResult.success) {
        setSubmitting(false)
        // Phase 10.93: suspension errors carry a `reason` field from the RPC
        const suspReason = dbResult.reason
        const map: Record<string, string> = {
          unauthenticated: "سجّل دخولك أولاً",
          invalid_amount: "أدخل عدد حصص صحيح",
          project_not_found: "المشروع غير موجود",
          project_not_active: "المشروع ليس نشطاً للشراء حالياً",
          insufficient_offering_shares: "الحصص المتاحة في عَرض المشروع غير كافية",
          cannot_buy_own_project: "لا يمكنك شراء مشروعك الخاص",
          trading_suspended: suspReason
            ? `⏸️ التداول معلق مؤقتاً: ${suspReason}`
            : "⏸️ تم تعليق التداول على هذا المشروع مؤقتاً",
          offering_suspended: suspReason
            ? `🔒 شراء الحصص معلق مؤقتاً: ${suspReason}`
            : "🔒 تم تعليق شراء الحصص الجديدة مؤقتاً",
        }
        return showError(map[dbResult.error ?? ""] ?? `تعذّر إرسال الطلب — ${dbResult.error}`)
      }

      // Mirror to legacy realtime mock for the chat/notif simulation
      try {
        await createDeal({
          buyer_id: "me",
          seller_id: seller.id,
          buyer_name: "أنا",
          seller_name: seller.name,
          project_id: project.id,
          project_name: project.name,
          shares: sharesNum,
          price_per_share: project.share_price,
          total,
        })
      } catch { /* non-fatal — DB row is the source of truth */ }

      // Phase 10.97 — submit the payment proof together with the deal
      // so the admin sees both at once. proofDataUrl is a base64 data
      // URL captured inside this modal via PaymentInstructionsBlock.
      if (dbResult.deal_id && proofDataUrl) {
        try {
          await submitPaymentProof({
            deal_id: dbResult.deal_id,
            payment_method: "master_card",
            amount_paid: total,
            proof_image_url: proofDataUrl,
            transaction_reference: null,
            notes: null,
          })
        } catch {
          // Non-fatal: deal is created; proof can be re-uploaded from /deals/:id
        }
      }

      setSubmitting(false)
      setWaiting(true)
      showSuccess("✅ تم إرسال الطلب + إثبات الدفع — الإدارة ستراجعه")
    } catch (error) {
      setSubmitting(false)
      showError("فشل إرسال الطلب، حاول مرة أخرى")
    }
  }

  // عرض شاشة الانتظار بعد الإرسال
  if (waiting) {
    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-[#0a0a0a] border border-blue-400/30 rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-blue-400/10 border-2 border-blue-400/30 flex items-center justify-center mx-auto mb-5 animate-pulse">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" strokeWidth={1.5} />
          </div>
          <div className="text-lg font-bold text-white mb-2">بانتظار رد البائع...</div>
          <div className="text-xs text-neutral-400 leading-relaxed mb-5">
            تم إرسال طلبك إلى <span className="text-white font-bold">{seller.name}</span>.
            ستحصل على إشعار فور رده على الطلب.
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">المشروع</span>
              <span className="text-white font-bold">{project.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">الحصص</span>
              <span className="text-green-400 font-bold font-mono">{sharesNum}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">الإجمالي</span>
              <span className="text-yellow-400 font-bold font-mono">{fmtNum(total)} د.ع</span>
            </div>
          </div>
          <button
            onClick={() => {
              setWaiting(false)
              setShares("1")
              setAgreed(false)
              setProofDataUrl(null)
              onClose()
              showInfo("يمكنك متابعة التطبيق، سنُعلمك بالرد")
            }}
            className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.08]"
          >
            متابعة التصفح
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">

        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-lg font-bold text-white mb-1">طلب شراء حصص</div>
            <div className="text-xs text-neutral-500">{project.name} • من {seller.name}</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shares input */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-xs text-neutral-400 font-bold">عدد الحصص</label>
            <button
              onClick={() => setShares(String(Math.min(project.available_shares, 10)))}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              الأقصى المتاح
            </button>
          </div>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            min="1"
            max={project.available_shares}
            placeholder="0"
            dir="ltr"
            className={cn(
              "w-full bg-white/[0.05] rounded-xl px-4 py-3.5 text-2xl font-bold text-white text-center outline-none border transition-colors font-mono",
              sharesNum > project.available_shares ? "border-red-400/40" : "border-white/[0.1]"
            )}
          />
          <div className="text-[10px] text-neutral-500 text-center mt-1.5">
            متاح: <span className="font-mono">{project.available_shares.toLocaleString("en-US")}</span> حصة
          </div>
        </div>

        {/* Pricing breakdown */}
        {sharesNum > 0 && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">سعر الحصة</span>
              <span className="text-white font-mono">{fmtNum(project.share_price)} د.ع</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">عدد الحصص</span>
              <span className="text-white font-mono">× {sharesNum}</span>
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-yellow-400">الإجمالي</span>
              <span className="text-base font-bold text-yellow-400 font-mono">{fmtNum(total)} د.ع</span>
            </div>
          </div>
        )}

        {/* Validation warning */}
        {sharesNum > project.available_shares && (
          <div className="bg-red-400/[0.06] border border-red-400/20 rounded-xl p-3 mb-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-400">
              العدد المطلوب أكبر من المتاح ({project.available_shares} حصة فقط)
            </div>
          </div>
        )}

        {/* Phase 10.97 — payment instructions + proof upload */}
        {sharesNum > 0 && sharesNum <= project.available_shares && (
          <div className="mb-4">
            <PaymentInstructionsBlock
              proofDataUrl={proofDataUrl}
              onProofChange={setProofDataUrl}
              title="💳 معلومات تحويل المبلغ"
              subtitle={`حوّل ${fmtNum(total)} د.ع وارفع صورة الإثبات`}
              required
              compact
            />
          </div>
        )}

        {/* Agreement */}
        <button
          onClick={() => setAgreed(!agreed)}
          className={cn(
            "w-full flex items-start gap-3 p-3 rounded-xl border mb-4 transition-all text-right",
            agreed
              ? "bg-green-400/[0.06] border-green-400/30"
              : "bg-white/[0.04] border-white/[0.08]"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
            agreed ? "bg-green-400 border-green-400" : "border-neutral-500"
          )}>
            {agreed && <span className="text-black text-xs font-bold">✓</span>}
          </div>
          <span className={cn("text-[11px] leading-relaxed", agreed ? "text-green-400" : "text-neutral-400")}>
            أوافق على قوانين الصفقة. مدة الصفقة 15 دقيقة بعد قبول البائع. الإلغاء يؤثر على تقييمي.
          </span>
        </button>

        {/* Submit */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={cn(
              "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              isValid && !submitting
                ? "bg-neutral-100 text-black hover:bg-neutral-200"
                : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                إرسال الطلب
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
