"use client"

/**
 * Route-level error boundary for /exchange.
 * Catches errors in the buy/sell flow so the user sees a recoverable
 * card instead of the global wall.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"

export default function ExchangeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[exchange] error boundary:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h1 className="text-base font-bold mb-2">تعذّر تحميل سوق التبادل</h1>
        <p className="text-xs text-neutral-400 leading-relaxed mb-2">
          إذا حدث الخطأ بعد الضغط على شراء/بيع — قد يكون الإعلان غير مكتمل
          أو تطبيق Migration ناقص.
        </p>
        <p className="text-[11px] text-neutral-500 mb-5">
          جرّب إعادة المحاولة أو ارجع للرئيسية.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-200 transition-colors"
          >
            <RefreshCw className="w-3 h-3" strokeWidth={2.5} />
            إعادة المحاولة
          </button>
          <Link
            href="/dashboard"
            className="bg-white/[0.05] border border-white/[0.1] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-3 h-3 rotate-180" strokeWidth={2.5} />
            الرئيسية
          </Link>
        </div>
        {/* DEBUG INFO — show the actual error so we can fix it */}
        <details className="mt-4 text-right">
          <summary className="text-[11px] text-blue-400 cursor-pointer">
            عرض تفاصيل تقنية للمطوّر
          </summary>
          <div className="mt-2 bg-black/40 border border-white/[0.06] rounded p-2 text-left">
            <p className="text-[10px] text-red-300 font-mono break-all" dir="ltr">
              {error.name}: {error.message}
            </p>
            {error.stack && (
              <pre className="text-[9px] text-neutral-500 font-mono mt-2 whitespace-pre-wrap break-all overflow-auto max-h-40" dir="ltr">
                {error.stack.split("\n").slice(0, 8).join("\n")}
              </pre>
            )}
            {error.digest && (
              <p className="mt-2 text-[10px] text-neutral-500 font-mono" dir="ltr">
                digest: {error.digest}
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
