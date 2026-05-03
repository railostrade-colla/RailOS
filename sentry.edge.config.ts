/**
 * Sentry — Edge runtime initialisation.
 * Loaded by `instrumentation.ts` when NEXT_RUNTIME === "edge".
 * Covers: proxy.ts (middleware), edge route handlers, edge SSR.
 *
 * Edge runtime has stricter limits than Node — we keep this config
 * minimal (no replays, no profiling).
 */

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Lower sample rate on the edge — every middleware hit is a request.
  tracesSampleRate: 0.05,

  debug: false,
  sendDefaultPii: false,
})
