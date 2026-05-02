"use client"

/**
 * Real profile data layer for /profile page.
 *
 * Composes three sources into one shape:
 *   • auth.users          → email
 *   • profiles            → full_name, kyc_status, rating, trades, ...
 *   • user_stats_view     → level_name_ar, level_icon, level_color,
 *                           computed success_rate
 *
 * Derived (computed here, not stored in DB):
 *   • is_verified         = kyc_status === 'approved'
 *   • trust_score         = round(rating_average * 20)   ⚠ TODO
 *                           (Phase 4.X: enrich with disputes/reports/age)
 *   • joined_year_month   = 'YYYY-MM' from created_at
 *
 * Phase 4.1 — Profile only. Portfolio numbers (totalValue, profit, etc.)
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

/** Shape we expect from `profiles` (raw — every column nullable to be safe). */
interface ProfileRow {
  full_name: string | null
  username: string | null
  phone: string | null
  avatar_url: string | null
  role: string
  kyc_status: KycStatus
  is_active: boolean
  is_banned: boolean
  rating_average: number | null
  rating_count: number | null
  total_trades: number | null
  successful_trades: number | null
  total_trade_volume: number | null
  level: string | null
  is_ambassador: boolean | null
  created_at: string
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
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${yyyy}-${mm}`
}

/**
 * Load the signed-in user's full profile, joined with stats view.
 * Returns `null` when:
 *   - no authenticated user
 *   - the profile row is missing (orphaned auth.user)
 *   - any unexpected error (also logged via console.error)
 *
 * Always fails closed — never throws to the caller.
 */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // Parallel: profile + stats view (one round-trip pair).
    const [profileRes, statsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, username, phone, avatar_url, role, kyc_status, is_active, is_banned, rating_average, rating_count, total_trades, successful_trades, total_trade_volume, level, is_ambassador, created_at",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_stats_view")
        .select("level, level_name_ar, level_icon, level_color, success_rate")
        .eq("id", user.id)
        .maybeSingle(),
    ])

    const profile = profileRes.data as ProfileRow | null
    const stats = statsRes.data as StatsRow | null

    if (!profile) {
      // eslint-disable-next-line no-console
      console.error("[profile] no row in profiles for user", user.id)
      return null
    }

    const level = stats?.level ?? profile.level ?? "basic"
    const ratingAvg = Number(profile.rating_average ?? 0)
    const totalTrades = profile.total_trades ?? 0
    const successfulTrades = profile.successful_trades ?? 0

    const successRate =
      stats?.success_rate != null
        ? Math.round(Number(stats.success_rate))
        : totalTrades > 0
          ? Math.round((successfulTrades / totalTrades) * 100)
          : 0

    return {
      id: user.id,
      email: user.email ?? "",
      full_name: profile.full_name,
      username: profile.username,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      role: profile.role,
      kyc_status: profile.kyc_status,
      is_verified: profile.kyc_status === "approved",
      is_active: profile.is_active,
      is_banned: profile.is_banned,
      total_trades: totalTrades,
      successful_trades: successfulTrades,
      success_rate: successRate,
      rating_average: ratingAvg,
      rating_count: profile.rating_count ?? 0,
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
      created_at: profile.created_at,
      joined_year_month: formatYearMonth(profile.created_at),
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getCurrentUserProfile failed:", err)
    return null
  }
}
