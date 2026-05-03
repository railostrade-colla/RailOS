"use client"

/**
 * Orphans admin — DB-backed data layer (Phase 7).
 */

import { createClient } from "@/lib/supabase/client"
import type {
  OrphanChild,
  ChildSponsorshipStatus,
  EducationLevel,
} from "@/lib/mock-data/orphans"

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

// ─── Reads ───────────────────────────────────────────────────

export async function getAllChildren(): Promise<OrphanChild[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orphan_children")
      .select(`*`)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      first_name: string
      age: number
      gender: "male" | "female"
      city: string
      story?: string | null
      needs_amount_monthly: number | string
      sponsored_amount: number | string
      sponsors_count: number
      status: ChildSponsorshipStatus
      blur_photo: boolean
      photo_url?: string | null
      education_level: EducationLevel
      health_status: "good" | "monitoring" | "needs_care"
    }

    return (data as Row[]).map((c) => ({
      id: c.id,
      first_name: c.first_name,
      age: c.age,
      gender: c.gender,
      city: c.city,
      story: c.story ?? "",
      needs_amount_monthly: num(c.needs_amount_monthly),
      sponsored_amount: num(c.sponsored_amount),
      sponsors_count: c.sponsors_count,
      status: c.status,
      blur_photo: c.blur_photo,
      photo_url: c.photo_url ?? "",
      education_level: c.education_level,
      health_status: c.health_status,
    }))
  } catch {
    return []
  }
}

export interface AdminSponsorshipRow {
  id: string
  sponsor_id: string
  sponsor_name: string
  child_id: string
  child_name: string
  amount: number
  type: string
  status: string
  started_at: string
}

export async function getAllSponsorships(): Promise<AdminSponsorshipRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("sponsorships")
      .select(
        `id, sponsor_id, child_id, type, amount, status, started_at,
         sponsor:profiles!sponsor_id ( full_name, username ),
         child:orphan_children!child_id ( first_name )`,
      )
      .order("started_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      sponsor_id: string
      child_id: string
      type: string
      amount: number | string
      status: string
      started_at: string
      sponsor?: { full_name?: string | null; username?: string | null } | { full_name?: string | null; username?: string | null }[] | null
      child?: { first_name?: string | null } | { first_name?: string | null }[] | null
    }

    function unwrap<T>(v: T | T[] | null | undefined): T | null {
      if (!v) return null
      return Array.isArray(v) ? v[0] ?? null : v
    }

    return (data as Row[]).map((s) => {
      const sp = unwrap(s.sponsor)
      const ch = unwrap(s.child)
      return {
        id: s.id,
        sponsor_id: s.sponsor_id,
        sponsor_name: sp?.full_name?.trim() || sp?.username?.trim() || "—",
        child_id: s.child_id,
        child_name: ch?.first_name ?? "—",
        amount: num(s.amount),
        type: s.type,
        status: s.status,
        started_at: s.started_at?.split("T")[0] ?? "—",
      }
    })
  } catch {
    return []
  }
}

export interface AdminOrphanReportRow {
  id: string
  child_id: string
  child_name: string
  period: string
  highlights: string
  sent_at: string
}

export async function getAllReports(): Promise<AdminOrphanReportRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orphan_reports")
      .select(
        `id, child_id, period, highlights, sent_at,
         child:orphan_children!child_id ( first_name )`,
      )
      .order("sent_at", { ascending: false })
      .limit(100)

    if (error || !data) return []

    interface Row {
      id: string
      child_id: string
      period: string
      highlights?: string | null
      sent_at: string
      child?: { first_name?: string | null } | { first_name?: string | null }[] | null
    }

    function unwrap<T>(v: T | T[] | null | undefined): T | null {
      if (!v) return null
      return Array.isArray(v) ? v[0] ?? null : v
    }

    return (data as Row[]).map((r) => {
      const ch = unwrap(r.child)
      return {
        id: r.id,
        child_id: r.child_id,
        child_name: ch?.first_name ?? "—",
        period: r.period,
        highlights: r.highlights ?? "",
        sent_at: r.sent_at?.split("T")[0] ?? "—",
      }
    })
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
  child_id?: string
  recipients?: number
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<AdminRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" ||
          /function .* does not exist/i.test(msg) ||
          /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string; child_id?: string; recipients?: number }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return {
      success: true,
      child_id: result.child_id,
      recipients: result.recipients,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCreateOrphanChild(input: {
  first_name: string
  age: number
  gender: "male" | "female"
  city: string
  education_level: EducationLevel
  needs_amount_monthly: number
  story?: string
  health_status?: "good" | "monitoring" | "needs_care"
  blur_photo?: boolean
}): Promise<AdminRpcResult> {
  return callRpc("admin_create_orphan_child", {
    p_first_name: input.first_name,
    p_age: input.age,
    p_gender: input.gender,
    p_city: input.city,
    p_education_level: input.education_level,
    p_needs_amount_monthly: input.needs_amount_monthly,
    p_story: input.story ?? null,
    p_health_status: input.health_status ?? "good",
    p_blur_photo: input.blur_photo ?? true,
  })
}

export async function adminRemoveOrphanChild(childId: string): Promise<AdminRpcResult> {
  return callRpc("admin_remove_orphan_child", { p_child_id: childId })
}

export async function adminSendOrphanReport(input: {
  child_id: string
  period: string
  highlights?: string
  education_progress?: string
  health_status?: string
  photos_count?: number
}): Promise<AdminRpcResult> {
  return callRpc("admin_send_orphan_report", {
    p_child_id: input.child_id,
    p_period: input.period,
    p_highlights: input.highlights ?? null,
    p_education_progress: input.education_progress ?? null,
    p_health_status: input.health_status ?? null,
    p_photos_count: input.photos_count ?? 0,
  })
}
