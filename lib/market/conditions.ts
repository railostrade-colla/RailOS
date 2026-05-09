"use client"

/** Phase 12 — Market conditions + engine log readouts. */

import { createClient } from "@/lib/supabase/client"
import type { EngineLogRow, MarketConditions } from "./phase12-types"

export async function computeMarketConditions(
  projectId: string,
  date?: string,
): Promise<MarketConditions | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("compute_market_conditions", {
      p_project_id: projectId,
      p_date: date ?? new Date().toISOString().slice(0, 10),
    })
    if (error || !data) return null
    return data as MarketConditions
  } catch {
    return null
  }
}

export async function getMonthlyAccumulated(projectId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_monthly_accumulated", {
      p_project_id: projectId,
    })
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  }
}

export async function getMonthlyCap(projectId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_monthly_cap", {
      p_project_id: projectId,
    })
    if (error) return 0.10
    return Number(data) || 0.10
  } catch {
    return 0.10
  }
}

export async function getEngineLogForProject(
  projectId: string,
  days = 30,
): Promise<EngineLogRow[]> {
  try {
    const supabase = createClient()
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from("market_engine_log")
      .select("*")
      .eq("project_id", projectId)
      .gte("date", since)
      .order("date", { ascending: false })
    if (error || !data) return []
    return data as EngineLogRow[]
  } catch {
    return []
  }
}
