/**
 * Root middleware (Phase 14.09 A).
 *
 * Runs on every request to refresh the Supabase auth cookie BEFORE
 * the request reaches a route handler / server component. Without
 * this, the server-side cookie goes stale within ~1 hour of the JWT
 * issue time even though the browser's localStorage session is
 * still valid — which is what was causing the "auth keeps dropping,
 * have to log in again" reports.
 *
 * The actual cookie refresh happens in `lib/supabase/middleware.ts`'s
 * `updateSession` helper, which:
 *   1. Reads the incoming request cookies
 *   2. Spins up a server-side Supabase client with those cookies
 *   3. Calls `auth.getUser()` which forces a token refresh if the
 *      current JWT is about to expire
 *   4. Writes the refreshed cookies back onto the response
 *
 * The matcher excludes static assets and image files so we don't
 * spin a Supabase client for every favicon hit.
 */
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *   - _next/static (build output)
     *   - _next/image (image optimizer)
     *   - favicon.ico
     *   - common static image extensions
     *   - /api routes that explicitly opt out of session refresh
     *     can add their own marker; we still want refresh on most
     *     API calls so RLS keeps working.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
