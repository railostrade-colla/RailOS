/**
 * Public types for the market layer.
 */

export type MarketPhase = "launch" | "active" | "frozen" | "committee_review"
export type HealthStatus = "healthy" | "watch" | "critical" | "frozen"
export type InterventionStatus = "none" | "watch" | "buy_intervention" | "freeze"
export type PromiseStatus = "pending" | "in_progress" | "completed" | "failed" | "extended"
export type FundTxType = "commission_inflow" | "buy_intervention" | "sell_release" | "adjustment"

// ──────────────────────────────────────────────────────────────────────────
// Engine outputs
// ──────────────────────────────────────────────────────────────────────────
export interface MarketCheckResult {
  shouldIncrease: boolean
  newPrice: number
  oldPrice: number
  changePct: number
  reason: string
  phase: MarketPhase
  metrics?: {
    score?: number
    factor_a?: number
    factor_b?: number
  }
}

export interface MarketState {
  project_id: string
  initial_price: number
  current_price: number
  total_growth_pct: number
  monthly_growth_pct: number
  yearly_growth_pct: number
  market_phase: MarketPhase
  health_status: HealthStatus
  total_deals_count: number
  is_frozen: boolean
  frozen_reason?: string
  last_change_at: string
  factor_a?: number
  factor_b?: number
  factor_c?: number
}

export interface PriceHistoryEntry {
  id: string
  project_id: string
  old_price: number
  new_price: number
  change_pct: number
  recorded_at: string
  phase: MarketPhase
  trigger?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Development index
// ──────────────────────────────────────────────────────────────────────────
export interface DevelopmentMeasurement {
  id: string
  project_id: string
  measured_at: string
  development_score: number
  price_to_development_ratio: number
  intervention_status: InterventionStatus
  measurements?: {
    a: number
    b: number
    c: number
    d: number
    e: number
  }
  committee_rating?: number
}

// ──────────────────────────────────────────────────────────────────────────
// Stability fund
// ──────────────────────────────────────────────────────────────────────────
export interface FundBalance {
  total_balance: number
  available_balance: number
  reserved_balance: number
  total_inflow: number
  total_interventions: number
  total_profit: number
}

export interface FundTransaction {
  id: string
  type: FundTxType
  amount: number
  project_id?: string
  project_name?: string
  shares_count?: number
  price_per_share?: number
  recorded_at: string
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Promises
// ──────────────────────────────────────────────────────────────────────────
export interface DevelopmentPromise {
  id: string
  project_id: string
  project_name: string
  promise_text: string
  promise_type: "milestone" | "expansion" | "improvement" | "delivery"
  status: PromiseStatus
  created_at: string
  due_at: string
  completed_at?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Deal qualification
// ──────────────────────────────────────────────────────────────────────────
export type DealCategory = "qualifying" | "low_weight" | "excluded"

export interface DealQualification {
  deal_id: string
  category: DealCategory
  weight: number
  recorded_at: string
}
