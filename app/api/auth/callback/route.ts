/**
 * Supabase OAuth callback — `/api/auth/callback`.
 *
 * Thin wrapper over the shared handler so the SAME logic also serves
 * `/auth/callback` (see app/auth/callback/route.ts). Lives under
 * /api/* so the proxy.ts middleware skips it.
 */

import { type NextRequest } from "next/server"
import { handleOAuthCallback } from "@/lib/supabase/oauth-callback"

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request)
}
