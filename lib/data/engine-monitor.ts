"use client"

/**
 * Engine monitor — client wrapper for Phase 14.08f.
 *
 * Read-only views of the new 3-layer engine:
 *   • Per-project layer progress + suggested next rise (live compute)
 *   • Recent daily-cron runs (last N, with which caps fired)
 *
 * Plus one super-admin RPC:
 *   • manualTriggerDailyEngine(projectId?) — fires the cron's logic
 *     for one project (or all). Used for testing without waiting
 *     for the scheduled tick.
 */

import { createClient } from "@/lib/supabase/client"

// ═══════════════════════════════════════════════════════════════════
// Types — mirror the jsonb payloads from the SQL functions
// ═══════════════════════════════════════════════════════════════════

export interface Layer1Progress {
  progress: number
  distinct_pairs: number
  active_users: number
  pair_ratio_pct: number
  target_pct: number
  window_days: number
}

export interface Layer2Progress {
  progress: number
  supply_value: number
  demand_value: number
  balance: number
}

export interface Layer3Progress {
  progress: number
  new_dealers: number
  returning_dealers: number
  total: number
  window_days: number
}

export interface AllLayers {
  layer1: Layer1Progress
  layer2: Layer2Progress
  layer3: Layer3Progress
  layer1_reward_pct: number
  layer2_reward_pct: number
  layer3_reward_pct: number
  raw_rise_pct: number
}

export interface CapsReport {
  applied_rise_pct: number
  raw_rise_pct: number
  capped_by: string[]
  sector?: string | null
  sector_cap_pct?: number
  sector_used_pct?: number
  sector_remaining_pct?: number
  daily_cap_pct?: number
  day_of_month?: number
  yearly_cap_pct?: number
  yearly_used_pct?: number
  yearly_remaining_pct?: number
  engine_enabled: boolean
}

export interface EngineDailyRun {
  id: string
  project_id: string
  run_at: string
  layer1_progress: number
  layer2_progress: number
  layer3_progress: number
  layer1_reward_pct: number
  layer2_reward_pct: number
  layer3_reward_pct: number
  raw_rise_pct: number
  applied_rise_pct: number
  capped_by: string[]
  old_price: number
  new_price: number
  notes: string | null
}

export interface MonthlyRiseRow {
  project_id: string
  project_name: string
  sector: string | null
  current_price: number
  monthly_rise_pct: number
  rise_events_count: number
  last_rise_at: string | null
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const num = (v: unknown, fallback = 0): number => {
  if (v == null) return fallback
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

const asStrArr = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string")
}

// ═══════════════════════════════════════════════════════════════════
// RPC wrappers
// ═══════════════════════════════════════════════════════════════════

/** Live layer progress for one project (no DB write). */
export async function getProjectLayers(
  projectId: string,
): Promise<AllLayers | null> {
  if (!projectId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("compute_all_layers", {
      p_project_id: projectId,
    })
    if (error || !data) return null
    return data as AllLayers
  } catch {
    return null
  }
}

/** Live caps report for a raw rise % (no DB write). */
export async function previewCaps(
  projectId: string,
  rawRisePct: number,
): Promise<CapsReport | null> {
  if (!projectId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("apply_caps", {
      p_project_id: projectId,
      p_raw_rise_pct: rawRisePct,
    })
    if (error || !data) return null
    return data as CapsReport
  } catch {
    return null
  }
}

/** Last N daily-cron runs across all projects (or filter by project). */
export async function getRecentRuns(
  limit = 50,
  projectId?: string,
): Promise<EngineDailyRun[]> {
  try {
    const supabase = createClient()
    let query = supabase
      .from("engine_daily_runs")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(Math.max(1, Math.min(500, limit)))
    if (projectId) query = query.eq("project_id", projectId)
    const { data, error } = await query
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ""),
      project_id: String(r.project_id ?? ""),
      run_at: String(r.run_at ?? ""),
      layer1_progress: num(r.layer1_progress),
      layer2_progress: num(r.layer2_progress),
      layer3_progress: num(r.layer3_progress),
      layer1_reward_pct: num(r.layer1_reward_pct),
      layer2_reward_pct: num(r.layer2_reward_pct),
      layer3_reward_pct: num(r.layer3_reward_pct),
      raw_rise_pct: num(r.raw_rise_pct),
      applied_rise_pct: num(r.applied_rise_pct),
      capped_by: asStrArr(r.capped_by),
      old_price: num(r.old_price),
      new_price: num(r.new_price),
      notes: (r.notes as string | null) ?? null,
    }))
  } catch {
    return []
  }
}

/** Monthly rise per project (read from the view). */
export async function getMonthlyRiseTable(): Promise<MonthlyRiseRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("v_project_monthly_rise")
      .select("*")
      .order("monthly_rise_pct", { ascending: false })
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => ({
      project_id: String(r.project_id ?? ""),
      project_name: String(r.project_name ?? ""),
      sector: (r.sector as string | null) ?? null,
      current_price: num(r.current_price),
      monthly_rise_pct: num(r.monthly_rise_pct),
      rise_events_count: num(r.rise_events_count),
      last_rise_at: (r.last_rise_at as string | null) ?? null,
    }))
  } catch {
    return []
  }
}

/**
 * Manual cron trigger for testing — super_admin only (enforced
 * server-side by the SQL wrapper in Phase 14.08g).
 *
 * Phase 14.08.1: optional `force` flag bypasses the one-run-per-day
 * idempotency guard. Default FALSE so the natural path is safe; the
 * UI exposes a separate clearly-labelled button for the force case.
 *
 * Passing projectId fires the per-project runner; omitting it runs
 * the full all-projects loop.
 */
export interface ManualTriggerResult {
  success: boolean
  error?: string
  payload?: Record<string, unknown>
  /** True when the server skipped because already_ran_today and force was false. */
  skipped?: boolean
  skippedReason?: string
}

export async function manualTriggerDailyEngine(
  projectId?: string,
  force = false,
): Promise<ManualTriggerResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("manual_trigger_daily_engine", {
      p_project_id: projectId ?? null,
      p_force: force,
    })
    if (error) return { success: false, error: error.message }
    const payload = (data ?? {}) as Record<string, unknown>
    if (payload.ok === false) {
      return { success: false, error: String(payload.error ?? "unknown") }
    }

    // Detect the "already_ran_today" early-return from the SQL runner
    // so the UI can surface it as info, not success.
    const result = payload.result as Record<string, unknown> | undefined
    const skipped =
      typeof result?.skipped === "string" ? result.skipped : undefined
    if (skipped === "already_ran_today") {
      return {
        success: true,
        skipped: true,
        skippedReason: skipped,
        payload,
      }
    }

    return { success: true, payload }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
