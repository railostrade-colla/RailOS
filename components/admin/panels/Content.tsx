"use client"

/**
 * Content hub — embeds every content-management sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { LegalPagesEditorPanel } from "./LegalPagesEditorPanel"
import { NotificationsBroadcasterPanel } from "./NotificationsBroadcasterPanel"
import { SupportInboxPanel } from "./SupportInboxPanel"
import { DiscountsAdminPanel } from "./DiscountsAdminPanel"

export function ContentPanel() {
  return (
    <EmbeddedTabsHub
      title="📝 المحتوى"
      subtitle="إدارة المحتوى المرئي للتطبيق — الصفحات، الإشعارات، الدعم، العروض"
      tabs={[
        { key: "legal", label: "📜 الصفحات القانونية", hint: "الشروط + الخصوصية + الأسئلة الشائعة", Panel: LegalPagesEditorPanel },
        { key: "broadcast", label: "📢 إذاعة الإشعارات", hint: "إرسال إشعار لشريحة من المستخدمين", Panel: NotificationsBroadcasterPanel },
        { key: "support", label: "💬 صندوق الدعم", hint: "ردّ على تذاكر الدعم", Panel: SupportInboxPanel },
        { key: "discounts", label: "🎁 الخصومات", hint: "إنشاء + إدارة عروض الخصم", Panel: DiscountsAdminPanel },
      ]}
    />
  )
}
