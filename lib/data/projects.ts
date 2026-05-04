/**
 * Projects data layer — Supabase-backed.
 * Fallback: pages use lib/mock-data when these return empty arrays.
 */

import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/mock-data/types"
import { dedupCache } from "./cache"

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
  return dedupCache("projects:active:all", async () => {
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
  }, 30_000)
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
  return dedupCache(`projects:new:${limit}`, async () => {
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
  }, 30_000)
}

export async function getTrendingProjects(limit = 6): Promise<Project[]> {
  return dedupCache(`projects:trending:${limit}`, async () => {
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
  }, 30_000)
}

// ──────────────────────────────────────────────────────────────────────
// Project updates — the periodic posts the project owner publishes
// ──────────────────────────────────────────────────────────────────────

/** A row from the `project_updates` table (created in 02_projects.sql). */
export interface ProjectUpdate {
  id: string
  project_id: string
  title: string
  content: string
  images: string[]
  /** 0–100 — null when the update isn't tied to a milestone. */
  progress_percentage: number | null
  created_at: string
}

interface UpdateRow {
  id: string
  project_id: string | null
  title: string | null
  content: string | null
  images: string[] | null
  progress_percentage: number | null
  created_at: string | null
}

/**
 * Loads recent updates for a project, newest first. Returns an empty
 * array on any failure (table missing, RLS, network) so the section
 * just collapses gracefully.
 */
export async function getProjectUpdates(
  projectId: string,
  limit: number = 10,
): Promise<ProjectUpdate[]> {
  if (!projectId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("project_updates")
      .select(
        "id, project_id, title, content, images, progress_percentage, created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[projects] getProjectUpdates:", error.message)
      return []
    }
    return (data as UpdateRow[]).map((r) => ({
      id: r.id,
      project_id: r.project_id ?? projectId,
      title: r.title ?? "",
      content: r.content ?? "",
      images: Array.isArray(r.images)
        ? r.images.filter((s): s is string => typeof s === "string")
        : [],
      progress_percentage:
        typeof r.progress_percentage === "number"
          ? r.progress_percentage
          : null,
      created_at: r.created_at ?? new Date().toISOString(),
    }))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[projects] getProjectUpdates threw:", err)
    return []
  }
}
