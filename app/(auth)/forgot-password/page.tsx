"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Loader2, CheckCircle2 } from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { resetPasswordForEmail } from "@/lib/supabase/auth-helpers"
import { showSuccess, showError } from "@/lib/utils/toast"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      showError("أدخل البريد الإلكتروني")
      return
    }
    setLoading(true)
    const { error } = await resetPasswordForEmail(email)
    setLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    showSuccess("تم إرسال رابط استعادة كلمة المرور")
    setSent(true)
  }

  return (
    <AuthLayout
      title="استعادة كلمة المرور"
      subtitle="سنرسل لك رابط لإعادة تعيين كلمة المرور"
      badge="استعادة"
    >
      {!sent ? (
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
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-100 text-black hover:bg-neutral-200 disabled:opacity-50 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "إرسال رابط الاستعادة"
            )}
          </button>
        </form>
      ) : (
        <div className="bg-green-400/[0.06] border border-green-400/20 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <div className="text-sm text-white font-medium mb-2">
            تم إرسال البريد!
          </div>
          <div className="text-xs text-neutral-400 leading-relaxed">
            تحقق من بريدك ({email}) واتبع التعليمات لإعادة تعيين كلمة المرور
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="text-white hover:text-neutral-300 font-medium"
        >
          ← العودة لتسجيل الدخول
        </Link>
      </div>
    </AuthLayout>
  )
}
