/**
 * Centralised route classification used by `middleware.ts` to decide
 * whether to require auth, redirect logged-in users away, or restrict
 * to admin role.
 *
 * Matching semantics (see middleware.ts → matchesAny):
 *   • `pathname === '/dashboard'`            → match
 *   • `pathname === '/dashboard/foo/bar'`    → match (starts with `/dashboard/`)
 *   • `pathname === '/dashboard-other'`      → DOES NOT match
 *   • `pathname === '/'`                     → matches `/` exactly
 *
 * Anything not classified here falls through unmodified. New routes
 * should be explicitly added to one of the lists below.
 */
export const ROUTE_CONFIG = {
  /**
   * Routes that require an authenticated, active, non-banned user.
   * Mirrors every folder under `app/(app)/` minus the public ones
   * (`/privacy`, `/terms`).
   */
  PROTECTED: [
    "/dashboard",
    "/portfolio",
    "/wallet",
    "/deals",
    "/exchange",
    "/market",
    "/orders",
    "/settings",
    "/notifications",
    "/profile",
    "/profile-setup",
    "/kyc",
    "/quick-sale",
    "/quick-sell",
    "/auctions",
    "/contracts",
    "/invoices",
    "/discounts",
    "/council",
    "/healthcare",
    "/orphans",
    "/ambassador",
    "/community",
    "/following",
    "/levels",
    "/menu",
    "/news",
    "/support",
    "/about",
    "/investment",
    "/app-guide",
    "/investment-guide",
    "/company",
    "/project",
    "/deal-chat",
    "/reset-password",
  ],

  /**
   * Admin-only — requires `profiles.role IN ('admin', 'super_admin')`.
   * Note: `/admin-login` is intentionally PUBLIC so admins can sign in.
   */
  ADMIN_ONLY: ["/admin"],

  /**
   * Auth pages — when an already-signed-in user lands here, redirect
   * them to `/dashboard`.
   */
  AUTH_PAGES: ["/login", "/register", "/forgot-password"],

  /**
   * Fully public — no auth check at all. The home page reads
   * `?status=banned|suspended` to render the appropriate notice.
   */
  PUBLIC: [
    "/",
    "/splash",
    "/admin-login",
    "/privacy",
    "/terms",
  ],
} as const

export type RouteConfig = typeof ROUTE_CONFIG
