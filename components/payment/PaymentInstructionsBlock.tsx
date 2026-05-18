"use client"

/**
 * Phase 10.97 — Reusable block shown inside the direct-buy modal +
 * fee-unit-request modal:
 *   • Master card number (with copy-to-clipboard)
 *   • Transfer phone (with copy-to-clipboard)
 *   • Free-text instructions
 *   • Image upload for payment proof (stored as base64 data URL —
 *     no Storage bucket required for the first cut)
 *
 * Parent component holds the proof state and reads `proofDataUrl`
 * to submit alongside the request.
 */

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, Check, Upload, X, AlertCircle } from "lucide-react"
import { getPaymentSettings, type PaymentSettings, EMPTY_PAYMENT_SETTINGS } from "@/lib/data/payment-settings"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

interface Props {
  /** Current proof image (base64 data URL) — null when nothing uploaded yet */
  proofDataUrl: string | null
  /** Setter the parent uses to receive uploads + remove the image */
  onProofChange: (dataUrl: string | null) => void
  /** Optional override of the title shown above the block */
  title?: string
  /** Optional helper text below the title */
  subtitle?: string
  /** Show a "required" warning if no proof yet */
  required?: boolean
  /** Compact layout — used in tight modals */
  compact?: boolean
}

const MAX_BYTES = 3 * 1024 * 1024  // 3 MB

export function PaymentInstructionsBlock({
  proofDataUrl,
  onProofChange,
  title,
  subtitle,
  required = true,
  compact = false,
}: Props) {
  const t = useTranslations("extrasUI")
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY_PAYMENT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    getPaymentSettings().then((s) => {
      if (!cancelled) {
        setSettings(s)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const copy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      showSuccess(field === "card" ? t("pibCopiedCard") : t("pibCopiedPhone"))
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      showError(t("pibCopyFailed"))
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showError(t("pibImageOnly"))
      return
    }
    if (file.size > MAX_BYTES) {
      showError(t("pibImageTooLarge"))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") onProofChange(result)
    }
    reader.onerror = () => showError(t("pibReadFailed"))
    reader.readAsDataURL(file)
  }

  const noPaymentMethod = !settings.master_card_number && !settings.transfer_phone

  return (
    <div className={cn(
      "bg-white/[0.04] border border-white/[0.08] rounded-xl",
      compact ? "p-3 space-y-2.5" : "p-4 space-y-3"
    )}>
      <div>
        <div className={cn("font-bold text-white", compact ? "text-xs" : "text-sm")}>
          {title ?? t("pibTitle")}
        </div>
        {subtitle && (
          <div className="text-[10px] text-neutral-500 mt-0.5">{subtitle}</div>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-neutral-500 text-center py-3">
          {t("pibLoading")}
        </div>
      ) : noPaymentMethod ? (
        <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-yellow-300 leading-relaxed">
            {t("pibNoMethod")}
          </div>
        </div>
      ) : (
        <>
          {settings.master_card_number && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-neutral-500">{t("pibCardLabel")}</span>
                <button
                  onClick={() => copy(settings.master_card_number!, "card")}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedField === "card" ? (
                    <><Check className="w-3 h-3" /> {t("pibCopied")}</>
                  ) : (
                    <><Copy className="w-3 h-3" /> {t("pibCopy")}</>
                  )}
                </button>
              </div>
              <div className="font-mono text-sm text-white tracking-wider" dir="ltr">
                {settings.master_card_number}
              </div>
              {settings.master_card_holder && (
                <div className="text-[10px] text-neutral-500 mt-1">
                  {t("pibHolderPre")}{settings.master_card_holder}
                </div>
              )}
            </div>
          )}

          {settings.transfer_phone && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-neutral-500">{t("pibTransferLabel")}</span>
                <button
                  onClick={() => copy(settings.transfer_phone!, "phone")}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedField === "phone" ? (
                    <><Check className="w-3 h-3" /> {t("pibCopied")}</>
                  ) : (
                    <><Copy className="w-3 h-3" /> {t("pibCopy")}</>
                  )}
                </button>
              </div>
              <div className="font-mono text-sm text-white tracking-wider" dir="ltr">
                {settings.transfer_phone}
              </div>
            </div>
          )}

          {settings.payment_instructions && (
            <div className="bg-blue-400/[0.04] border border-blue-400/[0.15] rounded-lg p-2.5 text-[11px] text-blue-200 leading-relaxed whitespace-pre-line">
              {settings.payment_instructions}
            </div>
          )}
        </>
      )}

      {/* Proof upload */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-neutral-400">
            {t("pibProofLabel")} {required && <span className="text-red-400">*</span>}
          </span>
          {settings.support_phone && (
            <span className="text-[10px] text-neutral-500" dir="ltr">
              📞 {settings.support_phone}
            </span>
          )}
        </div>

        {proofDataUrl ? (
          <div className="relative bg-white/[0.04] border border-green-400/[0.3] rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofDataUrl} alt={t("pibProofAlt")} className="w-full max-h-48 object-contain" />
            <button
              type="button"
              onClick={() => onProofChange(null)}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center"
              aria-label={t("pibDeleteImage")}
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-400/[0.15] border border-green-400/[0.3] rounded-md px-2 py-0.5">
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {t("pibReadyToSend")}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-6 bg-white/[0.04] hover:bg-white/[0.06] border-2 border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-lg flex flex-col items-center gap-1.5 transition-colors"
          >
            <Upload className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
            <span className="text-[11px] text-neutral-400">{t("pibUploadReceipt")}</span>
            <span className="text-[9px] text-neutral-600">{t("pibImageFormats")}</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
