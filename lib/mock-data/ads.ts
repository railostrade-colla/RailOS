/**
 * /dashboard — ad banner slider + market summary stats.
 */

import type { Ad } from "./types"

export const mockAds: Ad[] = [
  {
    id: "1",
    title: "مزاد جديد - خصم 40٪ على الحصص",
    description: "ينتهي خلال 24 ساعة",
    icon: "🎯",
    action_label: "عرض المزاد",
    link_type: "internal",
    link_url: "/auctions",
    type: "text",
  },
  {
    id: "2",
    title: "افتتاح مشروع الواحة الزراعي",
    subtitle: "FEATURED",
    description: "ابدأ الاستثمار من 100,000 د.ع",
    icon: "🌾",
    action_label: "تفاصيل",
    link_type: "internal",
    link_url: "/market",
    type: "image",
  },
  {
    id: "3",
    title: "اشترك في Quick Sell",
    subtitle: "PREMIUM",
    description: "احصل على عروض حصرية بخصم 15٪ + أولوية في التنفيذ",
    icon: "⚡",
    action_label: "اشترك",
    link_type: "internal",
    link_url: "/quick-sale",
    type: "promo",
  },
]

/** /dashboard market-summary stats. */
export const mockStats: { projects: number; shares: number; volume: number } = {
  projects: 27,
  shares: 1247,
  volume: 2_400_000_000,
}
