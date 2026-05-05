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
 * Loads KYC submissions newest-first. Admins see all rows.
 *
 * Phase 10.60: prefers `get_kyc_submissions_admin` RPC (SECURITY
 * DEFINER, returns user email from auth.users + profile name).
 * Falls back to the direct table read for older databases.
 */
export async function getKycSubmissions(
  limit: number = 200,
): Promise<KycSubmission[]> {
  const supabase = createClient()

  // ─── Preferred path: SECURITY DEFINER RPC ────────────────────
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "get_kyc_submissions_admin",
      { p_limit: limit },
    )
    if (!rpcErr && Array.isArray(rpcData)) {
      interface RpcRow {
        id: string
        user_id: string | null
        full_name: string | null
        date_of_birth: string | null
        city: string | null
        document_type: string | null
        document_front_url: string | null
        document_back_url: string | null
        selfie_url: string | null
        status: string | null
        review_notes: string | null
        submitted_at: string | null
        profile_name?: string | null
        profile_username?: string | null
        user_email?: string | null
      }
      return (rpcData as RpcRow[]).map((r) => ({
        id: r.id,
        user_id: r.user_id ?? "",
        user_name:
          r.full_name?.trim() ||
          r.profile_name?.trim() ||
          r.profile_username?.trim() ||
          "—",
        user_email:
          r.user_email?.trim() ||
          (r.profile_username ? `@${r.profile_username}` : "—"),
        birth_date: r.date_of_birth ?? "",
        city: r.city ?? "",
        document_type: mapDocType(r.document_type),
        front_url: r.document_front_url ?? "",
        back_url: r.document_back_url ?? "",
        selfie_url: r.selfie_url ?? "",
        status: mapStatus(r.status),
        rejection_reason: r.review_notes ?? undefined,
        submitted_at: (r.submitted_at ?? "").slice(0, 10) || "—",
      }))
    }
    if (rpcErr) {
      // eslint-disable-next-line no-console
      console.warn("[kyc-admin] get_kyc_submissions_admin RPC:", rpcErr.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[kyc-admin] RPC threw, falling back:", err)
  }

  // ─── Fallback: direct table read ─────────────────────────────
  try {
    const { data, error } = await supabase
      .from("kyc_submissions")
      .select(
        `id, user_id, full_name, date_of_birth, city,
         document_type, document_number,
         document_front_url, document_back_url, selfie_url,
         status, review_notes, submitted_at`,
      )
      .order("submitted_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[kyc-admin] getKycSubmissions:", error.message)
      return []
    }

    const { fetchProfilesByIds } = await import("./admin-join-helper")
    const profileMap = await fetchProfilesByIds(
      data.map((r) => (r as { user_id: string | null }).user_id),
      supabase,
    )

    return (data as KycRow[]).map((r) => {
      const profile = r.user_id ? profileMap.get(r.user_id) ?? null : null
      const userName =
        r.full_name?.trim() ||
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "—"
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

    // Phase 10.65 — preferred path: SECURITY DEFINER RPCs that
    // bypass RLS and never hit the "Cannot coerce" PostgREST quirk
    // when the UPDATE-then-SELECT chain returns 0 rows.
    const rpcName = params.decision === "approved"
      ? "admin_approve_kyc"
      : "admin_reject_kyc"
    const rpcArgs = params.decision === "approved"
      ? { p_submission_id: params.submissionId }
      : { p_submission_id: params.submissionId, p_reason: params.reason ?? "—" }

    try {
      const { data, error } = await supabase.rpc(rpcName, rpcArgs)
      if (!error && data) {
        const r = data as { success?: boolean; error?: string }
        if (r.success) return { success: true }
        if (r.error) {
          const map: Record<string, ReviewKycResult["reason"]> = {
            unauthenticated: "unauthenticated",
            not_admin: "rls",
            reason_required: "unknown",
            not_found: "unknown",
          }
          return {
            success: false,
            reason: map[r.error] ?? "unknown",
            error: r.error,
          }
        }
      }
      // RPC errored or returned null — fall through to legacy path
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[kyc-admin] RPC failed, trying legacy path:", error.message)
      }
    } catch (rpcErr) {
      // eslint-disable-next-line no-console
      console.warn("[kyc-admin] RPC threw, trying legacy path:", rpcErr)
    }

    // ─── Legacy fallback path (direct table write) ──────────────
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    // Use maybeSingle() so 0-row results return null instead of
    // throwing "Cannot coerce the result to a single JSON object".
    const { data: rows, error: subErr } = await supabase
      .from("kyc_submissions")
      .update({
        status: params.decision,
        review_notes: params.reason ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", params.submissionId)
      .select("user_id")

    if (subErr) {
      const code = subErr.code ?? ""
      const msg = subErr.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      return { success: false, reason: "unknown", error: msg }
    }

    const updatedRows = (rows ?? []) as Array<{ user_id: string }>
    if (updatedRows.length === 0) {
      return {
        success: false,
        reason: "rls",
        error: "0 rows updated — RLS blocked or submission missing",
      }
    }

    const userId = updatedRows[0].user_id
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
