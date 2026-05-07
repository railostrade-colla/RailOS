"use client"

/**
 * Shares & Trading hub — Phase 10.59 restructure.
 *
 * Tabs:
 *   • Share Requests (queue of share-modification requests, admins
 *     can review + open the modification page)
 *   • Shares Market (all projects' shares stats: offered, sold,
 *     investors, value, activity ranking)
 *   • Deals (every transaction on the platform with invoice button)
 *   • Payment Proofs (direct-buy from admin payment confirmations)
 *
 * Removed (per user request): Projects tab, Auctions tab, Project
 * Wallets tab. Project Wallets moved to Projects section.
 */

// Phase 11.01 — "🔐 تعديل الحصص" tab removed entirely (founder request).
// The two-factor share-modification flow + ShareModificationPanel +
// share-modifications.ts data layer were all deleted. To increase shares
// for an existing project, super_admin uses "إضافة حصص للطرح" inside the
// Project Wallets panel (Phase 10.92).
import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { ShareRequestsPanel } from "./ShareRequestsPanel"
import { SharesMarketPanel } from "./SharesMarketPanel"
import { DealsAdminPanel } from "./DealsAdminPanel"
import { PaymentProofsPanel } from "./PaymentProofsPanel"

export function SharesPanel() {
  return (
    <EmbeddedTabsHub
      title="◎ الحصص والتداول"
      subtitle="استقبال طلبات الحصص + متابعة السوق والصفقات + إثباتات الدفع"
      tabs={[
        { key: "requests", label: "📥 طلبات الحصص", hint: "استقبال طلبات شراء الحصص + إثباتات الدفع", Panel: ShareRequestsPanel },
        { key: "shares", label: "📊 الحصص في السوق", hint: "العرض + المباع + النشاط", Panel: SharesMarketPanel },
        { key: "deals", label: "📋 الصفقات", hint: "كل صفقات التداول مع الفواتير", Panel: DealsAdminPanel },
        { key: "proofs", label: "🧾 إثباتات الدفع", hint: "تأكيدات دفع الشراء المباشر", Panel: PaymentProofsPanel },
      ]}
    />
  )
}
