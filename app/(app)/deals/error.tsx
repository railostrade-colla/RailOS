"use client"

/**
 * Route-level error boundary for /deals.
 * Same recovery pattern as /deals/[id]/error.tsx — keeps a render
 * crash inside the deal page from bubbling to the global wall.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"

export default function DealsListError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[deals] error boundary:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h1 className="text-base font-bold mb-2">تعذّر عرض الصفقات</h1>
        <p className="text-xs text-neutral-400 leading-relaxed mb-5">
          واجهت قائمة الصفقات خطأً مؤقتاً. جرّب إعادة المحاولة.
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
        {error.digest && (
          <p className="mt-4 text-[10px] text-neutral-600 font-mono" dir="ltr">{error.digest}</p>
        )}
      </div>
    </div>
  )
}
