"use client"

/**
 * System hub — Phase 13.45.
 *
 * Removed: "⚙ محرّك السوق" tab (stability fund + interventions +
 * dev promises). The market engine has moved to its own dedicated
 * panel under "نظرة عامة → مراقبة السوق" with on/off toggle +
 * conditions + manual rise — see MarketEnginePanelV2 (Phase 13.46).
 *
 * What stays here: admin / payment / market settings / market state
 * / fee config / levels / audit log.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminUsersPanel } from "./AdminUsersPanel"
import { MarketSettingsAdvancedPanel } from "./MarketSettings"
import { MarketStatePanel } from "./MarketState"
import { FeeConfigAdvancedPanel } from "./FeeConfig"
import { LevelSettingsPanel } from "./LevelSettingsPanel"
import { AuditLogPanel } from "./AuditLogPanel"
import { PaymentSettingsPanel } from "./PaymentSettingsPanel"

export function SystemPanel() {
  return (
    <EmbeddedTabsHub
      title="⚙ النظام"
      subtitle="إعدادات النظام والإداريين والسجلات"
      tabs={[
        { key: "admins", label: "👑 الإداريون", hint: "إنشاء + صلاحيات (super-admin only)", Panel: AdminUsersPanel },
        { key: "payment", label: "💳 إعدادات الدفع", hint: "ماستر كارد + هاتف التحويل + التعليمات", Panel: PaymentSettingsPanel },
        { key: "market_settings", label: "📈 إعدادات السوق", hint: "حدود + قواعد التداول", Panel: MarketSettingsAdvancedPanel },
        { key: "market_state", label: "🚦 حالة السوق", hint: "إيقاف / تشغيل / صيانة", Panel: MarketStatePanel },
        { key: "fee_config", label: "💰 إعدادات الرسوم", hint: "نسب + حدود الرسوم", Panel: FeeConfigAdvancedPanel },
        { key: "levels", label: "⚙️ المستويات", hint: "متطلبات الترقية", Panel: LevelSettingsPanel },
        { key: "audit", label: "📜 سجلّ التدقيق", hint: "كل إجراءات الإداريين", Panel: AuditLogPanel },
      ]}
    />
  )
}
