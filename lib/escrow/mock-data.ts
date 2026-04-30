/**
 * Mock Escrow Deals + Locked Shares for development/demo.
 *
 * Five deals covering the main lifecycle states:
 *   - pending                 ← المشتري لم يؤكّد الدفع بعد
 *   - payment_confirmed       ← بانتظار البائع لتحرير الحصص
 *   - cancellation_requested  ← البائع طلب إلغاء
 *   - disputed                ← نزاع نشط
 *   - completed               ← اكتملت
 */

import type { EscrowDeal } from "./types"

export interface LockedShareEntry {
  user_id: string
  project_id: string
  deal_id: string
  amount: number
  locked_at: string
}

const now = Date.now()
const HOURS_24 = 24 * 3_600_000
const HOURS_48 = 48 * 3_600_000

const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString()

// ──────────────────────────────────────────────────────────────────────────
// Mock deals
// ──────────────────────────────────────────────────────────────────────────

export const MOCK_ESCROW_DEALS: EscrowDeal[] = [
  {
    id: "deal_001",
    listing_id: "l1",
    project_id: "1",
    project_name: "مزرعة الواحة",
    buyer_id: "me",
    buyer_name: "أنا",
    seller_id: "u1",
    seller_name: "علي حسن",
    shares_amount: 5,
    price_per_share: 98_500,
    total_amount: 492_500,
    status: "pending",
    shares_locked: true,
    locked_at: iso(-2 * 3_600_000),       // قبل ساعتين
    expires_at: iso(HOURS_24 - 2 * 3_600_000),
    buyer_confirmed_payment: false,
    seller_released_shares: false,
    created_at: iso(-2 * 3_600_000),
  },
  {
    id: "deal_002",
    listing_id: "l3",
    project_id: "2",
    project_name: "برج بغداد",
    buyer_id: "me",
    buyer_name: "أنا",
    seller_id: "u3",
    seller_name: "سارة محمود",
    shares_amount: 3,
    price_per_share: 245_000,
    total_amount: 735_000,
    status: "payment_confirmed",
    shares_locked: true,
    locked_at: iso(-6 * 3_600_000),
    expires_at: iso(HOURS_48 - 6 * 3_600_000),
    buyer_confirmed_payment: true,
    buyer_confirmed_at: iso(-1 * 3_600_000),
    seller_released_shares: false,
    created_at: iso(-6 * 3_600_000),
  },
  {
    id: "deal_003",
    listing_id: "l4",
    project_id: "3",
    project_name: "مجمع الكرخ",
    buyer_id: "me",
    buyer_name: "أنا",
    seller_id: "u4",
    seller_name: "نور الدين",
    shares_amount: 10,
    price_per_share: 173_000,
    total_amount: 1_730_000,
    status: "cancellation_requested",
    shares_locked: true,
    locked_at: iso(-4 * 3_600_000),
    expires_at: iso(HOURS_24 - 4 * 3_600_000),
    buyer_confirmed_payment: false,
    seller_released_shares: false,
    cancellation_requested_by: "seller",
    cancellation_reason: "تغيّرت ظروفي الشخصية، أعتذر",
    cancellation_requested_at: iso(-30 * 60_000),
    created_at: iso(-4 * 3_600_000),
  },
  {
    id: "deal_004",
    listing_id: "l2",
    project_id: "1",
    project_name: "مزرعة الواحة",
    buyer_id: "u5",
    buyer_name: "زين العبيدي",
    seller_id: "me",
    seller_name: "أنا",
    shares_amount: 8,
    price_per_share: 99_000,
    total_amount: 792_000,
    status: "disputed",
    shares_locked: true,
    locked_at: iso(-12 * 3_600_000),
    expires_at: iso(HOURS_48 - 12 * 3_600_000),
    buyer_confirmed_payment: true,
    buyer_confirmed_at: iso(-10 * 3_600_000),
    seller_released_shares: false,
    dispute_id: "DSP-005",
    notes: "المشتري يدّعي الدفع، البائع لم يستلم",
    created_at: iso(-12 * 3_600_000),
  },
  {
    id: "deal_005",
    listing_id: "l-old-1",
    project_id: "2",
    project_name: "برج بغداد",
    buyer_id: "me",
    buyer_name: "أنا",
    seller_id: "u6",
    seller_name: "ياسمين كريم",
    shares_amount: 4,
    price_per_share: 252_000,
    total_amount: 1_008_000,
    status: "completed",
    shares_locked: false,
    locked_at: iso(-3 * 86_400_000),
    expires_at: iso(-2 * 86_400_000),
    buyer_confirmed_payment: true,
    buyer_confirmed_at: iso(-3 * 86_400_000 + 30 * 60_000),
    seller_released_shares: true,
    seller_released_at: iso(-3 * 86_400_000 + 60 * 60_000),
    completed_at: iso(-3 * 86_400_000 + 60 * 60_000),
    created_at: iso(-3 * 86_400_000),
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Mock locked shares — اشتقاق من الصفقات الـ active
// ──────────────────────────────────────────────────────────────────────────

export const MOCK_LOCKED_SHARES: LockedShareEntry[] = MOCK_ESCROW_DEALS
  .filter((d) => d.shares_locked)
  .map((d) => ({
    user_id: d.seller_id,
    project_id: d.project_id,
    deal_id: d.id,
    amount: d.shares_amount,
    locked_at: d.locked_at,
  }))
