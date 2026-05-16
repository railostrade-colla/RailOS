"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
  SettingsButtonGroup,
  SettingsToggle,
} from "@/components/settings"

/**
 * Phase 14.13 Batch 0 — Language & region sub-page. The language
 * control is now FUNCTIONAL: it sets the NEXT_LOCALE cookie (read by
 * i18n/request.ts) and refreshes so <html lang/dir> + next-intl flip.
 * UI text stays Arabic until per-namespace translations land
 * (Batches 1+) — empty namespaces fall back to the key, but pages
 * aren't rewired yet so nothing changes visually beyond dir/lang.
 */
function currentLocale(): "ar" | "en" {
  if (typeof document === "undefined") return "ar"
  return document.cookie.includes("NEXT_LOCALE=en") ? "en" : "ar"
}

export default function LanguageSettingsPage() {
  const router = useRouter()
  const t = useTranslations("settings")
  const [language, setLanguage] = useState<"ar" | "en">(currentLocale())
  const [timezone, setTimezone] = useState("baghdad")
  const [currency, setCurrency] = useState("IQD")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [autoLocation, setAutoLocation] = useState(true)

  const changeLanguage = (id: string) => {
    const loc = id === "en" ? "en" : "ar"
    setLanguage(loc)
    // 1-year cookie; read server-side by i18n/request.ts.
    document.cookie = `NEXT_LOCALE=${loc};path=/;max-age=31536000;samesite=lax`
    router.refresh()
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title={t("langTitle")}
            subtitle={t("langSubtitle")}
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard title={t("langCardTitle")} description={t("langCardDesc")}>
              <SettingsButtonGroup
                value={language}
                onChange={changeLanguage}
                options={[
                  { id: "ar", label: "العربية" },
                  { id: "en", label: "English" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title={t("tzTitle")}>
              <SettingsButtonGroup
                value={timezone}
                onChange={setTimezone}
                options={[
                  { id: "baghdad", label: t("tzBaghdad") },
                  { id: "dubai", label: t("tzDubai") },
                  { id: "riyadh", label: t("tzRiyadh") },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title={t("currencyTitle")}>
              <SettingsButtonGroup
                value={currency}
                onChange={setCurrency}
                options={[
                  { id: "IQD", label: t("currencyIqd") },
                  { id: "USD", label: t("currencyUsd") },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title={t("timeFmtTitle")}>
              <SettingsButtonGroup
                value={timeFormat}
                onChange={setTimeFormat}
                options={[
                  { id: "24h", label: t("timeFmt24") },
                  { id: "12h", label: t("timeFmt12") },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title={t("autoLocTitle")}
              description={t("autoLocDesc")}
            >
              <SettingsToggle
                label={t("autoLocToggle")}
                checked={autoLocation}
                onChange={setAutoLocation}
              />
            </SettingsOptionCard>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
