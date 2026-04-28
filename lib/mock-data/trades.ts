/**
 * Trades, direct buys, recent project trades, wallet log, fee requests/ledger.
 *
 * Aliases:
 * - /orders            → mockTrades, mockDirectBuys
 * - /profile           → mockRecentTrades
 * - /project/[id]      → projectRecentTrades
 * - /portfolio         → mockWalletLog, mockFeeRequests, mockFeeLedger
 */

import type {
  DirectBuy,
  FeeLedgerEntry,
  FeeRequest,
  Trade,
  WalletLogEntry,
} from "./types"

// ──────────────────────────────────────────────────────────────────────────
// /orders — confirmed/in_progress/cancelled trades
// ──────────────────────────────────────────────────────────────────────────
export const mockTrades: Trade[] = [
  { id: "t1", project: { name: "مزرعة الواحة" }, shares: 50, price: 95000, status: "confirmed", created_at: "2026-04-25", buyer_id: "me", seller_id: "user1", seller: { name: "علي حسن" }, buyer: { name: "أنا" } },
  { id: "t2", project: { name: "برج بغداد" }, shares: 20, price: 245000, status: "in_progress", created_at: "2026-04-24", buyer_id: "user2", seller_id: "me", seller: { name: "أنا" }, buyer: { name: "محمد أحمد" } },
  { id: "t3", project: { name: "مجمع الكرخ" }, shares: 30, price: 170000, status: "cancelled", created_at: "2026-04-20", buyer_id: "me", seller_id: "user3", seller: { name: "سارة محمود" }, buyer: { name: "أنا" } },
]

export const mockDirectBuys: DirectBuy[] = [
  { id: "d1", project_id: "1", project_name: "مزرعة الواحة", shares: 100, price_per_share: 95000, status: "approved", created_at: "2026-04-25", payment_due_at: "2026-04-27 18:00" },
  { id: "d2", project_id: "2", project_name: "برج بغداد", shares: 50, price_per_share: 240000, status: "pending", created_at: "2026-04-24" },
  { id: "d3", project_id: "3", project_name: "مجمع الكرخ", shares: 25, price_per_share: 170000, status: "postponed", created_at: "2026-04-20", admin_note: "بانتظار توفر سيولة" },
]

// ──────────────────────────────────────────────────────────────────────────
// /profile — recent (status-only) trades
// ──────────────────────────────────────────────────────────────────────────
export const mockRecentTrades: Array<{
  id: string
  project: { name: string }
  status: string
  created_at: string
}> = [
  { id: "1", project: { name: "مزرعة الواحة" }, status: "confirmed", created_at: "2026-04-25" },
  { id: "2", project: { name: "برج بغداد" }, status: "in_progress", created_at: "2026-04-23" },
  { id: "3", project: { name: "مجمع الكرخ" }, status: "confirmed", created_at: "2026-04-20" },
]

// ──────────────────────────────────────────────────────────────────────────
// /project/[id] — recent trades for chart sidebar
// ──────────────────────────────────────────────────────────────────────────
export const projectRecentTrades: Array<{ price: number; shares: number; created_at: string }> = [
  { price: 99000, shares: 50, created_at: "2026-04-25" },
  { price: 100500, shares: 30, created_at: "2026-04-24" },
  { price: 98500, shares: 75, created_at: "2026-04-23" },
  { price: 99500, shares: 25, created_at: "2026-04-22" },
  { price: 101000, shares: 100, created_at: "2026-04-20" },
]

// ──────────────────────────────────────────────────────────────────────────
// /portfolio — wallet log + fee requests + fee ledger
// ──────────────────────────────────────────────────────────────────────────
export const mockWalletLog: WalletLogEntry[] = [
  { id: "1", op_type: "deal_buy", amount: 1_900_000, project_name: "مزرعة الواحة", created_at: "2026-04-25 14:30" },
  { id: "2", op_type: "deal_sell", amount: 1_240_000, project_name: "برج بغداد", created_at: "2026-04-24 10:15" },
  { id: "3", op_type: "shares_sent", amount: 5, project_name: "مجمع الكرخ", created_at: "2026-04-22 16:00" },
  { id: "4", op_type: "shares_received", amount: 10, project_name: "مزرعة الواحة", created_at: "2026-04-20 09:30" },
]

export const mockFeeRequests: FeeRequest[] = [
  { id: "1", amount_requested: 50000, status: "pending", created_at: "2026-04-25" },
  { id: "2", amount_requested: 100000, status: "approved", created_at: "2026-04-20" },
  { id: "3", amount_requested: 25000, status: "rejected", created_at: "2026-04-15" },
]

export const mockFeeLedger: FeeLedgerEntry[] = [
  { id: "1", type: "addition", amount: 100000, reason: "admin_topup", created_at: "2026-04-20" },
  { id: "2", type: "subtraction", amount: 1500, reason: "listing_fee", created_at: "2026-04-22" },
  { id: "3", type: "subtraction", amount: 2500, reason: "auction_fee", created_at: "2026-04-23" },
  { id: "4", type: "subtraction", amount: 5000, reason: "quick_sell_fee", created_at: "2026-04-24" },
]

// ──────────────────────────────────────────────────────────────────────────
// Profit distributions (used by /investment "تاريخ التوزيعات")
// ──────────────────────────────────────────────────────────────────────────
export type DistributionType = "ربح ربعي" | "ربح سنوي" | "توزيع نهائي"

export interface Distribution {
  id: string
  date: string
  project_name: string
  sector: string
  amount: number
  type: DistributionType
}

export const DISTRIBUTIONS: Distribution[] = [
  {
    id: "d1",
    date: "2026-04-15",
    project_name: "مزرعة الواحة",
    sector: "زراعة",
    amount: 450000,
    type: "ربح ربعي",
  },
  {
    id: "d2",
    date: "2026-03-20",
    project_name: "برج بغداد",
    sector: "عقارات",
    amount: 850000,
    type: "ربح ربعي",
  },
  {
    id: "d3",
    date: "2026-02-10",
    project_name: "نخيل العراق",
    sector: "زراعة",
    amount: 320000,
    type: "ربح ربعي",
  },
  {
    id: "d4",
    date: "2026-01-05",
    project_name: "مزرعة الواحة",
    sector: "زراعة",
    amount: 380000,
    type: "ربح ربعي",
  },
  {
    id: "d5",
    date: "2025-12-15",
    project_name: "برج بغداد",
    sector: "عقارات",
    amount: 720000,
    type: "ربح ربعي",
  },
]

export function getDistributionsByUser(_userId: string = "me"): Distribution[] {
  return DISTRIBUTIONS
}

export function getTotalDistributions(_userId: string = "me"): number {
  return DISTRIBUTIONS.reduce((sum, d) => sum + d.amount, 0)
}
