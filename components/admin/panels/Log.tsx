"use client"

/**
 * Legacy "Decisions Log" panel — superseded by AuditLogPanel which
 * reads the real `audit_log` table. This forwarder also points at
 * the related history surfaces.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function LogPanel() {
  return (
    <LegacyForwarder
      title="📋 سجلّ القرارات"
      body="سجلّ القرارات الموحَّد انتقل إلى لوحة سجلّ التدقيق المُغذَّاة من قاعدة البيانات."
      targets={[
        { tab: "audit_log", icon: "📜", label: "سجلّ التدقيق", hint: "كل إجراءات الإداريين (موافقات، رفض، تجميد…)" },
        { tab: "user_stats", icon: "📋", label: "سجلّ المستخدم", hint: "تاريخ المستويات + الصفقات لكل مستخدم" },
        { tab: "council_admin", icon: "🏛️", label: "قرارات المجلس", hint: "تصويتات + قرارات أعضاء المجلس" },
        { tab: "disputes", icon: "⚖️", label: "أحكام النزاعات", hint: "نتائج النزاعات السابقة" },
      ]}
    />
  )
}
