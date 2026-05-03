"use client"

/**
 * ShareTransferModal (Phase 10).
 *
 * User-facing modal for sending shares of a specific project to
 * another user. The recipient must accept before the holdings move.
 * 2% fee is shown upfront and deducted from sender's fee balance
 * on accept.
 */

import { useState } from "react"
import { X, ArrowRightLeft, Loader2 } from "lucide-react"
import { UserPicker } from "@/components/admin/UserPicker"
import { submitShareTransfer } from "@/lib/data/share-transfers"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  projectId: string
  projectName: string
  availableShares: number
  /** Current market price per share — used to estimate the 2% fee. */
  pricePerShare?: number
}

const fmtNum = (n: number) => n.toLocaleString("en-US")

export function ShareTransferModal({
  open,
  onClose,
  onSuccess,
  projectId,
  projectName,
  availableShares,
  pricePerShare = 0,
}: Props) {
  const [recipient, setRecipient] = useState<{ id: string; display_name: string } | null>(null)
  const [shares, setShares] = useState<string>("")
  const [message, setMessage] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const sharesNum = Number(shares) || 0
  const estimatedValue = sharesNum * pricePerShare
  const estimatedFee = Math.floor(estimatedValue * 0.02)

  const valid =
    !!recipient &&
    sharesNum > 0 &&
    sharesNum <= availableShares

  const reset = () => {
    setRecipient(null)
    setShares("")
    setMessage("")
  }

  const handleSubmit = async () => {
    if (!recipient) return showError("اختر مستقبلاً")
    if (sharesNum <= 0) return showError("أدخل عدد حصص صحيح")
    if (sharesNum > availableShares) {
      return showError(`المتاح فقط ${fmtNum(availableShares)} حصة`)
    }
    setSubmitting(true)
    const result = await submitShareTransfer({
      recipient_id: recipient.id,
      project_id: projectId,
      shares: sharesNum,
      message: message.trim() || undefined,
    })
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        cannot_transfer_to_self: "لا يمكنك تحويل الحصص لنفسك",
        invalid_shares: "أدخل عدد حصص صحيح",
        recipient_not_found: "المستلم غير موجود",
        insufficient_shares: `المتاح فقط ${fmtNum(result.available ?? 0)} حصة (لديك حصص مجمّدة)`,
        missing_table: "الجداول غير منشورة بعد",
        rls: "صلاحياتك لا تسمح",
      }
      showError(map[result.reason ?? ""] ?? "فشل إرسال طلب التحويل")
      return
    }
    showSuccess("📨 تم إرسال طلب التحويل — في انتظار قبول المستلم")
    reset()
    onSuccess?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-purple-400" strokeWidth={2} />
            <div>
              <div className="text-base font-bold text-white">نقل حصص</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 truncate max-w-xs">
                {projectName}
              </div>
            </div>
          </div>
          <button
            onClick={() => { reset(); onClose() }}
            className="text-neutral-500 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-[11px] text-purple-300 leading-relaxed">
          المستلم يجب أن يقبل التحويل خلال 7 أيام. سيتم خصم رسوم 2% من رصيد وحدات الرسوم بعد القبول.
        </div>

        {/* Recipient picker */}
        <div className="mb-3">
          <UserPicker
            label="المستلم *"
            placeholder="ابحث بالاسم أو username..."
            value={recipient}
            onChange={setRecipient}
          />
        </div>

        {/* Shares amount */}
        <div className="mb-3">
          <label className="text-xs text-neutral-400 mb-1.5 block">
            عدد الحصص * (متاح: <span className="text-white font-mono">{fmtNum(availableShares)}</span>)
          </label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            min={1}
            max={availableShares}
            placeholder="0"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
          />
          {sharesNum > 0 && pricePerShare > 0 && (
            <div className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
              القيمة التقديرية: <span className="font-mono text-white">{fmtNum(estimatedValue)}</span> د.ع
              <br />
              الرسوم (2%): <span className="font-mono text-yellow-400">{fmtNum(estimatedFee)}</span> د.ع
            </div>
          )}
        </div>

        {/* Optional message */}
        <div className="mb-4">
          <label className="text-xs text-neutral-400 mb-1.5 block">
            رسالة (اختياري)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="مثلاً: هدية عيد"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { reset(); onClose() }}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
              valid && !submitting
                ? "bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 hover:bg-purple-500/[0.2]"
                : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
            )}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  )
}
