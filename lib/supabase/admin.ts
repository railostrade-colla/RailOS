import { createClient as createSbClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client (server-only).
 *
 * ⚠ Bypasses every RLS policy — never import this from a "use client"
 * file or expose its return value to the browser. Intended uses:
 *   • API route handlers that need to read auth.users (e.g. emails)
 *   • Webhook handlers that act on behalf of every user
 *   • Background jobs / Edge Functions
 *
 * Returns `null` when SUPABASE_SERVICE_ROLE_KEY is missing so callers
 * can degrade gracefully (e.g. skip the admin lookup) instead of
 * crashing during local dev.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createSbClient(url, key, {
    auth: {
      // Don't persist sessions or refresh tokens — pure stateless.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Look up an auth user's email by their UUID.
 * Returns null on any failure (no service role, no user, RLS issue).
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  if (!userId) return null
  const admin = createAdminClient()
  if (!admin) return null

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    return data.user.email
  } catch {
    return null
  }
}
