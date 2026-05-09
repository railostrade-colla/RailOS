"use client"

/**
 * PaymentProofModal — Phase 12.7.
 *
 * Replaces the old "أُقرّ بأنّني دفعت" checkbox-only modal. Now the
 * buyer must:
 *   1. Pick payment method (zain_cash / master_card / bank_transfer / other)
 *   2. Enter the amount they actually paid (defaults to deal total)
 *   3. (Optional) reference number from the bank/wallet
 *   4. (Optional) note for the seller
 *   5. Upload an image of the receipt — REQUIRED
 *   6. Tick the truthfulness pledge
 *
 * On submit we upload the image to the payment-proofs bucket then call
 * submit_payment_proof RPC. Deal flips to 'payment_submitted' and the
 * seller gets a notification.
 */

import { useState, useRef } from "react"
import { ImagePlus, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui"
import {
  submitDealPaymentProof,
  type ExchangePaymentMethod,
} from "@/lib/data/payment-proof-submit"
import { showSuccess, showError } from "@/lib/utils/toast"
// Phase 12.8 — proof-submitted sound for buyer (seller hears its own
// version via the deal-page status-transition watcher).
import { playPaymentSubmitted } from "@/lib/sounds"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const METHODS: { id: ExchangePaymentMethod; label: string; icon: string }[] = [
  { id: "zain_cash",     label: "زين كاش",       icon: "📱" },
  { id: "bank_transfer", label: "حوالة بنكية",   icon: "🏦" },
  { id: "master_card",   label: "ماستركارد",     icon: "💳" },
  { id: "other",         label: "طريقة أخرى",    icon: "🔗" },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  dealId: string
  /** The expected payment amount (deal.total_amount). Pre-fills the input. */
  expectedAmount: number
  sellerName: string
  /** Called after a successful submission so the parent can refresh/redirect. */
  onSubmitted: () => void
}

export function PaymentProofModal({
  isOpen,
  onClose,
  dealId,
  expectedAmount,
  sellerName,
  onSubmitted,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [method, setMethod] = useState<ExchangePaymentMethod>("zain_cash")
  const [amount, setAmount] = useState<string>(String(expectedAmount))
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setMethod("zain_cash")
    setAmount(String(expectedAmount))
    setReference("")
    setNotes("")
    setFile(null)
    setFilePreview(null)
    setAgreed(false)
    setSubmitting(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) {
      showError("اختر صورة فقط (JPG/PNG/WEBP)")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      showError("حجم الصورة يتجاوز 10MB")
      return
    }
    setFile(f)
    // Generate a local preview
    const reader = new FileReader()
    reader.onload = () => setFilePreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const removeFile = () => {
    setFile(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async () => {
    if (!file) {
      showError("صورة الإثبات مطلوبة")
      return
    }
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      showError("أدخل مبلغاً صحيحاً")
      return
    }
    if (!agreed) {
      showError("يجب الإقرار بصحة الإثبات")
      return
    }

    setSubmitting(true)
    const result = await submitDealPaymentProof({
      dealId,
      paymentMethod: method,
      amountPaid: amt,
      transactionReference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      proofImage: file,
    })
    setSubmitting(false)

    if (!result.success) {
      showError(result.error ?? "تعذّر إرسال الإثبات")
      return
    }

    playPaymentSubmitted()
    showSuccess("✅ تم إرسال الإثبات — البائع سيتحقّق ويُحرِّر الحصص")
    reset()
    onSubmitted()
  }

  const canSubmit = !!file && agreed && !submitting && parseInt(amount, 10) > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="🧾 رفع إثبات الدفع"
      subtitle={`بعد تحويل المبلغ لـ ${sellerName} خارج التطبيق`}
      size="md"
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2",
              canSubmit
                ? "bg-green-500 text-black hover:bg-green-600"
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
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                إرسال الإثبات
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Payment method picker */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1.5">
            طريقة الدفع المستخدمة
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "py-2.5 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                  method === m.id
                    ? "bg-blue-400/[0.12] border-blue-400/40 text-blue-300"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                )}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1.5">
            المبلغ المُحوَّل (د.ع){" "}
            <span className="text-neutral-600">
              · المتوقَّع: {fmtNum(expectedAmount)}
            </span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            dir="ltr"
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2.5 text-base text-white font-mono text-center outline-none focus:border-white/20"
          />
        </div>

        {/* Reference (optional) */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1.5">
            رقم العملية{" "}
            <span className="text-neutral-600">(اختياري)</span>
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="رقم المرجع من البنك أو المحفظة"
            maxLength={60}
            dir="ltr"
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-neutral-600 outline-none focus:border-white/20"
          />
        </div>

        {/* Image picker */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1.5">
            صورة الإثبات <span className="text-red-400">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          {!filePreview ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed border-white/[0.12] rounded-xl py-6 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-colors"
            >
              <ImagePlus className="w-6 h-6 text-neutral-400" strokeWidth={2} />
              <div className="text-xs text-neutral-300">
                اضغط لاختيار صورة الإيصال
              </div>
              <div className="text-[10px] text-neutral-600">
                JPG / PNG / WEBP — حتى 10MB
              </div>
            </button>
          ) : (
            <div className="relative bg-black border border-white/[0.08] rounded-xl overflow-hidden">
              <img
                src={filePreview}
                alt="proof preview"
                className="w-full h-auto max-h-72 object-contain"
              />
              <button
                onClick={removeFile}
                className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500/80 text-white flex items-center justify-center transition-colors"
                aria-label="إزالة"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div className="px-3 py-1.5 text-[10px] text-neutral-400 border-t border-white/[0.06]">
                {file?.name} · {file ? Math.round(file.size / 1024) : 0} KB
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1.5">
            ملاحظة للبائع <span className="text-neutral-600">(اختياري)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="مثلاً: التحويل من حساب أخي بالخطأ — تأكّد من اسم المُرسِل"
            maxLength={300}
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
          />
        </div>

        {/* Truthfulness pledge */}
        <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <span className="text-[11px] text-neutral-300 leading-relaxed">
            أُقرّ بصحّة هذا الإثبات وبأنّني فعلاً حوّلتُ المبلغ إلى{" "}
            <span className="text-white font-bold">{sellerName}</span>. الإثبات
            الكاذب أو المُعدَّل يُعرِّضني للحظر الفوري.
          </span>
        </label>

        <div className="flex items-start gap-2 px-2.5 py-2 bg-blue-400/[0.06] border border-blue-400/20 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-300 leading-relaxed">
            بعد الإرسال ينتقل البائع لمراجعة الإثبات وتحرير الحصص. المهلة 15 دقيقة.
          </p>
        </div>
      </div>
    </Modal>
  )
}
