import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client (Server Components, Route Handlers, Server Actions).
 *
 * Supports both naming conventions:
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (new — sb_publishable_xxx)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy JWT, still accepted by Supabase)
 *
 * The key value itself can be either format — Supabase SDK auto-detects.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — ignore (middleware handles refresh).
        }
      },
    },
  })
}
