"use client"

/**
 * Legacy "Users" panel — superseded by dedicated DB-backed panels.
 * The nav item still exists for backwards compatibility, but the page
 * now forwards to KycPanel / DisputesPanel / SupportInboxPanel /
 * AdminUsersPanel / UserStatsPanel.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function UsersPanel() {
  return (
    <LegacyForwarder
      title="⊙ المستخدمون والإدارة"
      body="هذه الصفحة قُسِّمت إلى لوحات مخصصة لكل وظيفة. اختر اللوحة المناسبة:"
      targets={[
        { tab: "kyc", icon: "🛡️", label: "التحقق (KYC)", hint: "مراجعة طلبات التوثيق" },
        { tab: "user_stats", icon: "📋", label: "سجلّ مستخدم", hint: "إحصائيات تفصيلية لمستخدم واحد" },
        { tab: "admin_users", icon: "👑", label: "إدارة الإداريين", hint: "إنشاء + صلاحيات الفريق" },
        { tab: "disputes", icon: "⚖️", label: "النزاعات", hint: "حلّ نزاعات الصفقات" },
        { tab: "support_inbox", icon: "💬", label: "صندوق الدعم", hint: "ردّ على تذاكر الدعم" },
        { tab: "level_settings", icon: "⚙️", label: "إعدادات المستويات", hint: "متطلبات الترقية + التنزيل" },
      ]}
    />
  )
}
