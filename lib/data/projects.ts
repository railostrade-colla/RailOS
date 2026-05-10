/**
 * Projects data layer — Supabase-backed.
 * Fallback: pages use lib/mock-data when these return empty arrays.
 */

import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/mock-data/types"
import { dedupCache } from "./cache"
import { iqd } from "@/lib/utils/money"

type DBProject = {
  id: string
  name: string
  slug?: string
  description?: string
  short_description?: string
  project_type?: string
  cover_image_url?: string
  cover_url?: string
  logo_url?: string
  total_shares: number
  share_price: number
  total_value?: number
  current_market_price?: number
  /** Percentage of total_shares offered to the public (0–100). */
  offering_percentage?: number
  status?: string
  offering_start_date?: string
  offering_end_date?: string
  created_at?: string
  published_at?: string
  /** Phase 10.95 — all admin-form fields needed by /project/[id] details page. */
  risk_level?: string
  return_min?: number | string
  return_max?: number | string
  expected_return_min?: number | string
  expected_return_max?: number | string
  distribution_type?: string
  profit_source?: string
  symbol?: string
  duration_open?: boolean
  duration_months?: number
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  detailed_address?: string
  location_city?: string
  location_address?: string
  gallery_images?: string[] | unknown
  documents?: unknown
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
  const totalShares = Number(row.total_shares ?? 0)
  const offeringPct = Number(row.offering_percentage ?? 0)
  // offering_shares = the public offering bucket total (never shrinks with sales).
  // available_shares = offering shares still available to buy (decreases with sales).
  // For a fresh project: both equal Math.round(total × pct).
  // The admin wallet RPC overrides available_shares with the real unsold count.
  const offeringShares = offeringPct > 0
    ? Math.round(totalShares * offeringPct / 100)
    : totalShares   // legacy fallback for rows without offering_percentage
  // Phase 10.95 — read returns + classification straight off the row.
  // DB stores ANNUAL %; the project details page divides by 12 for the
  // monthly card.  Both `return_min/max` and `expected_return_min/max`
  // exist (the create RPC writes both for backwards-compat); prefer
  // the canonical `expected_return_*` and fall back to `return_*`.
  const annualMin = Number(
    row.expected_return_min ?? row.return_min ?? 0
  ) || 0
  const annualMax = Number(
    row.expected_return_max ?? row.return_max ?? 0
  ) || 0

  // risk_level may be NULL/missing for older rows; default to "medium"
  // so the UI badge still renders.
  const dbRisk = row.risk_level
  const riskLevel: "low" | "medium" | "high" =
    dbRisk === "low" || dbRisk === "medium" || dbRisk === "high" ? dbRisk : "medium"

  // distribution_type: only the 4 enum values are valid in the type.
  const dbDist = row.distribution_type
  const distributionType =
    dbDist === "monthly" || dbDist === "quarterly" ||
    dbDist === "semi_annual" || dbDist === "annual"
      ? dbDist
      : undefined

  // Phase 11.23 — keep share_price (launch) and current_market_price
  // (live) as TWO separate fields so consumers can pick the right one.
  // When DB hasn't populated current_market_price yet (no deals), the
  // launch share_price is still surfaced under share_price; downstream
  // code falls back via `current_market_price ?? share_price`.
  // Phase 11.25 — iqd() rounds to integer so any fractional drift in
  // the DB (e.g. 24999.9999 from old float arithmetic) can't bleed
  // into the price-cap input handler and silently strip a dinar.
  const launchPrice = iqd(row.share_price)
  const livePrice = row.current_market_price != null
    ? iqd(row.current_market_price)
    : null

  return {
    id: row.id,
    name: row.name,
    sector: sectorMap[row.project_type ?? ""] ?? "أخرى",
    share_price: launchPrice || (livePrice ?? 0),
    current_market_price: livePrice,
    total_shares: totalShares,
    offering_shares: offeringShares,
    available_shares: offeringShares,   // refined by wallet aggregate in admin panel
    risk_level: riskLevel,
    project_value: row.total_value != null ? iqd(row.total_value) : undefined,
    description: row.short_description ?? row.description ?? "",
    created_at: row.created_at,
    // Phase 10.95 — extended admin-form fields surfaced on /project/[id]
    return_min: annualMin > 0 ? annualMin : undefined,
    return_max: annualMax > 0 ? annualMax : undefined,
    expected_return_min: annualMin > 0 ? annualMin : undefined,
    expected_return_max: annualMax > 0 ? annualMax : undefined,
    distribution_type: distributionType,
    profit_source: row.profit_source || undefined,
    symbol: row.symbol || undefined,
    // Phase 10.99b — surface the brand assets so the discover cards
    // and project details page show the real uploaded logo instead
    // of the sector emoji.
    logo_url: row.logo_url || undefined,
    logo: row.logo_url || undefined,           // legacy alias
    cover_url: row.cover_url || row.cover_image_url || undefined,
    cover_image: row.cover_url || row.cover_image_url || undefined,  // legacy alias
    // Phase 11.06 — surface duration so the discover card can hide the
    // "المدة" stat when the project is open-ended (founder spec).
    duration_open: row.duration_open ?? undefined,
    duration_months: row.duration_months ?? undefined,
  }
}

export async function getAllProjects(): Promise<Project[]> {
  return dedupCache("projects:active:all", async () => {
    try {
      const supabase = createClient()
      // Phase 13.27 — pull all + filter in JS (PostgREST escape
      // syntax for negated IN was misbehaving and dropping every
      // row). isDiscoverable handles NULL + every legacy value.
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
      if (error || !data) return []
      const filtered = (data as Array<{ status?: string | null }>).filter(isDiscoverable)
      const mapped = filtered.map((row) => dbToProject(row as DBProject))
      return await enrichProjectsWithSales(mapped)
    } catch {
      return []
    }
  }, 30_000)
}

/**
 * Phase 11.16 — overlay live sales data onto a list of projects.
 *
 * Discover cards + dashboard need each project's REAL:
 *   • available_shares  = offering wallet's available_shares (decreases
 *                         as buyers' deals are confirmed)
 *   • investors_count   = COUNT(DISTINCT user_id) from holdings of
 *                         this project where shares > 0
 *
 * dbToProject seeds available_shares with the FULL offering count
 * (offering_pct × total_shares) which is fine until any sale happens.
 * After the first sale the discover card needs the real remaining
 * count so the funding bar moves.
 *
 * Two cheap batched queries (one on project_wallets, one on holdings).
 * Failures are non-fatal — projects pass through unchanged.
 */
export async function enrichProjectsWithSales(
  projects: Project[],
): Promise<Project[]> {
  if (projects.length === 0) return projects
  const ids = Array.from(new Set(projects.map((p) => p.id).filter(Boolean)))
  if (ids.length === 0) return projects

  const supabase = createClient()
  const availableMap = new Map<string, number>()
  const investorsMap = new Map<string, number>()

  // 1. Offering wallet's actual available_shares per project
  try {
    const { data } = await supabase
      .from("project_wallets")
      .select("project_id, available_shares, total_shares")
      .in("project_id", ids)
      .eq("wallet_type", "offering")
    for (const w of (data ?? []) as Array<{
      project_id: string
      available_shares: number | string | null
      total_shares: number | string | null
    }>) {
      availableMap.set(w.project_id, Number(w.available_shares ?? 0))
    }
  } catch { /* best-effort */ }

  // 2. Distinct investor count per project — Phase 13.12.
  //
  // Direct SELECT on `holdings` is blocked by RLS for non-admin
  // viewers (the discover page is public and the home tab is open
  // to any signed-in user, so the row policy returns 0 rows for
  // most callers). The new SECURITY DEFINER RPC bypasses RLS and
  // returns ONLY (project_id, count) — no user_ids, no share
  // amounts — so it's safe to expose publicly. Falls back to the
  // legacy direct query for any DB that doesn't yet have the RPC.
  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc(
      "get_public_investor_counts",
      { p_project_ids: ids },
    )
    if (!rpcErr && Array.isArray(rpcRows)) {
      for (const row of rpcRows as Array<{ project_id: string; investor_count: number | string }>) {
        investorsMap.set(row.project_id, Number(row.investor_count ?? 0))
      }
    } else {
      // Legacy fallback (will likely return empty under RLS, but
      // keep it in case the RPC is missing on a stale DB).
      const { data } = await supabase
        .from("holdings")
        .select("project_id, user_id")
        .in("project_id", ids)
        .gt("shares", 0)
      const seen = new Map<string, Set<string>>()
      for (const h of (data ?? []) as Array<{ project_id: string; user_id: string }>) {
        if (!seen.has(h.project_id)) seen.set(h.project_id, new Set())
        seen.get(h.project_id)!.add(h.user_id)
      }
      for (const [pid, set] of seen) {
        investorsMap.set(pid, set.size)
      }
    }
  } catch { /* best-effort */ }

  return projects.map((p) => {
    const liveAvail = availableMap.get(p.id)
    const liveInvestors = investorsMap.get(p.id)
    return {
      ...p,
      available_shares:
        liveAvail !== undefined ? liveAvail : p.available_shares,
      investors_count:
        liveInvestors !== undefined ? liveInvestors : (p.investors_count ?? 0),
    }
  })
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
  /** Expected ANNUAL return % range. The form collects monthly numbers
   *  and the caller multiplies by 12 before passing them here so the
   *  DB stores annual figures (matching finance.ts conventions). */
  expected_return_min?: number
  expected_return_max?: number
  /** Brand assets uploaded in §2 of the form. Persisted on the
   *  projects row so the read-only details view, app project page,
   *  and any list rendering can show the real logo instead of the
   *  generic sector emoji. */
  logo_url?: string
  cover_url?: string
  /** Phase 10.90 — full-form persistence:
   *    open-ended vs fixed-months duration toggle,
   *    file-upload documents + gallery,
   *    owner contact + distribution mechanics. */
  duration_open?: boolean
  duration_months?: number
  documents?: Array<{
    name: string
    url: string
    size?: number
    mime_type?: string
  }>
  gallery_images?: string[]
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  detailed_address?: string
  profit_source?: string
  distribution_type?: string
  risk_level?: string
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
      p_expected_return_min: input.expected_return_min ?? null,
      p_expected_return_max: input.expected_return_max ?? null,
      p_logo_url: input.logo_url?.trim() ? input.logo_url.trim() : null,
      p_cover_url: input.cover_url?.trim() ? input.cover_url.trim() : null,
      // Phase 10.90 — full-form payload
      p_duration_open: input.duration_open ?? true,
      p_duration_months: input.duration_open ? null : (input.duration_months ?? null),
      p_documents: input.documents ?? [],
      p_gallery_images: input.gallery_images ?? [],
      p_owner_name: input.owner_name?.trim() || null,
      p_owner_phone: input.owner_phone?.trim() || null,
      p_owner_email: input.owner_email?.trim() || null,
      p_detailed_address: input.detailed_address?.trim() || null,
      p_profit_source: input.profit_source?.trim() || null,
      p_distribution_type: input.distribution_type ?? null,
      p_risk_level: input.risk_level ?? null,
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

// ──────────────────────────────────────────────────────────────────────
// Admin: update an existing project (Phase 10.94)
// ──────────────────────────────────────────────────────────────────────

export interface AdminUpdateProjectInput {
  id: string
  name: string
  short_description?: string
  description?: string
  project_type?: string
  company_id?: string | null
  symbol?: string
  /** Brand assets */
  logo_url?: string
  cover_url?: string
  gallery_images?: string[]
  documents?: Array<{ name: string; url: string; size?: number; mime_type?: string }>
  /** Location */
  location_city?: string
  location_address?: string
  detailed_address?: string
  /** Dates + duration */
  offering_start_date?: string
  offering_end_date?: string
  duration_open?: boolean
  duration_months?: number
  /** Returns — pass ANNUAL %; caller multiplies monthly × 12 */
  expected_return_min?: number
  expected_return_max?: number
  /** Classification */
  risk_level?: string
  distribution_type?: string
  profit_source?: string
  /** Owner contact */
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  /** Status — passing 'active' on a draft publishes it. */
  status?: "draft" | "active" | "coming_soon" | "sold_out" | "completed"
}

export interface AdminUpdateProjectResult {
  success: boolean
  reason?: string
  error?: string
  project_id?: string
}

export async function adminUpdateProject(
  input: AdminUpdateProjectInput,
): Promise<AdminUpdateProjectResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_update_project", {
      p_project_id: input.id,
      p_name: input.name,
      p_short_description: input.short_description ?? null,
      p_description: input.description ?? null,
      p_project_type: input.project_type ?? null,
      p_company_id: input.company_id ?? null,
      p_symbol: input.symbol ?? null,
      p_logo_url: input.logo_url ?? null,
      p_cover_url: input.cover_url ?? null,
      p_gallery_images: input.gallery_images ?? null,
      p_documents: input.documents ?? null,
      p_location_city: input.location_city ?? null,
      p_location_address: input.location_address ?? null,
      p_detailed_address: input.detailed_address ?? null,
      p_offering_start_date: input.offering_start_date ?? null,
      p_offering_end_date: input.offering_end_date ?? null,
      p_duration_open: input.duration_open ?? null,
      p_duration_months: input.duration_months ?? null,
      p_expected_return_min: input.expected_return_min ?? null,
      p_expected_return_max: input.expected_return_max ?? null,
      p_risk_level: input.risk_level ?? null,
      p_distribution_type: input.distribution_type ?? null,
      p_profit_source: input.profit_source ?? null,
      p_owner_name: input.owner_name ?? null,
      p_owner_phone: input.owner_phone ?? null,
      p_owner_email: input.owner_email ?? null,
      p_status: input.status ?? null,
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
    const result = (data ?? {}) as AdminUpdateProjectResult
    if (!result.success) {
      return { success: false, reason: result.reason ?? result.error ?? "unknown" }
    }
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
      invalidateCache(`projects:coming_soon:${i}`)  // Phase 13.17
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

// Phase 13.13 — explicit column list for the discover/home cards.
// dbToProject only reads ~25 of the 60+ columns on `projects`; the
// rest were being shipped over the wire on every dashboard mount.
// This trims payload by ~60% and lets PostgREST skip jsonb decoding
// for `gallery_images` / `documents` which the card never displays.
const CARD_COLUMNS =
  "id, name, slug, short_description, description, project_type, " +
  "logo_url, cover_url, cover_image_url, symbol, " +
  "total_shares, share_price, total_value, current_market_price, " +
  "offering_percentage, status, " +
  "offering_start_date, offering_end_date, duration_open, duration_months, " +
  "created_at, published_at, " +
  "risk_level, return_min, return_max, expected_return_min, expected_return_max, " +
  "distribution_type"

// Phase 13.17 — discover surface uses get_discover_projects RPC
// which combines admin pins + auto-rules:
//   trending    → ORDER BY investor_count DESC
//   new         → created_at > NOW() - 30 days
//   coming_soon → offering_start_date > NOW()
// The RPC returns the full card payload + investor_count in one
// round-trip, so we don't need enrichProjectsWithSales afterwards.
async function getDiscoverProjectsViaRPC(
  tab: "trending" | "new" | "coming_soon",
  limit: number,
): Promise<Project[] | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_discover_projects", {
      p_tab: tab,
      p_limit: limit,
    })
    if (error || !Array.isArray(data)) return null
    type DiscoverRow = DBProject & { investor_count?: number | string }
    const mapped = (data as DiscoverRow[]).map((row) => ({
      ...dbToProject(row as DBProject),
      investors_count: Number(row.investor_count ?? 0),
    }))
    return mapped
  } catch {
    return null
  }
}

// Phase 13.28 — show every project regardless of status.
// Phase 13.26/13.27 tried to filter the obvious "off" states
// (draft, pending, paused, ...) client- and server-side, but the
// founder's project رايلوس carries a status value that's none of
// the canonical ones AND none of the hidden ones — so EVERY filter
// I tried either over-hid it or under-included it. Pragmatic fix:
// drop the predicate. Discover lists every project; admin removes
// what shouldn't appear via the existing "حذف" action on the
// Projects panel.
//
// Truly archived states are still excluded server-side via the
// projects RLS policy (the row simply isn't readable for
// non-admins), so this can't accidentally reveal soft-deleted
// projects to end users.
function isDiscoverable(_row: { status?: string | null }): boolean {
  return true
}

/**
 * Phase 13.30 — direct-query fallback. Pulls every project the RLS
 * lets the caller see, ordered per the discover tab semantics, with
 * NO status filter (Discover-side filtering is the user's call,
 * see Phase 13.28 reasoning).
 */
async function getDiscoverProjectsViaDirectQuery(
  ordering: "created_at" | "share_price",
  limit: number,
): Promise<Project[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("projects")
      .select(CARD_COLUMNS)
      .order(ordering, { ascending: false })
      .limit(limit * 3)
    const filtered = ((data ?? []) as Array<{ status?: string | null }>)
      .filter(isDiscoverable)
      .slice(0, limit)
    const mapped = filtered.map((row) => dbToProject(row as unknown as DBProject))
    return await enrichProjectsWithSales(mapped)
  } catch {
    return []
  }
}

export async function getNewProjects(limit = 6): Promise<Project[]> {
  return dedupCache(`projects:new:${limit}`, async () => {
    // Phase 13.30 — try the RPC first; if it returns 0 rows (older
    // migration still filtering by status='active'), fall back to
    // the permissive direct query so the founder's project surfaces
    // whether or not Phase 13.29 has been applied to this DB.
    const viaRpc = await getDiscoverProjectsViaRPC("new", limit)
    if (viaRpc && viaRpc.length > 0) return viaRpc
    return getDiscoverProjectsViaDirectQuery("created_at", limit)
  }, 30_000)
}

export async function getTrendingProjects(limit = 6): Promise<Project[]> {
  return dedupCache(`projects:trending:${limit}`, async () => {
    // Phase 13.30 — same dual-path strategy as getNewProjects.
    const viaRpc = await getDiscoverProjectsViaRPC("trending", limit)
    if (viaRpc && viaRpc.length > 0) return viaRpc
    return getDiscoverProjectsViaDirectQuery("share_price", limit)
  }, 30_000)
}

/** Phase 13.17 — coming-soon projects (admin-pinned + future
 *  offering_start_date). New surface for the "قريباً" tab.
 *  Phase 13.30 — same dual-path as trending/new. */
export async function getComingSoonProjects(limit = 6): Promise<Project[]> {
  return dedupCache(`projects:coming_soon:${limit}`, async () => {
    const viaRpc = await getDiscoverProjectsViaRPC("coming_soon", limit)
    if (viaRpc && viaRpc.length > 0) return viaRpc
    // Direct query: only projects with a future offering_start_date.
    try {
      const supabase = createClient()
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from("projects")
        .select(CARD_COLUMNS)
        .gt("offering_start_date", nowIso)
        .order("offering_start_date", { ascending: true })
        .limit(limit * 3)
      const filtered = ((data ?? []) as Array<{ status?: string | null }>)
        .filter(isDiscoverable)
        .slice(0, limit)
      const mapped = filtered.map((row) => dbToProject(row as unknown as DBProject))
      return await enrichProjectsWithSales(mapped)
    } catch {
      return []
    }
  }, 30_000)
}

/** Phase 13.17 — admin write: pin/unpin a project to a discover tab.
 *  Pass `null` to clear the pin and revert to auto-ranking.
 *
 *  Phase 13.33 — dual-path: try the RPC first; if it's missing
 *  (Phase 13.17 migration not applied yet), fall back to a direct
 *  UPDATE on projects.discover_tag. The UPDATE is gated by admin
 *  RLS so non-admins can't reach it. */
export async function adminSetDiscoverTag(
  projectId: string,
  tag: "trending" | "coming_soon" | "new" | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // 1) Try the RPC.
  try {
    const { data, error } = await supabase.rpc("admin_set_discover_tag", {
      p_project_id: projectId,
      p_tag: tag,
    })
    if (!error) {
      const r = (data ?? {}) as { success?: boolean; error?: string }
      if (r.success) {
        invalidateProjectCaches()
        return { success: true }
      }
      // RPC ran but returned a known error code (not_admin etc.).
      return { success: false, error: r.error ?? "unknown" }
    }
    // RPC missing? Fall through to the direct UPDATE.
    const msg = error.message || ""
    const isMissing =
      msg.toLowerCase().includes("could not find the function") ||
      msg.toLowerCase().includes("schema cache") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    if (!isMissing) {
      return { success: false, error: msg }
    }
  } catch { /* fall through to UPDATE */ }

  // 2) Fallback: direct UPDATE. Requires admin RLS on projects
  //    UPDATE (already in place from Phase 5.x).
  try {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id ?? null
    const { error: updErr } = await supabase
      .from("projects")
      .update({
        discover_tag: tag,
        discover_tag_set_by: tag == null ? null : uid,
        discover_tag_set_at: tag == null ? null : new Date().toISOString(),
      })
      .eq("id", projectId)
    if (updErr) {
      // 42703 = column doesn't exist (Phase 13.17 migration
      // truly missing — no way around it without DB changes).
      if (updErr.code === "42703" || /column .* does not exist/i.test(updErr.message)) {
        return {
          success: false,
          error: "Phase 13.17 migration not applied — please run 20260510_phase13_17_discover_tags.sql",
        }
      }
      return { success: false, error: updErr.message }
    }
    invalidateProjectCaches()
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
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
