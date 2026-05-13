/**
 * Phase 12 — Commission + transfer types (post-Phase-14 cleanup).
 *
 * What used to live here was a kitchen-sink of every V7 engine
 * concept: EngineMode, EngineSettings, EngineLogRow, SectorCap,
 * ManualFreeze, AdminDecisionRow, MarketConditions. Phase 14 dropped
 * the underlying tables/RPCs (market_engine_settings,
 * market_engine_log, admin_decisions_log, …) so those types are
 * dead and were removed in Phase 14.07a.
 *
 * Surviving consumers:
 *   • lib/market/commissions.ts  — CommissionType, CommissionSetting
 *   • lib/market/transfers.ts    — CommissionType, ShareTransferRow
 *
 * Everything else (sector caps, engine modes, conditions, freezes,
 * decisions) now lives in `market_settings` (Phase 14.06 registry)
 * or the dedicated tables (share_transfers, contracts, …). New code
 * should NOT add types here unless it relates to the legacy commission
 * tier system; reach for `lib/data/market-settings.ts` instead.
 */

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
