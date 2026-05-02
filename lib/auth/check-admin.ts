/**
 * Admin-role helper.
 *
 * Reads `profiles.role` (enum `user_role`: 'user' | 'ambassador' |
 * 'admin' | 'super_admin'). The schema does NOT have a separate
 * `admins` table — role lives directly on the profile row.
 *
 * Use from server components, route handlers, or middleware (the
 * middleware also does an inline equivalent for performance).
 */

import { createClient } from "@/lib/supabase/server"

export type UserRole = "user" | "ambassador" | "admin" | "super_admin"

export interface AdminRoleResult {
  isAdmin: boolean
  isSuperAdmin: boolean
  role: UserRole | null
}

/**
 * Reads the role of a profile by id and returns whether it qualifies
 * as admin.  Returns `{ isAdmin: false, ... role: null }` on any error
 * (no row, RLS denial, network) — i.e. fails closed.
 */
export async function checkAdminRole(userId: string): Promise<AdminRoleResult> {
  if (!userId) {
    return { isAdmin: false, isSuperAdmin: false, role: null }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (error || !data) {
      return { isAdmin: false, isSuperAdmin: false, role: null }
    }

    const role = data.role as UserRole
    return {
      isAdmin: role === "admin" || role === "super_admin",
      isSuperAdmin: role === "super_admin",
      role,
    }
  } catch {
    return { isAdmin: false, isSuperAdmin: false, role: null }
  }
}

/**
 * Throws if the user is not an admin (any tier). Useful in route
 * handlers that should hard-fail unauthorized callers.
 */
export async function requireAdmin(userId: string): Promise<AdminRoleResult> {
  const result = await checkAdminRole(userId)
  if (!result.isAdmin) {
    throw new Error("Forbidden: admin role required")
  }
  return result
}
