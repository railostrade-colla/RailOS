"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui"
import {
  getActiveCases,
  DISEASE_LABELS,
  type HealthcareCase,
} from "@/lib/mock-data/healthcare"
import {
  donateHealthcare,
  getHealthcareCases,
} from "@/lib/data/healthcare"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const QUICK_AMOUNTS = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000]

export default function HealthcareDonatePage() {
  const router = useRouter()
  // Mock first-paint, then real DB.
  const [cases, setCases] = useState<HealthcareCase[]>(getActiveCases())
  useEffect(() => {
    let cancelled = false
    getHealthcareCases().then((rows) => {
      if (cancelled) return
      const active = rows.filter((c) => c.status === "urgent" || c.status === "active")
      if (active.length > 0) setCases(active)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const [amount, setAmount] = useState<number>(25_000)
  const [customAmount, setCustomAmount] = useState("")
  const [target, setTarget] = useState<"general" | string>("general")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const finalAmount = customAmount ? Number(customAmount) : amount

  const handleDonate = async () => {
    if (!finalAmount || finalAmount < 1000) {
      showError("الحدّ الأدنى للتبرّع 1,000 د.ع")
      return
    }
    setSubmitting(true)
    const result = await donateHealthcare({
      case_id: target === "general" ? undefined : target,
      amount: finalAmount,
      is_anonymous: isAnonymous,
      is_recurring: isRecurring,
    })
    setSubmitting(false)
    if (result.success) {
      showSuccess(`✅ تم تبرّعك بـ ${fmtNum(finalAmount)} د.ع${isRecurring ? " · شهري متكرّر" : ""} — شكراً لك!`)
      router.push("/healthcare")
    } else {
      showError(result.error || "تعذّر إتمام التبرّع")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">

          <PageHeader title="❤️ تبرّع للرعاية الصحية" subtitle="ساهم في إنقاذ حياة" />

          <Card variant="gradient" color="red" padding="lg" className="mb-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-400/[0.15] border border-red-400/[0.3] flex items-center justify-center mx-auto mb-3">
              <Heart className="w-7 h-7 text-red-400" fill="currentColor" strokeWidth={1} />
            </div>
            <div className="text-sm font-bold text-white mb-2">كل قطرة تصنع بحراً</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              تبرّعك يذهب 100% للحالات المحتاجة. لا عمولات. لا اقتطاعات.
            </div>
          </Card>

          {/* Amount */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">💰 المبلغ</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount("") }}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                    !customAmount && amount === a
                      ? "bg-red-400/[0.15] border-red-400/[0.4] text-red-400"
                      : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                  )}
                >
                  {fmtNum(a)} د.ع
                </button>
              ))}
            </div>

            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="أو مبلغ مخصّص (د.ع)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
            />
          </Card>

          {/* Target */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">🎯 الجهة المستفيدة</div>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="general">صندوق الرعاية الصحية العام</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {DISEASE_LABELS[c.disease_type].icon} {c.patient_display_name} — {c.diagnosis.slice(0, 40)}...
                </option>
              ))}
            </select>
            <div className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
              {target === "general"
                ? "سيُوزَّع المبلغ على الحالات الأكثر إلحاحاً وفق أولويات اللجنة الطبّية."
                : "سيذهب المبلغ مباشرة للحالة المُحدَّدة."}
            </div>
          </Card>

          {/* Options */}
          <Card padding="md" className="mb-5">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">⚙️ خيارات</div>
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <div>
                  <div className="text-xs text-white font-bold">إخفاء اسمي</div>
                  <div className="text-[10px] text-neutral-500">سأظهر كـ "متبرّع مجهول"</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <div>
                  <div className="text-xs text-white font-bold">تبرّع شهري متكرّر</div>
                  <div className="text-[10px] text-neutral-500">يُخصم تلقائياً كل شهر — يمكن الإلغاء في أي وقت</div>
                </div>
              </label>
            </div>
          </Card>

          {/* CTA */}
          <button
            onClick={handleDonate}
            disabled={submitting || finalAmount < 1000}
            className={cn(
              "w-full py-4 rounded-xl text-base font-bold transition-colors flex items-center justify-center gap-2 shadow-lg",
              finalAmount >= 1000 && !submitting
                ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600"
                : "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
            )}
          >
            <Heart className="w-5 h-5" fill="currentColor" />
            {submitting ? "جاري التبرّع..." : `تبرّع بـ ${fmtNum(finalAmount)} د.ع${isRecurring ? " شهرياً" : ""}`}
          </button>

        </div>
      </div>
    </AppLayout>
  )
}
