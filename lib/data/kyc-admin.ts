"use client"

/**
 * Admin-side KYC data layer (Phase Z).
 *
 * Wraps `kyc_submissions` from `01_users.sql`. Read-side joins with
 * profiles for the reviewer-friendly user_name + auth.users for the
 * email (via service role isn't possible from a client component, so
 * email falls back to profile.username when the JOIN doesn't return it).
 *
 * RLS is enforced server-side: the new admin SELECT/UPDATE policies
 * (Phase Z migration) require public.is_admin(). Non-admins get an
 * empty array / 42501 errors back — same surface as missing tables.
 */

import { createClient } from "@/lib/supabase/client"
import type { KycSubmission } from "@/lib/mock-data/kyc"

interface KycRow {
  id: string
  user_id: string | null
  full_name: string | null
  date_of_birth: string | null
  city: string | null
  document_type: string | null
  document_number: string | null
  document_front_url: string | null
  document_back_url: string | null
  selfie_url: string | null
  status: string | null
  review_notes: string | null
  submitted_at: string | null
  profile?:
    | { full_name?: string | null; username?: string | null }
    | { full_name?: string | null; username?: string | null }[]
    | null
}

/** Map DB kyc_status → mock KycSubmission["status"]. */
function mapStatus(s: string | null): KycSubmission["status"] {
  if (s === "approved") return "verified"
  if (s === "rejected") return "rejected"
  if (s === "pending") return "pending"
  // 'not_submitted' shouldn't appear in this table (rows only exist
  // when the user has submitted) — treat anything else as pending.
  return "pending"
}

/**
 * Map DB id_document_type → admin-side KycDocumentType.
 *
 * The two enums diverged: DB has `driver_license` while the admin-
 * panel mock has `residency`. Until they're reconciled (separate
 * migration), we collapse `driver_license` to `national_id` so the
 * KYC_DOC_TYPE_LABELS lookup always finds a key. Worst case the
 * admin sees "بطاقة وطنية" instead of "رخصة قيادة" — better than
 * the table cell rendering as undefined.
 */
function mapDocType(s: string | null): KycSubmission["document_type"] {
  if (s === "passport") return "passport"
  if (s === "national_id") return "national_id"
  // driver_license + anything else → fallback to national_id.
  return "national_id"
}

function unwrapProfile(
  v: KycRow["profile"],
): { full_name?: string | null; username?: string | null } | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

/**
 * Loads KYC submissions newest-first. Admins see all rows; everyone
 * else gets an empty array (RLS).
 */
export async function getKycSubmissions(
  limit: number = 200,
): Promise<KycSubmission[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("kyc_submissions")
      .select(
        `
        id, user_id, full_name, date_of_birth, city,
        document_type, document_number,
        document_front_url, document_back_url, selfie_url,
        status, review_notes, submitted_at,
        profile:profiles!user_id ( full_name, username )
        `,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[kyc-admin] getKycSubmissions:", error.message)
      return []
    }

    return (data as KycRow[]).map((r) => {
      const profile = unwrapProfile(r.profile)
      const userName =
        r.full_name?.trim() ||
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "—"
      // We don't have email from the client (it's on auth.users, not
      // profiles). Use the username when present so the admin still
      // has a stable handle to copy.
      const handle = profile?.username?.trim() || ""
      return {
        id: r.id,
        user_id: r.user_id ?? "",
        user_name: userName,
        user_email: handle ? `@${handle}` : "—",
        birth_date: r.date_of_birth ?? "",
        city: r.city ?? "",
        document_type: mapDocType(r.document_type),
        front_url: r.document_front_url ?? "",
        back_url: r.document_back_url ?? "",
        selfie_url: r.selfie_url ?? "",
        status: mapStatus(r.status),
        rejection_reason: r.review_notes ?? undefined,
        submitted_at: (r.submitted_at ?? "").slice(0, 10) || "—",
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[kyc-admin] getKycSubmissions threw:", err)
    return []
  }
}

export interface ReviewKycResult {
  success: boolean
  reason?: "unauthenticated" | "rls" | "missing_table" | "unknown"
  error?: string
}

/**
 * Approves a KYC submission. Updates `status='approved'`, records
 * the reviewer, and bumps the user's profiles.kyc_status so the
 * rest of the app sees verified-state immediately.
 *
 * Best-effort on the profiles update — if it fails (RLS quirk on
 * cross-row updates) the kyc_submissions row is still authoritative
 * and the trg_notify_kyc_status trigger will fire its notification.
 */
export async function approveKyc(submissionId: string): Promise<ReviewKycResult> {
  return reviewKyc({ submissionId, decision: "approved" })
}

export async function rejectKyc(
  submissionId: string,
  reason: string,
): Promise<ReviewKycResult> {
  if (!reason.trim()) {
    return { success: false, reason: "unknown", error: "اكتب سبب الرفض" }
  }
  return reviewKyc({ submissionId, decision: "rejected", reason })
}

async function reviewKyc(params: {
  submissionId: string
  decision: "approved" | "rejected"
  reason?: string
}): Promise<ReviewKycResult> {
  if (!params.submissionId) {
    return { success: false, reason: "unknown", error: "submissionId missing" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    // Update the submission row first — gated by the Phase-Z admin
    // policy, so non-admins fail fast.
    const { data: row, error: subErr } = await supabase
      .from("kyc_submissions")
      .update({
        status: params.decision,
        review_notes: params.reason ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", params.submissionId)
      .select("user_id")
      .single()

    if (subErr || !row) {
      const code = subErr?.code ?? ""
      const msg = subErr?.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[kyc-admin] reviewKyc submission:", msg)
      return { success: false, reason: "unknown", error: msg }
    }

    // Best-effort: mirror to profiles.kyc_status so the user sees
    // the verified badge on the next render. The submission row is
    // authoritative; if this update fails (RLS, etc.) the trigger
    // from 20260502_phase2_kyc_triggers.sql still fires its
    // notification, and the source-of-truth is consistent.
    const userId = (row as { user_id: string }).user_id
    if (userId) {
      try {
        await supabase
          .from("profiles")
          .update({ kyc_status: params.decision })
          .eq("id", userId)
      } catch {
        /* non-fatal */
      }
    }

    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[kyc-admin] reviewKyc threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
