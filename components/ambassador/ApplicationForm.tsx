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

// Q1 — predefined reasons (dropdown options)
const REASON_OPTIONS = [
  "أحب نشر فرص الاستثمار في العراق",
  "لدي شبكة معارف واسعة وأود الاستفادة منها",
  "أبحث عن دخل إضافي من المكافآت",
  "أريد المساهمة في نمو منصة عراقية",
  "لخبرتي في الإقناع والتسويق",
  "كل ما سبق",
] as const

// Q2 — predefined experience levels
const EXPERIENCE_OPTIONS = [
  "خبرة عملية في التسويق الرقمي",
  "مستثمر شخصي بخبرة سنوات",
  "عملت في المبيعات أو إقناع العملاء",
  "صانع محتوى على وسائل التواصل",
  "خبرة قليلة لكن لدي حماس عالٍ",
  "بدون خبرة سابقة لكن مستعد للتعلم",
] as const

const FOLLOWER_RANGES = [
  { value: "<1k",      label: "أقل من 1,000 متابع" },
  { value: "1k-10k",   label: "1,000 - 10,000 متابع" },
  { value: "10k-100k", label: "10,000 - 100,000 متابع" },
  { value: ">100k",    label: "أكثر من 100,000 متابع" },
] as const

const EXPECTED_REFERRALS = [
  { value: "1-5",   label: "1-5 إحالات" },
  { value: "5-20",  label: "5-20 إحالة" },
  { value: "20-50", label: "20-50 إحالة" },
  { value: ">50",   label: "أكثر من 50 إحالة" },
] as const

const BENEFITS = [
  { icon: Sparkles,   label: "2% من رسوم المُحالين", color: "text-yellow-400", bg: "bg-yellow-400/[0.08]", border: "border-yellow-400/[0.25]" },
  { icon: Trophy,     label: "مكافآت milestones",     color: "text-orange-400", bg: "bg-orange-400/[0.08]", border: "border-orange-400/[0.25]" },
  { icon: BarChart3,  label: "لوحة تحكّم متقدّمة",   color: "text-blue-400",   bg: "bg-blue-400/[0.08]",   border: "border-blue-400/[0.25]" },
  { icon: Award,      label: "شارة سفير مميّزة",       color: "text-purple-400", bg: "bg-purple-400/[0.08]", border: "border-purple-400/[0.25]" },
]

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
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
    if (!reason) return showError("اختر سبباً للانضمام")
    if (!experience) return showError("اختر مستوى الخبرة")
    if (checkedPlatforms.length < 1) return showError("اختر حساب تواصل اجتماعي واحد على الأقل")
    if (!followers) return showError("اختر شريحة المتابعين")
    if (!referrals) return showError("اختر عدد الإحالات المتوقّعة")
    if (!acceptTerms || !acceptCommit) return showError("الموافقة على الشروط والتعهّد إجبارية")
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
      showError(result.error || "تعذّر إرسال الطلب — حاول لاحقاً")
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
            <div className="text-base font-bold text-white">كن سفير رايلوس</div>
            <div className="text-xs text-neutral-400">مكافآت + لوحة تحكّم متقدّمة + شارة مميّزة</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon
            return (
              <div key={i} className={cn("flex items-center gap-2 rounded-lg p-2.5 border", b.bg, b.border)}>
                <Icon className={cn("w-4 h-4 flex-shrink-0", b.color)} strokeWidth={1.5} />
                <span className="text-[11px] text-neutral-200 font-medium">{b.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Q1 — dropdown */}
      <Question
        n={1}
        title="لماذا تريد أن تكون سفيراً؟"
        helper="اختر السبب الأقرب لدافعك"
      >
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">— اختر سبباً —</option>
          {REASON_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Question>

      {/* Q2 — dropdown */}
      <Question
        n={2}
        title="ما خبرتك في التسويق أو الاستثمار؟"
        helper="اختر مستوى خبرتك الأقرب"
      >
        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">— اختر مستوى الخبرة —</option>
          {EXPERIENCE_OPTIONS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
      </Question>

      {/* Q3 — checkboxes only (no URL needed) */}
      <Question
        n={3}
        title="حسابات التواصل الاجتماعي"
        helper={`أشّر على المنصّات التي تملك فيها حساباً (المُحدَّد: ${checkedPlatforms.length})`}
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
      <Question n={4} title="عدد المتابعين الإجمالي تقريباً">
        <select
          value={followers}
          onChange={(e) => setFollowers(e.target.value as SubmitApplicationInput["follower_range"] | "")}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">— اختر —</option>
          {FOLLOWER_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Question>

      {/* Q5 */}
      <Question n={5} title="كم إحالة تتوقّع تحقيقها شهرياً؟">
        <select
          value={referrals}
          onChange={(e) => setReferrals(e.target.value as SubmitApplicationInput["expected_referrals"] | "")}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
        >
          <option value="">— اختر —</option>
          {EXPECTED_REFERRALS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Question>

      {/* Q6 */}
      <Question n={6} title="شروط البرنامج">
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span className="text-xs text-neutral-300 leading-relaxed">
              أوافق على{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                شروط برنامج السفراء
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
              أتعهّد بترويج المنصة بطريقة احترافية وشفّافة دون تضليل أو ادّعاءات مبالغ فيها
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
          إلغاء
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
          📤 تقديم الطلب
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && !showSubmitted && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">📤 تأكيد التقديم</div>
              <button onClick={() => setShowConfirm(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-purple-400/[0.05] border border-purple-400/[0.2] rounded-xl p-3 mb-4 text-xs text-purple-300">
              سيتم إرسال طلبك للمراجعة. ستصلك النتيجة خلال <span className="font-bold">3-5 أيام عمل</span>.
            </div>
            <div className="text-xs text-neutral-400 mb-4">
              تم اختيار <span className="text-white font-bold">{checkedPlatforms.length}</span> حساب اجتماعي.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-purple-500/[0.15] border border-purple-500/[0.3] text-purple-400 text-sm font-bold hover:bg-purple-500/[0.2] disabled:opacity-50"
              >
                {submitting ? "جاري الإرسال..." : "تأكيد التقديم"}
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
            <div className="text-base font-bold text-white mb-2">✅ تم تقديم طلبك بنجاح!</div>
            <div className="text-xs text-neutral-300 leading-relaxed mb-4">
              ستصلك نتيجة المراجعة خلال <span className="text-white font-bold">3-5 أيام عمل</span>.
              يمكنك متابعة الحالة من هذه الصفحة.
            </div>
            <button
              onClick={() => {
                setShowSubmitted(false)
                onSubmitted()
              }}
              className="w-full py-3 rounded-xl bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-sm font-bold hover:bg-green-500/[0.2]"
            >
              متابعة الحالة
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
