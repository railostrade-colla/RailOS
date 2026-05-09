/**
 * /r/[code] — short referral redirect for ambassadors.
 *
 * Phase 12 — also bumps `referral_links.clicks_count` via the
 * `track_referral_click` RPC before redirecting so the ambassador
 * dashboard's "النقرات" counter actually moves.
 *
 * Server component — runs on the server, returns a 307 redirect
 * with no client JS needed. The RPC call is best-effort: any
 * failure (offline DB, anon-key issue, expired link) still
 * forwards the visitor to /register so the user-facing flow is
 * never blocked by analytics.
 */

import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

interface Props {
  params: Promise<{ code: string }>
}

export default async function ReferralRedirectPage({ params }: Props) {
  const { code } = await params
  const safeCode = (code ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
  if (!safeCode) {
    redirect("/register")
  }

  // Best-effort click tracking. Uses the public anon key — the RPC
  // is GRANT'd to anon. Failures are swallowed.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    try {
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      // No await on the typing side — but we DO await so the click
      // is recorded before the redirect (a 307 is fast enough that
      // the user won't notice the extra round-trip).
      await sb.rpc("track_referral_click", { p_code: safeCode })
    } catch {
      // Silent — tracking is non-critical.
    }
  }

  redirect(`/register?ref=${encodeURIComponent(safeCode)}`)
}

// Disable any caching so the redirect always reflects the current
// auth state of the visitor.
export const dynamic = "force-dynamic"
