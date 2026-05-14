/**
 * Supabase session refresh helper (Phase 14.09 A — now actually wired
 * up via /middleware.ts at the project root).
 *
 * Called on every request that the Next.js middleware matcher matches.
 * Reads the incoming cookies, spins up a server-side Supabase client,
 * forces a session lookup (which triggers a refresh if the JWT is
 * about to expire), and writes the refreshed cookies back on the
 * response.
 *
 * Without this running, the localStorage-based browser session keeps
 * itself refreshed indefinitely BUT the server-side cookie expires
 * with the original JWT — and any RLS query / server action will
 * start failing silently around the 1-hour mark.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Phase 14.09 A — same key-fallback pattern as lib/supabase/client.ts
  // and server.ts so this file works on both the new (sb_publishable_*)
  // and legacy (anon JWT) Supabase project configurations.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // First, mirror the new cookies onto the incoming request so
        // any downstream `getUser()` in the same tick sees them.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        // Then rebuild the response with the freshly mutated request
        // and write the cookies onto its outgoing Set-Cookie headers.
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // Touch the session. If it's close to expiry, Supabase emits the
  // refreshed JWT via the `setAll` callback above, which writes the
  // new cookies onto `supabaseResponse`.
  await supabase.auth.getUser()

  return supabaseResponse
}
