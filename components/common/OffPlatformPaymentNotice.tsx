"use client"

/**
 * OffPlatformPaymentNotice — Phase 14.11 A7.
 *
 * A light reminder banner shown in the deal / payment-proof flow so
 * users always understand: RailOS does NOT handle money. Payment is
 * arranged and sent OFF the platform (Zain Cash / Asia Hawala / bank
 * transfer), and RailOS only escrows the SHARES + documents the deal.
 *
 * Drop it near the top of the create-deal and payment-proof surfaces.
 * Links to the full /disclaimer page.
 */

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Info } from "lucide-react"

export function OffPlatformPaymentNotice({
  className = "",
}: {
  className?: string
}) {
  const t = useTranslations("extrasUI")
  return (
    <div
      className={
        "bg-yellow-400/[0.06] border border-yellow-400/20 rounded-xl p-3 flex items-start gap-2.5 " +
        className
      }
      dir="rtl"
    >
      <Info
        className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0"
        strokeWidth={2}
      />
      <div className="text-[11px] text-neutral-300 leading-relaxed">
        <span className="font-bold text-yellow-300">{t("offReminder")}</span>
        {t("offBodyPre")}<span className="font-bold">{t("offOffPlatform")}</span>
        {t("offBodyMid")}
        <Link
          href="/disclaimer"
          className="text-yellow-300 hover:text-yellow-200 underline underline-offset-2"
        >
          {t("offDisclaimerLink")}
        </Link>
      </div>
    </div>
  )
}
