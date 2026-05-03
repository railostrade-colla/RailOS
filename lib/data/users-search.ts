"use client"

/**
 * users-search — small reusable lookup for admin pickers (Phase 8.1).
 *
 * One source of truth for the "search user by name / username" UX
 * across admin panels. Use it via the <UserPicker /> component
 * (components/admin/UserPicker.tsx) — direct callers shouldn't be
 * common.
 *
 * Returns lightweight rows. If callers need richer per-user data
 * they should follow up with a targeted profile fetch.
 */

import { createClient } from "@/lib/supabase/client"

export interface UserSearchResult {
  id: string
  display_name: string
  /** Used for context badges in the picker dropdown. */
  username: string | null
  level: "basic" | "advanced" | "pro" | "elite" | null
  role: string | null
  is_council_member: boolean
}

export interface UserSearchOptions {
  /** Hide ids that the caller already has selected / can't pick. */
  excludeIds?: string[]
  /** Cap on results returned. */
  limit?: number
}

const MIN_QUERY_LENGTH = 2

interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
  level: string | null
  role: string | null
}

function levelKind(s: string | null): UserSearchResult["level"] {
  if (s === "advanced" || s === "pro" || s === "elite" || s === "basic") return s
  return null
}

export async function searchUsers(
  query: string,
  options: UserSearchOptions = {},
): Promise<UserSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  try {
    const supabase = createClient()
    const limit = Math.max(1, Math.min(options.limit ?? 10, 50))
    const q = `%${trimmed.replace(/[%_]/g, "\\$&")}%`

    let req = supabase
      .from("profiles")
      .select("id, full_name, username, level, role")
      .or(`full_name.ilike.${q},username.ilike.${q}`)
      .limit(limit)

    if (options.excludeIds && options.excludeIds.length > 0) {
      // .not.in() expects a stringified list
      req = req.not("id", "in", `(${options.excludeIds.join(",")})`)
    }

    const { data, error } = await req
    if (error || !data) return []

    const rows = data as ProfileRow[]

    // Cross-check council membership in a single follow-up query so we
    // can show "✓ عضو مجلس" badges in the picker.
    let councilSet = new Set<string>()
    try {
      const { data: cm } = await supabase
        .from("council_members")
        .select("user_id")
        .eq("is_active", true)
        .in(
          "user_id",
          rows.map((r) => r.id),
        )
      councilSet = new Set(
        ((cm as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id),
      )
    } catch {
      // council_members may not be deployed yet — non-fatal
    }

    return rows.map((r): UserSearchResult => ({
      id: r.id,
      display_name:
        r.full_name?.trim() ||
        r.username?.trim() ||
        r.id.slice(0, 8),
      username: r.username,
      level: levelKind(r.level),
      role: r.role,
      is_council_member: councilSet.has(r.id),
    }))
  } catch {
    return []
  }
}
