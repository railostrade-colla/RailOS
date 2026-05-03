"use client"

/**
 * Orphans care program — DB-backed data layer (Phase 6.1).
 *
 * Wraps the orphan_children, sponsorships, orphan_reports tables
 * created by 20260503_phase6_orphans_schema.sql. Mirrors the mock
 * shapes in @/lib/mock-data/orphans so pages can swap directly.
 *
 * Resilient pattern: every helper returns sane defaults on error so
 * a partially-deployed DB never breaks the page.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  OrphanChild,
  Sponsorship,
  OrphanReport,
  ChildSponsorshipStatus,
  EducationLevel,
  SponsorshipType,
  SponsorshipStatus,
} from "@/lib/mock-data/orphans"

// ─── Row types (raw DB shapes) ───────────────────────────────

interface ChildRow {
  id: string
  first_name: string
  age: number
  gender: string
  city: string
  story: string | null
  needs_amount_monthly: number | string
  sponsored_amount: number | string
  sponsors_count: number
  status: string
  blur_photo: boolean
  photo_url: string | null
  education_level: string
  health_status: string
}

interface SponsorshipRow {
  id: string
  sponsor_id: string
  child_id: string
  type: string
  amount: number | string
  duration_months: number
  status: string
  is_anonymous: boolean
  receive_reports: boolean
  started_at: string
  ends_at: string | null
  cancelled_at: string | null
  child?:
    | { first_name?: string | null }
    | { first_name?: string | null }[]
    | null
  sponsor?:
    | { full_name?: string | null }
    | { full_name?: string | null }[]
    | null
}

interface ReportRow {
  id: string
  child_id: string
  sponsor_id: string
  period: string
  education_progress: string | null
  health_status: string | null
  highlights: string | null
  photos_count: number
  sent_at: string
  child?:
    | { first_name?: string | null }
    | { first_name?: string | null }[]
    | null
}

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function asStatus(s: string): ChildSponsorshipStatus {
  if (s === "needs_sponsor" || s === "partial" || s === "fully_sponsored")
    return s
  return "needs_sponsor"
}
function asEdu(s: string): EducationLevel {
  if (s === "kindergarten" || s === "primary" || s === "intermediate" || s === "secondary" || s === "university")
    return s
  return "primary"
}
function asSpType(s: string): SponsorshipType {
  if (s === "monthly" || s === "annual" || s === "onetime") return s
  return "monthly"
}
function asSpStatus(s: string): SponsorshipStatus {
  // mock has only active|ended; map cancelled→ended for the UI.
  if (s === "active") return "active"
  return "ended"
}
function asHealth(s: string): OrphanChild["health_status"] {
  if (s === "good" || s === "monitoring" || s === "needs_care") return s
  return "good"
}

function rowToChild(r: ChildRow): OrphanChild {
  return {
    id: r.id,
    first_name: r.first_name,
    age: r.age,
    gender: r.gender === "female" ? "female" : "male",
    city: r.city,
    story: r.story ?? "",
    needs_amount_monthly: num(r.needs_amount_monthly),
    sponsored_amount: num(r.sponsored_amount),
    sponsors_count: r.sponsors_count ?? 0,
    status: asStatus(r.status),
    blur_photo: r.blur_photo === true,
    photo_url: r.photo_url ?? undefined,
    education_level: asEdu(r.education_level),
    health_status: asHealth(r.health_status),
  }
}

function rowToSponsorship(r: SponsorshipRow): Sponsorship {
  const child = unwrap(r.child)
  const sponsor = unwrap(r.sponsor)
  return {
    id: r.id,
    sponsor_id: r.sponsor_id,
    sponsor_name: sponsor?.full_name?.trim() || "—",
    child_id: r.child_id,
    child_first_name: child?.first_name ?? "—",
    type: asSpType(r.type),
    amount: num(r.amount),
    duration_months: r.duration_months,
    status: asSpStatus(r.status),
    started_at: r.started_at?.slice(0, 10) ?? "",
    ends_at: r.ends_at?.slice(0, 10) ?? undefined,
    is_anonymous: r.is_anonymous,
    receive_reports: r.receive_reports,
  }
}

function rowToReport(r: ReportRow): OrphanReport {
  const child = unwrap(r.child)
  return {
    id: r.id,
    child_id: r.child_id,
    child_first_name: child?.first_name ?? "—",
    sponsor_id: r.sponsor_id,
    period: r.period,
    education_progress: r.education_progress ?? "",
    health_status: r.health_status ?? "",
    highlights: r.highlights ?? "",
    photos_count: r.photos_count ?? 0,
    sent_at: r.sent_at?.slice(0, 10) ?? "",
  }
}

// ─── Reads ───────────────────────────────────────────────────

export async function getOrphanChildren(): Promise<OrphanChild[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orphan_children")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return (data as ChildRow[]).map(rowToChild)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[orphans] children:", err)
    return []
  }
}

export async function getOrphanChildById(id: string): Promise<OrphanChild | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orphan_children")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return rowToChild(data as ChildRow)
  } catch {
    return null
  }
}

export async function getMySponsorships(): Promise<Sponsorship[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("sponsorships")
      .select(
        `
        *,
        child:orphan_children!child_id ( first_name ),
        sponsor:profiles!sponsor_id ( full_name )
        `,
      )
      .eq("sponsor_id", user.id)
      .order("started_at", { ascending: false })

    if (error || !data) return []
    return (data as SponsorshipRow[]).map(rowToSponsorship)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[orphans] sponsorships:", err)
    return []
  }
}

export async function getReportsByChild(childId: string): Promise<OrphanReport[]> {
  if (!childId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orphan_reports")
      .select(
        `id, child_id, sponsor_id, period, education_progress,
         health_status, highlights, photos_count, sent_at,
         child:orphan_children!child_id ( first_name )`,
      )
      .eq("child_id", childId)
      .order("sent_at", { ascending: false })
    if (error || !data) return []
    return (data as ReportRow[]).map(rowToReport)
  } catch {
    return []
  }
}

export async function getMyReports(): Promise<OrphanReport[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("orphan_reports")
      .select(
        `id, child_id, sponsor_id, period, education_progress,
         health_status, highlights, photos_count, sent_at,
         child:orphan_children!child_id ( first_name )`,
      )
      .eq("sponsor_id", user.id)
      .order("sent_at", { ascending: false })
    if (error || !data) return []
    return (data as ReportRow[]).map(rowToReport)
  } catch {
    return []
  }
}

// ─── Stats ───────────────────────────────────────────────────

export interface OrphansStats {
  total_children: number
  sponsored: number
  partial: number
  needs_sponsor: number
  sponsors_count: number
  total_donated: number
}

export async function getOrphansStats(): Promise<OrphansStats> {
  const empty: OrphansStats = {
    total_children: 0,
    sponsored: 0,
    partial: 0,
    needs_sponsor: 0,
    sponsors_count: 0,
    total_donated: 0,
  }
  try {
    const supabase = createClient()
    const { data: children } = await supabase
      .from("orphan_children")
      .select("status")

    const { data: sponsorships } = await supabase
      .from("sponsorships")
      .select("sponsor_id, amount, status")
      .eq("status", "active")

    const stats = { ...empty }
    if (Array.isArray(children)) {
      for (const c of children as { status: string }[]) {
        stats.total_children++
        if (c.status === "fully_sponsored") stats.sponsored++
        else if (c.status === "partial") stats.partial++
        else stats.needs_sponsor++
      }
    }
    if (Array.isArray(sponsorships)) {
      const sponsorIds = new Set<string>()
      for (const s of sponsorships as { sponsor_id: string; amount: number | string }[]) {
        sponsorIds.add(s.sponsor_id)
        stats.total_donated += num(s.amount)
      }
      stats.sponsors_count = sponsorIds.size
    }
    return stats
  } catch {
    return empty
  }
}

// ─── Writes ──────────────────────────────────────────────────

export interface CreateSponsorshipInput {
  child_id: string
  type: SponsorshipType
  amount: number
  duration_months: number
  is_anonymous?: boolean
  receive_reports?: boolean
}

export interface SponsorshipResult {
  success: boolean
  sponsorship_id?: string
  reason?: "unauthenticated" | "missing_table" | "rls" | "invalid" | "unknown"
  error?: string
}

export async function createSponsorship(
  input: CreateSponsorshipInput,
): Promise<SponsorshipResult> {
  if (!input.child_id || input.amount <= 0 || input.duration_months <= 0) {
    return { success: false, reason: "invalid", error: "بيانات الكفالة ناقصة" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase
      .from("sponsorships")
      .insert({
        sponsor_id: user.id,
        child_id: input.child_id,
        type: input.type,
        amount: input.amount,
        duration_months: input.duration_months,
        is_anonymous: input.is_anonymous ?? false,
        receive_reports: input.receive_reports ?? true,
      })
      .select("id")
      .single()

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg))
        return { success: false, reason: "missing_table", error: msg }
      if (code === "42501" || /permission/i.test(msg))
        return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    return {
      success: true,
      sponsorship_id: (data as { id: string } | null)?.id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function cancelSponsorship(
  sponsorshipId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!sponsorshipId) return { success: false, error: "missing id" }
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("sponsorships")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason?.trim() || null,
      })
      .eq("id", sponsorshipId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
