"use client"

/**
 * Decisions Log hub — embeds the audit-log + related history surfaces
 * as top tabs.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AuditLogPanel } from "./AuditLogPanel"
import { UserStatsPanel } from "./UserStatsPanel"
import { CouncilAdminPanel } from "./CouncilAdminPanel"
import { DisputesPanel } from "./DisputesPanel"

export function LogPanel() {
  return (
    <EmbeddedTabsHub
      title="📋 سجلّ القرارات"
      subtitle="كل الأحداث الإدارية والقرارات في مكان واحد"
      tabs={[
        { key: "audit", label: "📜 سجلّ التدقيق", hint: "موافقات، رفض، تجميد…", Panel: AuditLogPanel },
        { key: "user", label: "📋 سجلّ المستخدم", hint: "تاريخ المستويات + الصفقات", Panel: UserStatsPanel },
        { key: "council", label: "🏛️ قرارات المجلس", hint: "تصويتات + قرارات الأعضاء", Panel: CouncilAdminPanel },
        { key: "disputes", label: "⚖️ أحكام النزاعات", hint: "نتائج النزاعات", Panel: DisputesPanel },
      ]}
    />
  )
}
