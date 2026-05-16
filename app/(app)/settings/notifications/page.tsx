"use client"

import { useTranslations } from "next-intl"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { NotificationSettings } from "@/components/notifications/NotificationSettings"

export default function NotificationSettingsPage() {
  const t = useTranslations("settings")
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">
          <PageHeader
            badge={t("notifBadge")}
            title={t("notifTitle")}
            description={t("notifDesc")}
            showBack
            backHref="/settings"
          />

          <NotificationSettings />
        </div>
      </div>
    </AppLayout>
  )
}
