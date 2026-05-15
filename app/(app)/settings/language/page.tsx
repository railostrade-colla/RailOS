"use client"

import { useState } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsOptionCard,
  SettingsButtonGroup,
  SettingsToggle,
} from "@/components/settings"

/**
 * Phase 14.13 Unified UI Part 2 — Language & region sub-page.
 * Relocated from the old "general" tab. Language stays "ar" (English
 * is Beta/قريباً — wired in M4). Local UI state, unchanged behaviour.
 */
export default function LanguageSettingsPage() {
  const [language, setLanguage] = useState("ar")
  const [timezone, setTimezone] = useState("baghdad")
  const [currency, setCurrency] = useState("IQD")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [autoLocation, setAutoLocation] = useState(true)

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title="اللغة والمنطقة"
            subtitle="اللغة، التوقيت، العملة"
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsOptionCard title="اللغة" description="لغة واجهة التطبيق">
              <SettingsButtonGroup
                value={language}
                onChange={setLanguage}
                options={[
                  { id: "ar", label: "العربية" },
                  { id: "en", label: "English (قريباً)" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title="المنطقة الزمنية">
              <SettingsButtonGroup
                value={timezone}
                onChange={setTimezone}
                options={[
                  { id: "baghdad", label: "بغداد +3" },
                  { id: "dubai", label: "دبي +4" },
                  { id: "riyadh", label: "الرياض +3" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title="العملة">
              <SettingsButtonGroup
                value={currency}
                onChange={setCurrency}
                options={[
                  { id: "IQD", label: "د.ع IQD" },
                  { id: "USD", label: "$ USD" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard title="تنسيق الوقت">
              <SettingsButtonGroup
                value={timeFormat}
                onChange={setTimeFormat}
                options={[
                  { id: "24h", label: "24 ساعة" },
                  { id: "12h", label: "12 ساعة" },
                ]}
              />
            </SettingsOptionCard>

            <SettingsOptionCard
              title="الموقع التلقائي"
              description="استخدم موقعك لتحسين التوصيات"
            >
              <SettingsToggle
                label="تفعيل الموقع التلقائي"
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
