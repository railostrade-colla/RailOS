"use client"

/**
 * strategic-advisor — Phase 13.56.
 *
 * Wraps `get_strategic_market_advisor()` RPC — a single round-trip
 * that returns:
 *   • snapshot of every meaningful market metric
 *   • composite health score (0-100) + Arabic label
 *   • machine-readable "unlock conditions" for the next price rise
 *   • prioritised, actionable advice with concrete next steps
 *
 * Consumed by <StrategicAdvisorCard /> which is mounted twice:
 *   • Monitor.tsx — under 🩺 صحة السوق strip
 *   • MarketEnginePanelV2.tsx — Dynamic tab under 🔭 مراقبة السوق
 */

import { createClient } from "@/lib/supabase/client"

export interface StrategicSnapshot {
  total_users: number
  active_users_24h: number
  active_users_7d: number
  active_users_30d: number
  kyc_approved: number
  kyc_pending: number
  kyc_not_submitted: number
  dealing_users_lifetime: number
  dealing_users_7d: number
  deals_total: number
  deals_24h: number
  deals_7d: number
  traded_value_24h: number
  traded_value_7d: number
  avg_deal_size: number
  open_demand_count: number
  open_demand_value: number
  supply_shares: number
  supply_value: number
}

export interface UnlockCondition {
  key: "participation" | "demand" | "min_deals" | string
  title: string
  icon: string
  current: number
  target: number
  missing: number
  unit: string
  pct_complete: number
  unlock_rise_pct: number | null
}

export type AdvicePriority = "critical" | "high" | "medium" | "good"

export interface AdviceItem {
  priority: AdvicePriority
  category: "liquidity" | "participation" | "engagement" | "compliance" | "stability" | "growth" | string
  icon: string
  title: string
  body: string
  action: string
  expected_impact: string
}

export interface StrategicAdvisorResult {
  success: boolean
  generated_at: string | null
  health_score: number
  health_label: string
  snapshot: StrategicSnapshot
  unlock_conditions: UnlockCondition[]
  advice: AdviceItem[]
  error?: string
}

const EMPTY_SNAPSHOT: StrategicSnapshot = {
  total_users: 0,
  active_users_24h: 0,
  active_users_7d: 0,
  active_users_30d: 0,
  kyc_approved: 0,
  kyc_pending: 0,
  kyc_not_submitted: 0,
  dealing_users_lifetime: 0,
  dealing_users_7d: 0,
  deals_total: 0,
  deals_24h: 0,
  deals_7d: 0,
  traded_value_24h: 0,
  traded_value_7d: 0,
  avg_deal_size: 0,
  open_demand_count: 0,
  open_demand_value: 0,
  supply_shares: 0,
  supply_value: 0,
}

export const EMPTY_ADVISOR: StrategicAdvisorResult = {
  success: false,
  generated_at: null,
  health_score: 0,
  health_label: "—",
  snapshot: EMPTY_SNAPSHOT,
  unlock_conditions: [],
  advice: [],
}

export async function getStrategicMarketAdvisor(): Promise<StrategicAdvisorResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_strategic_market_advisor")
    if (error || data == null) {
      return { ...EMPTY_ADVISOR, error: error?.message ?? "no_data" }
    }
    type Raw = {
      success?: boolean
      generated_at?: string
      health_score?: number | string
      health_label?: string
      snapshot?: Partial<Record<keyof StrategicSnapshot, number | string>>
      unlock_conditions?: UnlockCondition[]
      advice?: AdviceItem[]
      error?: string
    }
    const r = (data ?? {}) as Raw
    const num = (v: unknown, f = 0): number =>
      v === undefined || v === null ? f : Number(v)

    const snapEntries = Object.keys(EMPTY_SNAPSHOT) as Array<keyof StrategicSnapshot>
    const snapshot = snapEntries.reduce<StrategicSnapshot>((acc, k) => {
      acc[k] = num(r.snapshot?.[k])
      return acc
    }, { ...EMPTY_SNAPSHOT })

    return {
      success: !!r.success,
      generated_at: r.generated_at ?? null,
      health_score: num(r.health_score),
      health_label: r.health_label ?? "—",
      snapshot,
      unlock_conditions: Array.isArray(r.unlock_conditions) ? r.unlock_conditions : [],
      advice: Array.isArray(r.advice) ? r.advice : [],
      error: r.error,
    }
  } catch (err) {
    return {
      ...EMPTY_ADVISOR,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
