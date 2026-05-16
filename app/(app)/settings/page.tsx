"use client"

import {
  Palette, Globe, Lock, Bell, Wallet, User, HelpCircle,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { SettingsCategoryCard } from "@/components/settings"

/**
 * Phase 14.13 Unified UI Part 2 — Settings is now a vertical category
 * list (iOS-Settings / Notion style). Every section the old tabbed
 * page handled was relocated to its own sub-page; nothing was dropped:
 *   appearance   → theme bridge + font/density/animations
 *   language     → language / timezone / currency / time format
 *   security     → biometric (WebAuthn) + password + danger zone
 *   notifications→ existing advanced NotificationSettings page
 *   finance      → level limit + PaymentMethodsEditor
 *   account      → personal data / KYC entry points
 *   support      → FAQ / contact entry points
 */
const CATEGORIES = [
  {
    icon: Palette,
    titleKey: "catAppearanceTitle",
    subKey: "catAppearanceSub",
    color: "#C084FC",
    href: "/settings/appearance",
  },
  {
    icon: Globe,
    titleKey: "catLangTitle",
    subKey: "catLangSub",
    color: "#60A5FA",
    href: "/settings/language",
  },
  {
    icon: Lock,
    titleKey: "catSecurityTitle",
    subKey: "catSecuritySub",
    color: "#4ADE80",
    href: "/settings/security",
  },
  {
    icon: Bell,
    titleKey: "catNotifTitle",
    subKey: "catNotifSub",
    color: "#FBBF24",
    href: "/settings/notifications",
  },
  {
    icon: Wallet,
    titleKey: "catFinanceTitle",
    subKey: "catFinanceSub",
    color: "#22C55E",
    href: "/settings/finance",
  },
  {
    icon: User,
    titleKey: "catAccountTitle",
    subKey: "catAccountSub",
    color: "#F472B6",
    href: "/settings/account",
  },
  {
    icon: HelpCircle,
    titleKey: "catSupportTitle",
    subKey: "catSupportSub",
    color: "#22D3EE",
    href: "/settings/support",
  },
] as const

export default function SettingsPage() {
  const t = useTranslations("settings")
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader title={t("hubTitle")} subtitle={t("hubSubtitle")} backHref="/profile" />

          <div className="flex flex-col gap-3 mt-2">
            {CATEGORIES.map((c) => (
              <SettingsCategoryCard
                key={c.href}
                icon={c.icon}
                title={t(c.titleKey)}
                subtitle={t(c.subKey)}
                color={c.color}
                href={c.href}
              />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
