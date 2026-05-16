"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
} from "@/components/settings"
import { showInfo } from "@/lib/utils/toast"
import { LEVEL_LIMITS, fmtLimit, type InvestorLevel } from "@/lib/utils/contractLimits"
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/data/profile"
import { PaymentMethodsEditor } from "@/components/settings/PaymentMethodsEditor"

/**
 * Phase 14.13 Unified UI Part 2 — Finance sub-page. Level-based
 * monthly limit + the Phase-12.7 PaymentMethodsEditor are relocated
 * verbatim from the old "finance" tab.
 */
export default function FinanceSettingsPage() {
  const t = useTranslations("settings")
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    getCurrentUserProfile().then((p) => {
      if (cancelled || !p) return
      setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const levelKey: InvestorLevel = (() => {
    const raw = profile?.level
    return raw === "advanced" || raw === "pro" ? raw : "basic"
  })()

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title={t("financeTitle")}
            subtitle={t("financeSubtitle")}
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard title={t("financeSettings")}>
              <div className="divide-y divide-white/[0.04]">
                <div className="py-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-white font-medium">{t("currentMonthlyLimit")}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{t("byLevel", { level: levelKey })}</div>
                  </div>
                  <span className="text-sm font-bold text-yellow-400 font-mono">
                    {fmtLimit(LEVEL_LIMITS[levelKey])} {t("iqd")}
                  </span>
                </div>
                <button
                  onClick={() => showInfo(t("feeUnitsSoon"))}
                  className="no-shadow w-full flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors text-right"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{t("feeUnits")}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{t("feeUnitsSub")}</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
                </button>
                <button
                  onClick={() => showInfo(t("statementPreparing"))}
                  className="no-shadow w-full flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.04] rounded-lg px-2 -mx-2 transition-colors text-right"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{t("statement")}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{t("statementSub")}</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
                </button>
              </div>
            </SettingsOptionCard>

            <PaymentMethodsEditor />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
