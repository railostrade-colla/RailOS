"use client"

/**
 * audit_log read-only data layer (Phase X).
 *
 * Wraps the `audit_log` table from `01_users.sql`. RLS gates SELECT
 * to admins via the Phase-W `public.is_admin()` helper, so non-admins
 * just get an empty array back — same behaviour as a missing table.
 *
 * Mapping notes:
 *   The DB table has only the bare-minimum columns (user_id, action,
 *   entity_type, entity_id, metadata, ip_address, user_agent,
 *   created_at). The admin panel renders a richer shape — admin
 *   name/role from a JOIN with profiles, an entity_name + reason
 *   pulled out of metadata. This module does that mapping.
 *
 *   The DB profiles.role enum and the panel's AdminRole are different
 *   sets — we collapse them:
 *     super_admin → founder
 *     admin       → admin
 *     anything else → moderator (ambassador / user shouldn't appear
 *                                 here but we map defensively)
 */

import { createClient } from "@/lib/supabase/client"
import type {
  AuditLogEntry,
  AuditAction,
  AuditEntityType,
  AdminRole,
} from "@/lib/mock-data/auditLog"

interface AuditLogRow {
  id: string
  user_id: string | null
  action: string | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  // From the joined profile (PostgREST returns it as either an
  // object or a single-element array depending on the relation).
  profile?:
    | { full_name?: string | null; role?: string | null }
    | { full_name?: string | null; role?: string | null }[]
    | null
}

const VALID_ENTITY_TYPES: ReadonlyArray<AuditEntityType> = [
  "user",
  "project",
  "deal",
  "contract",
  "kyc",
  "council",
  "auction",
  "fee_request",
  "dispute",
  "ambassador",
  "system",
]

function asEntityType(s: string | null): AuditEntityType {
  return s && (VALID_ENTITY_TYPES as ReadonlyArray<string>).includes(s)
    ? (s as AuditEntityType)
    : "system"
}

/** Best-effort cast to the panel's AuditAction string-union. */
function asAction(s: string | null): AuditAction | null {
  if (!s) return null
  // The mock's AuditAction list is the canonical set the UI knows
  // how to render — we let TypeScript trust the cast and let the
  // page's `ACTION_LABELS[e.action]` lookup fall through (with an
  // optional-chaining fallback) for any unknown DB action string.
  return s as AuditAction
}

/** Map DB profiles.role → panel's AdminRole. */
function mapRole(role: string | null): AdminRole {
  if (role === "super_admin") return "founder"
  if (role === "admin") return "admin"
  // user / ambassador / unknown — surface as 'moderator' so the badge
  // still renders. (These shouldn't actually appear in audit_log
  // since INSERTs come from SECURITY DEFINER triggers acting on
  // admin actions, but we map defensively.)
  return "moderator"
}

function getMetaString(
  meta: Record<string, unknown> | null,
  key: string,
): string | undefined {
  if (!meta) return undefined
  const v = meta[key]
  return typeof v === "string" ? v : undefined
}

/**
 * Fetch the admin audit log, newest-first. Returns an empty array
 * for non-admins (RLS) or when the table is missing.
 */
export async function getAuditLog(
  limit: number = 200,
): Promise<AuditLogEntry[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("audit_log")
      .select(
        `
        id, user_id, action, entity_type, entity_id, metadata,
        ip_address, user_agent, created_at,
        profile:profiles!user_id ( full_name, role )
        `,
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[audit] getAuditLog:", error.message)
      return []
    }

    const out: AuditLogEntry[] = []
    for (const row of data as AuditLogRow[]) {
      const action = asAction(row.action)
      if (!action) continue

      const profile = Array.isArray(row.profile)
        ? row.profile[0] ?? null
        : row.profile ?? null

      const entityType = asEntityType(row.entity_type)
      const entityName =
        getMetaString(row.metadata, "entity_name") ??
        getMetaString(row.metadata, "name") ??
        row.entity_id ??
        "—"

      out.push({
        id: row.id,
        admin_id: row.user_id ?? "",
        admin_name: profile?.full_name?.trim() || "—",
        admin_role: mapRole(profile?.role ?? null),
        action,
        entity_type: entityType,
        entity_id: row.entity_id ?? "",
        entity_name: entityName,
        metadata: row.metadata ?? {},
        ip_address: row.ip_address ?? undefined,
        reason: getMetaString(row.metadata, "reason"),
        created_at: row.created_at ?? new Date().toISOString(),
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] getAuditLog threw:", err)
    return []
  }
}
