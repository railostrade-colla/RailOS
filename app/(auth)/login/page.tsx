"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, Eye, EyeOff, Loader2, Fingerprint, X } from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { signInWithEmail } from "@/lib/supabase/auth-helpers"
import { showSuccess, showError } from "@/lib/utils/toast"
import {
  isBiometricSupported,
  hasAnyBiometricEnabled,
  loginWithBiometric,
  registerBiometric,
  isBiometricPromptDismissed,
  dismissBiometricPrompt,
} from "@/lib/auth/biometric"
import { cn } from "@/lib/utils/cn"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [showBioPrompt, setShowBioPrompt] = useState(false)
  const [pendingBioUser, setPendingBioUser] = useState<{ id: string; email: string } | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    if (isBiometricSupported() && hasAnyBiometricEnabled()) {
      setBioAvailable(true)
    }
  }, [])

  // ─────── Standard email/password login ───────
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
      } else {
        showError(error.message || "حدث خطأ، حاول مرة أخرى")
      }
      return
    }

    if (data.user) {
      showSuccess("تم تسجيل الدخول ✓")

      // Offer biometric registration on first login (if not dismissed)
      const userId = data.user.id
      const userEmail = data.user.email ?? email
      if (
        isBiometricSupported() &&
        !hasAnyBiometricEnabled() &&
        !isBiometricPromptDismissed()
      ) {
        setPendingBioUser({ id: userId, email: userEmail })
        setShowBioPrompt(true)
        return  // wait for user choice
      }

      router.push("/dashboard")
      router.refresh()
    }
  }

  // ─────── Biometric login ───────
  const handleBiometricLogin = async () => {
    setBioLoading(true)
    const result = await loginWithBiometric()
    setBioLoading(false)

    if (!result.success) {
      showError(result.error ?? "فشل تسجيل الدخول بالبصمة")
      return
    }
    showSuccess("تم تسجيل الدخول بالبصمة ✓")
    router.push("/dashboard")
    router.refresh()
  }

  // ─────── Enable biometric (after first login) ───────
  const handleEnableBiometric = async () => {
    if (!pendingBioUser) return
    setBioLoading(true)
    const result = await registerBiometric(pendingBioUser.id, pendingBioUser.email)
    setBioLoading(false)

    if (result.success) {
      showSuccess("تم تفعيل البصمة 👆")
    } else {
      showError(result.error ?? "تعذّر التفعيل")
    }

    setShowBioPrompt(false)
    setPendingBioUser(null)
    router.push("/dashboard")
    router.refresh()
  }

  const handleSkipBiometric = () => {
    if (dontAskAgain) dismissBiometricPrompt()
    setShowBioPrompt(false)
    setPendingBioUser(null)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <AuthLayout
      title="مرحباً بعودتك"
      subtitle="سجّل دخولك للمتابعة في Railos"
      badge="تسجيل الدخول"
    >
      {/* Biometric login button */}
      {bioAvailable && (
        <>
          <button
            onClick={handleBiometricLogin}
            disabled={bioLoading}
            className="w-full bg-blue-500/[0.1] border border-blue-500/30 text-blue-400 hover:bg-blue-500/[0.15] disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 mb-4"
          >
            {bioLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Fingerprint className="w-4 h-4" strokeWidth={2} />
                تسجيل دخول بالبصمة
              </>
            )}
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[10px] text-neutral-500">أو</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
        </>
      )}

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

      {/* ═══ Biometric Enrollment Prompt ═══ */}
      {showBioPrompt && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={handleSkipBiometric}
        >
          <div
            className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleSkipBiometric}
              className="absolute left-4 top-4 text-neutral-500 hover:text-white"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-20 h-20 rounded-full bg-blue-500/[0.1] border-2 border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                <Fingerprint className="w-10 h-10 text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="text-lg font-bold text-white mb-1.5">
                تفعيل تسجيل الدخول بالبصمة
              </div>
              <div className="text-xs text-neutral-400 leading-relaxed">
                ادخل التطبيق بسرعة دون الحاجة لكتابة كلمة المرور — استخدم بصمتك أو Face ID.
              </div>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[11px] text-neutral-400">
                لا تسأل مرة أخرى
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleSkipBiometric}
                disabled={bioLoading}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                لاحقاً
              </button>
              <button
                onClick={handleEnableBiometric}
                disabled={bioLoading}
                className={cn(
                  "flex-[2] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  bioLoading
                    ? "bg-white/[0.05] text-neutral-600"
                    : "bg-neutral-100 text-black hover:bg-neutral-200"
                )}
              >
                {bioLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" strokeWidth={2} />
                    ✓ تفعيل
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
