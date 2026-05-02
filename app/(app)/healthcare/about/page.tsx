"use client"

import { useRouter } from "next/navigation"
import { Info, Coins, FileCheck, Stethoscope, Eye, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader } from "@/components/ui"
import { DISEASE_LABELS } from "@/lib/mock-data/healthcare"

const SECTIONS = [
  {
    icon: Info,
    color: "blue" as const,
    title: "ما هو البرنامج؟",
    body: "برنامج رعاية صحية يدعم المرضى المحتاجين من مستثمري رايلوس وعموم المواطنين. يموّل العلاجات الباهظة ويوفّر تأميناً صحياً ميسّراً.",
  },
  {
    icon: Coins,
    color: "green" as const,
    title: "كيف يُموَّل؟",
    body: "من 3 مصادر: (1) اشتراكات التأمين الشهرية، (2) تبرّعات مباشرة من الأعضاء، (3) نسبة من رسوم الصفقات (0.05%) تُخصّص لصندوق الصحّة.",
  },
  {
    icon: FileCheck,
    color: "purple" as const,
    title: "شروط الاستفادة",
    body: "حساب موثَّق KYC + تقرير طبّي رسمي من مستشفى معتمد + إثبات احتياج مالي. الأولوية للحالات العاجلة المهدّدة للحياة.",
  },
  {
    icon: Stethoscope,
    color: "red" as const,
    title: "الأمراض المدعومة",
    bodyList: Object.values(DISEASE_LABELS).map((d) => `${d.icon} ${d.label}`),
  },
  {
    icon: Eye,
    color: "yellow" as const,
    title: "آلية المراجعة",
    body: "كل طلب يُراجَع من فريق طبّي مختصّ خلال 5-7 أيام عمل. يتم التحقّق من التقارير + التواصل مع المستشفى + تقييم الحالة المالية.",
  },
  {
    icon: Users,
    color: "orange" as const,
    title: "الشفافية",
    body: "كل تبرّع موثَّق ومُتتبَّع. التقارير الدورية تُنشَر شهرياً. أي حالة لها صفحة عامّة تُظهر المبلغ المتجمّع وقائمة المتبرّعين (مع خيار إخفاء الاسم).",
  },
]

export default function HealthcareAboutPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="عن البرنامج"
            subtitle="كيف يعمل برنامج الرعاية الصحية"
          />

          <Card variant="gradient" color="red" padding="lg" className="mb-6 text-center">
            <div className="text-4xl mb-3">🏥</div>
            <div className="text-base font-bold text-white mb-2">دعم العلاج وتمكين الحياة</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              نؤمن أن الصحّة حقّ للجميع. هذا البرنامج وُلد ليجسر الفجوة بين تكاليف العلاج الباهظة وقدرة المواطن العراقي.
            </div>
          </Card>

          <div className="space-y-3 mb-6">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon
              return (
                <Card key={i} padding="md">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      s.color === "blue"   ? "bg-blue-400/[0.1] border border-blue-400/[0.3]"   :
                      s.color === "green"  ? "bg-green-400/[0.1] border border-green-400/[0.3]"  :
                      s.color === "purple" ? "bg-purple-400/[0.1] border border-purple-400/[0.3]" :
                      s.color === "red"    ? "bg-red-400/[0.1] border border-red-400/[0.3]"    :
                      s.color === "yellow" ? "bg-yellow-400/[0.1] border border-yellow-400/[0.3]" :
                                             "bg-orange-400/[0.1] border border-orange-400/[0.3]"
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        s.color === "blue"   ? "text-blue-400"   :
                        s.color === "green"  ? "text-green-400"  :
                        s.color === "purple" ? "text-purple-400" :
                        s.color === "red"    ? "text-red-400"    :
                        s.color === "yellow" ? "text-yellow-400" : "text-orange-400"
                      }`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-white mb-1">{s.title}</div>
                      {s.body && <div className="text-xs text-neutral-300 leading-relaxed">{s.body}</div>}
                      {s.bodyList && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {s.bodyList.map((item, j) => (
                            <div key={j} className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300">
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <SectionHeader title="📞 لمزيد من المعلومات" />
          <Card padding="md" className="mb-6">
            <div className="text-xs text-neutral-300 leading-relaxed mb-3">
              هل لديك سؤال؟ تواصل معنا عبر الدعم الفنّي أو زُر صفحة الأسئلة الشائعة.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => router.push("/support")}
                className="flex-1 bg-blue-400/[0.08] border border-blue-400/[0.25] text-blue-400 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-400/[0.12] transition-colors"
              >
                تواصل معنا
              </button>
              <button
                onClick={() => router.push("/healthcare/apply")}
                className="flex-1 bg-neutral-100 text-black py-2.5 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
              >
                قدّم طلبك الآن
              </button>
            </div>
          </Card>

        </div>
      </div>
    </AppLayout>
  )
}
