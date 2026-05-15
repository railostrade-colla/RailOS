/**
 * 404 page (Phase 14.11 A1).
 *
 * Rendered by Next.js App Router for any unmatched route and for
 * explicit `notFound()` calls. It's a Server Component (no client
 * JS needed) and renders inside the root layout so the user keeps
 * the dark shell. RTL Arabic, consistent with the app's design
 * tokens (bg-white/[0.04] cards, rounded-xl buttons).
 */

import Link from "next/link"

export default function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-[70vh] flex items-center justify-center px-4 py-12"
    >
      <div className="max-w-md w-full text-center">
        <div className="text-6xl font-bold font-mono text-white/20 mb-2">
          404
        </div>
        <div className="text-4xl mb-4">🧭</div>
        <h1 className="text-xl font-bold text-white mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          الرابط الذي تحاول الوصول إليه غير صحيح أو تمّ نقله. تأكّد من
          العنوان أو عُد إلى الصفحة الرئيسية.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="bg-neutral-100 text-black hover:bg-neutral-200 font-bold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/market"
            className="bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/20 rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            تصفّح السوق
          </Link>
        </div>
      </div>
    </div>
  )
}
