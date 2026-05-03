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

// ═══════════════════════════════════════════════════════════════
// Phase A2 — Approved-dashboard data (referral link, KPIs, lists)
// ═══════════════════════════════════════════════════════════════

/** Marketer card shape — what the ApprovedDashboard renders. */
export interface AmbassadorMarketerStats {
  referral_code: string
  referral_link: string
  total_clicks: number
  total_signups: number
  total_investors: number
  total_rewards_shares: number
}

/** Single referral row — what the "الإحالات" tab renders. */
export interface AmbassadorReferralRow {
  id: string
  name: string
  kyc_status: "verified" | "pending" | null
  status: "click" | "registered" | "invested"
  reward_given: boolean
  /** ISO date — display-friendly, the page just shows it as-is. */
  created_at: string
}

/** Single reward row — what the "المكافآت" tab renders. */
export interface AmbassadorRewardRow {
  id: string
  shares: number
  project_name: string
  status: "approved" | "pending"
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Build the public referral URL from a code. Uses NEXT_PUBLIC_APP_URL
 * (falls back to relative path so it still copies cleanly).
 */
function buildReferralUrl(code: string): string {
  if (!code) return ""
  const base = process.env.NEXT_PUBLIC_APP_URL || ""
  return `${base.replace(/\/+$/, "")}/r/${code}`
}

/**
 * Fetch the active referral_link for an ambassador. If none exists,
 * create one via the `generate_referral_code()` SQL function.
 *
 * Returns null on any failure — the dashboard then renders empty
 * code/link slots (we don't fail-open with a fake code).
 */
async function ensureReferralLink(
  supabase: ReturnType<typeof createClient>,
  ambassadorId: string,
): Promise<{ code: string; clicks: number; signups: number; conversions: number } | null> {
  // 1) Try to find an active link.
  const { data: existing } = await supabase
    .from("referral_links")
    .select("code, clicks_count, signups_count, conversions_count")
    .eq("ambassador_id", ambassadorId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const row = existing as {
      code: string
      clicks_count: number | null
      signups_count: number | null
      conversions_count: number | null
    }
    return {
      code: row.code,
      clicks: row.clicks_count ?? 0,
      signups: row.signups_count ?? 0,
      conversions: row.conversions_count ?? 0,
    }
  }

  // 2) Generate a fresh code via the DB function and insert a link.
  //    The function signature is: generate_referral_code() RETURNS TEXT
  const { data: codeData, error: rpcErr } = await supabase.rpc("generate_referral_code")
  if (rpcErr || !codeData) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] generate_referral_code rpc:", rpcErr?.message)
    return null
  }
  const code =
    typeof codeData === "string"
      ? codeData
      : Array.isArray(codeData) && typeof codeData[0] === "string"
        ? codeData[0]
        : ""
  if (!code) return null

  const { data: inserted, error: insErr } = await supabase
    .from("referral_links")
    .insert({ ambassador_id: ambassadorId, code })
    .select("code, clicks_count, signups_count, conversions_count")
    .single()

  if (insErr || !inserted) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] insert referral_link:", insErr?.message)
    return null
  }
  const row = inserted as {
    code: string
    clicks_count: number | null
    signups_count: number | null
    conversions_count: number | null
  }
  return {
    code: row.code,
    clicks: row.clicks_count ?? 0,
    signups: row.signups_count ?? 0,
    conversions: row.conversions_count ?? 0,
  }
}

// ─── Public reads ────────────────────────────────────────

/**
 * Marketer card stats — referral link/code + 4 counters.
 * Approved ambassadors with no active link will get one auto-created.
 *
 * Returns zero/empty card if the user isn't approved or anything fails.
 */
export async function getMyMarketerStats(): Promise<AmbassadorMarketerStats> {
  const empty: AmbassadorMarketerStats = {
    referral_code: "",
    referral_link: "",
    total_clicks: 0,
    total_signups: 0,
    total_investors: 0,
    total_rewards_shares: 0,
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return empty

    // Fetch the ambassador row first — we need its id for the link.
    const { data: amb, error: ambErr } = await supabase
      .from("ambassadors")
      .select(
        "id, application_status, is_active, successful_referrals, total_rewards_earned",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    if (ambErr || !amb) return empty

    const ambRow = amb as {
      id: string
      application_status: DbStatus
      is_active: boolean
      successful_referrals: number | null
      total_rewards_earned: number | null
    }

    if (ambRow.application_status !== "approved" || !ambRow.is_active) {
      return empty
    }

    // Ensure (or fetch) the referral link.
    const link = await ensureReferralLink(supabase, ambRow.id)
    if (!link) {
      // Still return KPIs — link section will just be empty.
      return {
        ...empty,
        total_investors: ambRow.successful_referrals ?? 0,
        total_rewards_shares: ambRow.total_rewards_earned ?? 0,
      }
    }

    return {
      referral_code: link.code,
      referral_link: buildReferralUrl(link.code),
      total_clicks: link.clicks,
      total_signups: link.signups,
      total_investors: ambRow.successful_referrals ?? 0,
      total_rewards_shares: Number(ambRow.total_rewards_earned ?? 0),
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] getMyMarketerStats threw:", err)
    return empty
  }
}

/**
 * The "الإحالات" tab — a list of users referred by the current ambassador.
 *
 * We join `referrals` with `profiles` (referred_user_id) for the name
 * and `kyc_status`. We also join `ambassador_rewards` to compute
 * `reward_given` (any reward row in status='granted').
 */
export async function getMyReferrals(): Promise<AmbassadorReferralRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data: amb } = await supabase
      .from("ambassadors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (!amb) return []
    const ambassadorId = (amb as { id: string }).id

    // Pull referrals + the referred user's profile + any granted reward.
    const { data, error } = await supabase
      .from("referrals")
      .select(
        `
        id,
        has_invested,
        created_at,
        profiles:referred_user_id ( full_name, username, kyc_status ),
        ambassador_rewards ( id, status )
        `,
      )
      .eq("ambassador_id", ambassadorId)
      .order("created_at", { ascending: false })

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.error("[ambassador] getMyReferrals:", error.message)
      return []
    }

    type Row = {
      id: string
      has_invested: boolean | null
      created_at: string
      profiles?:
        | { full_name?: string | null; username?: string | null; kyc_status?: string | null }
        | { full_name?: string | null; username?: string | null; kyc_status?: string | null }[]
        | null
      ambassador_rewards?: { id: string; status: string }[] | null
    }

    return (data as Row[]).map((r) => {
      const profile = Array.isArray(r.profiles)
        ? r.profiles[0]
        : r.profiles ?? null
      const name =
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "زائر مجهول"
      const kyc =
        profile?.kyc_status === "verified"
          ? "verified"
          : profile?.kyc_status === "pending"
            ? "pending"
            : null
      const rewards = Array.isArray(r.ambassador_rewards)
        ? r.ambassador_rewards
        : []
      const rewardGiven = rewards.some((rw) => rw.status === "granted")

      // Derive the "click | registered | invested" funnel state.
      // We don't track raw clicks here (those are aggregated on the link),
      // so any row in `referrals` is at minimum "registered".
      const status: AmbassadorReferralRow["status"] = r.has_invested
        ? "invested"
        : "registered"

      return {
        id: r.id,
        name,
        kyc_status: kyc as AmbassadorReferralRow["kyc_status"],
        status,
        reward_given: rewardGiven,
        created_at: (r.created_at ?? "").slice(0, 10),
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] getMyReferrals threw:", err)
    return []
  }
}

/**
 * The "المكافآت" tab — list of rewards earned by the current ambassador.
 *
 * `granted` and `pending` from the DB map to UI's `approved` and `pending`
 * respectively. `cancelled` rows are hidden.
 */
export async function getMyRewards(): Promise<AmbassadorRewardRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data: amb } = await supabase
      .from("ambassadors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (!amb) return []
    const ambassadorId = (amb as { id: string }).id

    const { data, error } = await supabase
      .from("ambassador_rewards")
      .select(
        `
        id,
        reward_shares,
        status,
        created_at,
        projects ( name )
        `,
      )
      .eq("ambassador_id", ambassadorId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.error("[ambassador] getMyRewards:", error.message)
      return []
    }

    type Row = {
      id: string
      reward_shares: number | string
      status: string
      created_at: string
      projects?: { name?: string | null } | { name?: string | null }[] | null
    }

    return (data as Row[]).map((r) => {
      const project = Array.isArray(r.projects)
        ? r.projects[0]
        : r.projects ?? null
      return {
        id: r.id,
        shares: Number(r.reward_shares) || 0,
        project_name: project?.name?.trim() || "—",
        status: r.status === "granted" ? "approved" : "pending",
        created_at: (r.created_at ?? "").slice(0, 10),
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassador] getMyRewards threw:", err)
    return []
  }
}
