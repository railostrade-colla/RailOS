/**
 * Sentry — Node.js server runtime initialisation.
 * Loaded by `instrumentation.ts` when NEXT_RUNTIME === "nodejs".
 * Covers: API route handlers, server components, server actions.
 */

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Sample 10 % of server transactions.
  tracesSampleRate: 0.1,

  debug: false,
  sendDefaultPii: false,
})
