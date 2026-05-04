/**
 * Auto-generated Supabase types — placeholder.
 *
 * Re-generate with one of:
 *   npm run types:db          (requires `supabase link` once)
 *   npm run types:db:remote   (set SUPABASE_PROJECT_ID env var)
 *
 * Until generated, callers should keep using hand-typed shapes from
 * `lib/data/*` and `lib/mock-data/types`. This file exists so the
 * `types:db` script has a stable output path.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface Database {}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
