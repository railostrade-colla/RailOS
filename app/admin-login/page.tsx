"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Shield } from "lucide-react"
import { GridBackground } from "@/components/layout/GridBackground"
import { showSuccess, showError } from "@/lib/utils/toast"

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
    setTimeout(() => {
      showSuccess("مرحباً بك أيها المسؤول")
      router.push("/admin?tab=dashboard")
    }, 800)
  }

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4" dir="rtl">
      <GridBackground showCircles={false} />

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
                placeholder="railostrade@gmail.com"
                dir="ltr"
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
