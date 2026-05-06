"use client"

/**
 * Users hub — Phase 10.79 (Task 13).
 *
 * "المستويات" tab REMOVED — it lives in /admin?tab=system → "المستويات"
 * tab. Same level_settings panel, single source of truth, no drift.
 *
 * Current tabs (5):
 *   • قائمة المستخدمين — registered users with admin actions
 *   • التحقق (KYC) — review queue
 *   • سجلّ مستخدم — single-user deep-stats lookup
 *   • النزاعات — deal disputes
 *   • صندوق الدعم — support tickets
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { UsersListPanel } from "./UsersListPanel"
import { KycPanel } from "./KycPanel"
import { UserStatsPanel } from "./UserStatsPanel"
import { DisputesPanel } from "./DisputesPanel"
import { SupportInboxPanel } from "./SupportInboxPanel"

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
      ]}
    />
  )
}
