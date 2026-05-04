/**
 * Tiny session-level dedup cache for read-only Supabase queries.
 *
 * Why: pages re-mount on tab switches and each one re-runs its
 * `getX()` calls. For static-ish lookups (projects list, companies
 * list, current user profile) that's wasted round-trips. This wraps
 * any async function so concurrent calls share a single in-flight
 * promise, AND repeat calls within `ttlMs` reuse the cached result.
 *
 * Notes:
 *  - This is a CLIENT-side cache. It lives in the browser tab only.
 *  - Use ONLY for queries that are safe to cache for a few seconds.
 *  - Skip caching for user-mutated data (deals, listings, holdings).
 *  - The cache survives soft navigation but resets on full reload.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

/** Default cache lifetime — 30 seconds. Tune per call if needed. */
const DEFAULT_TTL_MS = 30_000

/**
 * Wraps an async fetcher so:
 *   1. Concurrent calls with the same key share one in-flight promise.
 *   2. Subsequent calls within `ttlMs` reuse the cached result.
 *
 * Example:
 *   getAllProjects = () => dedupCache("projects:all", () => realFetch(), 60_000)
 */
export async function dedupCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()

  // 1. Hot cache hit
  const cached = cache.get(key) as CacheEntry<T> | undefined
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  // 2. Already fetching → reuse promise
  const pending = inFlight.get(key) as Promise<T> | undefined
  if (pending) {
    return pending
  }

  // 3. Fresh fetch
  const promise = (async () => {
    try {
      const value = await fetcher()
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

/** Manually invalidate a cache key (e.g. after a write). */
export function invalidateCache(key: string): void {
  cache.delete(key)
  inFlight.delete(key)
}

/** Clear everything — typically on sign-out. */
export function clearAllCache(): void {
  cache.clear()
  inFlight.clear()
}
