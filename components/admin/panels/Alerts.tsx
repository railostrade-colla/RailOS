"use client"

/**
 * Legacy "Alerts" panel — there's no dedicated alerts feed yet, so we
 * forward to the surfaces that actually surface admin-relevant events
 * (RequestsHub for things needing action, AuditLog for past events,
 * MarketHealth for live market warnings).
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function AlertsPanel() {
  return (
    <LegacyForwarder
      title="🚨 التنبيهات"
      body="لا يوجد بَثّ تنبيهات موحَّد بعد. الأحداث المهمّة تُعرض في اللوحات التالية:"
      targets={[
        { tab: "requests_hub", icon: "🎯", label: "مركز الطلبات", hint: "كل ما يحتاج إجراء (KYC، نزاعات، إثباتات…)" },
        { tab: "disputes", icon: "⚖️", label: "النزاعات المفتوحة", hint: "صفقات في حالة نزاع" },
        { tab: "market_health", icon: "📊", label: "صحّة السوق", hint: "تحذيرات احتكار + ضغط بيع" },
        { tab: "audit_log", icon: "📜", label: "سجلّ التدقيق", hint: "كل الأحداث الإدارية الأخيرة" },
        { tab: "monitor", icon: "📡", label: "مراقبة السوق", hint: "حركة التداول الحيّة" },
        { tab: "broadcaster", icon: "📢", label: "إذاعة الإشعارات", hint: "إرسال إشعار للمستخدمين" },
      ]}
    />
  )
}
