"use client"

/**
 * System hub — embeds every system-settings sub-panel as a top tab.
 * Phase 10.63: added محرّك السوق tab (stability_fund + fund_transactions
 * + development_promises) — surfaces three previously orphaned tables.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminUsersPanel } from "./AdminUsersPanel"
import { MarketSettingsAdvancedPanel } from "./MarketSettings"
import { MarketStatePanel } from "./MarketState"
import { MarketEnginePanel } from "./MarketEnginePanel"
import { FeeConfigAdvancedPanel } from "./FeeConfig"
import { LevelSettingsPanel } from "./LevelSettingsPanel"
import { AuditLogPanel } from "./AuditLogPanel"

export function SystemPanel() {
  return (
    <EmbeddedTabsHub
      title="⚙ النظام"
      subtitle="إعدادات النظام والإداريين والسجلات"
      tabs={[
        { key: "admins", label: "👑 الإداريون", hint: "إنشاء + صلاحيات (super-admin only)", Panel: AdminUsersPanel },
        { key: "engine", label: "⚙ محرّك السوق", hint: "صندوق الاستقرار + سجل التدخّلات + التعهّدات", Panel: MarketEnginePanel },
        { key: "market_settings", label: "📈 إعدادات السوق", hint: "حدود + قواعد التداول", Panel: MarketSettingsAdvancedPanel },
        { key: "market_state", label: "🚦 حالة السوق", hint: "إيقاف / تشغيل / صيانة", Panel: MarketStatePanel },
        { key: "fee_config", label: "💰 إعدادات الرسوم", hint: "نسب + حدود الرسوم", Panel: FeeConfigAdvancedPanel },
        { key: "levels", label: "⚙️ المستويات", hint: "متطلبات الترقية", Panel: LevelSettingsPanel },
        { key: "audit", label: "📜 سجلّ التدقيق", hint: "كل إجراءات الإداريين", Panel: AuditLogPanel },
      ]}
    />
  )
}
