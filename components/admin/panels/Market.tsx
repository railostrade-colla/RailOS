"use client"

/**
 * Market hub — embeds every market-related sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { ProjectsPanel } from "./Projects"
import { AuctionsAdminPanel } from "./AuctionsAdminPanel"
import { AdminRequestsHubPanel } from "./AdminRequestsHubPanel"
import { MarketStatePanel } from "./MarketState"
import { MarketHealthPanel } from "./MarketHealthPanel"
import { MarketSettingsAdvancedPanel } from "./MarketSettings"

export function MarketPanel() {
  return (
    <EmbeddedTabsHub
      title="◉ السوق والمزادات"
      subtitle="كل ما يخصّ السوق — المشاريع، المزادات، الطلبات، الحالة، الصحّة"
      tabs={[
        { key: "projects", label: "▣ المشاريع", hint: "كل المشاريع وعروضها النشطة", Panel: ProjectsPanel },
        { key: "auctions", label: "🔨 المزادات", hint: "إنشاء + متابعة + إنهاء مبكر", Panel: AuctionsAdminPanel },
        { key: "requests", label: "🎯 مركز الطلبات", hint: "الشراء المباشر + طلبات أخرى", Panel: AdminRequestsHubPanel },
        { key: "state", label: "🚦 حالة السوق", hint: "إيقاف / تشغيل التداول", Panel: MarketStatePanel },
        { key: "health", label: "📊 صحّة السوق", hint: "ضغط الشراء + الاحتكار", Panel: MarketHealthPanel },
        { key: "settings", label: "⚙️ إعدادات السوق", hint: "حدود الأسعار + القواعد", Panel: MarketSettingsAdvancedPanel },
      ]}
    />
  )
}
