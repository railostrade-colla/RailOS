"use client"

/**
 * Alerts hub — Phase 14.08.2.
 *
 * Phase 14.08.2 removed the embedded MonitorPanel sub-tab: it surfaced
 * the legacy market-monitor UI which now lives at /admin/engine-monitor
 * (the Phase 14.08f App-Router page with full 3-layer visibility).
 *
 * Kept the panels that genuinely belong here:
 *   • AdminRequestsHubPanel reads `admin_notifications` + per-type
 *     pending lists via `lib/data/admin-requests`.
 *   • NotificationsBroadcasterPanel writes to `notifications`.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { AdminRequestsHubPanel } from "./AdminRequestsHubPanel"
import { NotificationsBroadcasterPanel } from "./NotificationsBroadcasterPanel"

export function AlertsPanel() {
  return (
    <EmbeddedTabsHub
      title="🚨 التنبيهات"
      subtitle="مركز الطلبات + إذاعة الإشعارات"
      tabs={[
        { key: "requests", label: "🎯 مركز الطلبات", hint: "كل ما يحتاج إجراء — موافقات، طلبات، نزاعات", Panel: AdminRequestsHubPanel },
        { key: "broadcast", label: "📢 إذاعة الإشعارات", hint: "إرسال إشعار للمستخدمين", Panel: NotificationsBroadcasterPanel },
      ]}
    />
  )
}
