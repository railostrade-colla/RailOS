/**
 * Projects data layer — Supabase-backed.
 * Fallback: pages use lib/mock-data when these return empty arrays.
 */

import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/mock-data/types"

type DBProject = {
  id: string
  name: string
  slug?: string
  description?: string
  short_description?: string
  project_type?: string
  cover_image_url?: string
  total_shares: number
  share_price: number
  total_value?: number
  current_market_price?: number
  status?: string
  offering_start_date?: string
  offering_end_date?: string
  created_at?: string
  published_at?: string
}

/** Transform a DB project row into the Project interface used by UI cards. */
function dbToProject(row: DBProject): Project {
  // Map project_type → human Arabic sector
  const sectorMap: Record<string, string> = {
    agriculture: "زراعة",
    real_estate: "عقارات",
    industrial: "صناعة",
    commercial: "تجارة",
    services: "خدمات",
    medical: "طبّي",
  }
  return {
    id: row.id,
    name: row.name,
    sector: sectorMap[row.project_type ?? ""] ?? "أخرى",
    share_price: Number(row.current_market_price ?? row.share_price ?? 0),
    total_shares: Number(row.total_shares ?? 0),
    available_shares: Number(row.total_shares ?? 0),  // approximation
    risk_level: "medium",
    project_value: row.total_value ? Number(row.total_value) : undefined,
    description: row.short_description ?? row.description ?? "",
    created_at: row.created_at,
  }
}

export async function getAllProjects(): Promise<Project[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map(dbToProject)
  } catch {
    return []
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return dbToProject(data)
  } catch {
    return null
  }
}

export async function getNewProjects(limit = 6): Promise<Project[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    return (data ?? []).map(dbToProject)
  } catch {
    return []
  }
}

export async function getTrendingProjects(limit = 6): Promise<Project[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("share_price", { ascending: false })
      .limit(limit)
    return (data ?? []).map(dbToProject)
  } catch {
    return []
  }
}
