/**
 * Supabase OAuth callback handler (Phase 9.1).
 *
 * Flow:
 *   1. User clicks "متابعة بـ Google" → redirected to Google
 *   2. Google redirects back here with ?code=… (and optionally ?next=…)
 *   3. We exchange the code for a Supabase session (sets cookies)
 *   4. If a `ref_code` cookie is present (set by signInWithGoogle on
 *      /register), we call link_referral_by_code() to attach the new
 *      user to the referring ambassador, then clear the cookie.
 *   5. Redirect to `next` (default: /dashboard).
 *
 * This route lives under /api/* so the proxy.ts middleware skips it
 * (the matcher excludes /api). That keeps the cookie-rotation logic
 * simple and avoids any chicken-and-egg with auth gates.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

const REF_COOKIE = "ref_code"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const errorDescription = url.searchParams.get("error_description")
  const nextRaw = url.searchParams.get("next") || "/dashboard"

  // Defend against open-redirect: only allow same-origin paths.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//")
    ? nextRaw
    : "/dashboard"

  // OAuth error from Google — bounce home with a flag so the UI can show it.
  if (errorDescription) {
    const fail = new URL("/login", url.origin)
    fail.searchParams.set("error", "oauth_failed")
    return NextResponse.redirect(fail)
  }

  // Missing code — likely a direct hit on the callback URL.
  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const fail = new URL("/login", url.origin)
    fail.searchParams.set("error", "oauth_exchange_failed")
    return NextResponse.redirect(fail)
  }

  // ── Attach referral if a ref_code cookie was set on /register ──
  const refCookie = request.cookies.get(REF_COOKIE)?.value
  const response = NextResponse.redirect(new URL(next, url.origin))
  if (refCookie) {
    try {
      // Best-effort — even if the RPC fails we still let the user in.
      await supabase.rpc("link_referral_by_code", { p_code: refCookie })
    } catch {
      /* swallow — referral is non-blocking */
    }
    // Clear the cookie regardless of RPC outcome.
    response.cookies.set(REF_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
  }

  return response
}
