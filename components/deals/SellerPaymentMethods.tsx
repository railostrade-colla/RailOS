"use client"

/**
 * SellerPaymentMethods — Phase 12.7.
 *
 * Shows the counter-party's payment methods on the deal page so the
 * buyer can transfer money off-platform. Each row is copyable with one
 * click. The methods are fetched via a gated RPC that only returns
 * data when the caller is a participant of an active deal.
 *
 * If the seller hasn't set any methods, we render a friendly nudge
 * pointing to /settings → tab=finance.
 */

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, CheckCircle2, AlertTriangle, Star } from "lucide-react"
import {
  PAYMENT_METHOD_META,
  getCounterpartyPaymentMethods,
  type PaymentMethod,
} from "@/lib/data/payment-methods"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

interface Props {
  dealId: string
  /** Optional title override. Defaults to "طرق دفع البائع". */
  title?: string
  /** Hide the help text under the title. */
  compact?: boolean
}

export function SellerPaymentMethods({ dealId, title, compact = false }: Props) {
  const t = useTranslations("deals")
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    getCounterpartyPaymentMethods(dealId).then((rows) => {
      if (cancelled) return
      // Sort: primary first, then original order.
      const sorted = [...rows].sort((a, b) => {
        const ap = a.is_primary ? 1 : 0
        const bp = b.is_primary ? 1 : 0
        return bp - ap
      })
      setMethods(sorted)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [dealId])

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
        <div className="text-xs text-neutral-500">{t("loadingMethods")}</div>
      </div>
    )
  }

  if (methods.length === 0) {
    return (
      <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-yellow-300 mb-1">
              {t("sellerNoMethods")}
            </div>
            <div className="text-[11px] text-yellow-200/70 leading-relaxed">
              {t("contactViaChat")}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-400/[0.05] to-green-400/[0.05] border border-blue-400/20 rounded-xl p-4 space-y-3">
      <div>
        <div className="text-xs font-bold text-white">
          {title ?? t("sellerMethodsTitle")}
        </div>
        {!compact && (
          <div className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
            {t("copyHint")}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {methods.map((m, idx) => (
          <PaymentMethodChip key={idx} method={m} />
        ))}
      </div>
    </div>
  )
}

function PaymentMethodChip({ method }: { method: PaymentMethod }) {
  const t = useTranslations("deals")
  const [copied, setCopied] = useState(false)
  const meta = PAYMENT_METHOD_META[method.type]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(method.value)
      setCopied(true)
      showSuccess(t("copied", { label: method.label }))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError(t("copyFailed"))
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "w-full bg-black/40 border rounded-lg p-3 transition-colors text-right group",
        copied
          ? "border-green-400/40"
          : "border-white/[0.08] hover:border-white/[0.15] hover:bg-black/60"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white">{method.label}</span>
            {method.is_primary && (
              <Star
                className="w-3 h-3 text-yellow-400"
                strokeWidth={2}
                fill="currentColor"
              />
            )}
          </div>
          {method.holder_name && (
            <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
              {method.holder_name}
            </div>
          )}
          <div
            className="text-sm font-mono text-blue-300 mt-1 break-all"
            dir="ltr"
          >
            {method.value}
          </div>
        </div>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
            copied
              ? "bg-green-400/[0.15] text-green-400"
              : "bg-white/[0.05] text-neutral-400 group-hover:bg-white/[0.1] group-hover:text-white"
          )}
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <Copy className="w-4 h-4" strokeWidth={2} />
          )}
        </div>
      </div>
    </button>
  )
}
