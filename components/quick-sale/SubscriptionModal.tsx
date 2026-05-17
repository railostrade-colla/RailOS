"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { X, Zap, Check } from "lucide-react"
import {
  subscribeToQuickSale,
  getFeeUnitsBalance,
  getSubscriptionStatus,
  QS_SUBSCRIPTION_FEE,
} from "@/lib/data/quick-sale"
import { showSuccess, showError } from "@/lib/utils/toast"
import { useRouter } from "next/navigation"

interface SubscriptionModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function SubscriptionModal({ onClose, onSuccess }: SubscriptionModalProps) {
  const router = useRouter()
  const t = useTranslations("quickSale")
  const FEATURES = t.raw("subFeatures") as string[]
  const [balance, setBalance] = useState<number>(0)
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // When the user already has an active subscription, the same modal
  // is re-used for renewal — show how much time is being added on top.
  const [existingDaysLeft, setExistingDaysLeft] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, status] = await Promise.all([
          getFeeUnitsBalance(),
          getSubscriptionStatus(),
        ])
        if (!cancelled) {
          setBalance(b)
          if (status.active) setExistingDaysLeft(status.days_left)
        }
      } finally {
        if (!cancelled) setLoadingBalance(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const isRenewal = existingDaysLeft > 0

  const canAfford = balance >= QS_SUBSCRIPTION_FEE
  const shortBy = Math.max(0, QS_SUBSCRIPTION_FEE - balance)

  async function handleSubscribe() {
    if (!canAfford || submitting) return

    setSubmitting(true)
    const result = await subscribeToQuickSale()

    if (result.success) {
      showSuccess(isRenewal ? t("subRenewSuccess") : t("subSuccess"))
      onSuccess()
    } else {
      showError(result.error || t("subFailed"))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-[#FB923C]/20 to-[#F87171]/20">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
            aria-label={t("close")}
          >
            <X size={16} className="text-neutral-400" />
          </button>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#FB923C] to-[#F87171] flex items-center justify-center shadow-lg">
              <Zap size={32} className="text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-white">
              {isRenewal ? t("subRenewTitle") : t("subTitle")}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              {isRenewal
                ? t("subRenewDesc", { n: existingDaysLeft })
                : t("subDesc")}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Price */}
          <div className="text-center py-2">
            <div className="text-4xl font-bold font-mono text-white">
              {QS_SUBSCRIPTION_FEE.toLocaleString("en-US")}
            </div>
            <div className="text-sm text-neutral-400 mt-1">{t("subUnitPerMonth")}</div>
            <div className="text-xs text-[#4ADE80] mt-2 font-bold">
              {t("subFullAccess")}
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 bg-white/[0.03] rounded-xl p-4 border border-white/[0.05]">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-neutral-300"
              >
                <Check
                  size={14}
                  className="text-[#4ADE80] shrink-0 mt-0.5"
                  strokeWidth={3}
                />
                <span className="leading-relaxed">{f}</span>
              </div>
            ))}
          </div>

          {/* Balance status */}
          <div
            className={`p-3 rounded-lg border text-sm ${
              loadingBalance
                ? "bg-white/[0.04] border-white/[0.08] text-neutral-400"
                : canAfford
                ? "bg-[#4ADE80]/5 border-[#4ADE80]/20 text-[#4ADE80]"
                : "bg-[#F87171]/5 border-[#F87171]/20 text-[#F87171]"
            }`}
          >
            {loadingBalance ? (
              t("subCheckingBalance")
            ) : (
              <>
                {t("subBalancePre")}
                <span className="font-mono font-bold">
                  {balance.toLocaleString("en-US")}
                </span>{" "}
                {t("subUnit")}
                {!canAfford && (
                  <div className="text-xs mt-1 opacity-90">
                    {t("subNeedPre")}
                    <span className="font-mono font-bold">
                      {shortBy.toLocaleString("en-US")}
                    </span>{" "}
                    {t("subNeedPost")}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleSubscribe}
            disabled={!canAfford || submitting || loadingBalance}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-opacity ${
              canAfford && !submitting && !loadingBalance
                ? "bg-gradient-to-r from-[#FB923C] to-[#F87171] hover:opacity-90"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {submitting
              ? (isRenewal ? t("subRenewing") : t("subSubscribing"))
              : loadingBalance
              ? "..."
              : canAfford
              ? (isRenewal ? t("subRenewNow") : t("subSubscribeNow"))
              : t("subInsufficient")}
          </button>

          {!canAfford && !loadingBalance && (
            <button
              onClick={() => router.push("/portfolio?tab=fee_units")}
              className="w-full py-2 text-sm text-[#60A5FA] hover:underline"
            >
              {t("subTopUp")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
