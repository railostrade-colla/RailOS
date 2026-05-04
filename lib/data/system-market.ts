"use client"

/**
 * System-wide market state (Phase 10.37).
 *
 * Reads + toggles the `system_market_state` singleton plus the 24h
 * aggregates from `deals` and the recent rows from `price_history`.
 *
 * All functions return safe defaults on any failure (missing migration,
 * RLS denial, network error) so the admin panel always renders.
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────

export interface PriceHistoryRow {
  id: string
  project_id: string
  project_name: string
  old_price: number
  new_price: number
  change_pct: number
  recorded_at: string
  phase: string
  trigger: string | null
}

export interface SystemMarketState {
  market_open: boolean
  updated_at: string
  last_change_reason: string | null
  trading_volume_24h: number
  trades_count_24h: number
  price_history: PriceHistoryRow[]
}

const EMPTY_STATE: SystemMarketState = {
  market_open: true,
  updated_at: new Date().toISOString(),
  last_change_reason: null,
  trading_volume_24h: 0,
  trades_count_24h: 0,
  price_history: [],
}

// ─── Reads ────────────────────────────────────────────────────────────

/**
 * Fetches the singleton state + 24h aggregates + recent price history.
 * Returns EMPTY_STATE if the migration isn't applied or any RPC failure.
 */
export async function getSystemMarketState(historyLimit = 20): Promise<SystemMarketState> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_system_market_state", {
      p_history_limit: historyLimit,
    })
    if (error || !data) return EMPTY_STATE
    const r = data as Partial<SystemMarketState> & { error?: string }
    if (r.error) return EMPTY_STATE
    return {
      market_open: Boolean(r.market_open ?? true),
      updated_at: r.updated_at ?? new Date().toISOString(),
      last_change_reason: r.last_change_reason ?? null,
      trading_volume_24h: Number(r.trading_volume_24h ?? 0),
      trades_count_24h: Number(r.trades_count_24h ?? 0),
      price_history: Array.isArray(r.price_history) ? r.price_history : [],
    }
  } catch {
    return EMPTY_STATE
  }
}

// ─── Writes ───────────────────────────────────────────────────────────

export interface ToggleResult {
  success: boolean
  changed?: boolean
  market_open?: boolean
  reason?: string
  error?: string
}

/** Toggles the master market open/closed flag. Admin-only. */
export async function setSystemMarketOpen(
  open: boolean,
  reason?: string,
): Promise<ToggleResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("set_system_market_open", {
      p_open: open,
      p_reason: reason ?? null,
    })
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const r = (data ?? {}) as ToggleResult
    if (!r.success) return { success: false, reason: r.reason ?? r.error ?? "unknown" }
    return r
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
