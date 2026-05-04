"use client"

/**
 * Legacy "Shares" panel — superseded by ShareModificationPanel and the
 * project-wallet pages. Forwards to those.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function SharesPanel() {
  return (
    <LegacyForwarder
      title="◎ الحصص والتداول"
      body="إدارة الحصص الآن مقسومة على لوحات مخصصة بصلاحيات مختلفة:"
      targets={[
        { tab: "share_modification", icon: "🔐", label: "تعديل الحصص (مزدوج التحقّق)", hint: "إصدار + إلغاء بـ super-admin code" },
        { tab: "project_wallets", icon: "🏦", label: "محافظ المشاريع", hint: "العرض + الاحتياطي + إطلاق للسوق" },
        { tab: "projects", icon: "▣", label: "المشاريع", hint: "تفاصيل المشروع + إجمالي الحصص" },
        { tab: "auctions_admin", icon: "🔨", label: "المزادات", hint: "إدارة مزادات الحصص" },
      ]}
    />
  )
}
