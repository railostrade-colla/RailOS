"use client"

/**
 * Healthcare admin — DB-backed data layer (Phase 7).
 */

import { createClient } from "@/lib/supabase/client"
import type {
  HealthcareApplication,
  HealthcareCase,
  AppStatus,
  CaseStatus,
  DiseaseType,
} from "@/lib/mock-data/healthcare"

interface ProfileRef {
  full_name?: string | null
  username?: string | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

// ─── Reads ───────────────────────────────────────────────────

export async function getAllApplications(): Promise<HealthcareApplication[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("healthcare_applications")
      .select(
        `id, user_id, status, disease_type, diagnosis, doctor_name,
         hospital, total_cost, user_available, requested_amount,
         attachments, reviewed_by, reviewed_at, rejection_reason,
         admin_notes, submitted_at, created_at,
         user:profiles!user_id ( full_name, username )`,
      )
      .order("submitted_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      status: string
      disease_type: DiseaseType
      diagnosis: string
      doctor_name: string
      hospital: string
      total_cost: number | string
      user_available: number | string
      requested_amount: number | string
      attachments?: string[] | null
      reviewed_at?: string | null
      rejection_reason?: string | null
      submitted_at: string
      user?: ProfileRef | ProfileRef[] | null
    }

    return (data as Row[]).map((r): HealthcareApplication => {
      const u = unwrap(r.user)
      // DB has 4 statuses (incl. 'cancelled'); mock only has 3.
      // Map 'cancelled' → 'rejected' for display continuity.
      const status: AppStatus =
        r.status === "approved" ? "approved"
        : r.status === "rejected" || r.status === "cancelled" ? "rejected"
        : "pending"
      return {
        id: r.id,
        user_id: r.user_id,
        user_name: u?.full_name?.trim() || u?.username?.trim() || "—",
        status,
        disease_type: r.disease_type,
        diagnosis: r.diagnosis,
        doctor_name: r.doctor_name,
        hospital: r.hospital,
        total_cost: num(r.total_cost),
        user_available: num(r.user_available),
        requested_amount: num(r.requested_amount),
        attachments: r.attachments ?? [],
        reviewed_at: r.reviewed_at ?? undefined,
        rejection_reason: r.rejection_reason ?? undefined,
        submitted_at: r.submitted_at?.split("T")[0] ?? "—",
      }
    })
  } catch {
    return []
  }
}

export async function getAllCases(): Promise<HealthcareCase[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("healthcare_cases")
      .select(`*`)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      patient_display_name: string
      patient_age: number
      city: string
      disease_type: DiseaseType
      diagnosis: string
      hospital: string
      total_required: number | string
      amount_collected: number | string
      donors_count: number
      status: string
      is_anonymous: boolean
      story?: string | null
      treatment_plan?: string | null
      created_at: string
    }

    return (data as Row[]).map((c): HealthcareCase => {
      // DB has 'cancelled'; mock CaseStatus is 3 values — collapse.
      const status: CaseStatus =
        c.status === "completed" ? "completed"
        : c.status === "urgent" ? "urgent"
        : "active"
      return {
        id: c.id,
        patient_display_name: c.patient_display_name,
        patient_age: c.patient_age,
        city: c.city,
        disease_type: c.disease_type,
        diagnosis: c.diagnosis,
        hospital: c.hospital,
        total_required: num(c.total_required),
        amount_collected: num(c.amount_collected),
        donors_count: c.donors_count ?? 0,
        status,
        is_anonymous: c.is_anonymous,
        story: c.story ?? undefined,
        treatment_plan: c.treatment_plan ?? undefined,
        created_at: c.created_at?.split("T")[0] ?? "—",
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
  case_id?: string
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
    const result = (data ?? {}) as { success?: boolean; error?: string; case_id?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return { success: true, case_id: result.case_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCreateHealthcareCase(input: {
  patient_display_name: string
  patient_age: number
  city: string
  disease_type: DiseaseType
  diagnosis: string
  hospital: string
  total_required: number
  is_urgent?: boolean
  is_anonymous?: boolean
  story?: string
  treatment_plan?: string
}): Promise<AdminRpcResult> {
  return callRpc("admin_create_healthcare_case", {
    p_patient_display_name: input.patient_display_name,
    p_patient_age: input.patient_age,
    p_city: input.city,
    p_disease_type: input.disease_type,
    p_diagnosis: input.diagnosis,
    p_hospital: input.hospital,
    p_total_required: input.total_required,
    p_is_urgent: input.is_urgent ?? false,
    p_is_anonymous: input.is_anonymous ?? true,
    p_story: input.story ?? null,
    p_treatment_plan: input.treatment_plan ?? null,
  })
}

export async function adminReviewApplication(
  applicationId: string,
  approve: boolean,
  notes?: string,
): Promise<AdminRpcResult> {
  return callRpc("admin_review_healthcare_application", {
    p_application_id: applicationId,
    p_approve: approve,
    p_notes: notes ?? null,
  })
}

export async function adminUpdateCaseProgress(
  caseId: string,
  newAmountCollected: number,
): Promise<AdminRpcResult> {
  return callRpc("admin_update_case_progress", {
    p_case_id: caseId,
    p_new_amount_collected: newAmountCollected,
  })
}

export async function adminMarkCaseCompleted(caseId: string): Promise<AdminRpcResult> {
  return callRpc("admin_mark_case_completed", { p_case_id: caseId })
}
