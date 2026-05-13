"use client"

/**
 * Market hub — Phase 14.07b cleanup.
 *
 * Removed: "📊 صحّة السوق" (MarketHealthPanel — mock-only, mislead
 * admin with synthetic data via analyzeAllProjects) and
 * "⚙️ إعدادات السوق" (MarketSettingsAdvancedPanel — pure mock
 * with a fake save). Both were deleted in Phase 14.07b. Real
 * settings live in /admin/market-settings (Phase 14.06 registry).
 *
 * Surviving tabs:
 *   • 🔨 المزادات   — AuctionsAdminPanel (DB-backed)
 *   • 🚦 حالة السوق  — MarketStatePanel (Phase 10.37 — DB-backed)
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AuctionsAdminPanel } from "./AuctionsAdminPanel"
import { MarketStatePanel } from "./MarketState"

export function MarketPanel() {
  return (
    <EmbeddedTabsHub
      title="◉ السوق والمزادات"
      subtitle="إدارة المزادات + التحكم بحالة السوق على مستوى المنصة"
      tabs={[
        { key: "auctions", label: "🔨 المزادات", hint: "إنشاء + متابعة + إنهاء مبكر", Panel: AuctionsAdminPanel },
        { key: "state", label: "🚦 حالة السوق", hint: "إيقاف / تشغيل التداول", Panel: MarketStatePanel },
      ]}
    />
  )
}
