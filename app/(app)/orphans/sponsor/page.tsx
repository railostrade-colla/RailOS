"use client"

import { Suspense, useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Modal } from "@/components/ui"
import {
  MOCK_ORPHAN_CHILDREN,
  SPONSORSHIP_PLANS,
  sponsorChild,
  type SponsorshipType,
} from "@/lib/mock-data/orphans"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

function SponsorContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const initialChild = sp?.get("child") || ""

  const availableChildren = useMemo(() => MOCK_ORPHAN_CHILDREN.filter((c) => c.status !== "fully_sponsored"), [])
  const [childId, setChildId] = useState<string>(initialChild || availableChildren[0]?.id || "")
  const [type, setType] = useState<SponsorshipType>("monthly")
  const [planId, setPlanId] = useState<string>("advanced")
  const [customAmount, setCustomAmount] = useState("")
  const [duration, setDuration] = useState(12)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [receiveReports, setReceiveReports] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const child = MOCK_ORPHAN_CHILDREN.find((c) => c.id === childId)
  const plan = SPONSORSHIP_PLANS.find((p) => p.id === planId)
  const monthlyAmount = customAmount ? Number(customAmount) : (plan?.monthly || 100_000)
  const totalAmount = type === "onetime" ? monthlyAmount : monthlyAmount * (type === "annual" ? 12 : duration)

  const handleSubmit = () => {
    if (!child) return showError("اختر طفلاً")
    if (monthlyAmount < 1000) return showError("المبلغ غير صحيح")
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    setSubmitting(true)
    const result = sponsorChild("me", {
      child_id: childId,
      type,
      amount: monthlyAmount,
      duration_months: duration,
      is_anonymous: isAnonymous,
      receive_reports: receiveReports,
    })
    setSubmitting(false)
    if (result.success) {
      showSuccess(`✅ بدأت كفالة ${child?.first_name} — شكراً لكرمك!`)
      setShowConfirm(false)
      router.push("/orphans/my-sponsorships")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-2xl mx-auto pb-20">

          <PageHeader title="❤️ كفالة طفل" subtitle="اختر طفلاً وابدأ رحلة العطاء" />

          {/* Step 1: Select child */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">1️⃣ اختر الطفل</div>
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20"
            >
              {availableChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gender === "male" ? "👦" : "👧"} {c.first_name} — {c.age} سنوات · {c.city}
                </option>
              ))}
            </select>

            {child && (
              <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <div className="text-xs text-neutral-200 leading-relaxed line-clamp-3 mb-2">{child.story}</div>
                <div className="text-[10px] text-neutral-500">
                  الكفالة الشهرية المطلوبة: <span className="text-white font-bold font-mono">{fmtNum(child.needs_amount_monthly)} د.ع</span>
                </div>
              </div>
            )}
          </Card>

          {/* Step 2: Type */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">2️⃣ نوع الكفالة</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "monthly" as const, label: "شهري",       desc: "متجدّد كل شهر" },
                { id: "annual" as const,  label: "سنوي",       desc: "دفعة واحدة لـ 12 شهر" },
                { id: "onetime" as const, label: "لمرة واحدة", desc: "تبرّع فوري" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "py-3 px-2 rounded-lg border transition-colors text-center",
                    type === t.id
                      ? "bg-teal-400/[0.1] border-teal-400/[0.4]"
                      : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]"
                  )}
                >
                  <div className={cn("text-sm font-bold mb-0.5", type === t.id ? "text-teal-400" : "text-white")}>{t.label}</div>
                  <div className="text-[10px] text-neutral-500">{t.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Step 3: Plan / amount */}
          <Card padding="md" className="mb-3">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">3️⃣ المبلغ</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {SPONSORSHIP_PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPlanId(p.id); setCustomAmount("") }}
                  className={cn(
                    "py-3 px-2 rounded-lg border transition-colors text-center",
                    !customAmount && planId === p.id
                      ? "bg-purple-400/[0.1] border-purple-400/[0.4]"
                      : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]"
                  )}
                >
                  <div className={cn("text-sm font-bold mb-0.5", !customAmount && planId === p.id ? "text-purple-400" : "text-white")}>{p.name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{fmtNum(p.monthly)}/شهر</div>
                </button>
              ))}
            </div>

            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="أو مبلغ مخصّص (د.ع/شهر)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20"
            />
          </Card>

          {/* Step 4: Duration (monthly only) */}
          {type === "monthly" && (
            <Card padding="md" className="mb-3">
              <div className="text-[11px] font-bold text-neutral-400 mb-3">4️⃣ مدّة الكفالة</div>
              <div className="grid grid-cols-4 gap-2">
                {[3, 6, 12, 24].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDuration(m)}
                    className={cn(
                      "py-2.5 rounded-lg text-xs font-bold border transition-colors",
                      duration === m
                        ? "bg-teal-400/[0.15] border-teal-400/[0.4] text-teal-400"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    {m} شهر
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Step 5: Options */}
          <Card padding="md" className="mb-5">
            <div className="text-[11px] font-bold text-neutral-400 mb-3">⚙️ خيارات</div>
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <div>
                  <div className="text-xs text-white font-bold">إخفاء اسمي</div>
                  <div className="text-[10px] text-neutral-500">سأظهر كـ "مكفّل مجهول" في الصفحة العامّة</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={receiveReports} onChange={(e) => setReceiveReports(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <div>
                  <div className="text-xs text-white font-bold">تلقّي تقارير دورية</div>
                  <div className="text-[10px] text-neutral-500">صور وأخبار عن تقدّم الطفل كل شهر/ربع</div>
                </div>
              </label>
            </div>
          </Card>

          {/* Total + CTA */}
          <Card variant="gradient" color="green" padding="md" className="mb-3">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-[10px] text-neutral-500 mb-0.5">إجمالي الكفالة</div>
                <div className="text-[10px] text-neutral-500">
                  {type === "monthly" ? `${fmtNum(monthlyAmount)} × ${duration} شهر` : type === "annual" ? `${fmtNum(monthlyAmount)} × 12 شهر` : "دفعة واحدة"}
                </div>
              </div>
              <div className="text-2xl font-bold text-green-400 font-mono">{fmtNum(totalAmount)} د.ع</div>
            </div>
          </Card>

          <button
            onClick={handleSubmit}
            disabled={!child}
            className={cn(
              "w-full py-4 rounded-xl text-base font-bold transition-colors flex items-center justify-center gap-2 shadow-lg",
              child
                ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600"
                : "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
            )}
          >
            <Heart className="w-5 h-5" fill="currentColor" />
            ابدأ الكفالة
          </button>

        </div>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="❤️ تأكيد الكفالة"
        subtitle={child ? `كفالة ${child.first_name}` : ""}
        size="sm"
        footer={
          <>
            <button onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white text-sm font-bold hover:from-teal-600 hover:to-blue-600 disabled:opacity-50">{submitting ? "جاري..." : "تأكيد"}</button>
          </>
        }
      >
        {child && (
          <>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs mb-3">
              <div className="flex justify-between"><span className="text-neutral-500">الطفل</span><span className="text-white">{child.first_name}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">النوع</span><span className="text-white">{type === "monthly" ? "شهري" : type === "annual" ? "سنوي" : "لمرة واحدة"}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">المبلغ الشهري</span><span className="text-white font-mono">{fmtNum(monthlyAmount)} د.ع</span></div>
              {type === "monthly" && <div className="flex justify-between"><span className="text-neutral-500">المدّة</span><span className="text-white">{duration} شهر</span></div>}
              <div className="flex justify-between border-t border-white/[0.05] pt-1.5 mt-1.5"><span className="text-neutral-500 font-bold">الإجمالي</span><span className="text-green-400 font-mono font-bold">{fmtNum(totalAmount)} د.ع</span></div>
            </div>
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              يمكنك إيقاف الكفالة في أي وقت من <span className="text-white font-bold">كفالاتي</span>.
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}

export default function SponsorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SponsorContent />
    </Suspense>
  )
}
