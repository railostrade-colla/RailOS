import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client.
 *
 * Supports both naming conventions:
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (new — sb_publishable_xxx)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY         (legacy JWT, still accepted by Supabase)
 *
 * The key value itself can be either format — Supabase SDK auto-detects.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  return createBrowserClient(url, key)
}
