"use client"

/**
 * System hub — Phase 14.07b cleanup.
 *
 * Removed three tabs that pointed at mock-only or duplicate panels:
 *   • "📈 إعدادات السوق" — MarketSettingsAdvancedPanel (mock,
 *     deleted). The real registry lives at /admin/market-settings
 *     (Phase 14.06) and is reachable via the sidebar entry added
 *     in Phase 14.07c.
 *   • "🚦 حالة السوق" — duplicated MarketStatePanel that also lives
 *     under Market hub. Reach it from there.
 *   • "💰 إعدادات الرسوم" — FeeConfigAdvancedPanel (mock, deleted).
 *     A real DB-backed replacement will land in a later phase; for
 *     now use Fees hub for the per-deal/per-unit controls.
 *
 * Surviving tabs:
 *   • 👑 الإداريون           — AdminUsersPanel (real)
 *   • 💳 إعدادات الدفع       — PaymentSettingsPanel (real)
 *   • ⚙️ المستويات            — LevelSettingsPanel (real)
 *   • 📜 سجلّ التدقيق         — AuditLogPanel (real)
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminUsersPanel } from "./AdminUsersPanel"
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
        { key: "levels", label: "⚙️ المستويات", hint: "متطلبات الترقية", Panel: LevelSettingsPanel },
        { key: "audit", label: "📜 سجلّ التدقيق", hint: "كل إجراءات الإداريين", Panel: AuditLogPanel },
      ]}
    />
  )
}
