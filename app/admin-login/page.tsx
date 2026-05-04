"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Shield } from "lucide-react"
import { showSuccess, showError } from "@/lib/utils/toast"
import { signInWithEmail } from "@/lib/supabase/auth-helpers"
import { createClient } from "@/lib/supabase/client"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      showError("يرجى ملء كل الحقول")
      return
    }
    setLoading(true)
    try {
      // 1. Real Supabase sign-in.
      const { data, error } = await signInWithEmail(email.trim(), password)
      if (error || !data?.user) {
        showError(error?.message ?? "بيانات الدخول غير صحيحة")
        setLoading(false)
        return
      }

      // 2. Verify the signed-in profile has admin role.
      const supabase = createClient()
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        showError("تعذّر التحقق من الصلاحيات")
        setLoading(false)
        return
      }

      const role = (profile as { role?: string }).role
      if (role !== "admin" && role !== "super_admin") {
        // Sign out and bounce — non-admins shouldn't keep a session
        // that landed on /admin-login.
        await supabase.auth.signOut()
        showError("هذا الحساب ليس لديه صلاحيات إدارية")
        setLoading(false)
        return
      }

      showSuccess("مرحباً بك أيها المسؤول")
      // Hard navigation so the proxy/middleware sees the fresh cookie
      // before evaluating the /admin route guard.
      window.location.href = "/admin?tab=dashboard"
    } catch (err) {
      showError(err instanceof Error ? err.message : "حدث خطأ غير متوقّع")
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
<div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-bold text-white mb-1">RaiLOS</div>
          <div className="text-xs text-neutral-500">لوحة الإدارة - منطقة محمية</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6 backdrop-blur">
          <div className="text-base font-bold text-white mb-1">تسجيل الدخول</div>
          <div className="text-xs text-neutral-500 mb-5">دخول للمسؤولين فقط</div>

          {/* Email */}
          <div className="mb-3">
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                dir="ltr"
                autoComplete="email"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
          >
            {loading ? "جاري التحقق..." : "دخول للوحة الإدارة"}
          </button>

          {/* Hint */}
          <div className="mt-4 bg-yellow-400/[0.06] border border-yellow-400/20 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-yellow-400">⚠️ كل محاولات الدخول مسجّلة لأغراض أمنية</div>
          </div>
        </form>

        {/* Back to app */}
        <div className="text-center mt-5">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-neutral-500 hover:text-white"
          >
            ← العودة للتطبيق
          </button>
        </div>
      </div>
    </div>
  )
}
