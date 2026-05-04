"use client"

/**
 * Users hub — embeds every user-management sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { KycPanel } from "./KycPanel"
import { UserStatsPanel } from "./UserStatsPanel"
import { AdminUsersPanel } from "./AdminUsersPanel"
import { DisputesPanel } from "./DisputesPanel"
import { SupportInboxPanel } from "./SupportInboxPanel"
import { LevelSettingsPanel } from "./LevelSettingsPanel"

export function UsersPanel() {
  return (
    <EmbeddedTabsHub
      title="⊙ المستخدمون والإدارة"
      subtitle="إدارة المستخدمين + التحقق + النزاعات + الدعم"
      tabs={[
        { key: "kyc", label: "🛡️ التحقق (KYC)", hint: "مراجعة طلبات التوثيق", Panel: KycPanel },
        { key: "stats", label: "📋 سجلّ مستخدم", hint: "إحصائيات تفصيلية لمستخدم واحد", Panel: UserStatsPanel },
        { key: "admins", label: "👑 الإداريون", hint: "إنشاء + صلاحيات الفريق", Panel: AdminUsersPanel },
        { key: "disputes", label: "⚖️ النزاعات", hint: "حلّ نزاعات الصفقات", Panel: DisputesPanel },
        { key: "support", label: "💬 صندوق الدعم", hint: "ردّ على تذاكر الدعم", Panel: SupportInboxPanel },
        { key: "levels", label: "⚙️ المستويات", hint: "متطلبات الترقية + التنزيل", Panel: LevelSettingsPanel },
      ]}
    />
  )
}
