"use client"

import { useRouter } from "next/navigation"
import { Info, ListChecks, Home, BookOpen, Heart, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader } from "@/components/ui"
import { SPONSORSHIP_PLANS } from "@/lib/mock-data/orphans"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const SECTIONS = [
  {
    icon: Info,
    color: "blue" as const,
    title: "ما هو البرنامج؟",
    body: "برنامج إنساني لرعاية الأطفال الذين فقدوا أحد والديهم أو كليهما — يوفّر دعماً تعليمياً وصحّياً ومعيشياً عبر نظام الكفالة الفردية أو التبرّع العام.",
  },
  {
    icon: ListChecks,
    color: "green" as const,
    title: "كيف نختار الأطفال؟",
    body: "نتعاون مع جمعيات معتمدة في كل المحافظات. كل طفل يخضع لزيارة ميدانية + مقابلة الأسرة الحاضنة + مراجعة الوضع المالي/الصحّي/التعليمي.",
  },
  {
    icon: Heart,
    color: "red" as const,
    title: "ماذا تشمل الكفالة؟",
    bodyList: [
      { icon: "🏠", title: "السكن",   body: "مساهمة في إيجار/إصلاح المنزل" },
      { icon: "📚", title: "التعليم", body: "كتب + قرطاسية + رسوم مدرسية" },
      { icon: "🍎", title: "الطعام",   body: "حصّة شهرية من الأساسيات" },
      { icon: "💊", title: "الصحّة",   body: "فحوصات دورية + علاج" },
    ],
  },
  {
    icon: FileText,
    color: "purple" as const,
    title: "التقارير الدورية",
    body: "تصلك تقارير شهرية أو ربع سنوية تشمل: تقدّم الطفل الدراسي + الحالة الصحّية + صور حديثة + رسائل من الطفل (إن أمكن).",
  },
]

export default function OrphansAboutPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title="عن البرنامج" subtitle="كيف يعمل برنامج رعاية الأيتام" />

          <Card variant="gradient" color="blue" padding="lg" className="mb-6 text-center">
            <div className="text-4xl mb-3">👶</div>
            <div className="text-base font-bold text-white mb-2">كل طفل يستحق فرصة</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              نؤمن أن دعم طفل يتيم اليوم يصنع جيلاً واعياً متعلّماً غداً. هدفنا: 1000 طفل مكفول حتى نهاية 2027.
            </div>
          </Card>

          {/* Sponsorship plans */}
          <SectionHeader title="💰 خطط الكفالة الشهرية" subtitle="اختر ما يناسب قدرتك" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {SPONSORSHIP_PLANS.map((plan) => (
              <Card key={plan.id} variant="gradient" color={plan.color} padding="md">
                <div className="text-base font-bold text-white mb-1">{plan.name}</div>
                <div className={cn(
                  "text-2xl font-bold font-mono mb-1",
                  plan.color === "blue"   && "text-blue-400",
                  plan.color === "purple" && "text-purple-400",
                  plan.color === "green"  && "text-green-400",
                )}>
                  {fmtNum(plan.monthly)}
                </div>
                <div className="text-[10px] text-neutral-500 mb-3">د.ع / شهرياً</div>
                <div className="space-y-1.5">
                  {plan.covers.map((c, i) => (
                    <div key={i} className="text-[11px] text-neutral-300 flex items-center gap-1">
                      <span className="text-green-400">✓</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Sections */}
          <div className="space-y-3 mb-6">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon
              return (
                <Card key={i} padding="md">
                  <div className="flex items-start gap-3 mb-2">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      s.color === "blue"   && "bg-blue-400/[0.1] border border-blue-400/[0.3]",
                      s.color === "green"  && "bg-green-400/[0.1] border border-green-400/[0.3]",
                      s.color === "red"    && "bg-red-400/[0.1] border border-red-400/[0.3]",
                      s.color === "purple" && "bg-purple-400/[0.1] border border-purple-400/[0.3]",
                    )}>
                      <Icon className={cn(
                        "w-5 h-5",
                        s.color === "blue"   && "text-blue-400",
                        s.color === "green"  && "text-green-400",
                        s.color === "red"    && "text-red-400",
                        s.color === "purple" && "text-purple-400",
                      )} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-white mb-1">{s.title}</div>
                      {s.body && <div className="text-xs text-neutral-300 leading-relaxed">{s.body}</div>}
                    </div>
                  </div>
                  {s.bodyList && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {s.bodyList.map((item, j) => (
                        <div key={j} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                          <div className="text-base mb-1">{item.icon}</div>
                          <div className="text-xs text-white font-bold mb-0.5">{item.title}</div>
                          <div className="text-[10px] text-neutral-500">{item.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/orphans/children")}
              className="bg-blue-400/[0.08] border border-blue-400/[0.25] text-blue-400 py-3 rounded-xl text-sm font-bold hover:bg-blue-400/[0.12] transition-colors"
            >
              تصفّح الأطفال
            </button>
            <button
              onClick={() => router.push("/orphans/sponsor")}
              className="bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              ابدأ كفالة الآن
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
