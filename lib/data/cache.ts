/**
 * Phase 11.18 — stale-while-revalidate cache for read-only Supabase
 * queries.
 *
 * Why this layer exists:
 *   • Pages re-mount on tab switches and each one re-runs its
 *     getX() calls. For static-ish lookups (projects, companies,
 *     profile) that's wasted round-trips.
 *   • Worse — every full page reload starts with EMPTY memory and
 *     the user stares at a loading spinner for 300ms-1s while
 *     Supabase round-trips finish. Hence the founder's complaint
 *     about "تأخير كبير في جلب البيانات".
 *
 * Layers:
 *   1. In-flight Map — concurrent calls share one promise.
 *   2. In-memory Map — repeat calls within ttlMs return instantly.
 *   3. localStorage — survives full page reloads, so the user gets
 *      the LAST KNOWN data on first paint, then a fresh fetch
 *      updates the page in place.
 *
 * Components can call readPersistedSync(key) at mount time to grab
 * cached data SYNCHRONOUSLY (no await) and render immediately,
 * then run the async fetcher in the background and update state
 * when it resolves.
 *
 * Cache only safe-to-cache reads:
 *   • Project lists / companies / news / current user profile
 *   • Dashboard analytics
 * Skip for live writes (deals, listings, holdings) — those need
 * realtime subscriptions instead.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  /** When the entry was originally written. Used as the "stale-but-
   *  acceptable" timestamp. */
  writtenAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

/** Default cache lifetime — 30 seconds. Tune per call if needed. */
const DEFAULT_TTL_MS = 30_000

/** localStorage key prefix so we can clear our entries without
 *  nuking unrelated app state. */
const LS_PREFIX = "railos:cache:"

/** Write an entry to BOTH memory and localStorage. Best-effort —
 *  storage quota errors are swallowed. */
function writeEntry<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now()
  const entry: CacheEntry<T> = {
    value,
    writtenAt: now,
    expiresAt: now + ttlMs,
  }
  cache.set(key, entry)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
    } catch {
      // Quota exceeded or storage disabled — keep going with memory only.
    }
  }
}

/** Read from memory first; if cold, hydrate from localStorage. */
function readEntry<T>(key: string): CacheEntry<T> | null {
  const mem = cache.get(key) as CacheEntry<T> | undefined
  if (mem) return mem
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    // Sanity check.
    if (typeof parsed?.expiresAt !== "number") return null
    cache.set(key, parsed)  // promote to memory
    return parsed
  } catch {
    return null
  }
}

/**
 * Synchronous read for the SWR pattern. Returns the last-known value
 * for `key` (even if expired) so a component can render immediately
 * and then update once the background fetch resolves.
 *
 * Returns null on a cold cache.
 */
export function readPersistedSync<T>(key: string): T | null {
  const entry = readEntry<T>(key)
  return entry ? entry.value : null
}

/**
 * Wraps an async fetcher so:
 *   1. Concurrent calls with the same key share one in-flight promise.
 *   2. Subsequent calls within `ttlMs` reuse the cached result
 *      (instant — no network hit).
 *   3. After ttlMs the entry is refreshed from network.
 *
 * Pair this with readPersistedSync(key) for true stale-while-revalidate:
 *   const initial = readPersistedSync<Foo>("foo:list")
 *   const [data, setData] = useState(initial ?? [])
 *   useEffect(() => { dedupCache("foo:list", fetchFoo).then(setData) }, [])
 */
export async function dedupCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()

  // 1. Hot cache hit (memory or persisted, not yet expired)
  const cached = readEntry<T>(key)
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
      writeEntry(key, value, ttlMs)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

/**
 * Phase 11.31 — true SWR (stale-while-revalidate) helper.
 *
 * Use case: a component mounts and wants to render IMMEDIATELY with
 * whatever cached data exists, even if expired. The fetcher then
 * runs in the background and the new value is delivered via the
 * onUpdate callback.
 *
 * This differs from `dedupCache`:
 *   • dedupCache awaits the network when the cache is expired.
 *   • swrCache returns expired data instantly and triggers the fetch
 *     to a callback, never blocking.
 *
 * Returns:
 *   { initial }  — last-known value (or null), available SYNCHRONOUSLY.
 *
 * Usage:
 *   const { initial } = swrCache<Foo>("foo:list")
 *   const [data, setData] = useState(initial ?? [])
 *   useEffect(() => {
 *     swrRevalidate("foo:list", fetchFoo, 30_000).then(setData)
 *   }, [])
 */
export function swrCache<T>(key: string): { initial: T | null } {
  return { initial: readPersistedSync<T>(key) }
}

/**
 * Phase 11.31 — background refresh side of swrCache. Runs the fetcher,
 * writes to cache, returns the fresh value. Concurrent calls with the
 * same key still share one in-flight promise (dedupCache semantics).
 */
export async function swrRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  // Reuse dedup logic — but we don't care about the cached value here,
  // we always want the fresh one.
  const pending = inFlight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = (async () => {
    try {
      const value = await fetcher()
      writeEntry(key, value, ttlMs)
      return value
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

/** Manually invalidate a cache key (e.g. after a write). Removes
 *  the entry from both memory AND localStorage so the next read
 *  hits the network. */
export function invalidateCache(key: string): void {
  cache.delete(key)
  inFlight.delete(key)
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(LS_PREFIX + key) } catch { /* ignore */ }
  }
}

/** Clear everything — typically on sign-out. Wipes both layers. */
export function clearAllCache(): void {
  cache.clear()
  inFlight.clear()
  if (typeof window !== "undefined") {
    try {
      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith(LS_PREFIX)) keys.push(k)
      }
      for (const k of keys) window.localStorage.removeItem(k)
    } catch { /* ignore */ }
  }
}
