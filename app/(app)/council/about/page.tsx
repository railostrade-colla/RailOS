"use client"

import { useRouter } from "next/navigation"
import { Check, X, Vote, Users, FileSearch, Crown, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Badge } from "@/components/ui"

export default function CouncilAboutPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="📚 كيف يعمل مجلس السوق؟"
            subtitle="دليل شامل عن المهام والصلاحيات"
            backHref="/council"
          />

          {/* ═══ § 1: Intro ═══ */}
          <Card className="mb-6">
            <h3 className="text-sm font-bold text-white mb-2">🏛️ ما هو مجلس السوق؟</h3>
            <p className="text-xs text-neutral-300 leading-relaxed mb-3">
              مجلس السوق هو الجهة الرقابية المنتخبة على منصة رايلوس. يتكوّن من مزيج من ممثلي الإدارة والمستثمرين المنتخبين، ودوره الأساسي ضمان الشفافية ومراقبة القرارات الكبرى.
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              المجلس يقدّم <strong className="text-white">توصيات استشارية</strong> توثَّق رسمياً، لكن القرار النهائي يبقى دائماً في يد الإدارة.
            </p>
          </Card>

          {/* ═══ § 2: Composition ═══ */}
          <Card className="mb-6">
            <SectionHeader title="👥 تكوين المجلس" subtitle="5–7 أعضاء — مزيج من الإدارة والمنتخبين" />
            <div className="space-y-3">
              <div className="bg-purple-400/[0.06] border border-purple-400/25 rounded-xl p-3 flex items-start gap-3">
                <Crown className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">المؤسس</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    عضو دائم — لا يخضع للانتخاب. صاحب الرؤية الاستراتيجية للمنصة.
                  </p>
                </div>
              </div>
              <div className="bg-blue-400/[0.06] border border-blue-400/25 rounded-xl p-3 flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">عضو إداري معيّن</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    1 عضو يُعيَّن من قِبل الإدارة لمتابعة العمليات اليومية.
                  </p>
                </div>
              </div>
              <div className="bg-green-400/[0.06] border border-green-400/25 rounded-xl p-3 flex items-start gap-3">
                <Vote className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">3–5 أعضاء منتخبون</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    من المستثمرين، يُنتخبون لمدة سنة قابلة للتجديد عبر تصويت مفتوح.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ═══ § 3: Eligibility ═══ */}
          <Card variant="highlighted" color="blue" className="mb-6">
            <SectionHeader title="📋 شروط الترشّح" subtitle="للأعضاء المنتخبين" />
            <div className="space-y-2">
              {[
                "مستوى متقدم أو محترف",
                "6 أشهر+ على المنصة",
                "100+ صفقة ناجحة",
                "نسبة نجاح 95%+",
                "KYC مكتمل",
                "لا انتهاكات سابقة",
              ].map((req) => (
                <div key={req} className="flex items-center gap-2 text-xs text-neutral-300">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={2.5} />
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ═══ § 4: Powers (2 cols) ═══ */}
          <SectionHeader title="⚖️ الصلاحيات" subtitle="ما يحق وما لا يحق للمجلس" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <Card variant="highlighted" color="green">
              <div className="text-sm font-bold text-green-400 mb-3 flex items-center gap-1.5">
                ✅ ما يحق للمجلس
              </div>
              <ul className="space-y-2 text-xs text-neutral-300">
                {[
                  "مراجعة المشاريع المقترحة",
                  "مراجعة طلبات إطلاق الحصص",
                  "التصويت بـ \"موافقة استشارية\"",
                  "تقديم \"اعتراض موثّق\"",
                  "تقديم طلبات تحقيق",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card variant="highlighted" color="red">
              <div className="text-sm font-bold text-red-400 mb-3 flex items-center gap-1.5">
                ❌ ما لا يحق للمجلس
              </div>
              <ul className="space-y-2 text-xs text-neutral-300">
                {[
                  "التدخّل في قرارات الإدارة",
                  "التعيينات والترقيات",
                  "إيقاف مشاريع",
                  "تجميد حسابات المستخدمين",
                  "تنفيذ معاملات مالية",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* ═══ § 5: Decision flow (timeline) ═══ */}
          <Card className="mb-6">
            <SectionHeader title="🔄 عملية اتخاذ القرار" />
            <div className="relative">
              <div className="absolute right-4 top-2 bottom-2 w-0.5 bg-white/[0.08]" />
              <div className="space-y-4 relative">
                {[
                  { num: 1, title: "تقديم اقتراح", desc: "من إدارة أو عضو مجلس أو مستثمر" },
                  { num: 2, title: "مراجعة المجلس + تصويت استشاري", desc: "5 أيام للنقاش والتصويت" },
                  { num: 3, title: "توصية المجلس", desc: "موافقة / اعتراض / محايد — موثّقة رسمياً" },
                  { num: 4, title: "القرار النهائي", desc: "المؤسس + الرئيس التنفيذي يأخذان القرار" },
                  { num: 5, title: "التنفيذ والتوثيق", desc: "تنفيذ القرار + توثيق كامل لكل الخطوات" },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-3 mr-1">
                    <div className="w-8 h-8 rounded-full bg-purple-400/[0.15] border-2 border-purple-400/40 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0 z-10 bg-[#0f0f0f]">
                      {step.num}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="text-sm font-bold text-white mb-0.5">{step.title}</div>
                      <div className="text-[11px] text-neutral-400 leading-relaxed">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ═══ § 6: Term + elections ═══ */}
          <Card variant="gradient" color="orange">
            <SectionHeader title="🗓️ مدة الدورة + الانتخابات" />
            <div className="space-y-2 mb-4">
              {[
                { label: "مدة الدورة", value: "سنة كاملة" },
                { label: "موعد الانتخابات", value: "قبل شهر من نهاية الدورة" },
                { label: "آلية التصويت", value: "إلكتروني عبر التطبيق" },
                { label: "الفائزون", value: "أصحاب أعلى أصوات حسب عدد المقاعد" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5">
                  <span className="text-[11px] text-neutral-400">{row.label}</span>
                  <span className="text-xs text-white font-bold">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/council/elections")}
              className="w-full bg-orange-400 hover:bg-orange-500 text-black py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Vote className="w-4 h-4" strokeWidth={2.5} />
              اطّلع على الانتخابات الحالية
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </Card>

        </div>
      </div>
    </AppLayout>
  )
}
