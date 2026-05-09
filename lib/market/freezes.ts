"use client"

/** Phase 12 — Manual project freezes. */

import { createClient } from "@/lib/supabase/client"
import { dedupCache, invalidateCache } from "@/lib/data/cache"
import type { ManualFreeze } from "./phase12-types"

const KEY = "phase12:freezes:active"

export async function listActiveFreezes(): Promise<ManualFreeze[]> {
  return dedupCache(KEY, async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("market_manual_freezes")
        .select("*")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
      if (error || !data) return []
      return data as ManualFreeze[]
    } catch {
      return []
    }
  }, 30_000)
}

export async function isProjectFrozen(projectId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("is_project_frozen", {
      p_project_id: projectId,
    })
    if (error) return false
    return Boolean(data)
  } catch {
    return false
  }
}

export async function adminFreezeProject(params: {
  projectId: string
  reason: string
  endDate?: string | null
}): Promise<{ success: boolean; reason?: string; id?: string }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_freeze_project", {
      p_project_id: params.projectId,
      p_reason: params.reason,
      p_end_date: params.endDate ?? null,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache(KEY)
    return { success: true, id: data as string }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

export async function adminUnfreezeProject(params: {
  projectId: string
  notes?: string
}): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("admin_unfreeze_project", {
      p_project_id: params.projectId,
      p_notes: params.notes ?? null,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache(KEY)
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
