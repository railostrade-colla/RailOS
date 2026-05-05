"use client"

/**
 * Alerts hub — Phase 10.59 dedupe.
 *
 * Removed duplicate sub-panels that live elsewhere:
 *   • DisputesPanel (lives in سجلّ القرارات / Log)
 *   • MarketHealthPanel (lives in السوق / Market)
 *   • AuditLogPanel (lives in سجلّ القرارات / Log)
 *
 * Kept the panels that genuinely belong here — the action inbox, the
 * live market monitor, and the broadcaster. All three are
 * DB-connected (no mocks):
 *   • AdminRequestsHubPanel reads `admin_notifications` + per-type
 *     pending lists via `lib/data/admin-requests`.
 *   • MonitorPanel streams from the live trades feed.
 *   • NotificationsBroadcasterPanel writes to `notifications`.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminRequestsHubPanel } from "./AdminRequestsHubPanel"
import { MonitorPanel } from "./Monitor"
import { NotificationsBroadcasterPanel } from "./NotificationsBroadcasterPanel"

export function AlertsPanel() {
  return (
    <EmbeddedTabsHub
      title="🚨 التنبيهات"
      subtitle="مركز الطلبات + المراقبة الحيّة + إذاعة الإشعارات"
      tabs={[
        { key: "requests", label: "🎯 مركز الطلبات", hint: "كل ما يحتاج إجراء — موافقات، طلبات، نزاعات", Panel: AdminRequestsHubPanel },
        { key: "monitor", label: "📡 مراقبة السوق", hint: "حركة التداول الحيّة", Panel: MonitorPanel },
        { key: "broadcast", label: "📢 إذاعة الإشعارات", hint: "إرسال إشعار للمستخدمين", Panel: NotificationsBroadcasterPanel },
      ]}
    />
  )
}
