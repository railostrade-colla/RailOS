"use client"

import { useState, useEffect } from "react"
import { Shield, Check, X } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Modal, Badge } from "@/components/ui"
import {
  MOCK_INSURANCE_PLANS,
  getMyInsurance as getMyInsuranceMock,
  type InsurancePlan,
  type InsuranceSubscription,
} from "@/lib/mock-data/healthcare"
import {
  getMyInsurance,
  subscribeInsurance,
} from "@/lib/data/healthcare"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const PLAN_FEATURES: Record<InsurancePlan, { features: string[]; covers: string[] }> = {
  basic: {
    features: ["قسط شهري بسيط — 3,000 د.ع فقط", "حدّ سنوي 1 مليون د.ع", "أمراض الطوارئ والحالات البسيطة"],
    covers: ["كسور وحوادث", "أمراض موسمية", "فحوصات أساسية"],
  },
  advanced: {
    features: ["قسط شهري متوازن — 6,000 د.ع", "حدّ سنوي 3 مليون د.ع", "أمراض مزمنة + جراحات صغيرة"],
    covers: ["السكّري", "ارتفاع الضغط", "جراحات اليوم الواحد", "الأشعة"],
  },
  comprehensive: {
    features: ["قسط شهري للحماية الكاملة — 12,000 د.ع", "حدّ سنوي 9 مليون د.ع", "كل الأمراض + الجراحات الكبرى"],
    covers: ["جراحات القلب", "علاج السرطان", "زراعة الأعضاء", "علاج خارج العراق"],
  },
}

/** عرض الحدّ السنوي بصيغة مختصرة (مثلاً: "1 مليون د.ع"). */
function fmtAnnualLimit(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} مليون د.ع`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} ألف د.ع`
  return `${fmtNum(n)} د.ع`
}

export default function InsurancePage() {
  // Mock first-paint, real DB on mount.
  const [myInsurance, setMyInsurance] = useState<InsuranceSubscription | null>(
    getMyInsuranceMock() ?? null,
  )
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    const ins = await getMyInsurance()
    setMyInsurance(ins)
  }

  useEffect(() => {
    let cancelled = false
    refresh().catch(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubscribe = async () => {
    if (!selectedPlan || submitting) return
    const plan = MOCK_INSURANCE_PLANS.find((p) => p.plan === selectedPlan)
    if (!plan) return
    setSubmitting(true)
    const result = await subscribeInsurance({
      plan: selectedPlan,
      monthly_fee: plan.monthly_fee,
      annual_limit: plan.annual_limit,
    })
    setSubmitting(false)
    if (result.success) {
      showSuccess(`✅ تم اشتراكك في خطّة "${plan.name}" — سيُخصم ${fmtNum(plan.monthly_fee)} د.ع شهرياً`)
      setSelectedPlan(null)
      await refresh()
    } else {
      showError(result.error || "تعذّر الاشتراك")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title="🛡️ التأمين الصحّي" subtitle="حماية صحّية ميسّرة لك ولعائلتك" />

          {myInsurance && (
            <Card variant="gradient" color="green" padding="lg" className="mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-400/[0.15] border border-green-400/[0.3] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">أنت مشترك حالياً</div>
                  <div className="text-[11px] text-neutral-400">
                    خطّة {MOCK_INSURANCE_PLANS.find((p) => p.plan === myInsurance.plan)?.name} · حدّ سنوي {fmtAnnualLimit(myInsurance.annual_limit)}
                  </div>
                </div>
                <Badge color="green">نشط</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-0.5">القسط الشهري</div>
                  <div className="text-white font-mono font-bold">{fmtNum(myInsurance.monthly_fee)} د.ع</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-0.5">الحدّ السنوي</div>
                  <div className="text-yellow-400 font-mono font-bold">{fmtAnnualLimit(myInsurance.annual_limit)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-0.5">الفاتورة التالية</div>
                  <div className="text-white font-mono">{myInsurance.next_billing}</div>
                </div>
              </div>
            </Card>
          )}

          <Card variant="gradient" color="blue" padding="md" className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
              <div className="text-base font-bold text-white">كيف يعمل التأمين؟</div>
            </div>
            <ol className="text-xs text-neutral-300 leading-relaxed space-y-1.5 pr-5 list-decimal">
              <li>اختر خطّة تناسبك من 3 خطط متاحة</li>
              <li>يُخصم القسط الشهري تلقائياً من رصيد وحدات الرسوم</li>
              <li>عند الحاجة للعلاج، قدّم طلباً مع الفواتير</li>
              <li>نُغطّي تكاليف العلاج حتى الحدّ السنوي للخطّة (1M / 3M / 9M د.ع) خلال 48 ساعة</li>
            </ol>
          </Card>

          <SectionHeader title="📋 الخطط المتاحة" subtitle="اختر الأنسب لاحتياجاتك" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {MOCK_INSURANCE_PLANS.map((plan) => {
              const features = PLAN_FEATURES[plan.plan]
              const isMine = myInsurance?.plan === plan.plan
              return (
                <Card
                  key={plan.plan}
                  variant={plan.plan === "advanced" ? "highlighted" : "default"}
                  color={plan.color}
                  padding="lg"
                  className={cn(plan.plan === "advanced" && "ring-2 ring-purple-400/30")}
                >
                  {plan.plan === "advanced" && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Badge color="purple">⭐ الأكثر شعبية</Badge>
                    </div>
                  )}

                  <div className="text-base font-bold text-white mb-1">{plan.name}</div>
                  <div className={cn(
                    "text-3xl font-bold font-mono mb-1",
                    plan.color === "blue"   && "text-blue-400",
                    plan.color === "purple" && "text-purple-400",
                    plan.color === "green"  && "text-green-400",
                  )}>
                    {fmtNum(plan.monthly_fee)}
                  </div>
                  <div className="text-[10px] text-neutral-500 mb-1">د.ع / شهرياً</div>
                  <div className={cn(
                    "text-xs font-bold mb-4",
                    plan.color === "blue"   && "text-blue-400",
                    plan.color === "purple" && "text-purple-400",
                    plan.color === "green"  && "text-green-400",
                  )}>
                    حدّ سنوي {fmtAnnualLimit(plan.annual_limit)}
                  </div>

                  <div className="space-y-2 mb-4">
                    {features.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-neutral-300">
                        <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 mb-4">
                    <div className="text-[10px] text-neutral-500 mb-1.5 font-bold">يشمل:</div>
                    <div className="flex flex-wrap gap-1">
                      {features.covers.map((c, i) => (
                        <span key={i} className="text-[10px] bg-white/[0.05] border border-white/[0.08] rounded-md px-1.5 py-0.5 text-neutral-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isMine ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-green-400/[0.1] border border-green-400/[0.3] text-green-400 text-xs font-bold cursor-not-allowed">
                      ✓ خطّتك الحالية
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedPlan(plan.plan)}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-xs font-bold border transition-colors",
                        plan.color === "blue"   && "bg-blue-400/[0.1] border-blue-400/[0.3] text-blue-400 hover:bg-blue-400/[0.15]",
                        plan.color === "purple" && "bg-purple-400/[0.1] border-purple-400/[0.3] text-purple-400 hover:bg-purple-400/[0.15]",
                        plan.color === "green"  && "bg-green-400/[0.1] border-green-400/[0.3] text-green-400 hover:bg-green-400/[0.15]",
                      )}
                    >
                      اشترك في {plan.name}
                    </button>
                  )}
                </Card>
              )
            })}
          </div>

        </div>
      </div>

      <Modal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        title="🛡️ تأكيد الاشتراك"
        size="sm"
        footer={
          <>
            <button onClick={() => setSelectedPlan(null)} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]">إلغاء</button>
            <button onClick={handleSubscribe} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50">{submitting ? "جاري..." : "تأكيد الاشتراك"}</button>
          </>
        }
      >
        {selectedPlan && (() => {
          const plan = MOCK_INSURANCE_PLANS.find((p) => p.plan === selectedPlan)
          if (!plan) return null
          return (
            <>
              <div className="text-xs text-neutral-300 leading-relaxed mb-3">
                ستشترك في خطّة <span className="text-white font-bold">{plan.name}</span> بقسط شهري <span className="text-white font-bold font-mono">{fmtNum(plan.monthly_fee)}</span> د.ع.
                <br />
                الحدّ السنوي للتغطية: <span className="text-yellow-400 font-bold">{fmtAnnualLimit(plan.annual_limit)}</span>.
              </div>
              <div className="bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 text-[11px] text-blue-400">
                ⚠️ سيتم خصم القسط الأول الآن من رصيد وحدات الرسوم. يمكن إلغاء الاشتراك في أي وقت.
              </div>
            </>
          )
        })()}
      </Modal>
    </AppLayout>
  )
}
