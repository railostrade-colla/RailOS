"use client"

/**
 * Route-level error boundary (Phase 14.11 A1).
 *
 * Catches any error thrown while rendering a route segment under the
 * App Router. Unlike `global-error.tsx` (which replaces the root
 * layout and only fires when the layout itself crashes), this boundary
 * renders INSIDE the root layout — so the user keeps the app shell and
 * just sees a recoverable error card instead of a white screen.
 *
 * Every error is forwarded to Sentry so we get the stack + digest.
 */

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import Link from "next/link"

export default function RouteError({
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
    <div
      dir="rtl"
      className="min-h-[70vh] flex items-center justify-center px-4 py-12"
    >
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-white mb-2">
          حدث خطأ غير متوقّع
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          نأسف على الإزعاج. تمّ تسجيل المشكلة لدينا تلقائياً وسنُصلحها.
          يمكنك إعادة المحاولة أو العودة إلى الصفحة الرئيسية.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => reset()}
            className="bg-neutral-100 text-black hover:bg-neutral-200 font-bold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            إعادة المحاولة
          </button>
          <Link
            href="/dashboard"
            className="bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/20 rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            العودة للرئيسية
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-[10px] text-neutral-600 font-mono break-all">
            رمز الخطأ: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
