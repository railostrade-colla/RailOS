"use client"

/**
 * Healthcare program — DB-backed data layer (Phase 6.1).
 *
 * Wraps healthcare_cases, healthcare_applications,
 * insurance_subscriptions, healthcare_donations tables
 * (20260503_phase6_healthcare_schema.sql). Mirrors the
 * @/lib/mock-data/healthcare types so pages can swap directly.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  HealthcareCase,
  HealthcareApplication,
  InsuranceSubscription,
  HealthcareDonation,
  CaseStatus,
  AppStatus,
  DiseaseType,
  InsurancePlan,
  InsuranceStatus,
} from "@/lib/mock-data/healthcare"

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function asDisease(s: string): DiseaseType {
  const all = ["cancer", "heart", "kidney", "neurological", "pediatric", "transplant", "other"]
  return (all.includes(s) ? s : "other") as DiseaseType
}

function asCaseStatus(s: string): CaseStatus {
  if (s === "urgent" || s === "active" || s === "completed") return s
  return "active"
}

function asAppStatus(s: string): AppStatus {
  if (s === "approved" || s === "rejected") return s
  return "pending"
}

function asPlan(s: string): InsurancePlan {
  if (s === "advanced" || s === "comprehensive") return s
  return "basic"
}

function asInsStatus(s: string): InsuranceStatus {
  if (s === "paused" || s === "cancelled") return s
  return "active"
}

// ─── Cases ───────────────────────────────────────────────────

interface CaseRow {
  id: string
  patient_display_name: string
  patient_age: number
  city: string
  disease_type: string
  diagnosis: string
  hospital: string
  total_required: number | string
  amount_collected: number | string
  donors_count: number
  status: string
  is_anonymous: boolean
  story: string | null
  treatment_plan: string | null
  created_at: string
}

function rowToCase(r: CaseRow): HealthcareCase {
  return {
    id: r.id,
    patient_display_name: r.patient_display_name,
    patient_age: r.patient_age,
    city: r.city,
    disease_type: asDisease(r.disease_type),
    diagnosis: r.diagnosis,
    hospital: r.hospital,
    total_required: num(r.total_required),
    amount_collected: num(r.amount_collected),
    donors_count: r.donors_count,
    status: asCaseStatus(r.status),
    is_anonymous: r.is_anonymous,
    created_at: r.created_at?.slice(0, 10) ?? "",
    story: r.story ?? undefined,
    treatment_plan: r.treatment_plan ?? undefined,
  }
}

export async function getHealthcareCases(): Promise<HealthcareCase[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("healthcare_cases")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return (data as CaseRow[]).map(rowToCase)
  } catch {
    return []
  }
}

export async function getHealthcareCaseById(
  id: string,
): Promise<HealthcareCase | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("healthcare_cases")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return rowToCase(data as CaseRow)
  } catch {
    return null
  }
}

// ─── Applications ────────────────────────────────────────────

interface AppRow {
  id: string
  user_id: string
  status: string
  disease_type: string
  diagnosis: string
  doctor_name: string
  hospital: string
  total_cost: number | string
  user_available: number | string
  requested_amount: number | string
  attachments: string[] | null
  submitted_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  profile?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function rowToApp(r: AppRow): HealthcareApplication {
  const profile = unwrap(r.profile)
  return {
    id: r.id,
    user_id: r.user_id,
    user_name:
      profile?.full_name?.trim() ||
      profile?.username?.trim() ||
      "—",
    status: asAppStatus(r.status),
    disease_type: asDisease(r.disease_type),
    diagnosis: r.diagnosis,
    doctor_name: r.doctor_name,
    hospital: r.hospital,
    total_cost: num(r.total_cost),
    user_available: num(r.user_available),
    requested_amount: num(r.requested_amount),
    attachments: Array.isArray(r.attachments)
      ? r.attachments.filter((s): s is string => typeof s === "string")
      : [],
    submitted_at: r.submitted_at?.slice(0, 10) ?? "",
    reviewed_at: r.reviewed_at?.slice(0, 10) ?? undefined,
    rejection_reason: r.rejection_reason ?? undefined,
  }
}

export async function getMyHealthcareApplications(): Promise<HealthcareApplication[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from("healthcare_applications")
      .select(`*, profile:profiles!user_id ( full_name, username )`)
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
    if (error || !data) return []
    return (data as AppRow[]).map(rowToApp)
  } catch {
    return []
  }
}

export interface SubmitApplicationInput {
  disease_type: DiseaseType
  diagnosis: string
  doctor_name: string
  hospital: string
  total_cost: number
  user_available: number
  requested_amount: number
  attachments?: string[]
}

export interface SubmitApplicationResult {
  success: boolean
  application_id?: string
  reason?: "unauthenticated" | "missing_table" | "rls" | "invalid" | "unknown"
  error?: string
}

export async function submitHealthcareApplication(
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  if (
    !input.diagnosis?.trim() ||
    !input.doctor_name?.trim() ||
    !input.hospital?.trim() ||
    input.total_cost <= 0 ||
    input.requested_amount <= 0
  ) {
    return { success: false, reason: "invalid", error: "البيانات ناقصة" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }
    const { data, error } = await supabase
      .from("healthcare_applications")
      .insert({
        user_id: user.id,
        disease_type: input.disease_type,
        diagnosis: input.diagnosis.trim(),
        doctor_name: input.doctor_name.trim(),
        hospital: input.hospital.trim(),
        total_cost: input.total_cost,
        user_available: input.user_available,
        requested_amount: input.requested_amount,
        attachments: input.attachments ?? [],
      })
      .select("id")
      .single()
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42P01") return { success: false, reason: "missing_table", error: msg }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    return {
      success: true,
      application_id: (data as { id: string } | null)?.id,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Insurance ───────────────────────────────────────────────

interface InsRow {
  id: string
  user_id: string
  plan: string
  monthly_fee: number | string
  annual_limit: number | string
  status: string
  started_at: string
  next_billing: string
}

function rowToInsurance(r: InsRow): InsuranceSubscription {
  return {
    id: r.id,
    user_id: r.user_id,
    plan: asPlan(r.plan),
    monthly_fee: num(r.monthly_fee),
    annual_limit: num(r.annual_limit),
    started_at: r.started_at?.slice(0, 10) ?? "",
    next_billing: r.next_billing?.slice(0, 10) ?? "",
    status: asInsStatus(r.status),
  }
}

export async function getMyInsurance(): Promise<InsuranceSubscription | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from("insurance_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
    if (error || !data) return null
    return rowToInsurance(data as InsRow)
  } catch {
    return null
  }
}

export interface SubscribeInsuranceInput {
  plan: InsurancePlan
  monthly_fee: number
  annual_limit: number
}

export async function subscribeInsurance(
  input: SubscribeInsuranceInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }
    const { error } = await supabase
      .from("insurance_subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: input.plan,
          monthly_fee: input.monthly_fee,
          annual_limit: input.annual_limit,
          status: "active",
          started_at: new Date().toISOString(),
          next_billing: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          cancelled_at: null,
        },
        { onConflict: "user_id" },
      )
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function cancelInsurance(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }
    const { error } = await supabase
      .from("insurance_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Donations ───────────────────────────────────────────────

export interface DonateInput {
  case_id?: string
  amount: number
  is_anonymous?: boolean
  is_recurring?: boolean
  notes?: string
}

export async function donateHealthcare(
  input: DonateInput,
): Promise<{ success: boolean; donation_id?: string; error?: string }> {
  if (!input.amount || input.amount <= 0)
    return { success: false, error: "مبلغ غير صحيح" }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }
    const { data, error } = await supabase
      .from("healthcare_donations")
      .insert({
        donor_id: user.id,
        case_id: input.case_id ?? null,
        amount: input.amount,
        is_anonymous: input.is_anonymous ?? false,
        is_recurring: input.is_recurring ?? false,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single()
    if (error) return { success: false, error: error.message }
    return {
      success: true,
      donation_id: (data as { id: string } | null)?.id,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

interface DonationRow {
  id: string
  donor_id: string
  case_id: string | null
  amount: number | string
  is_anonymous: boolean
  is_recurring: boolean
  created_at: string
  donor?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
}

function rowToDonation(r: DonationRow): HealthcareDonation {
  const donor = unwrap(r.donor)
  return {
    id: r.id,
    donor_id: r.donor_id,
    donor_name: r.is_anonymous
      ? "متبرّع كريم"
      : donor?.full_name?.trim() || donor?.username?.trim() || "—",
    case_id: r.case_id ?? undefined,
    amount: num(r.amount),
    is_anonymous: r.is_anonymous,
    is_recurring: r.is_recurring,
    created_at: r.created_at?.slice(0, 10) ?? "",
  }
}

export async function getDonationsForCase(
  caseId: string,
  limit: number = 50,
): Promise<HealthcareDonation[]> {
  if (!caseId) return []
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("healthcare_donations")
      .select(`*, donor:profiles!donor_id ( full_name, username )`)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as DonationRow[]).map(rowToDonation)
  } catch {
    return []
  }
}

// ─── Stats ───────────────────────────────────────────────────

export interface HealthcareStats {
  total_cases: number
  urgent_cases: number
  active_cases: number
  completed_cases: number
  total_collected: number
  total_donors: number
}

export async function getHealthcareStats(): Promise<HealthcareStats> {
  const empty: HealthcareStats = {
    total_cases: 0,
    urgent_cases: 0,
    active_cases: 0,
    completed_cases: 0,
    total_collected: 0,
    total_donors: 0,
  }
  try {
    const supabase = createClient()
    const { data: cases } = await supabase
      .from("healthcare_cases")
      .select("status, amount_collected, donors_count")
    if (!Array.isArray(cases)) return empty
    const stats = { ...empty }
    const donorIds = new Set<number>()
    for (const c of cases as { status: string; amount_collected: number | string; donors_count: number }[]) {
      stats.total_cases++
      if (c.status === "urgent") stats.urgent_cases++
      else if (c.status === "active") stats.active_cases++
      else if (c.status === "completed") stats.completed_cases++
      stats.total_collected += num(c.amount_collected)
      // donors_count is not deduplicated across cases; use approximate sum.
      stats.total_donors += c.donors_count ?? 0
      donorIds.add(stats.total_donors)
    }
    return stats
  } catch {
    return empty
  }
}
