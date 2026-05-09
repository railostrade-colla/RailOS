"use client"

/**
 * Fees hub — embeds every fee-related sub-panel as a top tab.
 * No more navigation: clicking a tab renders the corresponding panel
 * in-place, so the user stays inside `/admin?tab=fees`.
 *
 * ── Phase 12.5 cleanup (2026-05-09) ──────────────────────────────
 * The legacy duplicate "💎 وحدات الرسوم" tab (`FeeUnitsAdminPanel`)
 * was a hard-coded empty stub that shadowed the real DB-wired
 * "🎯 طلبات الوحدات" panel — admins clicked it, saw nothing, and
 * concluded that requests were lost. We removed the stub and put the
 * real DB-wired `FeeUnitsRequestsPanel` in its place under the same
 * primary label so the founder's mental model maps 1:1 to behaviour.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { FeeUnitsRequestsPanel } from "./FeeUnitsRequestsPanel"
import { DealFeesAdminPanel } from "./DealFeesAdmin"
import { PaymentProofsPanel } from "./PaymentProofsPanel"
import { InvoicesAdminPanel } from "./InvoicesAdminPanel"

/**
 * Fees hub — Phase 10.79 (Task 12) + 12.5 cleanup.
 *
 * "إعدادات الرسوم" (FeeConfigAdvancedPanel) lives in `tab=system →
 * إعدادات الرسوم`, not here, to avoid config drift. The hub focuses
 * on day-to-day operational tabs, all DB-wired:
 *
 *   1. وحدات الرسوم   → FeeUnitsRequestsPanel  (real charge requests)
 *   2. رسوم الصفقات   → DealFeesAdminPanel     (commissions ledger)
 *   3. إثباتات الدفع → PaymentProofsPanel      (read-only audit)
 *   4. الفواتير      → InvoicesAdminPanel      (issued invoices)
 */
export function FeesPanel() {
  return (
    <EmbeddedTabsHub
      title="💰 الرسوم"
      subtitle="وحدات الرسوم + رسوم الصفقات + إثباتات الدفع + الفواتير"
      tabs={[
        {
          key: "units",
          label: "💎 وحدات الرسوم",
          hint: "مراجعة طلبات شحن الوحدات + موافقة/رفض",
          Panel: FeeUnitsRequestsPanel,
        },
        {
          key: "deal_fees",
          label: "📊 رسوم الصفقات",
          hint: "عمولة 2% المحصّلة من كل صفقة (طرفَين)",
          Panel: DealFeesAdminPanel,
        },
        {
          key: "proofs",
          label: "🧾 إثباتات الدفع",
          hint: "سجل إثباتات الدفع (للمراجعة فقط — التسوية تتمّ في النزاعات)",
          Panel: PaymentProofsPanel,
        },
        {
          key: "invoices",
          label: "📄 الفواتير",
          hint: "متابعة الفواتير المُصدَرة من الصفقات المكتملة",
          Panel: InvoicesAdminPanel,
        },
      ]}
    />
  )
}
