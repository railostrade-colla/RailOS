"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Calendar,
  MapPin,
  Phone,
  Briefcase,
  Coins,
  Target,
  TrendingUp,
  Check,
  ChevronLeft,
  Sparkles,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

// ─── Static option data ───────────────────────────────────────────────
const CITIES = [
  "بغداد", "البصرة", "الموصل", "كركوك", "أربيل", "النجف",
  "كربلاء", "الكوت", "الناصرية", "الديوانية", "السماوة", "الرمادي",
] as const

const PROFESSIONS = [
  "موظف", "تاجر", "مهندس", "طبيب", "معلم", "مهني حر", "طالب", "أخرى",
] as const

const INCOME_TIERS = [
  { id: "lt_1m", label: "أقل من 1M د.ع", color: "text-neutral-400", border: "border-white/[0.1]" },
  { id: "1_5m", label: "1M - 5M د.ع", color: "text-blue-400", border: "border-blue-400/30" },
  { id: "5_15m", label: "5M - 15M د.ع", color: "text-yellow-400", border: "border-yellow-400/30" },
  { id: "gt_15m", label: "أكثر من 15M د.ع", color: "text-green-400", border: "border-green-400/30" },
] as const

const GOALS = [
  { id: "growth", label: "نمو رأس المال", icon: "📈" },
  { id: "income", label: "دخل شهري ثابت", icon: "💰" },
  { id: "preserve", label: "الحفاظ على القيمة", icon: "🛡️" },
  { id: "diversify", label: "التنويع في المحفظة", icon: "🎯" },
] as const

const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "مبتدئ", desc: "أول تجربة استثمارية", icon: "🌱" },
  { id: "intermediate", label: "متوسط", desc: "لدي تجارب سابقة", icon: "📈" },
  { id: "expert", label: "متقدم", desc: "مستثمر محترف", icon: "🎯" },
] as const

const SECTORS = [
  { id: "agri", label: "زراعة", icon: "🌾" },
  { id: "real_estate", label: "عقارات", icon: "🏗️" },
  { id: "industry", label: "صناعة", icon: "🏭" },
  { id: "trade", label: "تجارة", icon: "🏪" },
  { id: "tech", label: "تقنية", icon: "💻" },
  { id: "med", label: "طب", icon: "🏥" },
] as const

type Section = 1 | 2 | 3 | 4

export default function ProfileSetupPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<Section>(1)
  const [submitting, setSubmitting] = useState(false)

  // Section 1
  const [fullName, setFullName] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [gender, setGender] = useState<"male" | "female" | "">("")
  const [city, setCity] = useState<string>("")
  const [phone, setPhone] = useState("")

  // Section 2
  const [profession, setProfession] = useState<string>("")
  const [incomeTier, setIncomeTier] = useState<string>("")
  const [incomeSource, setIncomeSource] = useState("")

  // Section 3
  const [goals, setGoals] = useState<string[]>([])
  const [experience, setExperience] = useState<string>("")
  const [preferredSectors, setPreferredSectors] = useState<string[]>([])

  // Section 4
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [confirmAccuracy, setConfirmAccuracy] = useState(false)

  // ─── Section completion tracking ────────────────────────────────────
  const sectionComplete = useMemo(
    () => ({
      1: !!fullName.trim() && !!birthDate && !!gender && !!city && phone.length >= 10,
      2: !!profession && !!incomeTier,
      3: goals.length > 0 && !!experience && preferredSectors.length > 0,
      4: agreeTerms && agreePrivacy && confirmAccuracy,
    }),
    [fullName, birthDate, gender, city, phone, profession, incomeTier, goals, experience, preferredSectors, agreeTerms, agreePrivacy, confirmAccuracy],
  )

  const allComplete =
    sectionComplete[1] && sectionComplete[2] && sectionComplete[3] && sectionComplete[4]

  // ─── Toggle helpers ─────────────────────────────────────────────────
  const toggleGoal = (id: string) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  const toggleSector = (id: string) =>
    setPreferredSectors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )

  // ─── Submit handlers ────────────────────────────────────────────────
  const handleSkip = () => {
    showSuccess("يمكنك إكمال ملفك لاحقاً من الإعدادات")
    router.push("/dashboard")
  }

  const handleSubmit = async () => {
    if (!sectionComplete[1]) {
      showError("أكمل المعلومات الشخصية أولاً")
      setActiveSection(1)
      return
    }
    if (!sectionComplete[2]) {
      showError("أكمل المعلومات المهنية")
      setActiveSection(2)
      return
    }
    if (!sectionComplete[3]) {
      showError("اختر أهدافك الاستثمارية")
      setActiveSection(3)
      return
    }
    if (!sectionComplete[4]) {
      showError("أكّد جميع الموافقات للمتابعة")
      setActiveSection(4)
      return
    }

    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    showSuccess("تم حفظ ملفك! ننتقل لـ KYC... 🎉")
    setTimeout(() => router.push("/kyc"), 600)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-24">

          <PageHeader
            title="إكمال الملف الشخصي"
            subtitle="خطوة أخيرة قبل البدء — معلوماتك تساعدنا نقدم لك أفضل تجربة"
            showBack={false}
          />

          {/* Progress indicator (4 steps) */}
          <div className="flex items-center justify-between mb-6 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3">
            {([1, 2, 3, 4] as const).map((n, i) => {
              const done = sectionComplete[n]
              const active = activeSection === n
              return (
                <div key={n} className="flex items-center flex-1">
                  <button
                    onClick={() => setActiveSection(n)}
                    className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold transition-colors flex-shrink-0",
                      done && "bg-green-400/15 border-green-400/40 text-green-400",
                      !done && active && "bg-white text-black border-transparent",
                      !done && !active && "bg-white/[0.05] border-white/[0.1] text-neutral-500",
                    )}
                  >
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}
                  </button>
                  {i < 3 && (
                    <div className={cn(
                      "h-0.5 flex-1 mx-1.5 rounded-full transition-colors",
                      sectionComplete[n] ? "bg-green-400/40" : "bg-white/[0.06]",
                    )} />
                  )}
                </div>
              )
            })}
          </div>

          {/* ═══════════════ Section 1: Personal info ═══════════════ */}
          <Section
            n={1}
            title="المعلومات الشخصية"
            icon={<User className="w-4 h-4 text-blue-400" strokeWidth={2} />}
            done={sectionComplete[1]}
            active={activeSection === 1}
            onActivate={() => setActiveSection(1)}
          >
            <Field label="الاسم الكامل *">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد محمد علي"
                className="form-input"
              />
            </Field>

            <Field label="تاريخ الميلاد *" icon={<Calendar className="w-3.5 h-3.5 text-neutral-500" />}>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="form-input"
                dir="ltr"
              />
            </Field>

            <Field label="الجنس *">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "male" as const, label: "ذكر", icon: "👨" },
                  { id: "female" as const, label: "أنثى", icon: "👩" },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id)}
                    className={cn(
                      "py-3 rounded-xl border flex items-center justify-center gap-2 transition-colors text-sm",
                      gender === g.id
                        ? "bg-white text-black border-transparent font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="text-base">{g.icon}</span>
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="المدينة *" icon={<MapPin className="w-3.5 h-3.5 text-neutral-500" />}>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="form-input"
              >
                <option value="">— اختر المدينة —</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="رقم الهاتف *" icon={<Phone className="w-3.5 h-3.5 text-neutral-500" />}>
              <div className="flex gap-2">
                <span className="px-3 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-mono text-neutral-400 flex-shrink-0" dir="ltr">
                  +964
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="7701234567"
                  className="form-input flex-1 font-mono"
                  dir="ltr"
                />
              </div>
            </Field>
          </Section>

          {/* ═══════════════ Section 2: Professional info ═══════════════ */}
          <Section
            n={2}
            title="المعلومات المهنية"
            icon={<Briefcase className="w-4 h-4 text-yellow-400" strokeWidth={2} />}
            done={sectionComplete[2]}
            active={activeSection === 2}
            onActivate={() => setActiveSection(2)}
          >
            <Field label="المهنة *">
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="form-input"
              >
                <option value="">— اختر المهنة —</option>
                {PROFESSIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="مستوى الدخل الشهري *" icon={<Coins className="w-3.5 h-3.5 text-neutral-500" />}>
              <div className="grid grid-cols-1 gap-2">
                {INCOME_TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setIncomeTier(t.id)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-sm transition-colors flex items-center justify-between",
                      incomeTier === t.id
                        ? "bg-white text-black border-transparent font-bold"
                        : `bg-white/[0.04] ${t.border} ${t.color} hover:bg-white/[0.06]`,
                    )}
                  >
                    <span>{t.label}</span>
                    {incomeTier === t.id && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="مصدر الدخل الرئيسي (اختياري)">
              <input
                value={incomeSource}
                onChange={(e) => setIncomeSource(e.target.value)}
                placeholder="مثال: راتب شهري، نشاط تجاري..."
                maxLength={80}
                className="form-input"
              />
            </Field>
          </Section>

          {/* ═══════════════ Section 3: Investment goals ═══════════════ */}
          <Section
            n={3}
            title="الأهداف الاستثمارية"
            icon={<Target className="w-4 h-4 text-green-400" strokeWidth={2} />}
            done={sectionComplete[3]}
            active={activeSection === 3}
            onActivate={() => setActiveSection(3)}
          >
            <Field label="الهدف من الاستثمار * (يمكن اختيار أكثر من واحد)">
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => {
                  const selected = goals.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGoal(g.id)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs transition-colors flex items-center gap-2",
                        selected
                          ? "bg-green-400/[0.08] border-green-400/40 text-green-400 font-bold"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="text-base">{g.icon}</span>
                      <span className="flex-1 text-right">{g.label}</span>
                      {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="مستوى الخبرة *" icon={<TrendingUp className="w-3.5 h-3.5 text-neutral-500" />}>
              <div className="space-y-2">
                {EXPERIENCE_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setExperience(l.id)}
                    className={cn(
                      "w-full p-3 rounded-xl border text-right transition-colors flex items-center gap-3",
                      experience === l.id
                        ? "bg-white text-black border-transparent"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="text-2xl">{l.icon}</span>
                    <div className="flex-1 text-right">
                      <div className={cn("text-sm font-bold", experience === l.id ? "text-black" : "text-white")}>{l.label}</div>
                      <div className={cn("text-[11px] mt-0.5", experience === l.id ? "text-neutral-700" : "text-neutral-500")}>{l.desc}</div>
                    </div>
                    {experience === l.id && <Check className="w-4 h-4" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="القطاعات المفضّلة *">
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.map((s) => {
                  const selected = preferredSectors.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSector(s.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] border flex items-center gap-1 transition-colors",
                        selected
                          ? "bg-white text-black border-transparent font-bold"
                          : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="text-sm">{s.icon}</span>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          {/* ═══════════════ Section 4: Confirmations ═══════════════ */}
          <Section
            n={4}
            title="التأكيد والموافقات"
            icon={<Sparkles className="w-4 h-4 text-purple-400" strokeWidth={2} />}
            done={sectionComplete[4]}
            active={activeSection === 4}
            onActivate={() => setActiveSection(4)}
          >
            <Checkbox
              checked={agreeTerms}
              onChange={setAgreeTerms}
              label={
                <>
                  أوافق على{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/terms")}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    شروط الاستخدام
                  </button>
                </>
              }
            />
            <Checkbox
              checked={agreePrivacy}
              onChange={setAgreePrivacy}
              label={
                <>
                  أوافق على{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/privacy")}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    سياسة الخصوصية
                  </button>
                </>
              }
            />
            <Checkbox
              checked={confirmAccuracy}
              onChange={setConfirmAccuracy}
              label="أؤكد صحة المعلومات المُدخلة"
            />
          </Section>

          {/* ═══════════════ Action buttons ═══════════════ */}
          <div className="flex gap-2.5 mt-6">
            <button
              onClick={handleSkip}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] text-neutral-300 py-3.5 rounded-xl text-sm hover:bg-white/[0.08] transition-colors"
            >
              تخطّي للآن
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                "flex-[2] py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                allComplete && !submitting
                  ? "bg-neutral-100 text-black hover:bg-neutral-200"
                  : "bg-white/[0.08] text-neutral-500 cursor-not-allowed",
              )}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  إكمال + متابعة لـ KYC
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Inline form-input style — keeps the file self-contained */}
      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.form-input:focus) {
          border-color: rgba(255, 255, 255, 0.2);
        }
        :global(.form-input::placeholder) {
          color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components (kept in same file for cohesion)
// ──────────────────────────────────────────────────────────────────────

function Section({
  n,
  title,
  icon,
  done,
  active,
  onActivate,
  children,
}: {
  n: number
  title: string
  icon: React.ReactNode
  done: boolean
  active: boolean
  onActivate: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={!active ? onActivate : undefined}
      className={cn(
        "bg-white/[0.05] border rounded-2xl p-5 mb-4 backdrop-blur transition-colors",
        active ? "border-white/[0.15]" : "border-white/[0.08] cursor-pointer hover:bg-white/[0.06]",
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[11px] font-bold text-neutral-300">
            {done ? <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={3} /> : n}
          </div>
          {icon}
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
        {done && (
          <span className="text-[10px] text-green-400 font-bold bg-green-400/[0.1] border border-green-400/30 px-2 py-0.5 rounded">
            ✓ مكتمل
          </span>
        )}
      </div>
      {active && <div className="space-y-4">{children}</div>}
    </div>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] text-neutral-400 mb-1.5 font-bold flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2 group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5",
          checked
            ? "bg-green-400 border-green-400"
            : "bg-white/[0.04] border-white/[0.2] group-hover:border-white/[0.35]",
        )}
      >
        {checked && <Check className="w-3 h-3 text-black" strokeWidth={4} />}
      </button>
      <span className="text-xs text-neutral-300 leading-relaxed select-none">{label}</span>
    </label>
  )
}
