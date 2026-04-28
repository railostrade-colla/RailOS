/**
 * Mock data for /admin/market, /admin/stability-fund, /admin/promises.
 * Used until the real DB is wired (Phase 7).
 */

import type {
  MarketState,
  PriceHistoryEntry,
  DevelopmentMeasurement,
  FundBalance,
  FundTransaction,
  DevelopmentPromise,
} from "@/lib/market/types"

// ──────────────────────────────────────────────────────────────────────────
// Market state per project
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_MARKET_STATES: MarketState[] = [
  {
    project_id: "1",
    initial_price: 100000,
    current_price: 108500,
    total_growth_pct: 8.5,
    monthly_growth_pct: 8.5,
    yearly_growth_pct: 8.5,
    market_phase: "active",
    health_status: "healthy",
    total_deals_count: 142,
    is_frozen: false,
    last_change_at: "2026-04-25T14:30:00",
  },
  {
    project_id: "2",
    initial_price: 250000,
    current_price: 272500,
    total_growth_pct: 9.0,
    monthly_growth_pct: 9.0,
    yearly_growth_pct: 9.0,
    market_phase: "active",
    health_status: "watch",
    total_deals_count: 89,
    is_frozen: false,
    last_change_at: "2026-04-24T11:15:00",
  },
  {
    project_id: "3",
    initial_price: 175000,
    current_price: 178500,
    total_growth_pct: 2.0,
    monthly_growth_pct: 2.0,
    yearly_growth_pct: 2.0,
    market_phase: "active",
    health_status: "healthy",
    total_deals_count: 67,
    is_frozen: false,
    last_change_at: "2026-04-23T09:45:00",
  },
  {
    project_id: "4",
    initial_price: 120000,
    current_price: 138000,
    total_growth_pct: 15.0,
    monthly_growth_pct: 15.0,
    yearly_growth_pct: 15.0,
    market_phase: "frozen",
    health_status: "critical",
    total_deals_count: 56,
    is_frozen: true,
    frozen_reason: "تحت مراجعة لجنة التطوير",
    last_change_at: "2026-04-20T16:00:00",
  },
  {
    project_id: "5",
    initial_price: 90000,
    current_price: 91500,
    total_growth_pct: 1.7,
    monthly_growth_pct: 1.7,
    yearly_growth_pct: 1.7,
    market_phase: "launch",
    health_status: "healthy",
    total_deals_count: 12,
    is_frozen: false,
    last_change_at: "2026-04-22T10:30:00",
  },
  {
    project_id: "6",
    initial_price: 80000,
    current_price: 82400,
    total_growth_pct: 3.0,
    monthly_growth_pct: 3.0,
    yearly_growth_pct: 3.0,
    market_phase: "active",
    health_status: "healthy",
    total_deals_count: 95,
    is_frozen: false,
    last_change_at: "2026-04-21T13:20:00",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Price history (sample for project "1")
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_PRICE_HISTORY: PriceHistoryEntry[] = [
  { id: "ph1", project_id: "1", old_price: 100000, new_price: 101500, change_pct: 1.5, recorded_at: "2026-04-10T10:00:00", phase: "launch" },
  { id: "ph2", project_id: "1", old_price: 101500, new_price: 103000, change_pct: 1.48, recorded_at: "2026-04-15T11:30:00", phase: "launch" },
  { id: "ph3", project_id: "1", old_price: 103000, new_price: 105200, change_pct: 2.13, recorded_at: "2026-04-20T09:15:00", phase: "active" },
  { id: "ph4", project_id: "1", old_price: 105200, new_price: 107000, change_pct: 1.71, recorded_at: "2026-04-23T14:00:00", phase: "active" },
  { id: "ph5", project_id: "1", old_price: 107000, new_price: 108500, change_pct: 1.40, recorded_at: "2026-04-25T14:30:00", phase: "active" },
]

// ──────────────────────────────────────────────────────────────────────────
// Development measurements
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_DEVELOPMENT_DATA: DevelopmentMeasurement[] = [
  { id: "d1", project_id: "1", measured_at: "2026-04-25T00:00:00", development_score: 87, price_to_development_ratio: 1.05, intervention_status: "none" },
  { id: "d2", project_id: "2", measured_at: "2026-04-25T00:00:00", development_score: 72, price_to_development_ratio: 1.18, intervention_status: "watch" },
  { id: "d3", project_id: "3", measured_at: "2026-04-25T00:00:00", development_score: 91, price_to_development_ratio: 0.95, intervention_status: "none" },
  { id: "d4", project_id: "4", measured_at: "2026-04-20T00:00:00", development_score: 58, price_to_development_ratio: 1.45, intervention_status: "freeze" },
  { id: "d5", project_id: "5", measured_at: "2026-04-22T00:00:00", development_score: 80, price_to_development_ratio: 1.02, intervention_status: "none" },
  { id: "d6", project_id: "6", measured_at: "2026-04-21T00:00:00", development_score: 78, price_to_development_ratio: 1.06, intervention_status: "none" },
]

// ──────────────────────────────────────────────────────────────────────────
// Stability fund balance
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_FUND_BALANCE: FundBalance = {
  total_balance: 250_000_000,
  available_balance: 180_000_000,
  reserved_balance: 70_000_000,
  total_inflow: 320_000_000,
  total_interventions: 95_000_000,
  total_profit: 25_000_000,
}

// ──────────────────────────────────────────────────────────────────────────
// Fund transactions log
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_FUND_TRANSACTIONS: FundTransaction[] = [
  { id: "ft1", type: "commission_inflow", amount: 95000, project_id: "1", project_name: "مزرعة الواحة", recorded_at: "2026-04-25T14:30:00" },
  { id: "ft2", type: "buy_intervention", amount: 5_400_000, project_id: "4", project_name: "صفا الذهبي", shares_count: 45, price_per_share: 120000, recorded_at: "2026-04-24T16:00:00" },
  { id: "ft3", type: "commission_inflow", amount: 245000, project_id: "2", project_name: "برج بغداد", recorded_at: "2026-04-24T11:15:00" },
  { id: "ft4", type: "sell_release", amount: 3_200_000, project_id: "1", project_name: "مزرعة الواحة", shares_count: 32, price_per_share: 100000, recorded_at: "2026-04-22T10:00:00" },
  { id: "ft5", type: "commission_inflow", amount: 175000, project_id: "3", project_name: "مجمع الكرخ", recorded_at: "2026-04-23T09:45:00" },
  { id: "ft6", type: "buy_intervention", amount: 2_100_000, project_id: "2", project_name: "برج بغداد", shares_count: 9, price_per_share: 233333, recorded_at: "2026-04-21T13:00:00" },
  { id: "ft7", type: "commission_inflow", amount: 80000, project_id: "6", project_name: "قمة الرشيد", recorded_at: "2026-04-21T13:20:00" },
  { id: "ft8", type: "adjustment", amount: 50000, recorded_at: "2026-04-20T08:00:00", notes: "تسوية شهرية" },
]

// ──────────────────────────────────────────────────────────────────────────
// Development promises
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_PROMISES: DevelopmentPromise[] = [
  {
    id: "p1",
    project_id: "1",
    project_name: "مزرعة الواحة",
    promise_text: "إضافة 50 دونم جديد للزراعة + تركيب نظام ري بالتنقيط",
    promise_type: "expansion",
    status: "pending",
    created_at: "2026-04-15T10:00:00",
    due_at: "2026-07-15T00:00:00",
  },
  {
    id: "p2",
    project_id: "2",
    project_name: "برج بغداد",
    promise_text: "افتتاح الطابق الثالث + 8 محلات تجارية",
    promise_type: "milestone",
    status: "in_progress",
    created_at: "2026-04-10T09:30:00",
    due_at: "2026-06-01T00:00:00",
  },
  {
    id: "p3",
    project_id: "3",
    project_name: "مجمع الكرخ",
    promise_text: "تجهيز 20 شقة جديدة + موقف سيارات",
    promise_type: "delivery",
    status: "completed",
    created_at: "2026-02-20T11:00:00",
    due_at: "2026-04-20T00:00:00",
    completed_at: "2026-04-18T14:00:00",
  },
  {
    id: "p4",
    project_id: "4",
    project_name: "صفا الذهبي",
    promise_text: "زيادة الإنتاج بنسبة 30% خلال شهرين",
    promise_type: "improvement",
    status: "failed",
    created_at: "2026-02-01T08:00:00",
    due_at: "2026-04-01T00:00:00",
  },
  {
    id: "p5",
    project_id: "5",
    project_name: "نخيل العراق",
    promise_text: "حصاد المرحلة الأولى + تسويق المنتجات",
    promise_type: "milestone",
    status: "in_progress",
    created_at: "2026-04-05T12:00:00",
    due_at: "2026-08-01T00:00:00",
  },
  {
    id: "p6",
    project_id: "6",
    project_name: "قمة الرشيد",
    promise_text: "افتتاح فرع جديد في الكرادة",
    promise_type: "expansion",
    status: "pending",
    created_at: "2026-04-12T14:30:00",
    due_at: "2026-07-30T00:00:00",
  },
  {
    id: "p7",
    project_id: "1",
    project_name: "مزرعة الواحة",
    promise_text: "تجديد عقد التصدير مع شركاء جدد",
    promise_type: "delivery",
    status: "extended",
    created_at: "2026-03-01T10:00:00",
    due_at: "2026-05-30T00:00:00",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function getMarketStateByProject(projectId: string): MarketState | undefined {
  return MOCK_MARKET_STATES.find((m) => m.project_id === projectId)
}

export function getPriceHistoryByProject(projectId: string, limit?: number): PriceHistoryEntry[] {
  const rows = MOCK_PRICE_HISTORY.filter((p) => p.project_id === projectId)
  return limit ? rows.slice(-limit) : rows
}

export function getDevelopmentByProject(projectId: string): DevelopmentMeasurement | undefined {
  return MOCK_DEVELOPMENT_DATA.find((d) => d.project_id === projectId)
}

export function getProjectMarketHealth(projectId: string) {
  const state = getMarketStateByProject(projectId)
  const dev = getDevelopmentByProject(projectId)
  return { state, dev }
}

export function getMarketStats() {
  const total = MOCK_MARKET_STATES.length
  const healthy = MOCK_MARKET_STATES.filter((m) => m.health_status === "healthy").length
  const watch = MOCK_MARKET_STATES.filter((m) => m.health_status === "watch").length
  const critical = MOCK_MARKET_STATES.filter((m) => m.health_status === "critical").length
  const frozen = MOCK_MARKET_STATES.filter((m) => m.is_frozen).length
  return { total, healthy, watch, critical, frozen }
}

export function getPromiseStats() {
  const total = MOCK_PROMISES.length
  const pending = MOCK_PROMISES.filter((p) => p.status === "pending").length
  const in_progress = MOCK_PROMISES.filter((p) => p.status === "in_progress").length
  const completed = MOCK_PROMISES.filter((p) => p.status === "completed").length
  const failed = MOCK_PROMISES.filter((p) => p.status === "failed").length
  const extended = MOCK_PROMISES.filter((p) => p.status === "extended").length
  return { total, pending, in_progress, completed, failed, extended }
}

// ──────────────────────────────────────────────────────────────────────────
// Public-facing helpers (for /project/[id], /investment, /dashboard)
// ──────────────────────────────────────────────────────────────────────────

/** Current price for a project from market_state (fallback to 0). */
export function getProjectCurrentPrice(projectId: string): number {
  const state = MOCK_MARKET_STATES.find((s) => s.project_id === projectId)
  return state?.current_price ?? 0
}

/** Simple trend direction. */
export function getProjectPriceTrend(projectId: string): "up" | "stable" | "down" {
  const state = MOCK_MARKET_STATES.find((s) => s.project_id === projectId)
  if (!state) return "stable"
  if (state.total_growth_pct > 0) return "up"
  if (state.total_growth_pct < 0) return "down"
  return "stable"
}

/** Public status — never reveals internal phase. */
export function getProjectPublicStatus(projectId: string): {
  status: "active" | "review" | "frozen"
  label: string
} {
  const state = MOCK_MARKET_STATES.find((s) => s.project_id === projectId)
  if (!state) return { status: "active", label: "نشط" }
  if (state.is_frozen) return { status: "frozen", label: "مجمد" }
  if (state.market_phase === "committee_review") return { status: "review", label: "تحت المراجعة" }
  return { status: "active", label: "نشط" }
}

/** Chart-ready price points for the last N entries. */
export function getPriceHistoryForChart(projectId: string, limit: number = 30): Array<{
  date: string
  price: number
}> {
  return MOCK_PRICE_HISTORY
    .filter((p) => p.project_id === projectId)
    .slice(-limit)
    .map((p) => ({
      date: p.recorded_at.slice(0, 10),
      price: p.new_price,
    }))
}

/** Total growth between oldest & latest price_history entries for a project. */
export function getRecentMarketGrowth(projectId: string, limit: number = 30): number {
  const history = MOCK_PRICE_HISTORY
    .filter((p) => p.project_id === projectId)
    .slice(-limit)
  if (history.length < 2) return 0
  const oldest = history[0].old_price
  const latest = history[history.length - 1].new_price
  return Math.round(((latest - oldest) / oldest) * 1000) / 10
}

// ──────────────────────────────────────────────────────────────────────────
// Notifications generated from market events
// ──────────────────────────────────────────────────────────────────────────
export type MarketNotificationType = "price_increase" | "frozen" | "promise"

export interface MarketNotification {
  id: string
  type: MarketNotificationType
  icon: string
  title: string
  desc: string
  time: string
  href: string
  is_unread: boolean
}

/** Build user-facing notifications from market signals. */
export function generateMarketNotifications(_userId: string = "me"): MarketNotification[] {
  const result: MarketNotification[] = []

  for (const m of MOCK_MARKET_STATES) {
    if (m.total_growth_pct >= 5 && !m.is_frozen) {
      const projectName = m.project_id === "1" ? "مزرعة الواحة" :
        m.project_id === "2" ? "برج بغداد" :
        m.project_id === "3" ? "مجمع الكرخ" :
        m.project_id === "4" ? "صفا الذهبي" :
        m.project_id === "5" ? "نخيل العراق" : "قمة الرشيد"
      result.push({
        id: "mn-up-" + m.project_id,
        type: "price_increase",
        icon: "🎉",
        title: `ارتفع سعر ${projectName} بنسبة ${m.total_growth_pct.toFixed(1)}%`,
        desc: `السعر الجديد: ${m.current_price.toLocaleString("en-US")} د.ع`,
        time: "منذ ساعتين",
        href: "/project/" + m.project_id,
        is_unread: true,
      })
    }
    if (m.is_frozen) {
      result.push({
        id: "mn-fr-" + m.project_id,
        type: "frozen",
        icon: "⏸️",
        title: "تم تجميد سوق مشروع مؤقتاً",
        desc: m.frozen_reason ?? "للمراجعة الدورية",
        time: "منذ 5 ساعات",
        href: "/project/" + m.project_id,
        is_unread: true,
      })
    }
  }

  for (const p of MOCK_PROMISES.slice(0, 2)) {
    if (p.status === "pending") {
      result.push({
        id: "mn-pr-" + p.id,
        type: "promise",
        icon: "📜",
        title: `وعد تطوير جديد لـ ${p.project_name}`,
        desc: "اطلع على التفاصيل",
        time: "أمس",
        href: "/project/" + p.project_id,
        is_unread: false,
      })
    }
  }

  return result.slice(0, 8)
}
