"use client"

/**
 * market-engine-config — Phase 13.47.
 *
 * Single source of truth for the dynamic market-pricing rules.
 * Wraps the `market_engine_config` table (one-row, id=1) and the
 * `set_market_engine_state` RPC + `get_market_watch_advice` RPC.
 *
 * Phase 13.47 added two new conditions to the dynamic engine:
 *   • user-participation %       (default 30 → unlocks 1.5%)
 *   • supply/demand balance %    (default 40 → unlocks 1.5%)
 * Each contributes proportionally to the rise applied by the deal
 * trigger; combined rise is capped at daily_pct_cap.
 */

import { createClient } from "@/lib/supabase/client"

export interface MarketEngineConfig {
  enabled: boolean
  daily_pct_cap: number
  cooldown_minutes: number
  min_deals_threshold: number
  // Phase 13.47 — participation condition
  user_participation_required_pct: number
  participation_max_rise_pct: number
  // Phase 13.47 — supply/demand condition
  supply_demand_balance_target_pct: number
  supply_demand_max_rise_pct: number
  updated_at: string
}

const DEFAULT_CONFIG: MarketEngineConfig = {
  enabled: true,
  daily_pct_cap: 10,
  cooldown_minutes: 0,
  min_deals_threshold: 0,
  user_participation_required_pct: 30,
  participation_max_rise_pct: 1.5,
  supply_demand_balance_target_pct: 40,
  supply_demand_max_rise_pct: 1.5,
  updated_at: new Date(0).toISOString(),
}

export async function getMarketEngineConfig(): Promise<MarketEngineConfig> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("market_engine_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
    if (error || !data) return DEFAULT_CONFIG
    const r = data as {
      enabled?: boolean
      daily_pct_cap?: number | string
      cooldown_minutes?: number | string
      min_deals_threshold?: number | string
      user_participation_required_pct?: number | string
      participation_max_rise_pct?: number | string
      supply_demand_balance_target_pct?: number | string
      supply_demand_max_rise_pct?: number | string
      updated_at?: string
    }
    return {
      enabled: !!r.enabled,
      daily_pct_cap: Number(r.daily_pct_cap ?? 10),
      cooldown_minutes: Number(r.cooldown_minutes ?? 0),
      min_deals_threshold: Number(r.min_deals_threshold ?? 0),
      user_participation_required_pct: Number(r.user_participation_required_pct ?? 30),
      participation_max_rise_pct: Number(r.participation_max_rise_pct ?? 1.5),
      supply_demand_balance_target_pct: Number(r.supply_demand_balance_target_pct ?? 40),
      supply_demand_max_rise_pct: Number(r.supply_demand_max_rise_pct ?? 1.5),
      updated_at: r.updated_at ?? new Date(0).toISOString(),
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export interface SetMarketEngineStateInput {
  enabled?: boolean
  daily_pct_cap?: number
  cooldown_minutes?: number
  min_deals_threshold?: number
  user_participation_required_pct?: number
  participation_max_rise_pct?: number
  supply_demand_balance_target_pct?: number
  supply_demand_max_rise_pct?: number
}

export interface SetMarketEngineStateResult {
  success: boolean
  error?: string
}

export async function setMarketEngineState(
  input: SetMarketEngineStateInput,
): Promise<SetMarketEngineStateResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("set_market_engine_state", {
      p_enabled: input.enabled ?? null,
      p_daily_pct_cap: input.daily_pct_cap ?? null,
      p_cooldown_minutes: input.cooldown_minutes ?? null,
      p_min_deals_threshold: input.min_deals_threshold ?? null,
      p_user_participation_required_pct: input.user_participation_required_pct ?? null,
      p_participation_max_rise_pct: input.participation_max_rise_pct ?? null,
      p_supply_demand_balance_target_pct: input.supply_demand_balance_target_pct ?? null,
      p_supply_demand_max_rise_pct: input.supply_demand_max_rise_pct ?? null,
    })
    if (error) {
      const m = (error.message || "").toLowerCase()
      if (
        m.includes("could not find the function") ||
        m.includes("schema cache") ||
        error.code === "PGRST202" ||
        error.code === "42883"
      ) {
        return {
          success: false,
          error: "RPC غير موجود — طبّق migration 20260510_phase13_47",
        }
      }
      return { success: false, error: error.message }
    }
    type Row = { success?: boolean; error?: string }
    const r = (data ?? {}) as Row
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}


// ─── Market Watch Advisor (Phase 13.47) ───────────────────────────

export interface MarketWatchProgress {
  total_users: number
  dealing_users: number
  required_dealers: number
  participation_pct: number
  participation_target_pct: number
  participation_progress: number    // 0..1
  participation_unlock_pct: number  // contribution to rise %
  traded_value_24h: number
  pending_demand_value: number
  demand_ratio_pct: number
  demand_target_pct: number
  supply_demand_progress: number    // 0..1
  supply_demand_unlock_pct: number  // contribution to rise %
  combined_unlock_pct: number       // sum, before daily cap
}

export interface MarketWatchMessage {
  kind: "good" | "info" | "warn"
  icon: string
  title: string
  body: string
}

export interface MarketWatchAdvice {
  success: boolean
  health: "great" | "good" | "warn"
  progress: MarketWatchProgress
  messages: MarketWatchMessage[]
  error?: string
}

const EMPTY_PROGRESS: MarketWatchProgress = {
  total_users: 0,
  dealing_users: 0,
  required_dealers: 0,
  participation_pct: 0,
  participation_target_pct: 30,
  participation_progress: 0,
  participation_unlock_pct: 0,
  traded_value_24h: 0,
  pending_demand_value: 0,
  demand_ratio_pct: 0,
  demand_target_pct: 40,
  supply_demand_progress: 0,
  supply_demand_unlock_pct: 0,
  combined_unlock_pct: 0,
}

export async function getMarketWatchAdvice(): Promise<MarketWatchAdvice> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_market_watch_advice")
    if (error) {
      return {
        success: false,
        health: "warn",
        progress: EMPTY_PROGRESS,
        messages: [],
        error: error.message,
      }
    }
    type Raw = {
      success?: boolean
      health?: string
      progress?: Partial<Record<keyof MarketWatchProgress, number | string>>
      messages?: MarketWatchMessage[]
      error?: string
    }
    const r = (data ?? {}) as Raw
    const p = r.progress ?? {}
    const num = (k: keyof MarketWatchProgress, fallback: number): number => {
      const v = p[k]
      return v === undefined || v === null ? fallback : Number(v)
    }
    const progress: MarketWatchProgress = {
      total_users: num("total_users", 0),
      dealing_users: num("dealing_users", 0),
      required_dealers: num("required_dealers", 0),
      participation_pct: num("participation_pct", 0),
      participation_target_pct: num("participation_target_pct", 30),
      participation_progress: num("participation_progress", 0),
      participation_unlock_pct: num("participation_unlock_pct", 0),
      traded_value_24h: num("traded_value_24h", 0),
      pending_demand_value: num("pending_demand_value", 0),
      demand_ratio_pct: num("demand_ratio_pct", 0),
      demand_target_pct: num("demand_target_pct", 40),
      supply_demand_progress: num("supply_demand_progress", 0),
      supply_demand_unlock_pct: num("supply_demand_unlock_pct", 0),
      combined_unlock_pct: num("combined_unlock_pct", 0),
    }
    const health = (r.health === "great" || r.health === "good" || r.health === "warn")
      ? r.health
      : "good"
    return {
      success: !!r.success,
      health,
      progress,
      messages: Array.isArray(r.messages) ? r.messages : [],
      error: r.error,
    }
  } catch (err) {
    return {
      success: false,
      health: "warn",
      progress: EMPTY_PROGRESS,
      messages: [],
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
