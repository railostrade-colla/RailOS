import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client.
 *
 * Supports both naming conventions:
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (new — sb_publishable_xxx)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy JWT, still accepted by Supabase)
 *
 * Auth behavior:
 *   - persistSession: true     → session lives in localStorage across tabs/restarts
 *   - autoRefreshToken: true   → JWT refreshed silently before expiry
 *   - detectSessionInUrl: true → captures OAuth + magic-link callbacks
 *
 * The user stays signed in until they click "تسجيل خروج" explicitly.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
}
