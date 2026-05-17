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
import { useTranslations } from "next-intl"
import { X, ArrowRightLeft, Loader2 } from "lucide-react"
import { UserPicker } from "@/components/admin/UserPicker"
import { submitShareTransfer } from "@/lib/data/share-transfers"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
// Phase 11.27 — IntegerInput prevents wheel/arrow-key/spinner from
// silently mutating money/share inputs.
import { IntegerInput } from "@/components/ui/IntegerInput"

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
  const t = useTranslations("portfolioUI")
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
    if (!recipient) return showError(t("stmErrPickRecipient"))
    if (sharesNum <= 0) return showError(t("stmErrValidShares"))
    if (sharesNum > availableShares) {
      return showError(t("stmOnlyAvailable", { n: fmtNum(availableShares) }))
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
        unauthenticated: t("stmErrUnauth"),
        cannot_transfer_to_self: t("stmErrSelf"),
        invalid_shares: t("stmErrValidShares"),
        recipient_not_found: t("stmErrRecipientNotFound"),
        insufficient_shares: t("stmErrInsufficientFrozen", { n: fmtNum(result.available ?? 0) }),
        missing_table: t("stmErrMissingTable"),
        rls: t("stmErrRls"),
      }
      showError(map[result.reason ?? ""] ?? t("stmErrSendFailed"))
      return
    }
    showSuccess(t("stmSent"))
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
              <div className="text-base font-bold text-white">{t("stmTitle")}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 truncate max-w-xs">
                {projectName}
              </div>
            </div>
          </div>
          <button
            onClick={() => { reset(); onClose() }}
            className="text-neutral-500 hover:text-white"
            aria-label={t("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-[11px] text-purple-300 leading-relaxed">
          {t("stmNotice")}
        </div>

        {/* Recipient picker */}
        <div className="mb-3">
          <UserPicker
            label={t("stmRecipientLabel")}
            placeholder={t("stmRecipientPlaceholder")}
            value={recipient}
            onChange={setRecipient}
          />
        </div>

        {/* Shares amount */}
        <div className="mb-3">
          <label className="text-xs text-neutral-400 mb-1.5 block">
            {t("stmSharesLabelPre")}<span className="text-white font-mono">{fmtNum(availableShares)}</span>{t("stmSharesLabelPost")}
          </label>
          <IntegerInput
            value={shares}
            onValueChange={setShares}
            max={availableShares}
            placeholder="0"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
          />
          {sharesNum > 0 && pricePerShare > 0 && (
            <div className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
              {t("stmEstValuePre")}<span className="font-mono text-white">{fmtNum(estimatedValue)}</span> {t("iqd")}
              <br />
              {t("stmFeePre")}<span className="font-mono text-yellow-400">{fmtNum(estimatedFee)}</span> {t("iqd")}
            </div>
          )}
        </div>

        {/* Optional message */}
        <div className="mb-4">
          <label className="text-xs text-neutral-400 mb-1.5 block">
            {t("stmMessageOptional")}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder={t("stmMessagePlaceholder")}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { reset(); onClose() }}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
          >
            {t("cancel")}
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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("stmSendRequest")}
          </button>
        </div>
      </div>
    </div>
  )
}
