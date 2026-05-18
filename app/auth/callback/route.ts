/**
 * Supabase OAuth callback — `/auth/callback`.
 *
 * Phase A — historically the Supabase project's allowed redirect URL
 * (and the old hard-coded homepage button) pointed here, but the app
 * only implemented `/api/auth/callback`, so Google sign-in landed on
 * the app's not-found page ("الصفحة غير موجودة"). Mounting the shared
 * handler here too means the OAuth redirect resolves regardless of
 * which path the Supabase dashboard is configured with.
 *
 * NOTE: this route must be reachable WITHOUT an auth session (the
 * user isn't signed in until exchangeCodeForSession runs). The
 * proxy/middleware auth-gate must allow /auth/callback through —
 * if it ever redirects unauthenticated /auth/callback to /login,
 * add it to the middleware's public-path allowlist.
 */

import { type NextRequest } from "next/server"
import { handleOAuthCallback } from "@/lib/supabase/oauth-callback"

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request)
}
