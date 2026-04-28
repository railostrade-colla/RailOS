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
  { id: "1", title: "صفقة جديدة", body: "أحمد محمد طلب شراء 50 سهم من مزرعة الواحة", read_status: false, created_at: "2026-04-25T14:25:00", link: "/deals" },
  { id: "2", title: "ارتفع سعر مشروع", body: "ارتفع سعر مزرعة الواحة بنسبة 2.3%", read_status: false, created_at: "2026-04-25T13:30:00", link: "/market" },
  { id: "3", title: "مزاد جديد", body: "بدأ مزاد على حصص برج بغداد - خصم 30%", read_status: false, created_at: "2026-04-25T12:00:00", link: "/auctions" },
  { id: "4", title: "رد فريق الدعم", body: "تم الرد على طلبك #1247 - يرجى المراجعة", read_status: true, created_at: "2026-04-24T18:45:00", link: "/support" },
  { id: "5", title: "طلب صديق جديد", body: "علي حسن يريد إضافتك كصديق", read_status: true, created_at: "2026-04-24T10:30:00", link: "/profile" },
  { id: "6", title: "صفقة مكتملة", body: "تمت صفقة بيع 30 سهم بقيمة 3,000,000 د.ع", read_status: true, created_at: "2026-04-22T16:00:00", link: "/deals" },
  { id: "7", title: "انخفض سعر مشروع", body: "انخفض سعر مجمع الكرخ بنسبة 1.5%", read_status: true, created_at: "2026-04-18T09:15:00", link: "/market" },
]
