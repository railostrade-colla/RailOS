"use client"

/**
 * useStaleData — Phase 13.13.
 *
 * Stale-while-revalidate hook that wraps the cache layer in
 * `lib/data/cache.ts`. It handles the four states a data-driven
 * screen needs:
 *
 *   1. Cold-cache (first visit) → returns null → caller renders a
 *      skeleton instead of a spinner.
 *   2. Warm-cache (subsequent visits) → returns the last-known value
 *      INSTANTLY from localStorage, so the screen paints with content
 *      and never flashes empty.
 *   3. Background fetch → runs once on mount, silently swaps the
 *      data in place when it lands. No spinner, no full-page reload.
 *   4. Error → keeps the stale data on screen and surfaces error
 *      via an `error` flag so callers can show a toast if needed.
 *
 * Usage:
 *   const { data, isFresh, isFirstLoad, refetch } = useStaleData(
 *     "projects:trending:3",
 *     () => getTrendingProjects(3),
 *     { ttlMs: 30_000 },
 *   )
 *
 *   if (isFirstLoad) return <ProjectCardSkeleton count={3} />
 *   return data.map(...)
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { readPersistedSync, swrRevalidate } from "@/lib/data/cache"

export interface UseStaleDataOptions {
  /** Cache lifetime in milliseconds. Default: 30 seconds. */
  ttlMs?: number
  /** Skip the background fetch on mount. Useful for paginated UIs
   *  that want to control fetching manually via `refetch`. */
  skipInitialFetch?: boolean
}

export interface UseStaleDataResult<T> {
  /** Current data — last-known cached value, then fresh from network. */
  data: T | null
  /**
   * True when the cache was COLD on mount AND the first network
   * fetch is still pending. Use this to render a skeleton; once
   * data arrives (cached OR fresh) it flips to false.
   */
  isFirstLoad: boolean
  /** True only while a background refetch is in flight. Use this for
   *  a small "refreshing" badge if you want to hint at activity. */
  isRevalidating: boolean
  /** True when the data on screen came from a fresh fetch (not cache). */
  isFresh: boolean
  /** Last network error (if any). Stale data stays on screen. */
  error: unknown
  /** Force a fresh fetch — useful for pull-to-refresh or post-write
   *  invalidation. Updates state in place. */
  refetch: () => Promise<T | null>
}

export function useStaleData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseStaleDataOptions = {},
): UseStaleDataResult<T> {
  const { ttlMs = 30_000, skipInitialFetch = false } = options

  // Synchronous read from cache during render — no flash of empty.
  const initialRef = useRef<T | null>(null)
  if (initialRef.current === null) {
    initialRef.current = readPersistedSync<T>(key)
  }

  const [data, setData] = useState<T | null>(initialRef.current)
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(initialRef.current === null)
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false)
  const [isFresh, setIsFresh] = useState<boolean>(false)
  const [error, setError] = useState<unknown>(null)

  // Pin the fetcher in a ref so the effect doesn't re-fire when
  // the parent passes a new closure each render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async (): Promise<T | null> => {
    setIsRevalidating(true)
    setError(null)
    try {
      const fresh = await swrRevalidate(key, () => fetcherRef.current(), ttlMs)
      setData(fresh)
      setIsFresh(true)
      setIsFirstLoad(false)
      return fresh
    } catch (err) {
      setError(err)
      // Keep stale data on screen — don't blank it out.
      return data
    } finally {
      setIsRevalidating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttlMs])

  useEffect(() => {
    if (skipInitialFetch) return
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    data,
    isFirstLoad,
    isRevalidating,
    isFresh,
    error,
    refetch: run,
  }
}
