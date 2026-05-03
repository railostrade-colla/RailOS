"use client"

/**
 * Real profile data layer for /profile page.
 *
 * Resilient composition (Phase 4.1 hot-fix):
 *   • Step 1 (REQUIRED) auth.users      → email
 *   • Step 2 (REQUIRED) profiles        → all primary fields
 *   • Step 3 (OPTIONAL) user_stats_view → level_name_ar, level_icon,
 *                                         level_color, success_rate
 *
 * Each step has its own try/catch so a missing/broken view (e.g. when
 * migration `10-levels-system.sql` hasn't been applied) cannot wipe
 * out the whole profile load. When `user_stats_view` is unavailable,
 * we fall back to the same constants the seed migration uses.
 *
 * Derived (computed here, not stored in DB):
 *   • is_verified         = kyc_status === 'approved'
 *   • trust_score         = round(rating_average * 20)   ⚠ TODO
 *                           (Phase 4.X: enrich with disputes/reports/age)
 *   • joined_year_month   = 'YYYY-MM' from created_at
 *
 * Phase 4.1 — Profile only. Portfolio numbers (totalValue, profit, ...)
 * still come from `lib/mock-data` until Phase 4.2.
 */

import { createClient } from "@/lib/supabase/client"

export type KycStatus = "not_submitted" | "pending" | "approved" | "rejected"

export interface CurrentUserProfile {
  /** auth.users.id (UUID) */
  id: string
  /** From auth.users — never stored on profiles */
  email: string

  // ─── profiles columns ─────────────────────────────────────
  full_name: string | null
  username: string | null
  phone: string | null
  avatar_url: string | null
  role: string
  kyc_status: KycStatus

  /** Derived: kyc_status === 'approved' */
  is_verified: boolean

  is_active: boolean
  is_banned: boolean

  // ─── Trading stats (profiles + user_stats_view) ───────────
  total_trades: number
  successful_trades: number
  /** Computed by user_stats_view; falls back to a manual divide. */
  success_rate: number
  rating_average: number
  rating_count: number
  total_trade_volume: number

  /** Derived: rating_average * 20 (5★ = 100). TODO: richer formula. */
  trust_score: number

  // ─── Level (prefers user_stats_view, falls back to constants) ─
  /** Raw level: basic | advanced | pro | elite */
  level: string
  /** Display name in Arabic — supports `elite` natively */
  level_label: string
  /** Emoji icon */
  level_icon: string
  /** Hex color */
  level_color: string

  // ─── Misc ─────────────────────────────────────────────────
  is_ambassador: boolean

  // ─── Time ─────────────────────────────────────────────────
  /** ISO timestamp of profile creation */
  created_at: string
  /** Display-friendly 'YYYY-MM' from created_at */
  joined_year_month: string
}

/**
 * Shape we expect from `profiles` (raw).
 *
 * Base columns (always present from `01_users.sql`):
 *   full_name, username, phone, avatar_url, role, kyc_status,
 *   is_active, is_banned, rating_average, rating_count,
 *   trades_completed, total_invested, is_ambassador, created_at
 *
 * Optional columns (present only when migration `10-levels-system.sql`
 * has been applied):
 *   total_trades, successful_trades, total_trade_volume, level, ...
 *
 * We mark the optional ones as `... | undefined` so destructuring stays
 * safe on databases that haven't been migrated yet.
 */
interface ProfileRow {
  // Base
  full_name?: string | null
  username?: string | null
  phone?: string | null
  avatar_url?: string | null
  role?: string
  kyc_status?: KycStatus
  is_active?: boolean
  is_banned?: boolean
  rating_average?: number | null
  rating_count?: number | null
  trades_completed?: number | null
  is_ambassador?: boolean | null
  created_at?: string

  // From migration 10 (may be undefined on un-migrated DBs)
  total_trades?: number | null
  successful_trades?: number | null
  total_trade_volume?: number | null
  level?: string | null
}

/** Subset of `user_stats_view` we read here. */
interface StatsRow {
  level: string | null
  level_name_ar: string | null
  level_icon: string | null
  level_color: string | null
  success_rate: number | null
}

/**
 * Static fallbacks for environments where `user_stats_view` isn't
 * available (e.g. fresh DB before migration 10 ran). Mirrors the
 * `level_settings` seed values.
 */
const FALLBACK_LEVEL_LABELS: Record<string, string> = {
  basic: "أساسي",
  advanced: "متقدّم",
  pro: "محترف",
  elite: "النخبة",
}
const FALLBACK_LEVEL_ICONS: Record<string, string> = {
  basic: "🌱",
  advanced: "⚡",
  pro: "💎",
  elite: "👑",
}
const FALLBACK_LEVEL_COLORS: Record<string, string> = {
  basic: "#60A5FA",
  advanced: "#4ADE80",
  pro: "#C084FC",
  elite: "#FBBF24",
}

function formatYearMonth(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${yyyy}-${mm}`
}

/**
 * Load the signed-in user's full profile, with optional stats view.
 *
 * Returns `null` only when:
 *   - no authenticated user
 *   - the profile row is missing (orphaned auth.user)
 *   - the profiles query itself errors
 *
 * Failures inside the OPTIONAL `user_stats_view` step never cause null —
 * they just trigger fallback values for level_label/icon/color and an
 * inline computation for success_rate.
 */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = createClient()

  // ── Step 1: auth user (REQUIRED) ──────────────────────────
  let userId: string
  let userEmail: string
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    userId = data.user.id
    userEmail = data.user.email ?? ""
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[profile] auth.getUser failed:", err)
    return null
  }

  // ── Step 2: profiles row (REQUIRED) ───────────────────────
  // Use `select("*")` so the query never fails on databases where
  // migration 10 hasn't been applied yet (those DBs lack columns
  // like total_trades / successful_trades / level). We treat every
  // migration-10 column as optional in `ProfileRow` and fall back
  // gracefully below.
  let profile: ProfileRow
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[profile] profiles query error:", error.message)
      return null
    }
    if (!data) {
      // eslint-disable-next-line no-console
      console.error("[profile] no profile row for user", userId)
      return null
    }
    profile = data as ProfileRow
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[profile] profiles query threw:", err)
    return null
  }

  // ── Step 3: user_stats_view (OPTIONAL) ────────────────────
  // Isolated from the main flow — failure here just triggers fallbacks.
  let stats: StatsRow | null = null
  try {
    const { data, error } = await supabase
      .from("user_stats_view")
      .select("level, level_name_ar, level_icon, level_color, success_rate")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[profile] user_stats_view unavailable, using fallbacks:",
        error.message,
      )
    } else if (data) {
      stats = data as StatsRow
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[profile] user_stats_view fetch threw, using fallbacks:", err)
  }

  // ── Step 4: merge with fallbacks for missing migration-10 columns ─
  const level = stats?.level ?? profile.level ?? "basic"
  const ratingAvg = Number(profile.rating_average ?? 0)
  // Prefer migration-10's total_trades; fall back to the base
  // trades_completed column when that migration hasn't run.
  const totalTrades = Number(
    profile.total_trades ?? profile.trades_completed ?? 0,
  )
  const successfulTrades = Number(profile.successful_trades ?? 0)
  const createdAt = profile.created_at ?? ""

  const successRate =
    stats?.success_rate != null
      ? Math.round(Number(stats.success_rate))
      : totalTrades > 0
        ? Math.round((successfulTrades / totalTrades) * 100)
        : 0

  return {
    id: userId,
    email: userEmail,
    full_name: profile.full_name ?? null,
    username: profile.username ?? null,
    phone: profile.phone ?? null,
    avatar_url: profile.avatar_url ?? null,
    role: profile.role ?? "user",
    kyc_status: (profile.kyc_status as KycStatus | undefined) ?? "not_submitted",
    is_verified: profile.kyc_status === "approved",
    is_active: profile.is_active ?? true,
    is_banned: profile.is_banned ?? false,
    total_trades: totalTrades,
    successful_trades: successfulTrades,
    success_rate: successRate,
    rating_average: ratingAvg,
    rating_count: Number(profile.rating_count ?? 0),
    total_trade_volume: Number(profile.total_trade_volume ?? 0),
    // TODO Phase 4.X — replace this naive 5★→100 mapping with a
    // richer trust formula (factoring disputes, reports, account age).
    trust_score: Math.round(ratingAvg * 20),
    level,
    level_label:
      stats?.level_name_ar ?? FALLBACK_LEVEL_LABELS[level] ?? level,
    level_icon: stats?.level_icon ?? FALLBACK_LEVEL_ICONS[level] ?? "⭐",
    level_color:
      stats?.level_color ?? FALLBACK_LEVEL_COLORS[level] ?? "#60A5FA",
    is_ambassador: profile.is_ambassador ?? false,
    created_at: createdAt,
    joined_year_month: formatYearMonth(createdAt),
  }
}

// ══════════════════════════════════════════════════════════════════════
// Phase M — user_profile_extras (onboarding survey answers)
// ══════════════════════════════════════════════════════════════════════

export type Gender = "male" | "female"
export type IncomeTier = "lt_1m" | "1_5m" | "5_15m" | "gt_15m"
export type ExperienceLevel = "beginner" | "intermediate" | "expert"

/**
 * Mirrors the `user_profile_extras` table created by migration
 * 20260503_user_profile_extras.sql. All fields are nullable —
 * the row may not exist yet for users who skipped /profile-setup.
 */
export interface UserProfileExtras {
  user_id: string
  birth_date: string | null
  gender: Gender | null
  city: string | null
  profession: string | null
  income_tier: IncomeTier | null
  income_source: string | null
  goals: string[]
  experience: ExperienceLevel | null
  preferred_sectors: string[]
  agreed_terms_at: string | null
  agreed_privacy_at: string | null
  confirmed_accuracy_at: string | null
}

interface ExtrasRow {
  user_id?: string | null
  birth_date?: string | null
  gender?: string | null
  city?: string | null
  profession?: string | null
  income_tier?: string | null
  income_source?: string | null
  goals?: string[] | null
  experience?: string | null
  preferred_sectors?: string[] | null
  agreed_terms_at?: string | null
  agreed_privacy_at?: string | null
  confirmed_accuracy_at?: string | null
}

function asGender(s: unknown): Gender | null {
  return s === "male" || s === "female" ? s : null
}
function asIncomeTier(s: unknown): IncomeTier | null {
  if (s === "lt_1m" || s === "1_5m" || s === "5_15m" || s === "gt_15m") return s
  return null
}
function asExperience(s: unknown): ExperienceLevel | null {
  if (s === "beginner" || s === "intermediate" || s === "expert") return s
  return null
}

/**
 * Loads the current user's onboarding extras. Returns `null` when:
 *   • no signed-in user
 *   • the table doesn't exist yet (migration not applied)
 *   • the user hasn't filled it out
 */
export async function getMyProfileExtras(): Promise<UserProfileExtras | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("user_profile_extras")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[profile] user_profile_extras unavailable:", error.message)
      return null
    }
    if (!data) return null

    const row = data as ExtrasRow
    return {
      user_id: row.user_id ?? user.id,
      birth_date: row.birth_date ?? null,
      gender: asGender(row.gender),
      city: row.city ?? null,
      profession: row.profession ?? null,
      income_tier: asIncomeTier(row.income_tier),
      income_source: row.income_source ?? null,
      goals: Array.isArray(row.goals) ? row.goals.filter((g): g is string => typeof g === "string") : [],
      experience: asExperience(row.experience),
      preferred_sectors: Array.isArray(row.preferred_sectors)
        ? row.preferred_sectors.filter((s): s is string => typeof s === "string")
        : [],
      agreed_terms_at: row.agreed_terms_at ?? null,
      agreed_privacy_at: row.agreed_privacy_at ?? null,
      confirmed_accuracy_at: row.confirmed_accuracy_at ?? null,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[profile] getMyProfileExtras threw:", err)
    return null
  }
}

export interface UpsertProfileExtrasInput {
  birth_date?: string | null
  gender?: Gender | null
  city?: string | null
  profession?: string | null
  income_tier?: IncomeTier | null
  income_source?: string | null
  goals?: string[]
  experience?: ExperienceLevel | null
  preferred_sectors?: string[]
  agreed_terms?: boolean
  agreed_privacy?: boolean
  confirmed_accuracy?: boolean
}

export interface UpsertProfileExtrasResult {
  success: boolean
  /** Set to `"missing_table"` when the migration hasn't been applied yet
   *  — callers can choose to warn the user or silently skip. */
  reason?: "unauthenticated" | "missing_table" | "rls" | "unknown"
  error?: string
}

/**
 * UPSERTs the current user's profile-extras row. Booleans for the three
 * agreement flags are turned into NOW() timestamps so we keep an audit
 * trail of when consent was granted.
 *
 * Returns a richer error shape than just `boolean` so the page can
 * distinguish "the migration isn't applied yet" (silently fall back to
 * profiles-only persistence) from "real failure" (surface a toast).
 */
export async function upsertMyProfileExtras(
  input: UpsertProfileExtrasInput,
): Promise<UpsertProfileExtrasResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      user_id: user.id,
    }
    if (input.birth_date !== undefined) payload.birth_date = input.birth_date
    if (input.gender !== undefined) payload.gender = input.gender
    if (input.city !== undefined) payload.city = input.city
    if (input.profession !== undefined) payload.profession = input.profession
    if (input.income_tier !== undefined) payload.income_tier = input.income_tier
    if (input.income_source !== undefined) payload.income_source = input.income_source
    if (input.goals !== undefined) payload.goals = input.goals
    if (input.experience !== undefined) payload.experience = input.experience
    if (input.preferred_sectors !== undefined)
      payload.preferred_sectors = input.preferred_sectors
    if (input.agreed_terms === true) payload.agreed_terms_at = now
    if (input.agreed_privacy === true) payload.agreed_privacy_at = now
    if (input.confirmed_accuracy === true)
      payload.confirmed_accuracy_at = now

    const { error } = await supabase
      .from("user_profile_extras")
      .upsert(payload, { onConflict: "user_id" })

    if (error) {
      // PostgREST surfaces missing tables as `42P01`. We fall back
      // gracefully so the page doesn't toast scary errors during
      // partial deployments.
      if (
        error.code === "42P01" ||
        /relation .* does not exist/i.test(error.message)
      ) {
        return { success: false, reason: "missing_table", error: error.message }
      }
      if (error.code === "42501" || /permission/i.test(error.message)) {
        return { success: false, reason: "rls", error: error.message }
      }
      // eslint-disable-next-line no-console
      console.error("[profile] upsertMyProfileExtras:", error.message)
      return { success: false, reason: "unknown", error: error.message }
    }
    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[profile] upsertMyProfileExtras threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
