"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Loader2, CheckCircle2 } from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { resetPasswordForEmail } from "@/lib/supabase/auth-helpers"
import { showSuccess, showError } from "@/lib/utils/toast"
import { useTranslations } from "next-intl"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot")
  const te = useTranslations("errors")
  const tn = useTranslations("notifications")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      showError(t("emailPlaceholder"))
      return
    }
    setLoading(true)
    const { error } = await resetPasswordForEmail(email)
    setLoading(false)
    if (error) {
      showError(error.message)
      return
    }
    showSuccess(tn("resetLinkSent"))
    setSent(true)
  }

  return (
    <AuthLayout
      title={t("title")}
      subtitle={t("subtitle")}
      badge={t("badge")}
    >
      {!sent ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">
              {t("emailLabel")}
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
              t("submit")
            )}
          </button>
        </form>
      ) : (
        <div className="bg-green-400/[0.06] border border-green-400/20 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <div className="text-sm text-white font-medium mb-2">
            {t("sentTitle")}
          </div>
          <div className="text-xs text-neutral-400 leading-relaxed">
            {t("sentDesc", { email })}
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="text-white hover:text-neutral-300 font-medium"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthLayout>
  )
}
