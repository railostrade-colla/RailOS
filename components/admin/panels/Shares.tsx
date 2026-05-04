"use client"

/**
 * Shares hub — embeds every share-management sub-panel as a top tab.
 */

import { EmbeddedTabsHub } from "./EmbeddedTabsHub"
import { ShareModificationPanel } from "./ShareModificationPanel"
import { ProjectWalletsPanel } from "./ProjectWalletsPanel"
import { ProjectsPanel } from "./Projects"
import { AuctionsAdminPanel } from "./AuctionsAdminPanel"

export function SharesPanel() {
  return (
    <EmbeddedTabsHub
      title="◎ الحصص والتداول"
      subtitle="كل ما يخصّ إدارة الحصص — تعديل، محافظ، مشاريع، مزادات"
      tabs={[
        { key: "modification", label: "🔐 تعديل الحصص", hint: "إصدار + إلغاء بمصادقة مزدوجة", Panel: ShareModificationPanel },
        { key: "wallets", label: "🏦 محافظ المشاريع", hint: "العرض + الاحتياطي + إطلاق للسوق", Panel: ProjectWalletsPanel },
        { key: "projects", label: "▣ المشاريع", hint: "تفاصيل المشروع + إجمالي الحصص", Panel: ProjectsPanel },
        { key: "auctions", label: "🔨 المزادات", hint: "إدارة مزادات الحصص", Panel: AuctionsAdminPanel },
      ]}
    />
  )
}
