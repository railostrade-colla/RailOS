"use client"

/**
 * Admin-side ambassadors data layer (Phase AA).
 *
 * Wraps `ambassadors` + `ambassador_rewards` from `04_ambassadors.sql`
 * for the /admin?tab=ambassadors_admin queue. Admin SELECT/UPDATE is
 * gated by Phase-AA RLS policies (which use Phase-W public.is_admin()).
 *
 * Key shape mappings:
 *   • DB enum `ambassador_application_status`:
 *       pending  → mock 'pending'
 *       approved → mock 'approved'
 *       rejected → mock 'rejected'
 *       revoked  → mock 'suspended'
 *   • social_media_links is stored as a JSONB blob from Phase A1
 *     (`{ links: [...], follower_range, expected_referrals }`). We
 *     extract just the links array; everything else is admin-irrelevant.
 *   • profiles.level is potentially `elite` (4 levels in DB) but the
 *     admin panel only renders 3 — we collapse `elite → pro`.
 */

import { createClient } from "@/lib/supabase/client"
import type {
  AmbassadorAdmin,
  AmbassadorRewardAdmin,
  AmbassadorAppStatus,
  AmbassadorLevel,
  AmbassadorRewardStatus,
} from "@/lib/mock-data/ambassadors"

// ─── Types ───────────────────────────────────────────────────

interface AmbassadorRow {
  id: string
  user_id: string | null
  application_status: string | null
  is_active: boolean | null
  application_reason: string | null
  application_experience: string | null
  social_media_links: unknown
  approved_by: string | null
  approved_at: string | null
  revoked_by: string | null
  revoked_at: string | null
  revoke_reason: string | null
  admin_notes: string | null
  total_referrals: number | null
  successful_referrals: number | null
  total_rewards_earned: number | string | null
  applied_at: string | null
  profile?:
    | { full_name?: string | null; username?: string | null; level?: string | null }
    | { full_name?: string | null; username?: string | null; level?: string | null }[]
    | null
}

interface RewardRow {
  id: string
  ambassador_id: string
  referral_id: string | null
  reward_shares: number | string | null
  status: string | null
  granted_at: string | null
  created_at: string | null
  ambassador?:
    | { user_id?: string | null; profile?: { full_name?: string | null } | null }
    | null
}

// ─── Helpers ─────────────────────────────────────────────────

function mapStatus(s: string | null): AmbassadorAppStatus {
  if (s === "approved") return "approved"
  if (s === "rejected") return "rejected"
  if (s === "revoked") return "suspended"
  return "pending"
}

function mapLevel(s: string | null | undefined): AmbassadorLevel {
  // Admin panel renders only 3 buckets; collapse `elite` → `pro` for display.
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function mapRewardStatus(s: string | null): AmbassadorRewardStatus {
  // DB granted → mock paid; pending stays pending; cancelled is filtered out by caller.
  return s === "granted" ? "paid" : "pending"
}

function unwrapProfile<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

interface SocialLinksBlob {
  links?: { platform?: unknown; url?: unknown }[]
}

function extractLinks(raw: unknown): { platform: string; url: string }[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  const obj = raw as SocialLinksBlob
  if (!Array.isArray(obj.links)) return []
  const allowed = new Set<string>([
    "twitter",
    "instagram",
    "facebook",
    "telegram",
    "tiktok",
    "linkedin",
    "other",
  ])
  return obj.links
    .filter((x): x is { platform: string; url: string } => {
      if (!x || typeof x !== "object") return false
      const p = (x as { platform?: unknown }).platform
      const u = (x as { url?: unknown }).url
      return typeof p === "string" && typeof u === "string"
    })
    .map((x) => {
      // Normalise unknown platforms into "other" so the UI's icon map always lookup.
      const platform = allowed.has(x.platform) ? x.platform : "other"
      return { platform, url: x.url }
    })
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function dateOnly(s: string | null): string {
  if (!s) return "—"
  return s.slice(0, 10)
}

// ─── Reads ───────────────────────────────────────────────────

/**
 * Shape returned by the `get_ambassadors_admin` RPC (Phase 10.38).
 * Profile fields surfaced flat — no PostgREST FK join needed.
 */
interface AmbassadorRpcRow extends Omit<AmbassadorRow, "profile"> {
  user_name: string | null
  user_handle: string | null
  user_level: string | null
}

/**
 * Fetch all ambassador application rows. Admins see everything (RLS
 * via Phase-AA migration); non-admins get an empty array.
 *
 * Strategy: try the Phase 10.38 RPC first (does the SQL join + bypasses
 * PostgREST FK inference), fall back to the direct PostgREST query for
 * deployments where the migration isn't applied yet.
 */
export async function getAmbassadorsAdmin(
  limit: number = 200,
): Promise<AmbassadorAdmin[]> {
  // ─── Path 1: RPC (preferred — robust against missing FK constraints) ───
  try {
    const supabase = createClient()
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_ambassadors_admin",
      { p_limit: limit },
    )
    if (!rpcError && Array.isArray(rpcData)) {
      const out: AmbassadorAdmin[] = []
      for (const row of rpcData as AmbassadorRpcRow[]) {
        const userName = row.user_name?.trim() || "—"
        const handle = row.user_handle?.trim() || ""
        const status = mapStatus(row.application_status)
        const links = extractLinks(row.social_media_links)
        const social = links.map((l) => ({
          platform: l.platform as
            | "twitter" | "instagram" | "facebook" | "telegram"
            | "tiktok" | "linkedin" | "other",
          url: l.url,
        }))
        out.push({
          id: row.id,
          user_id: row.user_id ?? "",
          user_name: userName,
          user_email: handle ? `@${handle}` : "—",
          user_level: mapLevel(row.user_level),
          application_status: status,
          is_active: row.is_active === true,
          application_reason: row.application_reason ?? "",
          experience: row.application_experience ?? "",
          social_media_links: social,
          total_referrals: num(row.total_referrals),
          total_signups: num(row.total_referrals),
          total_first_trades: num(row.successful_referrals),
          total_rewards_earned: num(row.total_rewards_earned),
          applied_at: dateOnly(row.applied_at),
          approved_at: row.approved_at ? dateOnly(row.approved_at) : undefined,
          approved_by: row.approved_by ?? undefined,
          suspended_at:
            status === "suspended" && row.revoked_at
              ? dateOnly(row.revoked_at)
              : undefined,
          suspension_reason:
            status === "suspended"
              ? row.revoke_reason ?? row.admin_notes ?? undefined
              : undefined,
          rejection_reason:
            status === "rejected"
              ? row.admin_notes ?? row.revoke_reason ?? undefined
              : undefined,
        })
      }
      return out
    }
    // RPC missing or errored — fall through to legacy path.
    if (rpcError) {
      // eslint-disable-next-line no-console
      console.warn(
        "[ambassadors-admin] RPC get_ambassadors_admin not available, falling back:",
        rpcError.message,
      )
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ambassadors-admin] RPC threw, falling back:", err)
  }

  // ─── Path 2: two-step manual join (FK-independent fallback) ───
  // Avoids `profiles!user_id` PostgREST inference which silently
  // returns empty when the FK constraint isn't declared on the
  // ambassadors table.
  try {
    const supabase = createClient()

    const { data: rows, error } = await supabase
      .from("ambassadors")
      .select(
        `id, user_id, application_status, is_active,
         application_reason, application_experience, social_media_links,
         approved_by, approved_at, revoked_by, revoked_at, revoke_reason, admin_notes,
         total_referrals, successful_referrals, total_rewards_earned,
         applied_at`,
      )
      .order("applied_at", { ascending: false })
      .limit(limit)

    if (error || !rows) {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          "[ambassadors-admin] getAmbassadorsAdmin (fallback) failed:",
          error.message,
          error.code,
        )
      }
      return []
    }

    // Look up profiles separately; tolerate missing.
    const userIds = Array.from(
      new Set(
        rows
          .map((r) => (r as { user_id: string | null }).user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const profileMap = new Map<
      string,
      { full_name?: string | null; username?: string | null; level?: string | null }
    >()
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username, level")
          .in("id", userIds)
        for (const p of (profs ?? []) as Array<{
          id: string
          full_name: string | null
          username: string | null
          level: string | null
        }>) {
          profileMap.set(p.id, { full_name: p.full_name, username: p.username, level: p.level })
        }
      } catch { /* leave empty */ }
    }

    const out: AmbassadorAdmin[] = []
    for (const row of rows as AmbassadorRow[]) {
      const profile = row.user_id ? profileMap.get(row.user_id) ?? null : null
      const userName =
        profile?.full_name?.trim() ||
        profile?.username?.trim() ||
        "—"
      const handle = profile?.username?.trim() || ""

      const status = mapStatus(row.application_status)
      const links = extractLinks(row.social_media_links)
      // Mock type wants AmbassadorSocialLink[] with a stricter platform
      // union — `links` is already constrained to that set above.
      const social = links.map((l) => ({
        platform: l.platform as
          | "twitter"
          | "instagram"
          | "facebook"
          | "telegram"
          | "tiktok"
          | "linkedin"
          | "other",
        url: l.url,
      }))

      out.push({
        id: row.id,
        user_id: row.user_id ?? "",
        user_name: userName,
        user_email: handle ? `@${handle}` : "—",
        user_level: mapLevel(profile?.level),
        application_status: status,
        is_active: row.is_active === true,
        application_reason: row.application_reason ?? "",
        experience: row.application_experience ?? "",
        social_media_links: social,
        total_referrals: num(row.total_referrals),
        // The admin mock distinguishes total_signups vs total_first_trades;
        // the DB only tracks total_referrals (≈ signups) and
        // successful_referrals (≈ first-trades).
        total_signups: num(row.total_referrals),
        total_first_trades: num(row.successful_referrals),
        total_rewards_earned: num(row.total_rewards_earned),
        applied_at: dateOnly(row.applied_at),
        approved_at: row.approved_at ? dateOnly(row.approved_at) : undefined,
        approved_by: row.approved_by ?? undefined,
        // For the suspended UI, surface revoke fields.
        suspended_at:
          status === "suspended" && row.revoked_at
            ? dateOnly(row.revoked_at)
            : undefined,
        suspension_reason:
          status === "suspended"
            ? row.revoke_reason ?? row.admin_notes ?? undefined
            : undefined,
        rejection_reason:
          status === "rejected"
            ? row.admin_notes ?? row.revoke_reason ?? undefined
            : undefined,
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassadors-admin] getAmbassadorsAdmin threw:", err)
    return []
  }
}

/**
 * Fetch ambassador rewards (granted + pending). `cancelled` rows are
 * hidden — they're not interesting on the admin queue.
 */
export async function getAmbassadorRewardsAdmin(
  limit: number = 200,
): Promise<AmbassadorRewardAdmin[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("ambassador_rewards")
      .select(
        `
        id, ambassador_id, referral_id,
        reward_shares, status, granted_at, created_at,
        ambassador:ambassadors!ambassador_id (
          user_id,
          profile:profiles!user_id ( full_name )
        )
        `,
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[ambassadors-admin] rewards:", error.message)
      return []
    }

    return (data as RewardRow[]).map((r) => {
      // The nested join may unwrap to a single object or an array
      // depending on PostgREST relation cardinality.
      const ambRaw = r.ambassador as
        | { user_id?: string | null; profile?: { full_name?: string | null } | { full_name?: string | null }[] | null }
        | { user_id?: string | null; profile?: { full_name?: string | null } | { full_name?: string | null }[] | null }[]
        | null
      const amb = Array.isArray(ambRaw) ? (ambRaw[0] ?? null) : ambRaw
      const profile = unwrapProfile(amb?.profile ?? null)
      return {
        id: r.id,
        ambassador_id: r.ambassador_id,
        ambassador_name: profile?.full_name?.trim() || "—",
        // The DB only models first-trade rewards — there's no
        // signup / milestone breakdown. Always tag accordingly.
        type: "referral_first_trade" as const,
        amount: num(r.reward_shares),
        related_user_id: undefined,
        related_user_name: undefined,
        status: mapRewardStatus(r.status),
        awarded_at: dateOnly(r.created_at),
        paid_at: r.granted_at ? dateOnly(r.granted_at) : undefined,
      }
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassadors-admin] rewards threw:", err)
    return []
  }
}

// ─── Writes ──────────────────────────────────────────────────

export interface ReviewAmbassadorResult {
  success: boolean
  reason?: "unauthenticated" | "rls" | "missing_table" | "unknown"
  error?: string
}

async function update(
  ambassadorId: string,
  patch: Record<string, unknown>,
): Promise<ReviewAmbassadorResult> {
  if (!ambassadorId) {
    return { success: false, reason: "unknown", error: "ambassadorId missing" }
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { error } = await supabase
      .from("ambassadors")
      .update(patch)
      .eq("id", ambassadorId)

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501" || /permission/i.test(msg)) {
        return { success: false, reason: "rls", error: msg }
      }
      // eslint-disable-next-line no-console
      console.error("[ambassadors-admin] update:", msg)
      return { success: false, reason: "unknown", error: msg }
    }
    return { success: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ambassadors-admin] update threw:", err)
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Approve a pending application. The DB trigger sync_ambassador_status
 * sets is_active + bumps profiles.is_ambassador automatically.
 */
export function approveAmbassador(
  ambassadorId: string,
): Promise<ReviewAmbassadorResult> {
  return update(ambassadorId, {
    application_status: "approved",
  })
}

export function rejectAmbassador(
  ambassadorId: string,
  reason: string,
): Promise<ReviewAmbassadorResult> {
  if (!reason.trim())
    return Promise.resolve({ success: false, reason: "unknown", error: "اكتب سبب الرفض" })
  return update(ambassadorId, {
    application_status: "rejected",
    admin_notes: reason.trim(),
  })
}

/**
 * Soft-suspend an active ambassador. Sets status = 'revoked' so the
 * sync_ambassador_status trigger flips is_active=false and clears
 * profile.is_ambassador. Records the revoker + reason.
 */
export async function suspendAmbassador(
  ambassadorId: string,
  reason: string,
): Promise<ReviewAmbassadorResult> {
  if (!reason.trim())
    return { success: false, reason: "unknown", error: "اكتب سبب الإيقاف" }
  // Need the current admin's id for revoked_by — fetched here so the
  // generic update() helper stays neutral.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, reason: "unauthenticated" }
  return update(ambassadorId, {
    application_status: "revoked",
    revoke_reason: reason.trim(),
    revoked_by: user.id,
  })
}

/**
 * Reactivate a previously revoked ambassador — same shape as approval.
 * The trigger flips is_active back to true.
 */
export function reactivateAmbassador(
  ambassadorId: string,
): Promise<ReviewAmbassadorResult> {
  return update(ambassadorId, {
    application_status: "approved",
    revoke_reason: null,
    revoked_at: null,
    revoked_by: null,
  })
}

/**
 * Permanent termination — same DB representation as suspension but
 * with a marker in admin_notes so we can distinguish later. The DB
 * doesn't have a separate 'terminated' state.
 */
export async function terminateAmbassador(
  ambassadorId: string,
  reason: string,
): Promise<ReviewAmbassadorResult> {
  if (!reason.trim())
    return { success: false, reason: "unknown", error: "اكتب سبب الإنهاء" }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, reason: "unauthenticated" }
  return update(ambassadorId, {
    application_status: "revoked",
    revoke_reason: reason.trim(),
    revoked_by: user.id,
    admin_notes: `[terminated] ${reason.trim()}`,
  })
}
