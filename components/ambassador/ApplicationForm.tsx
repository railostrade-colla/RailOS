"use client"

/**
 * Ambassador application form (Q1-Q6) — collected when status === "none".
 * Validation:
 *  - Q1, Q2: required, min 50 chars, max 300
 *  - Q3: at least one social link
 *  - Q4, Q5: required selects
 *  - Q6: both checkboxes required
 */

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Star, X, Send, Sparkles, Trophy, BarChart3, Award } from "lucide-react"
import { showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import {
  submitAmbassadorApplication,
  type SubmitApplicationInput,
} from "@/lib/data/ambassador"

// Social platforms — just checkboxes now ("هل تملك حساب؟"). No URL required.
const SOCIAL_PLATFORMS = [
  { id: "instagram", icon: "📸", label: "Instagram" },
  { id: "twitter",   icon: "🐦", label: "X (Twitter)" },
  { id: "tiktok",    icon: "🎵", label: "TikTok" },
  { id: "facebook",  icon: "📘", label: "Facebook" },
  { id: "youtube",   icon: "▶️", label: "YouTube" },
  { id: "telegram",  icon: "✈️", label: "Telegram" },
  { id: "linkedin",  icon: "💼", label: "LinkedIn" },
  { id: "snapchat",  icon: "👻", label: "Snapchat" },
] as const

// Q1 — predefined reasons. `value` is DB-canonical Arabic (stored on
// the application + read by the admin panel); the display label is
// localized via `key`.
const REASON_OPTIONS = [
  { value: "أحب نشر فرص الاستثمار في العراق",          key: "afReason1" },
  { value: "لدي شبكة معارف واسعة وأود الاستفادة منها", key: "afReason2" },
  { value: "أبحث عن دخل إضافي من المكافآت",            key: "afReason3" },
  { value: "أريد المساهمة في نمو منصة عراقية",         key: "afReason4" },
  { value: "لخبرتي في الإقناع والتسويق",               key: "afReason5" },
  { value: "كل ما سبق",                                key: "afReason6" },
] as const

// Q2 — predefined experience levels (same canonical-value pattern).
const EXPERIENCE_OPTIONS = [
  { value: "خبرة عملية في التسويق الرقمي",        key: "afExp1" },
  { value: "مستثمر شخصي بخبرة سنوات",             key: "afExp2" },
  { value: "عملت في المبيعات أو إقناع العملاء",   key: "afExp3" },
  { value: "صانع محتوى على وسائل التواصل",        key: "afExp4" },
  { value: "خبرة قليلة لكن لدي حماس عالٍ",         key: "afExp5" },
  { value: "بدون خبرة سابقة لكن مستعد للتعلم",     key: "afExp6" },
] as const

const FOLLOWER_RANGES = [
  { value: "<1k",      labelKey: "afFollow1" },
  { value: "1k-10k",   labelKey: "afFollow2" },
  { value: "10k-100k", labelKey: "afFollow3" },
  { value: ">100k",    labelKey: "afFollow4" },
] as const

const EXPECTED_REFERRALS = [
  { value: "1-5",   labelKey: "afRef1" },
  { value: "5-20",  labelKey: "afRef2" },
  { value: "20-50", labelKey: "afRef3" },
  { value: ">50",   labelKey: "afRef4" },
] as const

const BENEFITS = [
  { icon: Sparkles,   labelKey: "afBenefit1", color: "text-yellow-400", bg: "bg-yellow-400/[0.08]", border: "border-yellow-400/[0.25]" },
  { icon: Trophy,     labelKey: "afBenefit2", color: "text-orange-400", bg: "bg-orange-400/[0.08]", border: "border-orange-400/[0.25]" },
  { icon: BarChart3,  labelKey: "afBenefit3", color: "text-blue-400",   bg: "bg-blue-400/[0.08]",   border: "border-blue-400/[0.25]" },
  { icon: Award,      labelKey: "afBenefit4", color: "text-purple-400", bg: "bg-purple-400/[0.08]", border: "border-purple-400/[0.25]" },
]

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const t = useTranslations("extrasUI")
  // Q1/Q2 are dropdowns now — empty string until admin picks.
  const [reason, setReason] = useState("")
  const [experience, setExperience] = useState("")
  // Q3 — Set of platform IDs the user has an account on.
  const [socialsChecked, setSocialsChecked] = useState<Set<string>>(new Set())
  const [followers, setFollowers] = useState<SubmitApplicationInput["follower_range"] | "">("")
  const [referrals, setReferrals] = useState<SubmitApplicationInput["expected_referrals"] | "">("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptCommit, setAcceptCommit] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const checkedPlatforms = SOCIAL_PLATFORMS.filter((p) => socialsChecked.has(p.id))

  const isValid =
    !!reason &&
    !!experience &&
    checkedPlatforms.length >= 1 &&
    !!followers &&
    !!referrals &&
    acceptTerms &&
    acceptCommit

  const toggleSocial = (id: string) => {
    setSocialsChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleClickSubmit = () => {
    if (!reason) return showError(t("afErrReason"))
    if (!experience) return showError(t("afErrExp"))
    if (checkedPlatforms.length < 1) return showError(t("afErrSocial"))
    if (!followers) return showError(t("afErrFollowers"))
    if (!referrals) return showError(t("afErrReferrals"))
    if (!acceptTerms || !acceptCommit) return showError(t("afErrTerms"))
    setShowConfirm(true)
  }

  const handleConfirmSubmit = async () => {
    setSubmitting(true)
    const result = await submitAmbassadorApplication({
      reason: reason,
      experience: experience,
      // Send platform IDs only — empty URL since user just confirmed they have an account.
      social_links: checkedPlatforms.map((p) => ({ platform: p.id, url: "" })),
      follower_range: followers as SubmitApplicationInput["follower_range"],
      expected_referrals: referrals as SubmitApplicationInput["expected_referrals"],
    })
    setSubmitting(false)
    if (result.success) {
      setShowConfirm(false)
      setShowSubmitted(true)
    } else {
      showError(result.error || t("afErrSubmit"))
    }
  }

  return (
    <>
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-purple-500/[0.12] via-pink-500/[0.06] to-transparent border border-purple-400/[0.25] rounded-2xl p-5 mb-5 overflow-hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center">
            <Star className="w-6 h-6 text-purple-300" fill="currentColor" strokeWidth={1} />
          </div>
          <div>
            <div className="text-base font-bold text-white">{t("afHeroTitle")}</div>
            <div className="text-xs text-neutral-400">{t("afHeroSub")}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon
            return (
              <div key={i} className={cn("flex items-center gap-2 rounded-lg p-2.5 border", b.bg, b.border)}>
                <Icon className={cn("w-4 h-4 flex-shrink-0", b.color)} strokeWidth={1.5} />
                <span className="text-[11px] text-neutral-200 font-medium">{t(b.labelKey)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Q1 — dropdown */}
      <Question
        n={1}
        title={t("afQ1Title")}
        helper={t("afQ1Helper")}
      >
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">{t("afChooseReason")}</option>
          {REASON_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{t(r.key)}</option>
          ))}
        </select>
      </Question>

      {/* Q2 — dropdown */}
      <Question
        n={2}
        title={t("afQ2Title")}
        helper={t("afQ2Helper")}
      >
        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">{t("afChooseExp")}</option>
          {EXPERIENCE_OPTIONS.map((x) => (
            <option key={x.value} value={x.value}>{t(x.key)}</option>
          ))}
        </select>
      </Question>

      {/* Q3 — checkboxes only (no URL needed) */}
      <Question
        n={3}
        title={t("afQ3Title")}
        helper={t("afQ3Helper", { n: checkedPlatforms.length })}
      >
        <div className="grid grid-cols-2 gap-2">
          {SOCIAL_PLATFORMS.map((p) => {
            const isChecked = socialsChecked.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSocial(p.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right transition-colors",
                  isChecked
                    ? "bg-purple-400/[0.1] border-purple-400/[0.3] text-white"
                    : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                    isChecked
                      ? "bg-purple-400 border-purple-400"
                      : "border-neutral-600"
                  )}
                >
                  {isChecked && <span className="text-black text-[10px] font-bold">✓</span>}
                </div>
                <span className="text-base">{p.icon}</span>
                <span className="text-xs font-medium flex-1">{p.label}</span>
              </button>
            )
          })}
        </div>
      </Question>

      {/* Q4 */}
      <Question n={4} title={t("afQ4Title")}>
        <select
          value={followers}
          onChange={(e) => setFollowers(e.target.value as SubmitApplicationInput["follower_range"] | "")}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">{t("afChooseGeneric")}</option>
          {FOLLOWER_RANGES.map((r) => <option key={r.value} value={r.value}>{t(r.labelKey)}</option>)}
        </select>
      </Question>

      {/* Q5 */}
      <Question n={5} title={t("afQ5Title")}>
        <select
          value={referrals}
          onChange={(e) => setReferrals(e.target.value as SubmitApplicationInput["expected_referrals"] | "")}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">{t("afChooseGeneric")}</option>
          {EXPECTED_REFERRALS.map((r) => <option key={r.value} value={r.value}>{t(r.labelKey)}</option>)}
        </select>
      </Question>

      {/* Q6 */}
      <Question n={6} title={t("afQ6Title")}>
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span className="text-xs text-neutral-300 leading-relaxed">
              {t("afAgreePre")}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                {t("afTermsLink")}
              </a>
            </span>
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptCommit}
              onChange={(e) => setAcceptCommit(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span className="text-xs text-neutral-300 leading-relaxed">
              {t("afCommit")}
            </span>
          </label>
        </div>
      </Question>

      {/* Footer */}
      <div className="flex gap-2 mt-5">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back()
            else window.location.href = "/menu"
          }}
          className="flex-1 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleClickSubmit}
          disabled={!isValid}
          className={cn(
            "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
            isValid
              ? "bg-neutral-100 text-black hover:bg-neutral-200"
              : "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" strokeWidth={2} />
          {t("afSubmit")}
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && !showSubmitted && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">{t("afConfirmTitle")}</div>
              <button onClick={() => setShowConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-xs text-purple-300">
              {t("afConfirmBodyPre")}<span className="font-bold">{t("afDays")}</span>{t("afConfirmBodyPost")}
            </div>
            <div className="text-xs text-neutral-400 mb-4">
              {t("afSelectedPre")}<span className="text-white font-bold">{checkedPlatforms.length}</span>{t("afSelectedPost")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2] disabled:opacity-50"
              >
                {submitting ? t("afSubmitting") : t("afConfirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSubmitted && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-green-400/[0.3] rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-green-400/[0.1] border-2 border-green-400/[0.3] flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-green-400" strokeWidth={2} />
            </div>
            <div className="text-base font-bold text-white mb-2">{t("afSuccessTitle")}</div>
            <div className="text-xs text-neutral-300 leading-relaxed mb-4">
              {t("afSuccessBodyPre")}<span className="text-white font-bold">{t("afDays")}</span>{t("afSuccessBodyPost")}
            </div>
            <button
              onClick={() => {
                setShowSubmitted(false)
                onSubmitted()
              }}
              className="w-full py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2]"
            >
              {t("afFollowStatus")}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Subcomponents ──────────────────────────────────────

function Question({
  n,
  title,
  helper,
  children,
}: {
  n: number
  title: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full bg-purple-400/[0.15] border border-purple-400/[0.3] flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          {helper && <div className="text-[11px] text-neutral-500 mt-0.5">{helper}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

// CountedTextarea + MIN_TEXT/MAX_TEXT removed: Q1/Q2 are now dropdowns,
// no free-text answers anymore.
