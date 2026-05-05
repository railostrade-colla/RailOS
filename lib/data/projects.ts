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

// ──────────────────────────────────────────────────────────────────────
// Admin: fetch a single project with EVERY column, for the edit form
// ──────────────────────────────────────────────────────────────────────

export interface ProjectFullRow {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  short_description?: string | null
  project_type?: string | null
  cover_image_url?: string | null
  total_shares?: number | string | null
  share_price?: number | string | null
  total_value?: number | string | null
  current_market_price?: number | string | null
  offering_percentage?: number | string | null
  ambassador_percentage?: number | string | null
  reserve_percentage?: number | string | null
  location_city?: string | null
  offering_start_date?: string | null
  offering_end_date?: string | null
  company_id?: string | null
  status?: string | null
  created_at?: string | null
  symbol?: string | null
  /** Catch-all for any other columns we surface to the form. */
  [extraColumn: string]: unknown
}

/**
 * Fetches every column for a single project. Used by the Edit panel
 * so the form can pre-fill every field the founder originally entered.
 * Returns null if not found / RLS denied.
 */
export async function getProjectByIdAdmin(id: string): Promise<ProjectFullRow | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data as ProjectFullRow
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────────────
// Admin: create a new project (Phase 10.20)
// ──────────────────────────────────────────────────────────────────────

export interface AdminCreateProjectInput {
  name: string
  short_description: string
  description: string
  project_type: string
  share_price: number
  total_shares: number
  offering_percentage?: number
  ambassador_percentage?: number
  reserve_percentage?: number
  location_city?: string
  offering_start_date?: string
  offering_end_date?: string
  /** null = "بلا (مشروع مباشر)" — the project has no parent company. */
  company_id?: string | null
  status?: "draft" | "active"
}

export interface AdminCreateProjectResult {
  success: boolean
  reason?: string
  error?: string
  project_id?: string
  slug?: string
  offering_shares?: number
  ambassador_shares?: number
  reserve_shares?: number
}

export async function adminCreateProject(
  input: AdminCreateProjectInput,
): Promise<AdminCreateProjectResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_create_project", {
      p_name: input.name,
      p_short_description: input.short_description,
      p_description: input.description,
      p_project_type: input.project_type,
      p_share_price: input.share_price,
      p_total_shares: input.total_shares,
      p_offering_percentage: input.offering_percentage ?? 90,
      p_ambassador_percentage: input.ambassador_percentage ?? 2,
      p_reserve_percentage: input.reserve_percentage ?? 8,
      p_location_city: input.location_city ?? null,
      p_offering_start_date: input.offering_start_date ?? null,
      p_offering_end_date: input.offering_end_date ?? null,
      p_company_id: input.company_id ?? null,
      p_status: input.status ?? "draft",
    })
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as AdminCreateProjectResult
    if (!result.success) {
      return { success: false, reason: result.reason ?? result.error ?? "unknown" }
    }
    // Invalidate cached project lists so the new row shows immediately
    invalidateProjectCaches()
    return result
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Drop cached project lists — call after any admin mutation. */
function invalidateProjectCaches(): void {
  // Lazy import to keep the module tree-shake friendly.
  import("./cache").then(({ invalidateCache }) => {
    invalidateCache("projects:active:all")
    for (let i = 1; i <= 12; i++) {
      invalidateCache(`projects:new:${i}`)
      invalidateCache(`projects:trending:${i}`)
    }
  })
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
