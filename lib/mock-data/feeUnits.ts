/**
 * /portfolio?tab=fee_units — fee units balance + transaction history.
 */

export type FeeUnitTxType = "purchase" | "consumption" | "refund"

export interface FeeUnitTransaction {
  id: string
  type: FeeUnitTxType
  amount: number
  description: string
  related_to?: "exchange" | "contract" | "auction" | "quick_sell" | "admin"
  created_at: string
}

export const FEE_UNITS_BALANCE = 250
export const FEE_UNIT_PRICE_IQD = 1000

export const FEE_UNIT_TRANSACTIONS: FeeUnitTransaction[] = [
  {
    id: "fu-1",
    type: "purchase",
    amount: 100,
    description: "شراء وحدات رسوم",
    created_at: "2026-04-20",
  },
  {
    id: "fu-2",
    type: "consumption",
    amount: -5,
    description: "إنشاء إعلان بيع — مزرعة الواحة",
    related_to: "exchange",
    created_at: "2026-04-22",
  },
  {
    id: "fu-3",
    type: "consumption",
    amount: -10,
    description: "إنشاء عقد جماعي — مزرعة الواحة",
    related_to: "contract",
    created_at: "2026-04-23",
  },
  {
    id: "fu-4",
    type: "purchase",
    amount: 200,
    description: "شراء حزمة وحدات",
    created_at: "2026-04-15",
  },
  {
    id: "fu-5",
    type: "consumption",
    amount: -3,
    description: "إنشاء مزاد على حصص برج بغداد",
    related_to: "auction",
    created_at: "2026-04-18",
  },
  {
    id: "fu-6",
    type: "consumption",
    amount: -8,
    description: "بيع سريع — Quick Sell",
    related_to: "quick_sell",
    created_at: "2026-04-19",
  },
  {
    id: "fu-7",
    type: "refund",
    amount: 5,
    description: "استرداد إعلان ملغى",
    related_to: "exchange",
    created_at: "2026-04-21",
  },
  {
    id: "fu-8",
    type: "consumption",
    amount: -2,
    description: "تجديد إعلان بيع",
    related_to: "exchange",
    created_at: "2026-04-24",
  },
]

export function getFeeUnitsBalance(_userId: string = "me"): number {
  return FEE_UNITS_BALANCE
}

export function getFeeUnitTransactions(_userId: string = "me"): FeeUnitTransaction[] {
  return FEE_UNIT_TRANSACTIONS
}

export function getFeeUnitsStats(_userId: string = "me") {
  const purchased = FEE_UNIT_TRANSACTIONS.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0)
  const consumed = Math.abs(FEE_UNIT_TRANSACTIONS.filter((t) => t.type === "consumption").reduce((s, t) => s + t.amount, 0))
  const refunded = FEE_UNIT_TRANSACTIONS.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0)
  return { purchased, consumed, refunded }
}

// ──────────────────────────────────────────────────────────────────────────
// Admin-side fee unit recharge requests (review queue)
// ──────────────────────────────────────────────────────────────────────────
export type FeeRequestPaymentMethod = "bank_transfer" | "zain_cash" | "asia_hawala"
export type FeeRequestStatus = "pending" | "approved" | "rejected"
export type UserLevel = "basic" | "advanced" | "pro"

export interface FeeUnitRequest {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_level: UserLevel
  current_balance: number
  requested_units: number
  amount_paid: number
  payment_method: FeeRequestPaymentMethod
  reference_number: string
  proof_image_url: string
  status: FeeRequestStatus
  rejection_reason?: string
  approved_units?: number
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
}

const proofPlaceholder = (text: string) =>
  `https://placehold.co/600x800/0a0a0a/ffffff?text=${encodeURIComponent(text)}`

export const MOCK_FEE_REQUESTS: FeeUnitRequest[] = [
  {
    id: "fur-1",
    user_id: "u1",
    user_name: "أحمد محمد",
    user_email: "ahmed.m@example.com",
    user_level: "advanced",
    current_balance: 35,
    requested_units: 50,
    amount_paid: 50_000,
    payment_method: "zain_cash",
    reference_number: "ZC2026042512345",
    proof_image_url: proofPlaceholder("ZAIN-50K"),
    status: "pending",
    submitted_at: "2026-04-25 09:00",
  },
  {
    id: "fur-2",
    user_id: "u2",
    user_name: "علي حسن",
    user_email: "ali.h@example.com",
    user_level: "pro",
    current_balance: 200,
    requested_units: 100,
    amount_paid: 100_000,
    payment_method: "bank_transfer",
    reference_number: "BNK20260420776",
    proof_image_url: proofPlaceholder("BANK-100K"),
    status: "approved",
    approved_units: 100,
    submitted_at: "2026-04-20 11:00",
    reviewed_at: "2026-04-20 11:30",
    reviewed_by: "Admin@1",
  },
  {
    id: "fur-3",
    user_id: "u3",
    user_name: "محمد أحمد",
    user_email: "mohammed.a@example.com",
    user_level: "advanced",
    current_balance: 0,
    requested_units: 25,
    amount_paid: 25_000,
    payment_method: "asia_hawala",
    reference_number: "AH123",
    proof_image_url: proofPlaceholder("ASIA-BLURRY"),
    status: "rejected",
    rejection_reason: "إيصال غير واضح — لا يمكن قراءة رقم المرجع",
    submitted_at: "2026-04-15 10:00",
    reviewed_at: "2026-04-15 11:30",
    reviewed_by: "Admin@Main",
  },
  {
    id: "fur-4",
    user_id: "u4",
    user_name: "سارة محمود",
    user_email: "sara.m@example.com",
    user_level: "basic",
    current_balance: 10,
    requested_units: 75,
    amount_paid: 75_000,
    payment_method: "zain_cash",
    reference_number: "ZC2026042598765",
    proof_image_url: proofPlaceholder("ZAIN-75K"),
    status: "pending",
    submitted_at: "2026-04-25 11:30",
  },
  {
    id: "fur-5",
    user_id: "u5",
    user_name: "نور الدين",
    user_email: "noureldin@example.com",
    user_level: "pro",
    current_balance: 150,
    requested_units: 200,
    amount_paid: 200_000,
    payment_method: "bank_transfer",
    reference_number: "BNK20260422554",
    proof_image_url: proofPlaceholder("BANK-200K"),
    status: "approved",
    approved_units: 200,
    submitted_at: "2026-04-22 14:00",
    reviewed_at: "2026-04-22 14:45",
    reviewed_by: "Admin@1",
  },
  {
    id: "fur-6",
    user_id: "u6",
    user_name: "زين العبيدي",
    user_email: "zain.o@example.com",
    user_level: "advanced",
    current_balance: 60,
    requested_units: 50,
    amount_paid: 60_000,
    payment_method: "zain_cash",
    reference_number: "ZC20260425LATE",
    proof_image_url: proofPlaceholder("ZAIN-OVERPAY"),
    status: "pending",
    submitted_at: "2026-04-25 13:50",
  },
  {
    id: "fur-7",
    user_id: "u7",
    user_name: "ياسمين كريم",
    user_email: "yasmin.k@example.com",
    user_level: "basic",
    current_balance: 0,
    requested_units: 30,
    amount_paid: 30_000,
    payment_method: "asia_hawala",
    reference_number: "AH20260424888",
    proof_image_url: proofPlaceholder("ASIA-30K"),
    status: "approved",
    approved_units: 30,
    submitted_at: "2026-04-24 09:30",
    reviewed_at: "2026-04-24 10:15",
    reviewed_by: "Admin@2",
  },
]

export const FEE_REQUEST_PAYMENT_LABELS: Record<FeeRequestPaymentMethod, { label: string; icon: string }> = {
  bank_transfer: { label: "حوالة بنكية", icon: "🏦" },
  zain_cash: { label: "زين كاش", icon: "📱" },
  asia_hawala: { label: "آسيا حوالة", icon: "💸" },
}

export const FEE_REQUEST_STATUS_LABELS: Record<FeeRequestStatus, { label: string; color: "yellow" | "green" | "red" }> = {
  pending: { label: "معلّق", color: "yellow" },
  approved: { label: "مُوافَق", color: "green" },
  rejected: { label: "مرفوض", color: "red" },
}

export const USER_LEVEL_LABELS: Record<UserLevel, { label: string; icon: string }> = {
  basic: { label: "مبتدئ", icon: "🌱" },
  advanced: { label: "متقدّم", icon: "⭐" },
  pro: { label: "محترف", icon: "👑" },
}

export function getFeeRequestsStats() {
  const all = MOCK_FEE_REQUESTS
  const today = "2026-04-25"
  return {
    pending_amount: all.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount_paid, 0),
    pending_count: all.filter((r) => r.status === "pending").length,
    approved_today: all.filter((r) => r.status === "approved" && r.reviewed_at?.startsWith(today)).length,
    total_inflow: all.filter((r) => r.status === "approved").reduce((s, r) => s + (r.approved_units ?? r.requested_units), 0),
  }
}
