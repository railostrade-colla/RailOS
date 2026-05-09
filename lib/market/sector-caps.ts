"use client"

/** Phase 12 — Sector caps data layer. */

import { createClient } from "@/lib/supabase/client"
import { dedupCache, invalidateCache } from "@/lib/data/cache"
import type { SectorCap } from "./phase12-types"

const KEY = "phase12:sector-caps:list"

export async function listSectorCaps(): Promise<SectorCap[]> {
  return dedupCache(KEY, async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("market_sector_caps")
        .select("*")
        .order("sector")
      if (error || !data) return []
      return data as SectorCap[]
    } catch {
      return []
    }
  }, 60_000)
}

export async function adminUpdateSectorCap(params: {
  sector: string
  newCap: number
  notes?: string
}): Promise<{ success: boolean; reason?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc("admin_update_sector_cap", {
      p_sector: params.sector,
      p_new_cap: params.newCap,
      p_notes: params.notes ?? null,
    })
    if (error) return { success: false, reason: error.message }
    invalidateCache(KEY)
    return { success: true }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : String(err) }
  }
}
