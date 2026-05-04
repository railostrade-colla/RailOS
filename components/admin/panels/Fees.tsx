"use client"

/**
 * Legacy "Fees" panel — superseded by FeeConfigAdvancedPanel +
 * FeeUnitsAdminPanel + DealFeesAdminPanel + RequestsHubPanel.
 */

import { LegacyForwarder } from "./LegacyForwarder"

export function FeesPanel() {
  return (
    <LegacyForwarder
      title="💰 الرسوم"
      body="نظام الرسوم انقسم إلى لوحات مخصصة لكل نوع:"
      targets={[
        { tab: "fee_config_advanced", icon: "⚙️", label: "إعدادات الرسوم المتقدمة", hint: "النسب + الحدود + الإعفاءات" },
        { tab: "fee_units_admin", icon: "💎", label: "وحدات الرسوم", hint: "تعريف + تسعير الوحدات" },
        { tab: "fee_units_requests", icon: "🎯", label: "طلبات الوحدات", hint: "موافقة على شراء الوحدات" },
        { tab: "deal_fees_admin", icon: "📊", label: "رسوم الصفقات", hint: "إعدادات رسوم البيع/الشراء" },
        { tab: "payment_proofs", icon: "🧾", label: "إثباتات الدفع", hint: "مراجعة إثباتات تحويل" },
        { tab: "invoices_admin", icon: "📄", label: "الفواتير", hint: "إصدار + متابعة الفواتير" },
      ]}
    />
  )
}
