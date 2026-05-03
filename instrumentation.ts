/**
 * Sentry — Server + Edge instrumentation dispatcher.
 *
 * Next.js calls `register()` once per runtime on cold start. We branch
 * by `NEXT_RUNTIME` so the right Sentry config is loaded:
 *
 *   nodejs  →  sentry.server.config.ts   (API routes, RSC, route handlers)
 *   edge    →  sentry.edge.config.ts     (proxy.ts, edge functions)
 *
 * `onRequestError` is a Next.js 15+ hook that fires when a server-side
 * route handler or RSC throws. We forward it to Sentry so 500s are
 * captured even when no client-side error boundary is hit.
 */

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
