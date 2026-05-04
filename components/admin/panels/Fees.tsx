"use client"

/**
 * Fees hub — embeds every fee-related sub-panel as a top tab.
 * No more navigation: clicking a tab renders the corresponding panel
 * in-place, so the user stays inside `/admin?tab=fees`.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { FeeConfigAdvancedPanel } from "./FeeConfig"
import { FeeUnitsAdminPanel } from "./FeeUnitsAdmin"
import { FeeUnitsRequestsPanel } from "./FeeUnitsRequestsPanel"
import { DealFeesAdminPanel } from "./DealFeesAdmin"
import { PaymentProofsPanel } from "./PaymentProofsPanel"
import { InvoicesAdminPanel } from "./InvoicesAdminPanel"

export function FeesPanel() {
  return (
    <EmbeddedTabsHub
      title="💰 الرسوم"
      subtitle="نظام الرسوم — كل الإعدادات والطلبات والإثباتات في مكان واحد"
      tabs={[
        { key: "config", label: "⚙️ إعدادات الرسوم", hint: "النسب + الحدود + الإعفاءات", Panel: FeeConfigAdvancedPanel },
        { key: "units", label: "💎 وحدات الرسوم", hint: "تعريف + تسعير الوحدات", Panel: FeeUnitsAdminPanel },
        { key: "requests", label: "🎯 طلبات الوحدات", hint: "موافقة على شراء الوحدات", Panel: FeeUnitsRequestsPanel },
        { key: "deal_fees", label: "📊 رسوم الصفقات", hint: "إعدادات رسوم البيع/الشراء", Panel: DealFeesAdminPanel },
        { key: "proofs", label: "🧾 إثباتات الدفع", hint: "مراجعة إثباتات تحويل", Panel: PaymentProofsPanel },
        { key: "invoices", label: "📄 الفواتير", hint: "إصدار + متابعة الفواتير", Panel: InvoicesAdminPanel },
      ]}
    />
  )
}
