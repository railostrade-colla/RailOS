/**
 * Escrow System — Types
 *
 * نظام تعليق الحصص (Escrow) لحماية الطرفين في الصفقات.
 * المنصة لا تتعامل بالأموال — فقط تدير الحصص.
 *
 * دورة حياة الصفقة:
 *   1. pending             ← فُتحت، الحصص مُعلَّقة، تنتظر تأكيد الدفع من المشتري
 *   2. payment_confirmed   ← المشتري أكّد الدفع، تنتظر البائع لتحرير الحصص
 *   3. completed           ← الحصص حُرِّرت → محفظة المشتري + إغلاق الإعلان
 *   3'.cancellation_requested ← البائع طلب إلغاء، المشتري لديه 24 ساعة للرد
 *   3''.disputed           ← نزاع — الحصص تبقى مُعلَّقة لحين حسم الإدارة
 *   3'''.cancelled_mutual  ← إلغاء بالتراضي → الحصص ترجع للبائع
 *   3''''.cancelled_expired← انتهى وقت الصفقة → الحصص ترجع للبائع
 */

export type EscrowDealStatus =
  | "pending"                  // فُتحت، تنتظر تأكيد الدفع
  | "payment_confirmed"        // المشتري أكّد الدفع
  | "completed"                // الحصص حُرِّرت
  | "cancellation_requested"   // البائع طلب إلغاء
  | "disputed"                 // نزاع
  | "cancelled_mutual"         // إلغاء بالتراضي
  | "cancelled_expired"        // انتهى الوقت

export type CancellationResponse = "accept" | "reject_and_paid" | "no_response"

export interface EscrowDeal {
  // المعرّفات
  id: string
  listing_id: string
  project_id: string
  project_name: string

  // الأطراف
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string

  // الكمية والسعر
  shares_amount: number
  price_per_share: number
  total_amount: number

  // حالة الـ Escrow
  status: EscrowDealStatus
  shares_locked: boolean
  locked_at: string
  expires_at: string  // 24/48/72 ساعة من locked_at

  // تأكيدات
  buyer_confirmed_payment: boolean
  buyer_confirmed_at?: string
  seller_released_shares: boolean
  seller_released_at?: string

  // الإلغاء
  cancellation_requested_by?: "buyer" | "seller"
  cancellation_reason?: string
  cancellation_requested_at?: string
  buyer_response_to_cancel?: CancellationResponse

  // النزاع
  dispute_id?: string

  // ملاحظات
  notes?: string

  // التوقيتات
  created_at: string
  completed_at?: string
  cancelled_at?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Result types for actions
// ──────────────────────────────────────────────────────────────────────────

export interface EscrowResult<T = unknown> {
  success: boolean
  reason?: string
  data?: T
}

export interface CanCreateDealResult {
  allowed: boolean
  reason?: string
  activeDeal?: EscrowDeal
  timeLeft?: number  // ms until expires_at
}

// ──────────────────────────────────────────────────────────────────────────
// Status meta — labels + colors for UI
// ──────────────────────────────────────────────────────────────────────────

export const STATUS_META: Record<
  EscrowDealStatus,
  { label: string; color: "yellow" | "blue" | "green" | "red" | "neutral" | "orange" }
> = {
  pending:                { label: "بانتظار الدفع",     color: "yellow"  },
  payment_confirmed:      { label: "تأكّد الدفع",        color: "blue"    },
  completed:              { label: "مكتملة",            color: "green"   },
  cancellation_requested: { label: "طلب إلغاء",          color: "orange"  },
  disputed:               { label: "نزاع",              color: "red"     },
  cancelled_mutual:       { label: "ملغاة بالتراضي",     color: "neutral" },
  cancelled_expired:      { label: "ملغاة (انتهى الوقت)", color: "neutral" },
}

// ──────────────────────────────────────────────────────────────────────────
// Notification types — escrow-related
// ──────────────────────────────────────────────────────────────────────────

export type EscrowNotificationType =
  | "deal_created"
  | "shares_locked"
  | "payment_confirmed"
  | "shares_released"
  | "deal_cancellation_requested"
  | "dispute_opened"
  | "deal_completed"
  | "deal_expired"

export const ESCROW_NOTIFICATION_LABELS: Record<EscrowNotificationType, { title: string; icon: string }> = {
  deal_created:                { title: "صفقة جديدة على إعلانك",     icon: "🤝" },
  shares_locked:               { title: "تم تعليق حصصك في صفقة",     icon: "🔒" },
  payment_confirmed:           { title: "المشتري أكّد الدفع",          icon: "💳" },
  shares_released:             { title: "تم تحرير الحصص لك",          icon: "✅" },
  deal_cancellation_requested: { title: "البائع طلب إلغاء الصفقة",    icon: "🚫" },
  dispute_opened:              { title: "تم فتح نزاع على صفقتك",      icon: "⚖️" },
  deal_completed:              { title: "اكتملت الصفقة بنجاح",         icon: "🎉" },
  deal_expired:                { title: "انتهى وقت الصفقة",           icon: "⏰" },
}
