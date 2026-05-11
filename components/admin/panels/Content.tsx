"use client"

/**
 * Content hub — embeds every content-management sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { NewsAdminPanel } from "./NewsAdminPanel"
import { NotificationsBroadcasterPanel } from "./NotificationsBroadcasterPanel"
import { SupportInboxPanel } from "./SupportInboxPanel"
import { DiscountsAdminPanel } from "./DiscountsAdminPanel"

export function ContentPanel() {
  return (
    <EmbeddedTabsHub
      title="📝 المحتوى"
      subtitle="إدارة المحتوى المرئي للتطبيق — الأخبار، الإشعارات، الدعم، العروض"
      tabs={[
        // Phase 13.63 — replaced legacy "الصفحات القانونيّة" with
        // "الأخبار" per founder spec; news lights up the dashboard
        // + market-page news section + /news/[id] detail page.
        { key: "news", label: "📰 الأخبار", hint: "نشر أخبار تظهر في الرئيسيّة + صفحة السوق", Panel: NewsAdminPanel },
        { key: "broadcast", label: "📢 إذاعة الإشعارات", hint: "إرسال إشعار لشريحة من المستخدمين", Panel: NotificationsBroadcasterPanel },
        { key: "support", label: "💬 صندوق الدعم", hint: "ردّ على تذاكر الدعم", Panel: SupportInboxPanel },
        { key: "discounts", label: "🎁 الخصومات", hint: "إنشاء + إدارة عروض الخصم", Panel: DiscountsAdminPanel },
      ]}
    />
  )
}
