"use client"

/**
 * Legacy "System" panel — superseded by AdminUsersPanel +
 * MarketSettingsAdvancedPanel + FeeConfigAdvancedPanel + AuditLogPanel.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function SystemPanel() {
  return (
    <LegacyForwarder
      title="⚙ النظام"
      body="إعدادات النظام موزّعة على لوحات مخصصة، لكل واحدة صلاحياتها:"
      targets={[
        { tab: "admin_users", icon: "👑", label: "إدارة الإداريين", hint: "إنشاء + صلاحيات (super-admin only)" },
        { tab: "market_settings_advanced", icon: "📈", label: "إعدادات السوق المتقدمة", hint: "حدود + قواعد التداول" },
        { tab: "market_state", icon: "🚦", label: "حالة السوق", hint: "إيقاف / تشغيل / صيانة" },
        { tab: "fee_config_advanced", icon: "💰", label: "إعدادات الرسوم", hint: "نسب + حدود الرسوم" },
        { tab: "level_settings", icon: "⚙️", label: "إعدادات المستويات", hint: "متطلبات الترقية" },
        { tab: "audit_log", icon: "📜", label: "سجلّ التدقيق", hint: "كل إجراءات الإداريين" },
      ]}
    />
  )
}
