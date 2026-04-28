/**
 * Payment proofs — uploaded receipts attached to deals, awaiting admin verification.
 * Used by /admin?tab=payment_proofs.
 */

export type PaymentProofStatus = "pending" | "confirmed" | "rejected" | "needs_resubmission"
export type MatchStatus = "match" | "mismatch" | "needs_review"
export type ProofPaymentMethod = "bank_transfer" | "zain_cash" | "asia_hawala" | "ki_card"

export interface PaymentProof {
  id: string
  deal_id: string
  user_id: string
  user_name: string
  payment_method: ProofPaymentMethod
  amount_required: number
  amount_paid: number
  reference_number: string
  proof_image_url: string
  status: PaymentProofStatus
  match_status: MatchStatus
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
  project_name: string
}

const placeholder = (text: string) =>
  `https://placehold.co/600x800/0a0a0a/ffffff?text=${encodeURIComponent(text)}`

export const MOCK_PAYMENT_PROOFS: PaymentProof[] = [
  {
    id: "pp-1",
    deal_id: "t1247",
    user_id: "u1",
    user_name: "أحمد محمد",
    payment_method: "zain_cash",
    amount_required: 4750000,
    amount_paid: 4750000,
    reference_number: "ZC2026042514301",
    proof_image_url: placeholder("ZAIN-CASH-RECEIPT-1"),
    status: "pending",
    match_status: "match",
    submitted_at: "2026-04-25 14:30",
    project_name: "مزرعة الواحة",
  },
  {
    id: "pp-2",
    deal_id: "t1198",
    user_id: "u3",
    user_name: "محمد أحمد",
    payment_method: "bank_transfer",
    amount_required: 4900000,
    amount_paid: 4500000,
    reference_number: "BNK20260425998",
    proof_image_url: placeholder("BANK-PROOF-2"),
    status: "pending",
    match_status: "mismatch",
    submitted_at: "2026-04-25 13:15",
    project_name: "برج بغداد",
  },
  {
    id: "pp-3",
    deal_id: "t1180",
    user_id: "u5",
    user_name: "زين العبيدي",
    payment_method: "ki_card",
    amount_required: 17000000,
    amount_paid: 17000000,
    reference_number: "KI20260425443",
    proof_image_url: placeholder("KI-CARD-3"),
    status: "confirmed",
    match_status: "match",
    submitted_at: "2026-04-24 10:00",
    reviewed_at: "2026-04-24 11:30",
    reviewed_by: "Admin@1",
    project_name: "مجمع الكرخ",
  },
  {
    id: "pp-4",
    deal_id: "t1150",
    user_id: "u7",
    user_name: "ياسمين كريم",
    payment_method: "asia_hawala",
    amount_required: 3450000,
    amount_paid: 3450000,
    reference_number: "AH20260423012",
    proof_image_url: placeholder("ASIA-HAWALA-4"),
    status: "pending",
    match_status: "needs_review",
    submitted_at: "2026-04-23 16:20",
    project_name: "صفا الذهبي",
  },
  {
    id: "pp-5",
    deal_id: "t1100",
    user_id: "u8",
    user_name: "كريم علي",
    payment_method: "zain_cash",
    amount_required: 1440000,
    amount_paid: 1440000,
    reference_number: "ZC20260420001",
    proof_image_url: placeholder("ZAIN-CASH-5"),
    status: "confirmed",
    match_status: "match",
    submitted_at: "2026-04-20 09:00",
    reviewed_at: "2026-04-20 10:15",
    reviewed_by: "Admin@Main",
    project_name: "مزرعة الواحة",
  },
  {
    id: "pp-6",
    deal_id: "t1095",
    user_id: "u9",
    user_name: "هدى صبري",
    payment_method: "bank_transfer",
    amount_required: 5000000,
    amount_paid: 5000000,
    reference_number: "BNK20260418776",
    proof_image_url: placeholder("BANK-BLURRY"),
    status: "rejected",
    match_status: "needs_review",
    rejection_reason: "صورة الإيصال غير واضحة، لا يمكن قراءة رقم المرجع",
    submitted_at: "2026-04-18 14:00",
    reviewed_at: "2026-04-18 15:30",
    reviewed_by: "Admin@2",
    project_name: "برج بغداد",
  },
  {
    id: "pp-7",
    deal_id: "t1080",
    user_id: "u10",
    user_name: "مصطفى الكاظمي",
    payment_method: "ki_card",
    amount_required: 2400000,
    amount_paid: 2400000,
    reference_number: "KI20260415221",
    proof_image_url: placeholder("KI-CARD-7"),
    status: "confirmed",
    match_status: "match",
    submitted_at: "2026-04-15 11:00",
    reviewed_at: "2026-04-15 12:00",
    reviewed_by: "Admin@1",
    project_name: "مجمع الكرخ",
  },
  {
    id: "pp-8",
    deal_id: "t1240",
    user_id: "u11",
    user_name: "ليلى ناصر",
    payment_method: "zain_cash",
    amount_required: 2850000,
    amount_paid: 2950000,
    reference_number: "ZC20260425777",
    proof_image_url: placeholder("ZAIN-CASH-EXTRA"),
    status: "pending",
    match_status: "mismatch",
    submitted_at: "2026-04-25 09:45",
    project_name: "صفا الذهبي",
  },
]

export const PAYMENT_METHOD_LABELS: Record<ProofPaymentMethod, { label: string; icon: string }> = {
  bank_transfer: { label: "حوالة بنكية", icon: "🏦" },
  zain_cash: { label: "زين كاش", icon: "📱" },
  asia_hawala: { label: "آسيا حوالة", icon: "💸" },
  ki_card: { label: "كي كارد", icon: "💳" },
}

export const PROOF_STATUS_LABELS: Record<PaymentProofStatus, { label: string; color: "yellow" | "green" | "red" | "orange" }> = {
  pending: { label: "معلّق", color: "yellow" },
  confirmed: { label: "مؤكّد", color: "green" },
  rejected: { label: "مرفوض", color: "red" },
  needs_resubmission: { label: "إعادة رفع", color: "orange" },
}

export const MATCH_STATUS_META: Record<MatchStatus, { label: string; color: "green" | "red" | "yellow" }> = {
  match: { label: "✓ مطابق", color: "green" },
  mismatch: { label: "✗ غير مطابق", color: "red" },
  needs_review: { label: "⚠️ مراجعة", color: "yellow" },
}

export function getPaymentProofsStats() {
  const all = MOCK_PAYMENT_PROOFS
  const today = "2026-04-25"
  return {
    pending: all.filter((p) => p.status === "pending").length,
    confirmed_today: all.filter((p) => p.status === "confirmed" && p.reviewed_at?.startsWith(today)).length,
    disputed: all.filter((p) => p.match_status === "mismatch" && p.status === "pending").length,
    total: all.length,
  }
}
