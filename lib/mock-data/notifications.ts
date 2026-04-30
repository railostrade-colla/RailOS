/**
 * /notifications — notification feed.
 * /dashboard — active alerts widget (helper at bottom).
 */

import type { AppNotification } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Active alerts surfaced on /dashboard (separate from the full feed)
// ──────────────────────────────────────────────────────────────────────────
export type ActiveAlertType = "kyc" | "deal_pending" | "ad_expiring" | "fee_low" | "level_up"
export type AlertPriority = "high" | "medium" | "low"

export interface ActiveAlert {
  id: string
  type: ActiveAlertType
  icon: string
  title: string
  desc: string
  cta: string
  href: string
  priority: AlertPriority
}

export function getActiveAlerts(_userId: string = "me"): ActiveAlert[] {
  return [
    {
      id: "alert-1",
      type: "kyc",
      icon: "📋",
      title: "إكمال التوثيق KYC",
      desc: "أكمل توثيق هويتك للوصول لكل الميزات",
      cta: "إكمال الآن",
      href: "/kyc",
      priority: "high",
    },
    {
      id: "alert-2",
      type: "deal_pending",
      icon: "🤝",
      title: "صفقة معلّقة",
      desc: "صفقة بانتظار موافقتك من مزرعة الواحة",
      cta: "مراجعة الصفقة",
      href: "/orders",
      priority: "medium",
    },
    {
      id: "alert-3",
      type: "ad_expiring",
      icon: "⏰",
      title: "إعلان ينتهي قريباً",
      desc: "إعلانك في برج بغداد ينتهي خلال 6 ساعات",
      cta: "تجديد",
      href: "/exchange",
      priority: "low",
    },
  ]
}

export const mockNotifications: AppNotification[] = [
  { id: "n1",  title: "🤝 صفقة جديدة على إعلانك",      body: "زين العبيدي طلب شراء 8 حصص من مزرعة الواحة",          read_status: false, created_at: "2026-04-30T10:25:00", link: "/deals/deal_004" },
  { id: "n2",  title: "🔒 تم تعليق حصصك",                body: "تم تعليق 5 حصص من برج بغداد لصفقة جديدة",            read_status: false, created_at: "2026-04-30T09:30:00", link: "/deals/deal_002" },
  { id: "n3",  title: "💳 المشتري أكّد الدفع",             body: "بانتظارك لتحرير 3 حصص من برج بغداد",                  read_status: false, created_at: "2026-04-30T08:00:00", link: "/deals/deal_002" },
  { id: "n4",  title: "🚫 البائع طلب إلغاء صفقة",          body: "نور الدين طلب إلغاء صفقة مجمع الكرخ — لديك 24 ساعة للرد",  read_status: false, created_at: "2026-04-30T07:30:00", link: "/deals/deal_003" },
  { id: "n5",  title: "⚖️ تم فتح نزاع على صفقتك",          body: "صفقة DSP-005 على مزرعة الواحة في انتظار قرار الإدارة",   read_status: false, created_at: "2026-04-29T20:00:00", link: "/deals/deal_004" },
  { id: "n6",  title: "🎉 اكتملت الصفقة بنجاح",            body: "تم تحويل 4 حصص من برج بغداد إلى محفظتك",                read_status: true,  created_at: "2026-04-27T16:00:00", link: "/deals/deal_005" },
  { id: "n7",  title: "ارتفع سعر مشروع",                body: "ارتفع سعر مزرعة الواحة بنسبة 2.3%",                       read_status: true,  created_at: "2026-04-25T13:30:00", link: "/market" },
  { id: "n8",  title: "مزاد جديد",                       body: "بدأ مزاد على حصص برج بغداد — خصم 30%",                  read_status: true,  created_at: "2026-04-25T12:00:00", link: "/auctions" },
  { id: "n9",  title: "رد فريق الدعم",                  body: "تم الرد على طلبك #1247 — يرجى المراجعة",                read_status: true,  created_at: "2026-04-24T18:45:00", link: "/support" },
  { id: "n10", title: "انخفض سعر مشروع",               body: "انخفض سعر مجمع الكرخ بنسبة 1.5%",                       read_status: true,  created_at: "2026-04-18T09:15:00", link: "/market" },
]
