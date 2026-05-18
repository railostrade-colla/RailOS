"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Gift,
} from "lucide-react"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { signUpWithEmail, signInWithGoogle } from "@/lib/supabase/auth-helpers"
import { getAmbassadorByCode, linkReferralByCode, type AmbassadorPreview } from "@/lib/data/referrals"
import { showSuccess, showError } from "@/lib/utils/toast"
import { useTranslations } from "next-intl"

export default function RegisterPage() {
  // useSearchParams() requires a Suspense boundary for static generation.
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("auth.register")
  const te = useTranslations("errors")
  const tn = useTranslations("notifications")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Ambassador referral preview (when ?ref=AMB-… is present in URL)
  const refCode = (searchParams?.get("ref") ?? "").trim()
  const [ambassador, setAmbassador] = useState<AmbassadorPreview | null>(null)

  useEffect(() => {
    if (!refCode) return
    let cancelled = false
    getAmbassadorByCode(refCode).then((preview) => {
      if (!cancelled) setAmbassador(preview)
    })
    return () => {
      cancelled = true
    }
  }, [refCode])

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle("/dashboard", refCode || undefined)
    if (error) {
      showError(error.message || te("googleFailed"))
      setGoogleLoading(false)
    }
    // On success the browser navigates away.
  }

  const isPasswordValid =
    password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  const isPasswordMatch =
    password === confirmPassword && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || name.trim().length < 3) {
      showError(t("nameHint"))
      return
    }
    if (!email) {
      showError(t("emailHint"))
      return
    }
    if (!isPasswordValid) {
      showError(te("pwdWeak"))
      return
    }
    if (!isPasswordMatch) {
      showError(te("pwdMismatch"))
      return
    }
    if (!agreed) {
      showError(te("mustAgreeTerms"))
      return
    }

    setLoading(true)
    const { data, error } = await signUpWithEmail(email, password, {
      full_name: name,
    })
    setLoading(false)

    if (error) {
      if (error.message.includes("already registered")) {
        showError(te("emailExists"))
      } else {
        showError(error.message)
      }
      return
    }

    if (data.user) {
      // Best-effort: attach the referral if a code was on the URL.
      if (refCode) {
        try {
          await linkReferralByCode(refCode)
        } catch {
          /* swallow — non-critical */
        }
      }
      showSuccess(tn("accountCreated"))
      // Phase 10.72 — fresh signups MUST complete profile before
      // entering the app. The /profile-setup page itself routes to
      // /dashboard once the form is submitted.
      router.push("/profile-setup")
      router.refresh()
    }
  }

  return (
    <AuthLayout
      title={t("title")}
      subtitle={t("subtitle")}
      badge={t("badge")}
    >
      {/* Ambassador referral banner */}
      {ambassador?.found && ambassador.ambassador_name && (
        <div className="mb-4 bg-green-500/[0.08] border border-green-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <Gift className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="text-xs text-green-300 leading-relaxed">
            {t("referralFrom")}
            <span className="font-bold text-green-200">{ambassador.ambassador_name}</span>
            {t("referralAuto")}
          </div>
        </div>
      )}

      {/* Google OAuth button */}
      <button
        onClick={handleGoogleSignup}
        disabled={googleLoading || loading}
        className="auth-primary-btn w-full bg-white text-black hover:bg-neutral-100 disabled:opacity-50 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 mb-4"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13.3 24 13.3c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.3 2.3-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.4 16.1 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.8-5 6.8-14.8 0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {t("googleButton")}
          </>
        )}
      </button>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] text-neutral-500">{t("orEmail")}</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            {t("nameLabel")}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
          </div>
        </div>

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

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            {t("pwdLabel")}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("pwdHint")}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="auth-eye-btn absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              aria-label={showPassword ? t("hidePwd") : t("showPwd")}
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
                {t("pwdValidHint")}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-1.5 block">
            {t("confirmLabel")}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("pwdRepeat")}
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
                {isPasswordMatch ? t("pwdMatch") : t("pwdNoMatch")}
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
            {t("agreePre")}
            <Link href="/terms" className="text-white hover:underline">
              {t("termsLink")}
            </Link>
            {t("agreeAnd")}
            <Link href="/privacy" className="text-white hover:underline">
              {t("privacyLink")}
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="auth-primary-btn w-full bg-neutral-100 text-black hover:bg-neutral-200 disabled:opacity-50 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t("submit")
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-neutral-500">{t("haveAccount")}</span>
        <Link
          href="/login"
          className="text-white hover:text-neutral-300 font-medium"
        >
          {t("signInLink")}
        </Link>
      </div>
    </AuthLayout>
  )
}
