"use client"

/**
 * Social Programs hub — Phase 13.2.
 *
 * Merges 4 previously separate sidebar entries (healthcare / orphans /
 * discounts / gifts) into a single "البرامج الاجتماعية" hub. The
 * sidebar gets shorter, the admin's mental model gets simpler — every
 * benefit-related panel lives here behind one entry point.
 *
 * Each tab is the same DB-wired panel that used to live as its own
 * top-level admin page; nothing is hidden, just reorganised.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { HealthcareAdminPanel } from "./HealthcareAdminPanel"
import { OrphansAdminPanel } from "./OrphansAdminPanel"
import { DiscountsAdminPanel } from "./DiscountsAdminPanel"
import { GiftsAdminPanel } from "./GiftsAdminPanel"

export function SocialProgramsPanel() {
  return (
    <EmbeddedTabsHub
      title="🤝 البرامج الاجتماعية"
      subtitle="الرعاية الصحية + الأيتام + الخصومات + الهدايا — كل برامج الدعم الاجتماعي"
      tabs={[
        {
          key: "healthcare",
          label: "🏥 الرعاية الصحية",
          hint: "طلبات التغطية الصحية + الموافقة + المتابعة",
          Panel: HealthcareAdminPanel,
        },
        {
          key: "orphans",
          label: "👶 رعاية الأيتام",
          hint: "كفالة الأيتام + التحويلات الشهرية",
          Panel: OrphansAdminPanel,
        },
        {
          key: "discounts",
          label: "🏷️ الخصومات",
          hint: "إنشاء + إدارة عروض الخصم",
          Panel: DiscountsAdminPanel,
        },
        {
          key: "gifts",
          label: "🎁 الهدايا",
          hint: "منح هدايا للمستخدمين + متابعة الاستلام",
          Panel: GiftsAdminPanel,
        },
      ]}
    />
  )
}
