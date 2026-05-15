"use client"

import { User, ShieldCheck, Image as ImageIcon } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  SettingsSectionHeader,
  SettingsCategoryCard,
} from "@/components/settings"

/**
 * Phase 14.13 Unified UI Part 2 — Account sub-page. Entry points into
 * the existing profile / KYC surfaces (no logic duplicated; the real
 * data lives on /profile).
 */
export default function AccountSettingsPage() {
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <SettingsSectionHeader
            title="الحساب الشخصي"
            subtitle="البيانات الشخصية، KYC"
            backHref="/settings"
          />

          <div className="flex flex-col gap-3">
            <SettingsCategoryCard
              icon={User}
              title="البيانات الشخصية"
              subtitle="الاسم، البريد، الهاتف"
              color="#F472B6"
              href="/profile"
            />
            <SettingsCategoryCard
              icon={ShieldCheck}
              title="التحقّق من الهوية (KYC)"
              subtitle="حالة التوثيق ومستوى الحساب"
              color="#4ADE80"
              href="/profile/level"
            />
            <SettingsCategoryCard
              icon={ImageIcon}
              title="الصورة الشخصية"
              subtitle="تحديث صورة الملف الشخصي"
              color="#60A5FA"
              href="/profile"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
