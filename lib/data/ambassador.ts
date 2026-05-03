"use client"

/**
 * Ambassador (user-side) data layer (Phase A1).
 *
 * Wraps the `ambassadors` table from `supabase/04_ambassadors.sql`.
 *
 * Status mapping — the DB enum and the UI's status are NOT identical.
 * The page UI distinguishes 5 states; the DB has 4 + "no row" implicit:
 *
 *   no row in `ambassadors`              → UI "none"
 *   ambassadors.application_status=pending  → UI "pending"
 *   ambassadors.application_status=approved → UI "approved"
 *   ambassadors.application_status=rejected → UI "rejected"
 *   ambassadors.application_status=revoked  → UI "suspended"
 *
 * The DB schema also doesn't have dedicated columns for `follower_range`
 * or `expected_referrals` — we stash them inside the `social_media_links`
 * JSONB column alongside the actual links:
 *
 *   social_media_links = {
 *     links:              [ { platform, url }, ... ],
 *     follower_range:     "1k-10k",
 *     expected_referrals: "5-20"
 *   }
 *
 * The admin UI reads the same column.
 */

import { createClient } from "@/lib/supabase/client"

// ─── Public shapes (mirror the legacy mock so JSX stays unchanged) ──

export type CurrentAmbassadorStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"

export interface AmbassadorApplicationData {
  reason: string
  experience: string
  social_links: { platform: string; url: string }[]
  follower_range: "<1k" | "1k-10k" | "10k-100k" | ">100k"
  expected_referrals: "1-5" | "5-20" | "20-50" | ">50"
  /** ISO date — display-friendly. */
  submitted_at: string
  rejection_reason?: string
}

export interface CurrentUserAmbassadorState {
  is_ambassador: boolean
  status: CurrentAmbassadorStatus
  application: AmbassadorApplicationData | null
}

export interface SubmitApplicationInput {
  reason: string
  experience: string
  social_links: { platform: string; url: string }[]
  follower_range: AmbassadorApplicationData["follower_range"]
  expected_referrals: AmbassadorApplicationData["expected_referrals"]
}

export interface SubmitApplicationResult {
  success: boolean
  application_id?: string
  status?: "pending"
  estimated_review_days?: number
  error?: string
}

export interface CancelApplicationResult {
  success: boolean
  error?: string
}

// ─── DB → UI status mapping ──────────────────────────────

type DbStatus = "pending" | "approved" | "rejected" | "revoked"

function dbStatusToUi(s: DbStatus): CurrentAmbassadorStatus {
  if (s === "revoked") return "suspended"
  return s
}

interface AmbassadorRow {
  id: string
  user_id: string
  application_status: DbStatus
  is_active: boolean
  application_reason: string | null
  application_experience: string | null
  social_media_links: unknown
  revoke_reason: string | null
  applied_at: string
  // Some deployments may also store a rejection reason in admin_notes
  // — we don't depend on it but expose it through revoke_reason fallback.
  admin_notes: string | null
}

/** Pull the structured fields out of the JSONB blob safely. */
function parseSocialBlob(raw: unknown): {
  links: { platform: string; url: string }[]
  follower_range: AmbassadorApplicationData["follower_range"]
  expected_referrals: AmbassadorApplicationData["expected_referrals"]
} {
  const fallback = {
    links: [] as { platform: string; url: string }[],
    follower_range: "<1k" as const,
    expected_referrals: "1-5" as const,
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback

  const obj = raw as Record<string, unknown>
  const linksRaw = obj.links
  const links = Array.isArray(linksRaw)
    ? linksRaw
        .filter(
          (x): x is { platform: string; url: string } =>
            !!x &&
            typeof x === "object" &&
            typeof (x as { platform?: unknown }).platform === "string" &&
            typeof (x as { url?: unknown }).url === "string",
        )
        .map((x) => ({ platform: x.platform, url: x.url }))
    : []

  const fr = obj.follower_range
  const er = obj.expected_referrals
  return {
    links,
    follower_range:
      fr === "<1k" ||
      fr === "1k-10k" ||
      fr === "10k-100k" ||
      fr === ">100k"
        ? fr
        : "<1k",
    expected_referrals:
      er === "1-5" || er === "5-20" || er === "20-50" || er === ">50"
        ? er
        : "1-5",
  }
}

// ─── Reads ───────────────────────────────────────────────

/**
 * Returns the current user's ambassador state. Resilient: missing row,
 * unauthenticated user, or RLS quirks all fall back to "none".
 */
export async function getMyAmbassadorStatus(): Promise<CurrentUserAmbassadorState> {
  const empty: CurrentUserAmbassadorState = {
    is_ambassador: false,
    status: "none",
    application: null,
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return empty

    const { data, error } = await supabase
      .from("ambassadors")
      .select(
        "id, user_id, application_status, is_active, application_reason, application_experience, social_media_links, revoke_reason, admin_notes, applied_at",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !data) return empty

    const row = data as AmbassadorRow
    const uiStatus = dbStatusToUi(row.application_status)
    const blob = parseSocialBlob(row.social_media_links)

    const application: AmbassadorApplicationData = {
      reason: row.application_reason ?? "",
      experience: row.application_experience ?? "",
      social_links: blob.links,
      follower_range: blob.follower_range,
      expected_referrals: blob.expected_referrals,
      submitted_at: row.applied_at,
      rejection_reason:
        row.revoke_reason ?? row.admin_notes ?? undefined,
    }

    return {
      is_ambassador: row.is_active === true,
      status: uiStatus,
      application,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] getMyAmbassadorStatus threw:", err)
    return empty
  }
}

// ─── Writes ──────────────────────────────────────────────

/**
 * INSERT a new ambassador application. The DB column DEFAULT sets the
 * status to 'pending' automatically — we don't pass it explicitly to
 * play nicely with future enum changes.
 *
 * Idempotency: the table has a UNIQUE(user_id) constraint, so a second
 * call from the same user is rejected by the DB with a `23505` code —
 * we surface it as a friendly error.
 */
export async function submitAmbassadorApplication(
  input: SubmitApplicationInput,
): Promise<SubmitApplicationResult> {
  // Light client-side validation — server-side RLS + CHECKs are the real gate.
  if (!input.reason || input.reason.trim().length < 50) {
    return { success: false, error: "السبب قصير جداً" }
  }
  if (!input.experience || input.experience.trim().length < 50) {
    return { success: false, error: "الخبرة قصيرة جداً" }
  }
  if (!input.social_links || input.social_links.length < 1) {
    return { success: false, error: "أضف حساب تواصل اجتماعي واحد على الأقل" }
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }

    // Pack everything we need in JSONB so the column carries both links
    // AND the survey answers — no schema migration required.
    const social_media_links = {
      links: input.social_links.map((l) => ({
        platform: l.platform,
        url: l.url.trim(),
      })),
      follower_range: input.follower_range,
      expected_referrals: input.expected_referrals,
    }

    const { data, error } = await supabase
      .from("ambassadors")
      .insert({
        user_id: user.id,
        application_reason: input.reason.trim(),
        application_experience: input.experience.trim(),
        social_media_links,
        // application_status defaults to 'pending' in DB
        // is_active defaults to false in DB
      })
      .select("id")
      .single()

    if (error) {
      // 23505 = unique violation — user already has a row
      if (error.code === "23505") {
        return { success: false, error: "لديك طلب مقدّم بالفعل" }
      }
      // eslint-disable-next-line no-console
      console.error("[ambassador] insert error:", error.message)
      return {
        success: false,
        error: "تعذّر إرسال الطلب — حاول مرّة أخرى",
      }
    }

    return {
      success: true,
      application_id: (data as { id: string } | null)?.id,
      status: "pending",
      estimated_review_days: 5,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] submitAmbassadorApplication threw:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}

/**
 * Hard-delete a pending application. Rows with status 'approved' or
 * 'revoked' should NOT be deletable by the user — we filter on
 * application_status='pending' so the DELETE is a no-op for non-pending.
 */
export async function cancelAmbassadorApplication(): Promise<CancelApplicationResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "غير مسجَّل دخول" }

    const { error } = await supabase
      .from("ambassadors")
      .delete()
      .eq("user_id", user.id)
      .eq("application_status", "pending")

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[ambassador] cancel error:", error.message)
      return { success: false, error: "تعذّر إلغاء الطلب" }
    }

    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] cancelAmbassadorApplication threw:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}

// ─── Re-exported helper (still pure / no DB) ─────────────

/**
 * Estimate progress 0..1 of the review based on elapsed days.
 * Identical semantics to the previous mock so we can drop in.
 */
export function estimateReviewProgress(
  submittedAt: string,
  totalDays: number = 5,
): number {
  const submitted = new Date(submittedAt).getTime()
  if (Number.isNaN(submitted)) return 0
  const elapsed = (Date.now() - submitted) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(1, elapsed / totalDays))
}
