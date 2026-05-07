"use client"

/**
 * Phase 11.00 — Admin permission system.
 *
 * Granular capabilities a super_admin can grant to a regular admin
 * via the Admins panel. Used to gate sidebar items + panel access
 * across the admin dashboard.
 *
 * super_admin always has all capabilities (the SQL helper returns
 * ["*"] as a wildcard).
 */

import { createClient } from "@/lib/supabase/client"

export type AdminPermission =
  | "manage_users"
  | "manage_projects"
  | "manage_companies"
  | "manage_orders"        // deals, share requests, fee requests
  | "manage_kyc"
  | "manage_market"        // market state, market settings, market engine
  | "manage_payments"      // payment_settings (master card / phone)
  | "manage_fees"          // fee config (rates, limits)
  | "manage_content"       // notifications broadcaster, ads, news
  | "manage_admins"        // (super_admin only — promote/demote/permissions)
  | "view_audit"
  | "view_dashboard"

export const PERMISSION_LABELS: Record<AdminPermission, { label: string; hint: string; icon: string }> = {
  view_dashboard:  { label: "لوحة التحكم",         hint: "عرض الإحصائيات الرئيسية",                       icon: "📊" },
  manage_users:    { label: "إدارة المستخدمين",   hint: "حظر، توثيق KYC، تعيين المستوى",                  icon: "👥" },
  manage_projects: { label: "إدارة المشاريع",     hint: "إنشاء + تعديل + نشر المشاريع",                   icon: "🏗️" },
  manage_companies:{ label: "إدارة الشركات",      hint: "إنشاء + تعديل الشركات",                          icon: "🏢" },
  manage_orders:   { label: "مركز الطلبات",       hint: "صفقات + طلبات حصص + رسوم",                       icon: "📥" },
  manage_kyc:      { label: "مراجعة التوثيق",     hint: "موافقة/رفض طلبات KYC",                            icon: "🛡️" },
  manage_market:   { label: "إدارة السوق",        hint: "حالة السوق + المحرّك + الإعدادات",              icon: "📈" },
  manage_payments: { label: "إعدادات الدفع",      hint: "بطاقة الماستر + هواتف التحويل",                  icon: "💳" },
  manage_fees:     { label: "إعدادات الرسوم",     hint: "نسب + حدود الرسوم",                              icon: "💰" },
  manage_content:  { label: "المحتوى والإشعارات", hint: "بثّ إشعارات + إعلانات + أخبار",                  icon: "📝" },
  view_audit:      { label: "سجلّ التدقيق",       hint: "قراءة سجل إجراءات الإداريين",                    icon: "📜" },
  manage_admins:   { label: "إدارة الإداريين",    hint: "إضافة/إزالة أدمن (Super Admin فقط)",             icon: "👑" },
}

/** All non-super capabilities — used as the default "give everything" preset. */
export const ALL_PERMISSIONS: AdminPermission[] = [
  "view_dashboard",
  "manage_users",
  "manage_projects",
  "manage_companies",
  "manage_orders",
  "manage_kyc",
  "manage_market",
  "manage_payments",
  "manage_fees",
  "manage_content",
  "view_audit",
]

/** Sensible default for a new admin: read-only-ish operator role. */
export const DEFAULT_PERMISSIONS: AdminPermission[] = [
  "view_dashboard",
  "manage_orders",
  "manage_kyc",
]

/** Cache the caller's permissions for the lifetime of a render tree. */
let _cachedPerms: AdminPermission[] | "*" | null = null
let _inflight: Promise<AdminPermission[] | "*"> | null = null

export async function getMyAdminPermissions(): Promise<AdminPermission[] | "*"> {
  if (_cachedPerms !== null) return _cachedPerms
  if (_inflight) return _inflight
  _inflight = (async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("get_my_admin_permissions")
      if (error || !data) return [] as AdminPermission[]
      const arr = data as unknown[]
      if (arr.length === 1 && arr[0] === "*") return "*"
      return arr.filter((x): x is AdminPermission => typeof x === "string") as AdminPermission[]
    } catch {
      return [] as AdminPermission[]
    }
  })()
  const result = await _inflight
  _cachedPerms = result
  _inflight = null
  return result
}

export function clearAdminPermissionsCache(): void {
  _cachedPerms = null
  _inflight = null
}

/** Synchronous check — assumes caller has resolved the promise once. */
export function hasPermission(
  perms: AdminPermission[] | "*",
  required: AdminPermission,
): boolean {
  if (perms === "*") return true
  return perms.includes(required)
}

// ─── RPC wrappers (super_admin only) ─────────────────────────────

export interface GrantAdminResult {
  success: boolean
  reason?: string
  error?: string
}

export async function adminGrantAdmin(
  userId: string,
  permissions: AdminPermission[],
): Promise<GrantAdminResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_grant_admin", {
      p_user_id: userId,
      p_permissions: permissions,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    const r = (data ?? {}) as { success?: boolean; error?: string }
    if (!r.success) return { success: false, reason: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminSetAdminPermissions(
  userId: string,
  permissions: AdminPermission[],
): Promise<GrantAdminResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_set_admin_permissions", {
      p_user_id: userId,
      p_permissions: permissions,
    })
    if (error) {
      const code = error.code ?? ""
      if (code === "42883" || code === "42P01") {
        return { success: false, reason: "missing_table", error: error.message }
      }
      return { success: false, reason: "unknown", error: error.message }
    }
    const r = (data ?? {}) as { success?: boolean; error?: string }
    if (!r.success) return { success: false, reason: r.error ?? "unknown" }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
