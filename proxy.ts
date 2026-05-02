/**
 * Next.js 16 Proxy — global security gate.
 *
 * Renamed from `middleware.ts` in Next.js 16. This file replaces the
 * earlier placeholder proxy.ts (which only refreshed session cookies)
 * with full route protection wired to `lib/auth/route-config.ts`.
 *
 * Order of operations on every request:
 *   1. Refresh the Supabase session cookie (always — needed for SSR).
 *   2. AUTH_PAGES + signed-in user → /dashboard.
 *   3. PROTECTED route + no user → /login?redirect=<original-path>.
 *   4. ADMIN_ONLY route + no user → /admin-login (separate sign-in).
 *   5. Signed-in user on PROTECTED/ADMIN → fetch
 *      profiles{ role, is_active, is_banned } once and gate:
 *        is_banned     → /?status=banned
 *        !is_active    → /?status=suspended
 *        admin-only    → require role IN ('admin','super_admin')
 *
 * The DB query in step 5 only fires on PROTECTED/ADMIN routes — public
 * pages stay cheap.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ROUTE_CONFIG } from "@/lib/auth/route-config"

/** Exact match OR strict sub-path match (so `/profile` ≠ `/profile-setup`). */
function matchesAny(pathname: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) {
    if (pathname === p) return true
    if (p === "/") continue // root never matches as prefix
    if (pathname.startsWith(p + "/")) return true
  }
  return false
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  search?: Record<string, string>,
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      url.searchParams.set(k, v)
    }
  }
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // The mutable response we'll potentially decorate with refreshed cookies.
  let response = NextResponse.next({ request })

  // Build a Supabase server client tied to this request's cookie jar.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Defensive: in dev with missing keys, just refresh-noop and pass through.
  if (!url || !key) {
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Calling getUser() also rotates the JWT cookie when needed.
  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user ? { id: data.user.id } : null
  } catch {
    // Bad keys / network — treat as anonymous, never break the request.
    user = null
  }

  const isProtected = matchesAny(pathname, ROUTE_CONFIG.PROTECTED)
  const isAdminRoute = matchesAny(pathname, ROUTE_CONFIG.ADMIN_ONLY)
  const isAuthPage = matchesAny(pathname, ROUTE_CONFIG.AUTH_PAGES)

  // ── 2) Already signed in → bounce away from login/register/forgot.
  if (isAuthPage && user) {
    return redirectTo(request, "/dashboard")
  }

  // ── 3) Anonymous on a protected (non-admin) route → /login.
  if (isProtected && !isAdminRoute && !user) {
    return redirectTo(request, "/login", { redirect: pathname })
  }

  // ── 4) Anonymous on an admin route → /admin-login.
  if (isAdminRoute && !user) {
    return redirectTo(request, "/admin-login")
  }

  // ── 5) Signed in + on protected/admin → status + role gates.
  if (user && (isProtected || isAdminRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active, is_banned")
      .eq("id", user.id)
      .single()

    const isBanned = profile?.is_banned === true
    const isInactive = profile && profile.is_active === false

    if (isBanned) {
      return redirectTo(request, "/", { status: "banned" })
    }
    if (isInactive) {
      return redirectTo(request, "/", { status: "suspended" })
    }

    if (isAdminRoute) {
      const role = (profile?.role as string | undefined) ?? ""
      const isAdmin = role === "admin" || role === "super_admin"
      if (!isAdmin) {
        return redirectTo(request, "/")
      }
    }
  }

  return response
}

/**
 * Match every path EXCEPT:
 *   - /api/*                      (route handlers self-authenticate)
 *   - /_next/static, /_next/image (build artefacts)
 *   - favicon.ico                 (browser ping)
 *   - sw-push.js, manifest.json   (PWA / Push SW)
 *   - any image/css/js asset      (svg, png, jpg, jpeg, gif, webp, ico, css, js)
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw-push.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
}
