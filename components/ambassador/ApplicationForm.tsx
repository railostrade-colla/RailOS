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
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
import {
  submitAmbassadorApplication,
  type SubmitApplicationInput,
} from "@/lib/mock-data/ambassadors"

const MAX_TEXT = 300
const MIN_TEXT = 50

const SOCIAL_PLATFORMS = [
  { id: "instagram", icon: "📸", label: "Instagram", placeholder: "@username" },
  { id: "twitter",   icon: "🐦", label: "X (Twitter)", placeholder: "@username" },
  { id: "tiktok",    icon: "🎵", label: "TikTok",     placeholder: "@username" },
  { id: "linkedin",  icon: "💼", label: "LinkedIn",   placeholder: "اسم الحساب أو الرابط" },
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
  { icon: Sparkles,   label: "5% من رسوم المُحالين", color: "text-yellow-400", bg: "bg-yellow-400/[0.08]", border: "border-yellow-400/[0.25]" },
  { icon: Trophy,     label: "مكافآت milestones",     color: "text-orange-400", bg: "bg-orange-400/[0.08]", border: "border-orange-400/[0.25]" },
  { icon: BarChart3,  label: "لوحة تحكّم متقدّمة",   color: "text-blue-400",   bg: "bg-blue-400/[0.08]",   border: "border-blue-400/[0.25]" },
  { icon: Award,      label: "شارة سفير مميّزة",       color: "text-purple-400", bg: "bg-purple-400/[0.08]", border: "border-purple-400/[0.25]" },
]

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [reason, setReason] = useState("")
  const [experience, setExperience] = useState("")
  const [socials, setSocials] = useState<Record<string, string>>({})
  const [followers, setFollowers] = useState<SubmitApplicationInput["follower_range"] | "">("")
  const [referrals, setReferrals] = useState<SubmitApplicationInput["expected_referrals"] | "">("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptCommit, setAcceptCommit] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const filledSocials = SOCIAL_PLATFORMS.filter((p) => (socials[p.id] || "").trim().length > 0)

  const isValid =
    reason.trim().length >= MIN_TEXT &&
    reason.length <= MAX_TEXT &&
    experience.trim().length >= MIN_TEXT &&
    experience.length <= MAX_TEXT &&
    filledSocials.length >= 1 &&
    !!followers &&
    !!referrals &&
    acceptTerms &&
    acceptCommit

  const handleClickSubmit = () => {
    if (reason.trim().length < MIN_TEXT) return showError(`الجواب الأول يحتاج ${MIN_TEXT} حرف على الأقل`)
    if (experience.trim().length < MIN_TEXT) return showError(`الجواب الثاني يحتاج ${MIN_TEXT} حرف على الأقل`)
    if (filledSocials.length < 1) return showError("املأ حساب تواصل اجتماعي واحد على الأقل")
    if (!followers) return showError("اختر شريحة المتابعين")
    if (!referrals) return showError("اختر عدد الإحالات المتوقّعة")
    if (!acceptTerms || !acceptCommit) return showError("الموافقة على الشروط والتعهّد إجبارية")
    setShowConfirm(true)
  }

  const handleConfirmSubmit = async () => {
    setSubmitting(true)
    const result = submitAmbassadorApplication("me", {
      reason: reason.trim(),
      experience: experience.trim(),
      social_links: filledSocials.map((p) => ({ platform: p.id, url: socials[p.id].trim() })),
      follower_range: followers as SubmitApplicationInput["follower_range"],
      expected_referrals: referrals as SubmitApplicationInput["expected_referrals"],
    })
    setSubmitting(false)
    if (result.success) {
      setShowConfirm(false)
      setShowSubmitted(true)
    } else {
      showError("تعذّر إرسال الطلب — حاول لاحقاً")
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

      {/* Q1 */}
      <Question
        n={1}
        title="لماذا تريد أن تكون سفيراً؟"
        helper={`اكتب أسبابك ودوافعك (${MIN_TEXT}-${MAX_TEXT} حرف)`}
      >
        <CountedTextarea
          value={reason}
          onChange={setReason}
          placeholder="اكتب أسبابك ودوافعك..."
          rows={4}
        />
      </Question>

      {/* Q2 */}
      <Question
        n={2}
        title="ما خبرتك في التسويق أو الاستثمار؟"
        helper={`اكتب عن تجربتك السابقة (${MIN_TEXT}-${MAX_TEXT} حرف)`}
      >
        <CountedTextarea
          value={experience}
          onChange={setExperience}
          placeholder="اكتب عن تجربتك السابقة..."
          rows={4}
        />
      </Question>

      {/* Q3 */}
      <Question
        n={3}
        title="حسابات التواصل الاجتماعي"
        helper={`املأ حساباً واحداً على الأقل (المُكتمل: ${filledSocials.length})`}
      >
        <div className="space-y-2.5">
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p.id}>
              <label className="text-[11px] text-neutral-400 mb-1 block flex items-center gap-1.5">
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </label>
              <input
                type="text"
                value={socials[p.id] || ""}
                onChange={(e) => setSocials({ ...socials, [p.id]: e.target.value })}
                placeholder={p.placeholder}
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          ))}
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
              تم تعبئة <span className="text-white font-bold">{filledSocials.length}</span> حساب اجتماعي.
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

function CountedTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  const len = value.length
  const overLimit = len > MAX_TEXT
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        maxLength={MAX_TEXT}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none"
      />
      <div className="flex justify-end mt-1">
        <span className={cn(
          "text-[10px] font-mono",
          overLimit ? "text-red-400" : len < MIN_TEXT ? "text-yellow-400" : "text-neutral-500"
        )}>
          {len.toLocaleString("en-US")} / {MAX_TEXT.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  )
}
