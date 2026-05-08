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
 *
 * Reverse-proxy gotcha (Phase 9.1.1 fix):
 *   In Railway / Render / Fly / Vercel-with-custom-host, Next.js sees
 *   the *internal* container URL (e.g. http://localhost:8080) inside
 *   `request.url`, not the public HTTPS URL the browser is on. If we
 *   used `new URL(request.url).origin` for the redirect target the
 *   user gets bounced to localhost:8080 which obviously fails. We
 *   compute the public origin from the X-Forwarded-* headers the
 *   reverse proxy sets, falling back to NEXT_PUBLIC_APP_URL, then
 *   finally to request.url for local dev.
 */

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

const REF_COOKIE = "ref_code"

/**
 * Resolve the public-facing origin the browser sees, even behind a
 * reverse proxy. Order:
 *   1. X-Forwarded-Host + X-Forwarded-Proto (set by Railway/Vercel/etc.)
 *   2. process.env.NEXT_PUBLIC_APP_URL (manual override for the deployment)
 *   3. new URL(request.url).origin (local dev / when nothing else is set)
 */
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const errorDescription = url.searchParams.get("error_description")
  const nextRaw = url.searchParams.get("next") || "/dashboard"

  // Defend against open-redirect: only allow same-origin paths.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//")
    ? nextRaw
    : "/dashboard"

  const publicOrigin = resolvePublicOrigin(request)

  // OAuth error from Google — bounce home with a flag so the UI can show it.
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

  // ── Phase 11.04 — route NEW Google users to /profile-setup ──
  // Founder spec: "اريد عند التسجيل عبر كوكل بعد التحقق يحول المستخدم
  // الى صفحة ملاء البيانات الاسم والرقم وتعيين كلمة المرور".
  //
  // We treat the profile as "incomplete" (and therefore needing the
  // setup step) when EITHER:
  //   • profiles.phone is null/empty, OR
  //   • the user has only OAuth identities (no email/password provider)
  //     AND has not yet completed setup (signalled by phone being unset).
  //
  // Existing users who already filled the form pass through to `next`.
  // The decision is wrapped in try/catch so any RPC/network hiccup
  // falls back to the original next-URL behaviour (we'd rather let an
  // existing user reach /dashboard than trap them at setup).
  let finalDestination = next
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Read minimal fields from profiles. profile_setup_complete is
      // optional — if your schema has it, we honour it; otherwise we
      // fall back to phone presence.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle()

      const phoneEmpty =
        !profile?.phone || String(profile.phone).trim().length === 0
      const nameEmpty =
        !profile?.full_name || String(profile.full_name).trim().length === 0

      if (phoneEmpty || nameEmpty) {
        finalDestination = "/profile-setup"
      }
    }
  } catch {
    // Best-effort — fall back to the originally requested next URL.
  }

  // ── Attach referral if a ref_code cookie was set on /register ──
  const refCookie = request.cookies.get(REF_COOKIE)?.value
  const response = NextResponse.redirect(new URL(finalDestination, publicOrigin))
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
