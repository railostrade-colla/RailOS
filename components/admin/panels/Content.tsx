"use client"

/**
 * Legacy "Content" panel — superseded by LegalPagesEditorPanel and
 * NotificationsBroadcasterPanel.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function ContentPanel() {
  return (
    <LegacyForwarder
      title="📝 المحتوى"
      body="إدارة المحتوى الآن مقسومة على لوحات متخصصة:"
      targets={[
        { tab: "legal_editor", icon: "📜", label: "محرّر الصفحات القانونية", hint: "الشروط + الخصوصية + الـ FAQ" },
        { tab: "broadcaster", icon: "📢", label: "إذاعة الإشعارات", hint: "إرسال إشعار لشريحة من المستخدمين" },
        { tab: "support_inbox", icon: "💬", label: "صندوق الدعم", hint: "ردّ على تذاكر الدعم" },
        { tab: "discounts_admin", icon: "🎁", label: "الخصومات", hint: "إنشاء + إدارة عروض الخصم" },
      ]}
    />
  )
}
