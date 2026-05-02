"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Gift } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui"
import { donateOrphan } from "@/lib/mock-data/orphans"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const QUICK_AMOUNTS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000]

export default function OrphansDonatePage() {
  const router = useRouter()
  const [amount, setAmount] = useState<number>(50_000)
  const [customAmount, setCustomAmount] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const finalAmount = customAmount ? Number(customAmount) : amount

  const handleDonate = () => {
    if (!finalAmount || finalAmount < 1000) return showError("الحدّ الأدنى للتبرّع 1,000 د.ع")
    setSubmitting(true)
    const result = donateOrphan("me", finalAmount, isAnonymous)
    setSubmitting(false)
    if (result.success) {
      showSuccess(`✅ تبرّعك بـ ${fmtNum(finalAmount)} د.ع — جزاك الله خيراً!`)
      router.push("/orphans")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">

          <PageHeader title="🎁 تبرّع للصندوق العام" subtitle="ساهم في رعاية كل الأطفال" />

          <Card variant="gradient" color="blue" padding="lg" className="mb-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-400/[0.15] border border-blue-400/[0.3] flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
            </div>
            <div className="text-sm font-bold text-white mb-2">الصندوق العام</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              يُوزَّع المبلغ على الأطفال الأكثر احتياجاً (تعليم/صحة/طعام/سكن) وفق أولويات اللجنة.
            </div>
          </Card>

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
                      ? "bg-blue-400/[0.15] border-blue-400/[0.4] text-blue-400"
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
                  <div className="text-[10px] text-neutral-500">يُخصم تلقائياً كل شهر</div>
                </div>
              </label>
            </div>
          </Card>

          <button
            onClick={handleDonate}
            disabled={submitting || finalAmount < 1000}
            className={cn(
              "w-full py-4 rounded-xl text-base font-bold transition-colors flex items-center justify-center gap-2 shadow-lg",
              finalAmount >= 1000 && !submitting
                ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600"
                : "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
            )}
          >
            <Gift className="w-5 h-5" />
            {submitting ? "جاري التبرّع..." : `تبرّع بـ ${fmtNum(finalAmount)} د.ع${isRecurring ? " شهرياً" : ""}`}
          </button>

        </div>
      </div>
    </AppLayout>
  )
}
