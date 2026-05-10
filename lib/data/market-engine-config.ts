"use client"

/**
 * market-engine-config — Phase 13.46.
 *
 * Single source of truth for the dynamic market-pricing rules.
 * Wraps the `market_engine_config` table (one-row, id=1) and the
 * `set_market_engine_state` RPC.
 */

import { createClient } from "@/lib/supabase/client"

export interface MarketEngineConfig {
  enabled: boolean
  daily_pct_cap: number
  cooldown_minutes: number
  min_deals_threshold: number
  updated_at: string
}

const DEFAULT_CONFIG: MarketEngineConfig = {
  enabled: true,
  daily_pct_cap: 10,
  cooldown_minutes: 0,
  min_deals_threshold: 0,
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
      updated_at?: string
    }
    return {
      enabled: !!r.enabled,
      daily_pct_cap: Number(r.daily_pct_cap ?? 10),
      cooldown_minutes: Number(r.cooldown_minutes ?? 0),
      min_deals_threshold: Number(r.min_deals_threshold ?? 0),
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
          error: "RPC غير موجود — طبّق migration 20260510_phase13_46",
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
