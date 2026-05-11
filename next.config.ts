import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  // ─── Performance ─────────────────────────────────────────
  // Tree-shake heavy icon/chart libraries so each route only ships
  // what it actually uses (Next 16 supports this directly).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
    ],
  },
  trailingSlash: false,
  // Static asset caching — browser keeps fonts/images around for 30
  // days, which is the biggest win for repeat-visitor performance.
  async headers() {
    // Phase 13.50 — security headers on every response.
    // CSP allows Supabase + Sentry + same-origin assets; tightened to
    // block iframe embedding (clickjacking) and content-type sniffing.
    // `'unsafe-inline'` on script-src is required for Next.js inline
    // hydration scripts (no nonce support yet); we will tighten when
    // Next adds nonce middleware.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.sentry.io https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ")

    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
      { key: "Content-Security-Policy", value: csp },
      // Cross-Origin isolation — keeps the page safe when third-party
      // scripts get loaded from CDNs.
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ]

    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, immutable" },
        ],
      },
      {
        // Apply security headers to every other route.
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
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
