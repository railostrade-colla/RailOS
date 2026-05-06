"use client"

/**
 * Fees hub — embeds every fee-related sub-panel as a top tab.
 * No more navigation: clicking a tab renders the corresponding panel
 * in-place, so the user stays inside `/admin?tab=fees`.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { FeeUnitsAdminPanel } from "./FeeUnitsAdmin"
import { FeeUnitsRequestsPanel } from "./FeeUnitsRequestsPanel"
import { DealFeesAdminPanel } from "./DealFeesAdmin"
import { PaymentProofsPanel } from "./PaymentProofsPanel"
import { InvoicesAdminPanel } from "./InvoicesAdminPanel"

/**
 * Fees hub — Phase 10.79 (Task 12).
 *
 * "إعدادات الرسوم" (FeeConfigAdvancedPanel) was REMOVED from this hub
 * per the founder's spec: it lives in /admin?tab=system → "إعدادات
 * الرسوم" tab. Keeping it in two places caused config drift, so the
 * Fees hub now focuses on day-to-day operational tabs only.
 */
export function FeesPanel() {
  return (
    <EmbeddedTabsHub
      title="💰 الرسوم"
      subtitle="وحدات الرسوم + طلبات الشحن + رسوم الصفقات + إثباتات الدفع + الفواتير"
      tabs={[
        { key: "units", label: "💎 وحدات الرسوم", hint: "تعريف + تسعير الوحدات", Panel: FeeUnitsAdminPanel },
        { key: "requests", label: "🎯 طلبات الوحدات", hint: "موافقة على شراء الوحدات", Panel: FeeUnitsRequestsPanel },
        { key: "deal_fees", label: "📊 رسوم الصفقات", hint: "حساب رسوم البيع/الشراء", Panel: DealFeesAdminPanel },
        { key: "proofs", label: "🧾 إثباتات الدفع", hint: "مراجعة إثباتات تحويل", Panel: PaymentProofsPanel },
        { key: "invoices", label: "📄 الفواتير", hint: "إصدار + متابعة الفواتير", Panel: InvoicesAdminPanel },
      ]}
    />
  )
}
