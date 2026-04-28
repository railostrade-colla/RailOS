"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { signInWithEmail } from "@/lib/supabase/auth-helpers"
import { showSuccess, showError } from "@/lib/utils/toast"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      showError("أدخل البريد الإلكتروني وكلمة المرور")
      return
    }
    setLoading(true)
    const { data, error } = await signInWithEmail(email, password)
    setLoading(false)

    if (error) {
      if (error.message.includes("Invalid login")) {
        showError("البريد أو كلمة المرور غير صحيحة")
      } else if (error.message.includes("Email not confirmed")) {
        showError("يرجى تأكيد بريدك الإلكتروني أولاً")
      } else {
        showError(error.message || "حدث خطأ، حاول مرة أخرى")
      }
      return
    }

    if (data.user) {
      showSuccess("تم تسجيل الدخول ✓")
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <AuthLayout
      title="مرحباً بعودتك"
      subtitle="سجّل دخولك للمتابعة في Railos"
      badge="تسجيل الدخول"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              dir="ltr"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-neutral-400">كلمة المرور</label>
            <Link
              href="/forgot-password"
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-neutral-100 text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "تسجيل الدخول"
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-neutral-500">ليس لديك حساب؟ </span>
        <Link
          href="/register"
          className="text-white hover:text-neutral-300 font-medium"
        >
          إنشاء حساب
        </Link>
      </div>
    </AuthLayout>
  )
}
