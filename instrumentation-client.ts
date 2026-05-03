/**
 * Sentry — Client SDK initialisation.
 *
 * Runs in the browser. Imported automatically by Next.js when this file
 * exists at the project root (Next.js 16 convention).
 *
 * Behaviour with no DSN:
 *   `Sentry.init()` is a no-op when `dsn` is undefined — the app keeps
 *   working normally even before SENTRY_* env vars are set on Railway.
 */

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Sample 10 % of transactions for performance monitoring (cheap on free tier).
  tracesSampleRate: 0.1,

  // Session replay — only when an error happens (zero idle replays).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Don't ship debug logs in prod bundles.
  debug: false,

  // Strip personally-identifiable information automatically.
  sendDefaultPii: false,
})

/**
 * Reports React Server Component / app-router navigation transitions.
 * Required by Sentry to attach traces to client-side route changes.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
