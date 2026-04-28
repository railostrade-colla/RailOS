"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type Strength = "weak" | "medium" | "strong" | "very_strong"

const STRENGTH_LABEL: Record<Strength, string> = {
  weak: "ضعيف",
  medium: "متوسط",
  strong: "قوي",
  very_strong: "قوي جداً",
}

const STRENGTH_COLOR: Record<Strength, { bar: string; text: string; emoji: string }> = {
  weak: { bar: "bg-red-400", text: "text-red-400", emoji: "🔴" },
  medium: { bar: "bg-yellow-400", text: "text-yellow-400", emoji: "🟡" },
  strong: { bar: "bg-green-400", text: "text-green-400", emoji: "🟢" },
  very_strong: { bar: "bg-purple-400", text: "text-purple-400", emoji: "✨" },
}

function checkRules(pw: string) {
  return {
    minLen: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
  }
}

function computeStrength(pw: string): Strength {
  const r = checkRules(pw)
  const score = [r.minLen, r.upper, r.lower, r.digit, r.symbol].filter(Boolean).length
  if (score <= 1) return "weak"
  if (score === 2 || score === 3) return "medium"
  if (score === 4) return "strong"
  return "very_strong"
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [currentPw, setCurrentPw] = useState("")
  const [currentVerified, setCurrentVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)

  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // ─── Live derivations ──────────────────────────────────────────────
  const rules = useMemo(() => checkRules(newPw), [newPw])
  const strength = useMemo(() => computeStrength(newPw), [newPw])
  const allRulesMet = rules.minLen && rules.upper && rules.lower && rules.digit && rules.symbol
  const passwordsMatch = !!newPw && newPw === confirmPw
  const isDifferentFromCurrent = !!newPw && newPw !== currentPw

  const canSubmit =
    currentVerified && allRulesMet && passwordsMatch && isDifferentFromCurrent && !submitting

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!currentPw) {
      showError("أدخل كلمة المرور الحالية")
      return
    }
    setVerifying(true)
    await new Promise((r) => setTimeout(r, 600))

    // Mock check — accept any password ≥ 6 chars (server check happens later)
    if (currentPw.length < 6) {
      showError("كلمة المرور غير صحيحة")
      setCurrentVerified(false)
    } else {
      setCurrentVerified(true)
      showSuccess("تم التحقق ✓")
    }
    setVerifying(false)
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!currentVerified) showError("تحقّق من كلمة المرور الحالية أولاً")
      else if (!allRulesMet) showError("كلمة المرور لا تستوفي الشروط")
      else if (!passwordsMatch) showError("الكلمتان غير متطابقتين")
      else if (!isDifferentFromCurrent) showError("الكلمة الجديدة يجب أن تختلف عن الحالية")
      return
    }

    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    showSuccess("تم تحديث كلمة المرور بنجاح! 🔒")
    setTimeout(() => router.push("/profile"), 600)
  }

  const sc = STRENGTH_COLOR[strength]
  const strengthFill =
    strength === "weak" ? "w-1/4" :
    strength === "medium" ? "w-2/4" :
    strength === "strong" ? "w-3/4" : "w-full"

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-md mx-auto pb-20">

          <PageHeader
            title="تغيير كلمة المرور"
            subtitle="حدّث كلمة المرور للحفاظ على أمان حسابك"
            backHref="/profile"
          />

          {/* ═══ Section 1: Current password ═══ */}
          <div className={cn(
            "bg-white/[0.05] border rounded-2xl p-5 mb-4 backdrop-blur",
            currentVerified ? "border-green-400/30" : "border-white/[0.08]",
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-blue-400" strokeWidth={2} />
              <h3 className="text-sm font-bold text-white">كلمة المرور الحالية</h3>
              {currentVerified && (
                <span className="ml-auto text-[10px] text-green-400 font-bold bg-green-400/[0.1] border border-green-400/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  موثق
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => {
                    setCurrentPw(e.target.value)
                    if (currentVerified) setCurrentVerified(false)
                  }}
                  placeholder="أدخل كلمة المرور الحالية"
                  disabled={currentVerified}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white outline-none disabled:opacity-60 transition-colors"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!currentVerified && (
                <button
                  onClick={handleVerify}
                  disabled={verifying || !currentPw}
                  className="bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold px-4 rounded-xl hover:bg-white/[0.1] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {verifying ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                  )}
                  تحقّق
                </button>
              )}
            </div>
          </div>

          {/* ═══ Section 2: New password ═══ */}
          <div className={cn(
            "bg-white/[0.05] border rounded-2xl p-5 mb-4 backdrop-blur transition-opacity",
            currentVerified ? "border-white/[0.08] opacity-100" : "border-white/[0.05] opacity-50 pointer-events-none",
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-yellow-400" strokeWidth={2} />
              <h3 className="text-sm font-bold text-white">كلمة المرور الجديدة</h3>
            </div>

            {/* New password */}
            <div className="mb-3">
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">كلمة المرور الجديدة</div>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="على الأقل 8 أحرف"
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white outline-none transition-colors"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {newPw && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-neutral-500">قوة كلمة المرور</span>
                    <span className={cn("text-[10px] font-bold flex items-center gap-1", sc.text)}>
                      <span>{sc.emoji}</span>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all", sc.bar, strengthFill)} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="mb-4">
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">تأكيد كلمة المرور</div>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="كرّر كلمة المرور الجديدة"
                  className={cn(
                    "w-full bg-white/[0.04] border focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white outline-none transition-colors",
                    confirmPw && !passwordsMatch ? "border-red-500/40" : "border-white/[0.08]",
                  )}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPw && !passwordsMatch && (
                <div className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                  <X className="w-3 h-3" strokeWidth={3} />
                  الكلمتان غير متطابقتين
                </div>
              )}
              {passwordsMatch && (
                <div className="text-[10px] text-green-400 mt-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3" strokeWidth={3} />
                  متطابقتان ✓
                </div>
              )}
            </div>

            {/* Same-as-current warning */}
            {newPw && !isDifferentFromCurrent && (
              <div className="bg-yellow-400/[0.06] border border-yellow-400/25 rounded-lg p-2.5 mb-4 flex gap-2 items-start">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="text-[11px] text-yellow-300 leading-relaxed">
                  الكلمة الجديدة يجب أن تختلف عن الحالية
                </div>
              </div>
            )}

            {/* Rules checklist */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[10px] text-neutral-500 mb-2 font-bold">قواعد كلمة المرور:</div>
              <div className="space-y-1.5">
                <Rule met={rules.minLen} text="8 أحرف على الأقل" />
                <Rule met={rules.upper} text="حرف كبير واحد (A-Z)" />
                <Rule met={rules.lower} text="حرف صغير واحد (a-z)" />
                <Rule met={rules.digit} text="رقم واحد (0-9)" />
                <Rule met={rules.symbol} text="رمز خاص (!@#$%^&*)" />
              </div>
            </div>
          </div>

          {/* ═══ Section 3: Security tips ═══ */}
          <div className="bg-purple-400/[0.06] border border-purple-400/25 rounded-2xl p-4 mb-5 backdrop-blur">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-purple-400" strokeWidth={2} />
              <h3 className="text-sm font-bold text-white">💡 نصائح لأمان حسابك</h3>
            </div>
            <ul className="space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                لا تشارك كلمة المرور مع أحد مهما كانت الظروف
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                استخدم كلمة مرور مختلفة عن باقي حساباتك
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                غيّر كلمة المرور كل 3 أشهر
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                فعّل المصادقة الثنائية (2FA) إذا متاحة
              </li>
            </ul>
          </div>

          {/* ═══ Action buttons ═══ */}
          <div className="flex gap-2.5">
            <button
              onClick={() => router.back()}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-3.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                canSubmit
                  ? "bg-neutral-100 text-black hover:bg-neutral-200"
                  : "bg-white/[0.08] text-neutral-500 cursor-not-allowed",
              )}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" strokeWidth={2} />
                  تحديث كلمة المرور
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}

function Rule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className={cn(
        "w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors",
        met ? "bg-green-400/20 border-green-400/50" : "bg-white/[0.04] border-white/[0.15]",
      )}>
        {met ? (
          <Check className="w-2.5 h-2.5 text-green-400" strokeWidth={3} />
        ) : (
          <X className="w-2 h-2 text-neutral-600" strokeWidth={2.5} />
        )}
      </div>
      <span className={met ? "text-green-300" : "text-neutral-500"}>{text}</span>
    </div>
  )
}
