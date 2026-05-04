"use client"

/**
 * Alerts hub — embeds every alerts-related sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminRequestsHubPanel } from "./AdminRequestsHubPanel"
import { DisputesPanel } from "./DisputesPanel"
import { MarketHealthPanel } from "./MarketHealthPanel"
import { AuditLogPanel } from "./AuditLogPanel"
import { MonitorPanel } from "./Monitor"
import { NotificationsBroadcasterPanel } from "./NotificationsBroadcasterPanel"

export function AlertsPanel() {
  return (
    <EmbeddedTabsHub
      title="🚨 التنبيهات"
      subtitle="كل الأحداث الإدارية المهمّة — موزّعة على لوحات متخصصة"
      tabs={[
        { key: "requests", label: "🎯 مركز الطلبات", hint: "كل ما يحتاج إجراء", Panel: AdminRequestsHubPanel },
        { key: "disputes", label: "⚖️ النزاعات", hint: "صفقات في حالة نزاع", Panel: DisputesPanel },
        { key: "health", label: "📊 صحّة السوق", hint: "تحذيرات احتكار + ضغط بيع", Panel: MarketHealthPanel },
        { key: "audit", label: "📜 سجلّ التدقيق", hint: "الأحداث الإدارية الأخيرة", Panel: AuditLogPanel },
        { key: "monitor", label: "📡 مراقبة السوق", hint: "حركة التداول الحيّة", Panel: MonitorPanel },
        { key: "broadcast", label: "📢 إذاعة الإشعارات", hint: "إرسال إشعار للمستخدمين", Panel: NotificationsBroadcasterPanel },
      ]}
    />
  )
}
