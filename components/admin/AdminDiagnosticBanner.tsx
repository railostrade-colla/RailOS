"use client"

/**
 * Admin diagnostic banner (Phase 10.41).
 *
 * Surfaces the auth → admin handshake status at the top of the
 * admin shell. Renders nothing when everything is wired correctly
 * (the common case after onboarding); otherwise it shows a clear
 * red card explaining exactly why admin queries are returning empty
 * + a one-click "promote me to super_admin" button when the system
 * hasn't been bootstrapped yet.
 *
 * Most common failure modes this catches:
 *   1. Not signed in       → "سجّل دخولك أولاً"
 *   2. profiles row missing → "أنشئ profile لحسابك"
 *   3. role = 'user'        → "ليست لديك صلاحيات إدارية"
 *   4. No super_admin yet   → "اضغط لتعيين نفسك كأوّل super_admin"
 *
 * Mounting: rendered inside app/admin/layout.tsx so every admin
 * page sees it. Hidden completely when is_admin === true.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, AlertTriangle, Sparkles, RefreshCw, Lock } from "lucide-react"
import {
  whoamiAdmin,
  bootstrapFirstSuperAdmin,
  type WhoamiAdminResult,
} from "@/lib/data/admin-utilities"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

export function AdminDiagnosticBanner() {
  const [info, setInfo] = useState<WhoamiAdminResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(false)

  const reload = () => {
    setLoading(true)
    whoamiAdmin().then((r) => {
      setInfo(r)
      setLoading(false)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  const handleBootstrap = async () => {
    setBootstrapping(true)
    const r = await bootstrapFirstSuperAdmin()
    setBootstrapping(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        already_seeded: "هناك مسؤول أعلى موجود بالفعل — تواصل معه ليرفع صلاحياتك",
        missing_migration: "Migration 10.41 غير منشورة على Supabase — طبّقها أولاً",
      }
      showError(map[r.reason ?? ""] ?? r.reason ?? "فشل التعيين")
      return
    }
    showSuccess("✅ تم تعيينك كـ super_admin — أعِد تحميل الصفحة")
    reload()
    // Hard reload so RLS-gated queries refresh with the new role.
    setTimeout(() => window.location.reload(), 1200)
  }

  // Hide while loading the first check to avoid a flash of the
  // banner on every page nav.
  if (loading) return null

  // All good — render nothing.
  if (info?.is_admin) return null

  // ─── Failure variants ───
  const notSignedIn = !info?.authenticated
  const noProfile = info?.authenticated && !info.has_profile_row
  const notAdmin = info?.authenticated && info.has_profile_row && !info.is_admin
  const canBootstrap = info?.authenticated && (info.super_admin_count ?? 1) === 0

  return (
    <div
      dir="rtl"
      className={cn(
        "border-b px-5 py-3 flex items-start gap-3",
        notSignedIn
          ? "bg-yellow-400/[0.05] border-yellow-400/[0.25]"
          : "bg-red-400/[0.05] border-red-400/[0.25]",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0",
          notSignedIn
            ? "bg-yellow-400/[0.1] border-yellow-400/[0.3]"
            : "bg-red-400/[0.1] border-red-400/[0.3]",
        )}
      >
        {notSignedIn ? (
          <Lock className="w-4 h-4 text-yellow-400" strokeWidth={1.8} />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-400" strokeWidth={1.8} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn(
            "text-sm font-bold",
            notSignedIn ? "text-yellow-400" : "text-red-400",
          )}>
            {notSignedIn && "🔒 لم تسجّل دخولك بعد"}
            {noProfile && "⚠️ حسابك بدون profile — تعذّر التحقّق من صلاحياتك"}
            {notAdmin && "⚠️ ليست لديك صلاحيات إدارية"}
          </div>
          {info?.role && info.role !== "unknown" && (
            <span className="text-[10px] bg-white/[0.05] border border-white/[0.1] rounded px-2 py-0.5 font-mono text-neutral-300">
              role: {info.role}
            </span>
          )}
          {info?.user_id && (
            <span
              className="text-[10px] bg-white/[0.05] border border-white/[0.1] rounded px-2 py-0.5 font-mono text-neutral-400"
              dir="ltr"
            >
              uid: {info.user_id.slice(0, 8)}…
            </span>
          )}
          <span className="text-[10px] bg-white/[0.05] border border-white/[0.1] rounded px-2 py-0.5 font-mono text-neutral-400">
            super_admins: {info?.super_admin_count ?? 0}
          </span>
        </div>

        <div className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
          {notSignedIn && (
            <>سجّل دخولك من{" "}
              <Link href="/admin-login" className="text-blue-400 underline hover:text-blue-300">
                صفحة الدخول الإداري
              </Link>{" "}
              ثم عُد إلى هنا.
            </>
          )}
          {noProfile && (
            <>قاعدة البيانات لا تحوي صفّاً في <code className="font-mono bg-black/30 px-1 rounded">profiles</code> لحسابك.
              {canBootstrap
                ? " اضغط الزرّ التالي لإنشائه + تعيينك كأوّل super_admin."
                : " اطلب من المسؤول الأعلى إضافة الصفّ يدوياً."}
            </>
          )}
          {notAdmin && (
            <>
              <Shield className="inline w-3 h-3 -mt-0.5 mx-0.5" />
              لكي ترى طلبات السفير + الرسوم + KYC + النزاعات وغيرها، يجب أن يكون
              <code className="font-mono bg-black/30 px-1 rounded mx-1">profiles.role</code>
              أحد القيمتيْن{" "}
              <span className="font-mono text-yellow-300">admin</span> أو{" "}
              <span className="font-mono text-yellow-300">super_admin</span>.
              {canBootstrap
                ? " بما أنّه لا يوجد super_admin بعد، يمكنك تعيين نفسك بنقرة واحدة:"
                : " اطلب من المسؤول الأعلى الحالي رفع صلاحياتك."}
            </>
          )}
        </div>

        <div className="flex gap-2 mt-2.5 flex-wrap">
          {canBootstrap && info?.authenticated && (
            <button
              onClick={handleBootstrap}
              disabled={bootstrapping}
              className="flex items-center gap-1.5 bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-300 hover:bg-purple-500/[0.2] rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {bootstrapping ? "جارٍ..." : "عيِّنّي كأوّل super_admin"}
            </button>
          )}
          <button
            onClick={reload}
            className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.1] text-white hover:bg-white/[0.08] rounded-md px-3 py-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة الفحص
          </button>
        </div>
      </div>
    </div>
  )
}
