"use client"

/**
 * Admin-scoped error boundary.
 *
 * Catches any uncaught error inside `/admin/*` panels (e.g. a Rules-of-Hooks
 * violation, a missing migration, a malformed RPC response) and renders an
 * in-place recovery card with a one-click reset, a link back to the dashboard,
 * and the raw error message for the operator. Without this file, errors
 * propagate to the project-level error boundary which only shows a generic
 * "حدث خطأ غير متوقّع" wall.
 *
 * This file MUST be a client component — Next.js requires error boundaries
 * to opt into the client runtime.
 */

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react"

interface AdminErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  // Surface the error in the browser console so the founder can copy/paste
  // the full stack while a non-technical admin only sees the friendly card.
  useEffect(() => {
    console.error("[AdminError]", error)
  }, [error])

  // Best-effort detection of common error categories so we can show
  // a more specific hint than just the raw message.
  const msg = error?.message ?? ""
  const isHooksBug = /rendered (more|fewer|different) hooks/i.test(msg)
  const isMissingRpc =
    /function .* does not exist/i.test(msg) ||
    /could not find/i.test(msg) ||
    /relation .* does not exist/i.test(msg)

  return (
    <div className="p-6 max-w-2xl mx-auto" dir="rtl">
      <div className="bg-red-400/[0.05] border border-red-400/[0.25] rounded-2xl p-8">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-red-400/[0.1] border border-red-400/[0.3] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-7 h-7 text-red-400" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-white mb-1">
              تعذّر تحميل هذه الصفحة
            </div>
            <div className="text-xs text-neutral-400 leading-relaxed">
              حدث خطأ أثناء عرض اللوحة. باقي لوحة التحكم تعمل بشكل طبيعي —
              يمكنك إعادة المحاولة، أو الانتقال إلى لوحة أخرى.
            </div>
          </div>
        </div>

        {/* Smart hints */}
        {isHooksBug && (
          <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.25] rounded-xl p-3 mb-4 text-xs text-yellow-300">
            ⚠️ <span className="font-bold">Rules of Hooks</span> — لوحة بها
            استدعاء <code className="font-mono bg-black/30 px-1 rounded">useState</code> بعد
            <code className="font-mono bg-black/30 px-1 rounded mx-1">return</code> مشروط.
            راجع كود اللوحة ورتّب جميع الـ hooks في الأعلى.
          </div>
        )}
        {isMissingRpc && (
          <div className="bg-orange-400/[0.05] border border-orange-400/[0.25] rounded-xl p-3 mb-4 text-xs text-orange-300">
            🗄 <span className="font-bold">Migration ناقصة</span> — يبدو أن
            دالة أو جدول في Supabase غير منشور. طبّق آخر migration من المجلد
            <code className="font-mono bg-black/30 px-1 rounded mx-1">supabase/migrations/</code>
            ثم أعد المحاولة.
          </div>
        )}

        {/* Raw error (collapsible-ish — always visible since the audience is operators) */}
        <details className="bg-black/40 border border-white/[0.06] rounded-xl p-3 mb-4 group">
          <summary className="text-[11px] text-neutral-400 cursor-pointer hover:text-white">
            تفاصيل تقنية للمطوّر
          </summary>
          <pre
            className="text-[11px] text-red-300 font-mono mt-2 whitespace-pre-wrap break-words leading-relaxed"
            dir="ltr"
          >
            {msg || "Unknown error"}
            {error?.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        </details>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={reset}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-sm font-bold hover:bg-blue-500/[0.2]"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
          <Link
            href="/admin?tab=dashboard"
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm hover:bg-white/[0.08]"
          >
            <LayoutDashboard className="w-4 h-4" />
            لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  )
}
