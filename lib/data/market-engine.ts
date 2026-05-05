"use client"

/**
 * market-engine — admin reads of the market engine internals
 * (stability_fund, fund_transactions, development_promises).
 * Phase 10.63 wires three orphan tables previously written-only by
 * the market-engine RPCs but never surfaced in any UI.
 */

import { createClient } from "@/lib/supabase/client"

export interface StabilityFund {
  id: number
  total_balance: number
  available_balance: number
  reserved_balance: number
  total_inflow: number
  total_interventions: number
  total_profit: number
  updated_at: string | null
}

export interface FundTransaction {
  id: string
  type: string
  amount: number
  project_id: string | null
  project_name: string | null
  shares_count: number | null
  price_per_share: number | null
  recorded_at: string
  notes: string | null
}

export interface PromisesSummary {
  total: number
  pending: number
  completed: number
  overdue: number
}

export interface MarketEngineOverview {
  stability_fund: StabilityFund | null
  recent_txns: FundTransaction[]
  promises_summary: PromisesSummary
  snapshot_at: string | null
}

const ZERO_FUND: StabilityFund = {
  id: 1,
  total_balance: 0, available_balance: 0, reserved_balance: 0,
  total_inflow: 0, total_interventions: 0, total_profit: 0,
  updated_at: null,
}

const ZERO_PROMISES: PromisesSummary = {
  total: 0, pending: 0, completed: 0, overdue: 0,
}

export async function getMarketEngineOverview(): Promise<MarketEngineOverview> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_market_engine_overview")
    if (error || !data) {
      return {
        stability_fund: null,
        recent_txns: [],
        promises_summary: ZERO_PROMISES,
        snapshot_at: null,
      }
    }
    const r = data as {
      error?: string
      stability_fund?: Partial<StabilityFund>
      recent_txns?: FundTransaction[]
      promises_summary?: Partial<PromisesSummary>
      snapshot_at?: string
    }
    if (r.error) {
      return {
        stability_fund: null,
        recent_txns: [],
        promises_summary: ZERO_PROMISES,
        snapshot_at: null,
      }
    }
    const fund = r.stability_fund && Object.keys(r.stability_fund).length > 0
      ? { ...ZERO_FUND, ...r.stability_fund } as StabilityFund
      : null
    return {
      stability_fund: fund,
      recent_txns: Array.isArray(r.recent_txns) ? r.recent_txns : [],
      promises_summary: { ...ZERO_PROMISES, ...(r.promises_summary ?? {}) },
      snapshot_at: r.snapshot_at ?? null,
    }
  } catch {
    return {
      stability_fund: null,
      recent_txns: [],
      promises_summary: ZERO_PROMISES,
      snapshot_at: null,
    }
  }
}

export async function getFundTransactions(limit: number = 100): Promise<FundTransaction[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_fund_transactions", { p_limit: limit })
    if (error || !Array.isArray(data)) return []
    return data as FundTransaction[]
  } catch {
    return []
  }
}

export interface DevelopmentPromise {
  id: string
  project_id: string
  promise_text: string
  promise_type: string
  status: string
  created_at: string
  due_at: string
  completed_at: string | null
  evidence_url: string | null
}

export async function getDevelopmentPromisesForProject(
  projectId: string,
): Promise<DevelopmentPromise[]> {
  if (!projectId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(
      "get_development_promises_for_project",
      { p_project_id: projectId },
    )
    if (error || !Array.isArray(data)) return []
    return data as DevelopmentPromise[]
  } catch {
    return []
  }
}
