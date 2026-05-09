/**
 * Phase 12 — Market engine + Commission types.
 *
 * Kept separate from the legacy lib/market/types.ts so the existing
 * stability/development/engine helpers stay untouched. All Phase-12
 * code imports from here.
 */

export type EngineMode = "initial" | "permanent" | "frozen"

export type CommissionType =
  | "trade"
  | "auction"
  | "quick_sell"
  | "contract_creation"
  | "contract_auction"
  | "transfer_first"
  | "transfer_second"
  | "transfer_third"

export interface CommissionSetting {
  commission_type: CommissionType
  display_name_ar: string
  is_enabled: boolean
  current_rate: number
  default_rate: number
  paused_until: string | null
  changed_at: string
  changed_by: string | null
  notes: string | null
}

export interface SectorCap {
  sector: string
  monthly_cap_percent: number
  display_name_ar: string
  is_active: boolean
  changed_at: string
  changed_by: string | null
}

export interface EngineSettings {
  id: string
  scope: "global" | "project"
  project_id: string | null
  engine_mode: "initial" | "permanent"
  initial_rise_per_trade: number
  initial_max_trades_per_day: number
  c1_target_pair_ratio: number
  c2_target_hold_ratio: number
  c1_max_rise: number
  c2_max_rise: number
  daily_cap: number
  free_transfer_max_value: number
  min_account_age_days: number
  circular_detection_window_days: number
  mutual_transfer_window_days: number
  mutual_transfer_penalty_days: number
  changed_at: string
  changed_by: string | null
  notes: string | null
}

export interface EngineLogRow {
  id: string
  project_id: string
  date: string
  engine_mode: EngineMode | null
  condition1_score: number | null
  condition2_hold_score: number | null
  condition2_balance_score: number | null
  condition2_score: number | null
  distinct_pairs_today: number
  total_holders: number | null
  trades_count_today: number
  monthly_accumulated: number | null
  monthly_cap: number | null
  daily_rise: number
  is_frozen: boolean
  computed_at: string
}

export interface ManualFreeze {
  id: string
  project_id: string
  freeze_reason: string
  freeze_start_date: string
  freeze_end_date: string | null
  triggered_by_user_id: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  created_at: string
}

export interface ShareTransferRow {
  id: string
  sender_id: string
  recipient_id: string
  project_id: string
  shares_count: number
  market_value: number
  commission_type: string
  commission_rate: number
  commission_amount: number
  transfer_number_in_week: number
  week_start_date: string
  is_mutual_pattern_penalty: boolean
  status: "pending" | "completed" | "cancelled"
  notes: string | null
  created_at: string
}

export interface AdminDecisionRow {
  id: string
  admin_id: string
  decision_type: string
  decision_target: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  rationale: string | null
  created_at: string
}

export interface MarketConditions {
  total_holders: number
  distinct_pairs: number
  pair_ratio: number
  c1_score: number
  hold_score: number
  balance_score: number
  c2_score: number
}
