"use client"

/**
 * Legacy "Market" panel — superseded by dedicated DB-backed panels.
 * Forwards to AuctionsAdminPanel / RequestsHubPanel / ProjectsPanel /
 * MarketStatePanel / MarketHealthPanel.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function MarketPanel() {
  return (
    <LegacyForwarder
      title="◉ السوق والمزادات"
      body="إدارة السوق توزّعت على لوحات مخصصة. اختر الوظيفة المطلوبة:"
      targets={[
        { tab: "projects", icon: "▣", label: "المشاريع + العروض", hint: "كل المشاريع وعروضها النشطة" },
        { tab: "auctions_admin", icon: "🔨", label: "إدارة المزادات", hint: "إنشاء + متابعة + إنهاء مبكر" },
        { tab: "requests_hub", icon: "🎯", label: "مركز الطلبات", hint: "الشراء المباشر + طلبات أخرى" },
        { tab: "market_state", icon: "📈", label: "حالة السوق", hint: "إيقاف / تشغيل التداول" },
        { tab: "market_health", icon: "📊", label: "صحّة السوق", hint: "ضغط الشراء + الاحتكار" },
        { tab: "market_settings_advanced", icon: "⚙️", label: "إعدادات السوق المتقدمة", hint: "حدود الأسعار + القواعد" },
      ]}
    />
  )
}
