/**
 * Shared Supabase OAuth callback handler.
 *
 * Phase A — the founder kept getting "الصفحة غير موجودة" after Google
 * sign-in. Root cause: the app only ever exposed the callback at
 * `/api/auth/callback`, but the Supabase project's allowed redirect
 * URL has historically been `/auth/callback` (the path the old
 * homepage hard-coded). Whichever one Supabase is configured with,
 * the OTHER 404s.
 *
 * Fix: this single implementation is mounted at BOTH routes:
 *   • app/api/auth/callback/route.ts
 *   • app/auth/callback/route.ts
 * so the OAuth redirect resolves no matter how the dashboard is set.
 *
 * Flow:
 *   1. User clicks "متابعة بـ Google" → redirected to Google
 *   2. Google → Supabase → redirects back here with ?code=…
 *   3. Exchange the code for a Supabase session (sets cookies)
 *   4. If a `ref_code` cookie is present, attach the referral
 *   5. New users (no name/phone) → /profile-setup, else → `next`
 *
 * Reverse-proxy gotcha: behind Railway/Render/Fly/Vercel-custom-host
 * Next.js sees the internal container URL in request.url, not the
 * public HTTPS URL. We resolve the public origin from X-Forwarded-*
 * headers, falling back to NEXT_PUBLIC_APP_URL, then request.url.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

const REF_COOKIE = "ref_code"

function resolvePublicOrigin(request: NextRequest): string {
  const fwdHost = request.headers.get("x-forwarded-host")
  if (fwdHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https"
    return `${proto}://${fwdHost}`
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl && /^https?:\/\//.test(envUrl)) {
    return envUrl.replace(/\/+$/, "")
  }

  return new URL(request.url).origin
}

export async function handleOAuthCallback(
  request: NextRequest,
): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const errorDescription = url.searchParams.get("error_description")
  const nextRaw = url.searchParams.get("next") || "/dashboard"

  // Defend against open-redirect: only allow same-origin paths.
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/dashboard"

  const publicOrigin = resolvePublicOrigin(request)

  // OAuth error from Google — bounce to /login with a flag.
  if (errorDescription) {
    const fail = new URL("/login", publicOrigin)
    fail.searchParams.set("error", "oauth_failed")
    return NextResponse.redirect(fail)
  }

  // Missing code — likely a direct hit on the callback URL.
  if (!code) {
    return NextResponse.redirect(new URL("/login", publicOrigin))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const fail = new URL("/login", publicOrigin)
    fail.searchParams.set("error", "oauth_exchange_failed")
    return NextResponse.redirect(fail)
  }

  // New Google users → /profile-setup (founder spec). We treat the
  // profile as incomplete when full_name OR phone is empty. Wrapped
  // in try/catch so any RPC/network hiccup falls back to `next`.
  let finalDestination = next
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle()

      const phoneEmpty =
        !profile?.phone || String(profile.phone).trim().length === 0
      const nameEmpty =
        !profile?.full_name ||
        String(profile.full_name).trim().length === 0

      if (phoneEmpty || nameEmpty) {
        finalDestination = "/profile-setup"
      }
    }
  } catch {
    /* best-effort — fall back to the originally requested next URL */
  }

  // Attach referral if a ref_code cookie was set on /register.
  const refCookie = request.cookies.get(REF_COOKIE)?.value
  const response = NextResponse.redirect(
    new URL(finalDestination, publicOrigin),
  )
  if (refCookie) {
    try {
      await supabase.rpc("link_referral_by_code", { p_code: refCookie })
    } catch {
      /* swallow — referral is non-blocking */
    }
    response.cookies.set(REF_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
  }

  return response
}
