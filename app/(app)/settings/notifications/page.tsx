"use client"

import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { NotificationSettings } from "@/components/notifications/NotificationSettings"

export default function NotificationSettingsPage() {
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">
          <PageHeader
            badge="SETTINGS · إشعارات"
            title="إعدادات الإشعارات"
            description="تحكّم في الإشعارات التي تتلقاها على أجهزتك"
            showBack
            backHref="/settings"
          />

          <NotificationSettings />
        </div>
      </div>
    </AppLayout>
  )
}
