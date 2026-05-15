/**
 * Lightweight in-memory rate limiter (Phase 14.12 S2).
 *
 * Deliberately NOT Redis/Upstash — for a single-instance deployment
 * serving a closed beta (20-50 users) an in-process fixed-window
 * counter is sufficient and adds zero infra/cost/failure-surface.
 * (If the app ever horizontally scales, swap the Map for a shared
 * store behind the same `checkRateLimit` signature.)
 *
 * Strategy: fixed window. Each key gets `limit` requests per
 * `windowMs`. A background sweep evicts stale buckets so the Map
 * doesn't grow unbounded.
 *
 * Usage in a route handler:
 *
 *   import { checkRateLimit, clientKey } from "@/lib/utils/rate-limit"
 *
 *   const rl = checkRateLimit(`push-sub:${clientKey(req)}`, {
 *     limit: 10, windowMs: 60_000,
 *   })
 *   if (!rl.ok) {
 *     return NextResponse.json(
 *       { error: "too_many_requests" },
 *       { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
 *     )
 *   }
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Periodic eviction of expired buckets. `unref()` so this timer never
// keeps a serverless function / process alive on its own.
const SWEEP_MS = 5 * 60_000
let sweeper: ReturnType<typeof setInterval> | null = null
function ensureSweeper() {
  if (sweeper) return
  sweeper = setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }, SWEEP_MS)
  // Node-only; guarded for edge runtime.
  ;(sweeper as unknown as { unref?: () => void }).unref?.()
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSec: number
}

/**
 * Fixed-window check. Returns ok=false once `limit` is exceeded for
 * `key` within the current window.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  ensureSweeper()
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.limit - 1, retryAfterSec: 0 }
  }

  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    retryAfterSec: 0,
  }
}

/**
 * Best-effort client identifier for a Request. Prefers the proxy
 * forwarded IP chain, falls back to a constant so the limiter still
 * applies a global ceiling when the IP is unknown.
 */
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    // First IP in the list is the original client.
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  )
}
