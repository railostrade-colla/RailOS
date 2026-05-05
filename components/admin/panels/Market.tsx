"use client"

/**
 * Market hub — focused on market state, health, settings, and auctions.
 * Phase 10.59: removed "Projects" + "Requests Hub" tabs (per user
 * request — Projects has its own dedicated section, and the Requests
 * Hub lives in the main sidebar).
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AuctionsAdminPanel } from "./AuctionsAdminPanel"
import { MarketStatePanel } from "./MarketState"
import { MarketHealthPanel } from "./MarketHealthPanel"
import { MarketSettingsAdvancedPanel } from "./MarketSettings"

export function MarketPanel() {
  return (
    <EmbeddedTabsHub
      title="◉ السوق والمزادات"
      subtitle="حالة السوق + المزادات + المؤشّرات + إعدادات التداول"
      tabs={[
        { key: "auctions", label: "🔨 المزادات", hint: "إنشاء + متابعة + إنهاء مبكر", Panel: AuctionsAdminPanel },
        { key: "state", label: "🚦 حالة السوق", hint: "إيقاف / تشغيل التداول", Panel: MarketStatePanel },
        { key: "health", label: "📊 صحّة السوق", hint: "ضغط الشراء + الاحتكار", Panel: MarketHealthPanel },
        { key: "settings", label: "⚙️ إعدادات السوق", hint: "حدود الأسعار + القواعد", Panel: MarketSettingsAdvancedPanel },
      ]}
    />
  )
}
