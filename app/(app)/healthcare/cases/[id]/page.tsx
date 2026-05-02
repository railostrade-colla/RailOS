"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Hospital, Stethoscope, Users, X } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, StatCard, SectionHeader, Badge, Modal, EmptyState } from "@/components/ui"
import {
  getCaseById,
  getCaseDonors,
  CASE_STATUS_LABELS,
  DISEASE_LABELS,
  makeDonation,
} from "@/lib/mock-data/healthcare"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const QUICK_AMOUNTS = [5_000, 10_000, 25_000, 50_000, 100_000]

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const c = getCaseById(id)
  const [showDonate, setShowDonate] = useState(false)
  const [amount, setAmount] = useState<number>(25_000)
  const [customAmount, setCustomAmount] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!c) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader title="حالة غير موجودة" />
            <EmptyState icon="🔍" title="هذه الحالة غير متاحة" description="ربما حُذفت أو الرابط غير صحيح" action={{ label: "العودة للحالات", onClick: () => router.push("/healthcare/cases") }} />
          </div>
        </div>
      </AppLayout>
    )
  }

  const pct = Math.round((c.amount_collected / c.total_required) * 100)
  const remaining = Math.max(0, c.total_required - c.amount_collected)
  const disease = DISEASE_LABELS[c.disease_type]
  const donors = getCaseDonors(c.id)

  const handleDonate = () => {
    const final = customAmount ? Number(customAmount) : amount
    if (!final || final < 1000) {
      showError("الحدّ الأدنى للتبرّع 1,000 د.ع")
      return
    }
    setSubmitting(true)
    const result = makeDonation("me", { case_id: c.id, amount: final, is_anonymous: isAnonymous, is_recurring: false })
    setSubmitting(false)
    if (result.success) {
      showSuccess(`✅ تم تبرّعك بـ ${fmtNum(final)} د.ع — شكراً لك!`)
      setShowDonate(false)
      setCustomAmount("")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title={c.patient_display_name} subtitle={`${c.patient_age} سنة · ${c.city}`} />

          {/* Hero status */}
          <Card variant="gradient" color={c.status === "urgent" ? "red" : c.status === "completed" ? "green" : "yellow"} padding="lg" className="mb-5 text-center">
            <div className="text-4xl mb-2">{disease.icon}</div>
            <Badge color={CASE_STATUS_LABELS[c.status].color}>{CASE_STATUS_LABELS[c.status].label}</Badge>
            <div className="text-base font-bold text-white mt-3 mb-1">{disease.label}</div>
            <div className="text-xs text-neutral-300 leading-relaxed max-w-md mx-auto">{c.diagnosis}</div>
          </Card>

          {/* Progress visual */}
          <Card padding="lg" className="mb-5">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-white font-mono">{pct}%</span>
              <span className="text-xs text-neutral-500">من المبلغ المطلوب</span>
            </div>
            <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <div
                className={cn("h-full transition-all", c.status === "completed" ? "bg-green-400" : "bg-gradient-to-r from-red-400 to-orange-400")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="جُمِع" value={fmtNum(c.amount_collected)} color="green" size="sm" />
              <StatCard label="المتبقّي" value={fmtNum(remaining)} color="yellow" size="sm" />
              <StatCard label="المطلوب" value={fmtNum(c.total_required)} color="neutral" size="sm" />
            </div>
          </Card>

          {/* Patient info */}
          <SectionHeader title="📋 معلومات المريض" />
          <Card padding="md" className="mb-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">المريض</div>
                <div className="text-white font-bold">{c.patient_display_name}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">العمر</div>
                <div className="text-white font-mono">{c.patient_age} سنة</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">المدينة</div>
                <div className="text-white">{c.city}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">تاريخ الإضافة</div>
                <div className="text-neutral-300 font-mono">{c.created_at}</div>
              </div>
            </div>
          </Card>

          {/* Medical report */}
          <SectionHeader title="🩺 التقرير الطبي" />
          <Card padding="md" className="mb-3">
            <div className="flex items-start gap-3 mb-3">
              <Hospital className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-neutral-500 mb-1">المستشفى</div>
                <div className="text-sm text-white">{c.hospital}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Stethoscope className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-neutral-500 mb-1">التشخيص</div>
                <div className="text-sm text-white leading-relaxed">{c.diagnosis}</div>
              </div>
            </div>
          </Card>

          {/* Treatment plan + story */}
          {(c.treatment_plan || c.story) && (
            <Card padding="md" className="mb-3">
              {c.story && (
                <div className="mb-4">
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">📖 القصّة</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">{c.story}</div>
                </div>
              )}
              {c.treatment_plan && (
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">💊 خطّة العلاج</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">{c.treatment_plan}</div>
                </div>
              )}
            </Card>
          )}

          {/* Donors */}
          <SectionHeader
            title="❤️ المتبرّعون"
            subtitle={`${fmtNum(donors.length)} متبرّع ساهموا`}
          />
          {donors.length === 0 ? (
            <Card padding="md" className="mb-5 text-center">
              <div className="text-xs text-neutral-400">لا متبرّعين بعد — كن أوّل المتبرّعين!</div>
            </Card>
          ) : (
            <Card padding="sm" className="mb-5">
              <div className="divide-y divide-white/[0.05]">
                {donors.slice(0, 8).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-2.5">
                    <div className="w-8 h-8 rounded-full bg-red-400/[0.1] border border-red-400/[0.2] flex items-center justify-center text-xs font-bold text-red-400">
                      {d.is_anonymous ? "?" : d.donor_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-bold">{d.is_anonymous ? "متبرّع مجهول" : d.donor_name}</div>
                      <div className="text-[10px] text-neutral-500">{d.created_at}</div>
                    </div>
                    <div className="text-sm font-bold text-green-400 font-mono">+{fmtNum(d.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CTA */}
          {c.status !== "completed" && (
            <button
              onClick={() => setShowDonate(true)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-base font-bold hover:from-red-600 hover:to-pink-600 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Heart className="w-5 h-5" fill="currentColor" />
              تبرّع لهذه الحالة
            </button>
          )}

        </div>
      </div>

      {/* Donate modal */}
      <Modal
        isOpen={showDonate}
        onClose={() => setShowDonate(false)}
        title="❤️ تبرّع للحالة"
        subtitle={c.patient_display_name}
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowDonate(false)}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              إلغاء
            </button>
            <button
              onClick={handleDonate}
              disabled={submitting}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-bold hover:from-red-600 hover:to-pink-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4" fill="currentColor" />
              {submitting ? "جاري التبرّع..." : `تبرّع بـ ${fmtNum(customAmount ? Number(customAmount) : amount)} د.ع`}
            </button>
          </>
        }
      >
        <div className="text-[11px] text-neutral-400 mb-2">اختر مبلغاً سريعاً</div>
        <div className="grid grid-cols-3 gap-2 mb-4">
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

        <div className="text-[11px] text-neutral-400 mb-2">أو مبلغ مخصّص</div>
        <input
          type="number"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="مثلاً: 75000"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-white/20 mb-4"
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs text-neutral-300">إخفاء اسمي (تبرّع مجهول)</span>
        </label>
      </Modal>
    </AppLayout>
  )
}
