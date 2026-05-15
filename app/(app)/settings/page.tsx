"use client"

import {
  Palette, Globe, Lock, Bell, Wallet, User, HelpCircle,
} from "lucide-react"
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
    title: "المظهر والعرض",
    subtitle: "الوضع، الخط، الحركات",
    color: "#C084FC",
    href: "/settings/appearance",
  },
  {
    icon: Globe,
    title: "اللغة والمنطقة",
    subtitle: "العربية، التوقيت، العملة",
    color: "#60A5FA",
    href: "/settings/language",
  },
  {
    icon: Lock,
    title: "الأمان والخصوصية",
    subtitle: "كلمة السر، البصمة",
    color: "#4ADE80",
    href: "/settings/security",
  },
  {
    icon: Bell,
    title: "الإشعارات",
    subtitle: "التنبيهات، الأصوات",
    color: "#FBBF24",
    href: "/settings/notifications",
  },
  {
    icon: Wallet,
    title: "المالية والدفع",
    subtitle: "المحفظة، الفواتير",
    color: "#22C55E",
    href: "/settings/finance",
  },
  {
    icon: User,
    title: "الحساب الشخصي",
    subtitle: "البيانات الشخصية، KYC",
    color: "#F472B6",
    href: "/settings/account",
  },
  {
    icon: HelpCircle,
    title: "الدعم والمساعدة",
    subtitle: "الأسئلة، التواصل",
    color: "#22D3EE",
    href: "/settings/support",
  },
] as const

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader title="⚙️ الإعدادات" subtitle="إدارة تفضيلاتك" backHref="/profile" />

          <div className="flex flex-col gap-3 mt-2">
            {CATEGORIES.map((c) => (
              <SettingsCategoryCard
                key={c.href}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
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
