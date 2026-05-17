"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { X, ShoppingCart, AlertTriangle, Loader2 } from "lucide-react"
import { useRealtime } from "@/lib/realtime/RealtimeProvider"
import { submitDirectBuyRequest, submitPaymentProof, type PaymentMethod } from "@/lib/data/direct-buy"
import { showSuccess, showError, showInfo } from "@/lib/utils/toast"
import { OffPlatformPaymentNotice } from "@/components/common/OffPlatformPaymentNotice"
import { cn } from "@/lib/utils/cn"
import { PaymentInstructionsBlock } from "@/components/payment/PaymentInstructionsBlock"
// Phase 11.27 — IntegerInput prevents wheel/arrow-key/spinner from
// silently mutating share-count inputs.
import { IntegerInput } from "@/components/ui/IntegerInput"

// Phase 10.99f — let the user pick the actual payment method used.
// Stored on payment_proofs so admin sees it in the share-requests
// table and on the printed invoice/ownership contract.
// Brand names (Master Card / Zain Cash / Asia Hawala / Ki Card) are
// identical in both locales; only bank_transfer / other are localized.
const PAYMENT_METHODS: { id: PaymentMethod; label: string; labelKey?: string; icon: string }[] = [
  { id: "master_card",   label: "Master Card",     icon: "💳" },
  { id: "zain_cash",     label: "Zain Cash",       icon: "💰" },
  { id: "asia_hawala",   label: "Asia Hawala",     icon: "🏧" },
  { id: "bank_transfer", label: "Bank transfer",   labelKey: "pmBankTransfer", icon: "🏦" },
  { id: "ki_card",       label: "Ki Card",         icon: "💳" },
  { id: "other",         label: "Other",           labelKey: "pmOther", icon: "💵" },
]

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
  const t = useTranslations("deals")
  const { createDeal } = useRealtime()
  const [shares, setShares] = useState("1")
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  // Phase 10.97 — payment proof captured inside the modal
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null)
  // Phase 10.99f — user-picked payment method (stored on payment_proofs)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("master_card")

  if (!open) return null

  const sharesNum = parseInt(shares) || 0
  const total = sharesNum * project.share_price
  const isValid =
    sharesNum > 0 && sharesNum <= project.available_shares && agreed && proofDataUrl !== null

  const handleSubmit = async () => {
    if (!isValid) {
      if (sharesNum < 1) return showError(t("errSharesValid"))
      if (sharesNum > project.available_shares) return showError(t("errNotEnoughShares"))
      if (!proofDataUrl) return showError(t("errProofImageRequired"))
      if (!agreed) return showError(t("errAgreeRules"))
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
          unauthenticated: t("errUnauthenticated"),
          invalid_amount: t("errSharesValid"),
          invalid_share_price: t("errInvalidSharePrice"),
          project_not_found: t("errProjectNotFound"),
          project_not_active: t("errProjectNotActive"),
          insufficient_offering_shares: t("errInsufficientOffering"),
          cannot_buy_own_project: t("errCannotBuyOwn"),
          deal_insert_failed: t("errDealInsertFailed"),
          trading_suspended: suspReason
            ? t("errTradingSuspendedReason", { reason: suspReason })
            : t("errTradingSuspended"),
          offering_suspended: suspReason
            ? t("errOfferingSuspendedReason", { reason: suspReason })
            : t("errOfferingSuspended"),
        }
        // eslint-disable-next-line no-console
        console.warn("[direct-buy] failure:", dbResult)
        return showError(map[dbResult.error ?? ""] ?? t("errSubmitRequestGeneric", { error: dbResult.error ?? "" }))
      }

      // Mirror to legacy realtime mock for the chat/notif simulation
      try {
        await createDeal({
          buyer_id: "me",
          seller_id: seller.id,
          buyer_name: t("me"),
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
      // Phase 11.02 — surface proof-submission errors (was a silent
      // try/catch; now logs + shows a warning toast so admin/user can see).
      if (dbResult.deal_id && proofDataUrl) {
        try {
          const proofResult = await submitPaymentProof({
            deal_id: dbResult.deal_id,
            payment_method: paymentMethod,
            amount_paid: total,
            proof_image_url: proofDataUrl,
            transaction_reference: null,
            notes: null,
          })
          if (!proofResult.success) {
            // eslint-disable-next-line no-console
            console.warn("[direct-buy] proof upload failed:", proofResult)
            const proofErrorMap: Record<string, string> = {
              invalid_payment_method: t("errInvalidPaymentMethod"),
              insert_failed: t("errInsertFailedProof"),
              proof_required: t("errProofRequired"),
              not_buyer: t("errNotBuyer"),
              invalid_status: t("errInvalidStatus"),
            }
            showError(
              t("proofUploadFailedPrefix") +
                (proofErrorMap[proofResult.error ?? ""] ?? proofResult.error ?? t("unknownError"))
            )
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[direct-buy] proof upload threw:", err)
          showError(t("proofUploadThrew"))
        }
      }

      setSubmitting(false)
      setWaiting(true)
      showSuccess(t("requestSentOk"))
    } catch (error) {
      setSubmitting(false)
      showError(t("requestFailedRetry"))
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
          <div className="text-lg font-bold text-white mb-2">{t("waitingSellerReply")}</div>
          <div className="text-xs text-neutral-400 leading-relaxed mb-5">
            {t("requestSentToPre")}<span className="text-white font-bold">{seller.name}</span>{t("requestSentToPost")}
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">{t("project")}</span>
              <span className="text-white font-bold">{project.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">{t("sharesLabel")}</span>
              <span className="text-green-400 font-bold font-mono">{sharesNum}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">{t("total")}</span>
              <span className="text-yellow-400 font-bold font-mono">{fmtNum(total)} {t("iqd")}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setWaiting(false)
              setShares("1")
              setAgreed(false)
              setProofDataUrl(null)
              onClose()
              showInfo(t("canFollowApp"))
            }}
            className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm font-bold hover:bg-white/[0.08]"
          >
            {t("keepBrowsing")}
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
            <div className="text-lg font-bold text-white mb-1">{t("buySharesRequest")}</div>
            <div className="text-xs text-neutral-500">{t("projectFromSeller", { project: project.name, seller: seller.name })}</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phase 14.11 A7 — off-platform payment reminder */}
        <OffPlatformPaymentNotice className="mb-4" />

        {/* Shares input */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-xs text-neutral-400 font-bold">{t("sharesCount")}</label>
            <button
              onClick={() => setShares(String(Math.min(project.available_shares, 10)))}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              {t("maxAvailable")}
            </button>
          </div>
          <IntegerInput
            value={shares}
            onValueChange={setShares}
            max={project.available_shares}
            placeholder="0"
            dir="ltr"
            className={cn(
              "w-full bg-white/[0.05] rounded-xl px-4 py-3.5 text-2xl font-bold text-white text-center outline-none border transition-colors font-mono",
              sharesNum > project.available_shares ? "border-red-400/40" : "border-white/[0.1]"
            )}
          />
          <div className="text-[10px] text-neutral-500 text-center mt-1.5">
            {t("availablePre")}<span className="font-mono">{project.available_shares.toLocaleString("en-US")}</span> {t("sharesUnit")}
          </div>
        </div>

        {/* Pricing breakdown */}
        {sharesNum > 0 && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">{t("sharePrice")}</span>
              <span className="text-white font-mono">{fmtNum(project.share_price)} {t("iqd")}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">{t("sharesCount")}</span>
              <span className="text-white font-mono">× {sharesNum}</span>
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-yellow-400">{t("total")}</span>
              <span className="text-base font-bold text-yellow-400 font-mono">{fmtNum(total)} {t("iqd")}</span>
            </div>
          </div>
        )}

        {/* Validation warning */}
        {sharesNum > project.available_shares && (
          <div className="bg-red-400/[0.06] border border-red-400/20 rounded-xl p-3 mb-4 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-400">
              {t("exceedsAvailable", { n: project.available_shares })}
            </div>
          </div>
        )}

        {/* Phase 10.99f — payment method picker */}
        {sharesNum > 0 && sharesNum <= project.available_shares && (
          <div className="mb-4">
            <label className="text-xs text-neutral-400 font-bold mb-2 block">
              {t("paymentMethod")} <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-[10px] flex flex-col items-center gap-0.5 transition-colors",
                    paymentMethod === m.id
                      ? "bg-blue-400/[0.1] border-blue-400/[0.4] text-blue-300 font-bold"
                      : "bg-white/[0.04] border-white/[0.06] text-neutral-400 hover:bg-white/[0.06]"
                  )}
                >
                  <span className="text-base">{m.icon}</span>
                  <span>{m.labelKey ? t(m.labelKey) : m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase 10.97 — payment instructions + proof upload */}
        {sharesNum > 0 && sharesNum <= project.available_shares && (
          <div className="mb-4">
            <PaymentInstructionsBlock
              proofDataUrl={proofDataUrl}
              onProofChange={setProofDataUrl}
              title={t("payInfoTitle")}
              subtitle={t("payInfoSubtitle", { amount: fmtNum(total) })}
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
            {t("agreeRules")}
          </span>
        </button>

        {/* Submit */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
          >
            {t("cancel")}
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
                {t("sending")}
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                {t("submitRequest")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
