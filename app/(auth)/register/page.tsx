"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { signUpWithEmail } from "@/lib/supabase/auth-helpers"
import { showSuccess, showError } from "@/lib/utils/toast"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const isPasswordValid =
    password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  const isPasswordMatch =
    password === confirmPassword && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || name.trim().length < 3) {
      showError("أدخل اسمك الكامل (3 أحرف على الأقل)")
      return
    }
    if (!email) {
      showError("أدخل البريد الإلكتروني")
      return
    }
    if (!isPasswordValid) {
      showError("كلمة المرور يجب أن تحتوي على 8 أحرف أو أكثر (حروف وأرقام)")
      return
    }
    if (!isPasswordMatch) {
      showError("كلمتا المرور غير متطابقتين")
      return
    }
    if (!agreed) {
      showError("يجب الموافقة على الشروط والأحكام")
      return
    }

    setLoading(true)
    const { data, error } = await signUpWithEmail(email, password, {
      full_name: name,
    })
    setLoading(false)

    if (error) {
      if (error.message.includes("already registered")) {
        showError("هذا البريد مسجل مسبقاً، جرّب تسجيل الدخول")
      } else {
        showError(error.message)
      }
      return
    }

    if (data.user) {
      showSuccess("تم إنشاء حسابك بنجاح، مرحباً في Railos! 🎉")
      router.push("/profile-setup")
    }
  }

  return (
    <AuthLayout
      title="إنشاء حساب جديد"
      subtitle="ابدأ رحلتك الاستثمارية مع Railos"
      badge="تسجيل جديد"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            الاسم الكامل
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أحمد محمد"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>
        </div>

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
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            كلمة المرور
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل (حروف وأرقام)"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
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
          {password && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <CheckCircle2
                className={`w-3 h-3 ${isPasswordValid ? "text-green-400" : "text-neutral-600"}`}
              />
              <span
                className={
                  isPasswordValid ? "text-green-400" : "text-neutral-500"
                }
              >
                8 أحرف + حروف وأرقام
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            تأكيد كلمة المرور
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد كلمة المرور"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>
          {confirmPassword && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <CheckCircle2
                className={`w-3 h-3 ${isPasswordMatch ? "text-green-400" : "text-neutral-600"}`}
              />
              <span
                className={
                  isPasswordMatch ? "text-green-400" : "text-neutral-500"
                }
              >
                {isPasswordMatch ? "كلمتا المرور متطابقتين" : "غير متطابقتين"}
              </span>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded bg-white/[0.05] border border-white/[0.2]"
          />
          <span className="text-xs text-neutral-400 leading-relaxed">
            أوافق على{" "}
            <Link href="/terms" className="text-white hover:underline">
              شروط الاستخدام
            </Link>{" "}
            و{" "}
            <Link href="/privacy" className="text-white hover:underline">
              سياسة الخصوصية
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-neutral-100 text-black hover:bg-neutral-200 disabled:opacity-50 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "إنشاء الحساب"
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-neutral-500">لديك حساب بالفعل؟ </span>
        <Link
          href="/login"
          className="text-white hover:text-neutral-300 font-medium"
        >
          تسجيل الدخول
        </Link>
      </div>
    </AuthLayout>
  )
}
