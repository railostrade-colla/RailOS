"use client"

/**
 * Phase 12 — Engine-mode data layer.
 *
 * The engine has three states: initial / permanent / frozen. Switch
 * between initial and permanent is admin-controlled (no automation),
 * frozen is per-project and only set by admin_freeze_project().
 */

import { createClient } from "@/lib/supabase/client"
import { dedupCache, invalidateCache } from "@/lib/data/cache"
import type { EngineMode, EngineSettings } from "./phase12-types"

const SETTINGS_KEY = "phase12:engine:settings:global"

export async function getGlobalEngineSettings(): Promise<EngineSettings | null> {
  return dedupCache(SETTINGS_KEY, async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("market_engine_settings")
        .select("*")
        .eq("scope", "global")
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return data as EngineSettings
    } catch {
      return null
    }
  }, 30_000)
}

export async function getEngineMode(projectId?: string): Promise<EngineMode> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_engine_mode", {
      p_project_id: projectId ?? null,
    })
    if (error) return "initial"
    return (data as EngineMode) ?? "initial"
  } catch {
    return "initial"
  }
}

export async function adminSwitchEngineMode(
  newMode: "initial" | "permanent",
  notes: string,
): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("admin_switch_engine_mode", {
      p_new_mode: newMode,
      p_notes: notes,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache(SETTINGS_KEY)
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

export async function adminRunDailyEngineNow(): Promise<{
  success: boolean
  processed?: number
  reason?: string
}> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("run_daily_market_engine")
    if (error) return { success: false, reason: error.message }
    const result = data as { processed?: number; date?: string } | null
    return { success: true, processed: result?.processed ?? 0 }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
