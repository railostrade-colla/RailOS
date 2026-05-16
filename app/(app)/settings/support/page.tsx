"use client"

import { useTranslations } from "next-intl"
import { HelpCircle, MessageCircle, Flag } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsCategoryCard,
} from "@/components/settings"

/**
 * Phase 14.13 Unified UI Part 2 — Support sub-page. Entry points into
 * the existing /support surface.
 */
export default function SupportSettingsPage() {
  const t = useTranslations("settings")
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title={t("supportTitle")}
            subtitle={t("supportSubtitle")}
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsCategoryCard
              icon={HelpCircle}
              title={t("supportFaqTitle")}
              subtitle={t("supportFaqSub")}
              color="#22D3EE"
              href="/support"
            />
            <SettingsCategoryCard
              icon={MessageCircle}
              title={t("supportContactTitle")}
              subtitle={t("supportContactSub")}
              color="#4ADE80"
              href="/support"
            />
            <SettingsCategoryCard
              icon={Flag}
              title={t("supportReportTitle")}
              subtitle={t("supportReportSub")}
              color="#FBBF24"
              href="/support"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
