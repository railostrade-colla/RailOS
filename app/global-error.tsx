"use client"

/**
 * Top-level error boundary for the App Router.
 *
 * Triggers when an error escapes every nested error.tsx — typically a
 * crash inside the root layout or a render error before any boundary
 * mounts. Sentry recommends a `global-error.tsx` to make sure these
 * still get captured.
 *
 * The component must render its OWN <html> + <body> because it
 * replaces the root layout when active.
 */

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          background: "#000",
          color: "#fff",
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Tajawal, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            حدث خطأ غير متوقّع
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#a1a1aa",
              lineHeight: 1.7,
              marginBottom: 24,
            }}
          >
            تمّ تسجيل الخطأ لدينا تلقائياً وسنُصلحه قريباً.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#fafafa",
              color: "#000",
              border: 0,
              padding: "12px 24px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: 16,
                fontSize: 10,
                color: "#52525b",
                fontFamily: "monospace",
              }}
            >
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
