import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  /* config options here */
}

/**
 * Sentry build-time options.
 *
 * Source-map upload only runs when SENTRY_AUTH_TOKEN + SENTRY_ORG +
 * SENTRY_PROJECT are all set (typically on Railway, not locally).
 * Without them, Sentry still captures errors but stack traces stay
 * minified — that's fine for a first push.
 */
export default withSentryConfig(nextConfig, {
  // Org / project — read from env so we don't hard-code values.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Quiet plugin during local dev; verbose in CI.
  silent: !process.env.CI,

  // Uploads source maps for client + server bundles.
  widenClientFileUpload: true,

  // Drops Sentry's verbose console.log from the production bundle.
  disableLogger: true,

  // Adds React component names to spans (better stack traces).
  reactComponentAnnotation: { enabled: true },

  // Optional: tunnel route to bypass ad-blockers. Set to a path you
  // don't already use — keep disabled for now to avoid surprises.
  // tunnelRoute: "/monitoring",
})
