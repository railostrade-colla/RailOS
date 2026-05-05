"use client"

/**
 * Users hub — Phase 10.59 restructure.
 *
 * Tabs (in order):
 *   • قائمة المستخدمون — actual registered users from `profiles`
 *     with admin actions (read replaces the old MOCK_ADMIN_USERS).
 *   • التحقق (KYC) — KYC review queue.
 *   • سجلّ مستخدم — single-user deep-stats lookup.
 *   • النزاعات — deal disputes.
 *   • صندوق الدعم — support tickets.
 *   • المستويات — level upgrade/downgrade settings.
 *
 * Admins/super-admins management was MOVED to the System hub
 * (per user request, "Users page is for actual users only").
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { UsersListPanel } from "./UsersListPanel"
import { KycPanel } from "./KycPanel"
import { UserStatsPanel } from "./UserStatsPanel"
import { DisputesPanel } from "./DisputesPanel"
import { SupportInboxPanel } from "./SupportInboxPanel"
import { LevelSettingsPanel } from "./LevelSettingsPanel"

export function UsersPanel() {
  return (
    <EmbeddedTabsHub
      title="⊙ المستخدمون"
      subtitle="إدارة المستخدمين المسجَّلين + التحقق + النزاعات + الدعم"
      tabs={[
        { key: "list", label: "👥 قائمة المستخدمين", hint: "كل مستخدم سجّل في التطبيق", Panel: UsersListPanel },
        { key: "kyc", label: "🛡️ التحقق (KYC)", hint: "مراجعة طلبات التوثيق", Panel: KycPanel },
        { key: "stats", label: "📋 سجلّ مستخدم", hint: "إحصائيات تفصيلية لمستخدم واحد", Panel: UserStatsPanel },
        { key: "disputes", label: "⚖️ النزاعات", hint: "حلّ نزاعات الصفقات", Panel: DisputesPanel },
        { key: "support", label: "💬 صندوق الدعم", hint: "ردّ على تذاكر الدعم", Panel: SupportInboxPanel },
        { key: "levels", label: "⚙️ المستويات", hint: "متطلبات الترقية + التنزيل", Panel: LevelSettingsPanel },
      ]}
    />
  )
}
