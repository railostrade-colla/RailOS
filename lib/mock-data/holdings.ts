/**
 * Single source of truth for "what the user owns".
 *
 * Aliases:
 * - portfolio        → mockHoldings (portfolio shape — embeds total/available)
 * - quick-sell       → mockHoldingsQuickSell (4 holdings with `id` field)
 * - wallet/send      → MOCK_HOLDINGS_SEND (3 holdings, slim project shape)
 * - exchange/create  → MOCK_HOLDINGS_EXCHANGE (3 holdings, no top-level id)
 */

import type { Holding } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Master shape — used by portfolio (with project meta) and quick-sell (with id)
// `user_id`, `buy_price`, `current_value` are populated for portfolio summary
// helpers; pages that don't need them can ignore the extra fields.
// ──────────────────────────────────────────────────────────────────────────
export const HOLDINGS: Holding[] = [
  {
    id: "1",
    project_id: "1",
    project: {
      id: "1",
      name: "مزرعة الواحة",
      sector: "زراعة",
      share_price: 100000,
      total_shares: 10000,
      available_shares: 2500,
    },
    shares_owned: 50,
    user_id: "me",
    buy_price: 92_000,         // bought slightly under current → ~+8.7% gain
    current_value: 5_000_000,  // 50 × 100,000
  },
  {
    id: "2",
    project_id: "2",
    project: {
      id: "2",
      name: "برج بغداد",
      sector: "تجارة",
      share_price: 250000,
      total_shares: 8000,
      available_shares: 4400,
    },
    shares_owned: 20,
    user_id: "me",
    buy_price: 235_000,        // ~+6.4% gain
    current_value: 5_000_000,  // 20 × 250,000
  },
  {
    id: "3",
    project_id: "3",
    project: {
      id: "3",
      name: "مجمع الكرخ",
      sector: "عقارات",
      share_price: 175000,
      total_shares: 12000,
      available_shares: 4560,
    },
    shares_owned: 30,
    user_id: "me",
    buy_price: 180_000,        // ~-2.8% loss (mixed portfolio)
    current_value: 5_250_000,  // 30 × 175,000
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Portfolio summary helper (used by /dashboard)
// ──────────────────────────────────────────────────────────────────────────
export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalProfit: number
  profitPercent: number
  dailyChange: number
  dailyChangePercent: number
  holdingsCount: number
}

/**
 * Aggregate the user's open positions into one snapshot.
 * Daily change is a deterministic sin-wave around 0.5 % so the dashboard
 * shows a stable but realistic-looking number across reloads within a day.
 */
// ──────────────────────────────────────────────────────────────────────────
// Comprehensive investment analytics (used by /investment dashboard)
// ──────────────────────────────────────────────────────────────────────────

export interface PerformanceRow extends Holding {
  cost: number
  profit: number
  profitPercent: number
}

export interface SectorSlice {
  name: string
  value: number
  percent: number
}

export interface HistoricalPoint {
  month: string
  value: number
}

export interface InvestmentAnalytics {
  totalValue: number
  totalCost: number
  totalProfit: number
  totalProfitPercent: number
  holdingsCount: number
  sectorsCount: number
  avgReturnPerYear: number
  avgHoldingMonths: number
  performance: PerformanceRow[]
  bestPerformers: PerformanceRow[]
  worstPerformers: PerformanceRow[]
  sectorDistribution: SectorSlice[]
  historicalData: HistoricalPoint[]
}

export function getInvestmentAnalytics(userId: string = "me"): InvestmentAnalytics {
  const userHoldings = HOLDINGS.filter((h) => (h.user_id ?? "me") === userId)

  const totalValue = userHoldings.reduce((s, h) => s + (h.current_value ?? 0), 0)
  const totalCost = userHoldings.reduce((s, h) => s + h.shares_owned * (h.buy_price ?? 0), 0)
  const totalProfit = totalValue - totalCost
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  // Per-holding performance
  const performance: PerformanceRow[] = userHoldings.map((h) => {
    const cost = h.shares_owned * (h.buy_price ?? 0)
    const profit = (h.current_value ?? 0) - cost
    const profitPercent = cost > 0 ? (profit / cost) * 100 : 0
    return { ...h, cost, profit, profitPercent }
  })

  const bestPerformers = [...performance].sort((a, b) => b.profitPercent - a.profitPercent).slice(0, 3)
  const worstPerformers = [...performance].sort((a, b) => a.profitPercent - b.profitPercent).slice(0, 3)

  // Sector distribution
  const sectorMap: Record<string, number> = {}
  userHoldings.forEach((h) => {
    const sector = h.project?.sector ?? "أخرى"
    sectorMap[sector] = (sectorMap[sector] ?? 0) + (h.current_value ?? 0)
  })
  const sectorDistribution: SectorSlice[] = Object.entries(sectorMap).map(([name, value]) => ({
    name,
    value,
    percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }))

  // Mock historical data — 12 months trending upward with sin-wave noise
  const historicalData: HistoricalPoint[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    const baseValue = totalValue * 0.7
    const growth = (i / 11) * 0.4 * totalValue
    const noise = Math.sin(i * 0.8) * totalValue * 0.05
    return {
      month: d.toLocaleDateString("ar-IQ-u-nu-latn", { month: "short" }),
      value: Math.round(baseValue + growth + noise),
    }
  })

  return {
    totalValue,
    totalCost,
    totalProfit,
    totalProfitPercent: parseFloat(totalProfitPercent.toFixed(2)),
    holdingsCount: userHoldings.length,
    sectorsCount: Object.keys(sectorMap).length,
    avgReturnPerYear: 14.2,
    avgHoldingMonths: 8,
    performance,
    bestPerformers,
    worstPerformers,
    sectorDistribution,
    historicalData,
  }
}

export function getPortfolioSummary(userId: string = "me"): PortfolioSummary {
  const userHoldings = HOLDINGS.filter((h) => (h.user_id ?? "me") === userId)
  const totalValue = userHoldings.reduce(
    (sum, h) => sum + (h.current_value ?? h.shares_owned * h.project.share_price),
    0,
  )
  const totalCost = userHoldings.reduce(
    (sum, h) => sum + h.shares_owned * (h.buy_price ?? h.project.share_price),
    0,
  )
  const totalProfit = totalValue - totalCost
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

  // Deterministic daily oscillation (one cycle ≈ 1 day) — keeps UI stable
  // across reloads but still varies day-to-day.
  const dailyChangePercent = Math.sin(Date.now() / 86_400_000) * 2 + 0.5
  const dailyChange = totalValue * (dailyChangePercent / 100)

  return {
    totalValue,
    totalCost,
    totalProfit,
    profitPercent: parseFloat(profitPercent.toFixed(2)),
    dailyChange: Math.round(dailyChange),
    dailyChangePercent: parseFloat(dailyChangePercent.toFixed(2)),
    holdingsCount: userHoldings.length,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Aliases
// ──────────────────────────────────────────────────────────────────────────

/** /portfolio uses the full shape with embedded total/available. */
export const mockHoldings = HOLDINGS

/** /quick-sell uses the same shape (it already had `id` per holding). */
export const mockHoldingsQuickSell = HOLDINGS

/** /wallet/send variant — different IDs (h1/h2/h3) and includes نخيل العراق. */
export const MOCK_HOLDINGS_SEND: Holding[] = [
  {
    id: "h1",
    project_id: "1",
    project: { id: "1", name: "مزرعة الواحة", sector: "زراعة", share_price: 100000 },
    shares_owned: 250,
  },
  {
    id: "h2",
    project_id: "2",
    project: { id: "2", name: "برج بغداد", sector: "تجارة", share_price: 250000 },
    shares_owned: 80,
  },
  {
    id: "h3",
    project_id: "5",
    project: { id: "5", name: "نخيل العراق", sector: "زراعة", share_price: 90000 },
    shares_owned: 120,
  },
]

/** /exchange/create variant — no top-level id, larger balances (250/80/120). */
export const MOCK_HOLDINGS_EXCHANGE: Array<{
  project_id: string
  project: { id: string; name: string; sector: string; share_price: number }
  shares_owned: number
}> = [
  { project_id: "1", project: { id: "1", name: "مزرعة الواحة", sector: "زراعة", share_price: 100000 }, shares_owned: 250 },
  { project_id: "2", project: { id: "2", name: "برج بغداد", sector: "تجارة", share_price: 250000 }, shares_owned: 80 },
  { project_id: "5", project: { id: "5", name: "نخيل العراق", sector: "زراعة", share_price: 90000 }, shares_owned: 120 },
]
