"use client"

import { useState } from "react"
import { ChevronDown, Scale, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

const SECTIONS = [
  {
    title: "طبيعة المنصة",
    icon: "🏛️",
    content: "رايلوس منصة تقنية لإدارة وتنظيم الفرص الاستثمارية، تربط المستثمرين بالشركات وأصحاب المشاريع. لا تقوم المنصة بأي تعاملات مالية مباشرة داخلها، وجميع العمليات المالية تتم خارج نطاق المنصة بين الأطراف.",
    legal: "استناداً إلى أحكام القانون المدني العراقي رقم (40) لسنة 1951 الخاصة بحرية التعاقد وتنظيم العلاقات بين الأطراف.",
  },
  {
    title: "التسجيل والأهلية",
    icon: "👤",
    content: "يُشترط أن يكون المستخدم بالغاً وفق القوانين المحلية المعمول بها. بتسجيلك فإنك تقر بصحة معلوماتك وموافقتك على شروط الاستخدام.",
    legal: "استناداً إلى أحكام الأهلية القانونية في القانون المدني العراقي.",
  },
  {
    title: "المسؤولية",
    icon: "⚖️",
    content: "المنصة تنظم العمليات وتيسر التواصل بين الأطراف فقط، وليست مسؤولة عن خسائر الاستثمار أو قرارات المستخدمين. كل مستخدم يتحمل مسؤولية قراراته الاستثمارية كاملاً.",
    legal: "استناداً إلى أحكام المسؤولية المدنية في القانون المدني العراقي رقم (40) لسنة 1951.",
  },
  {
    title: "العمولة والرسوم",
    icon: "💱",
    content: "تُفرض رسوم 2.5% على عمليات إرسال الحصص — تُخصم بوحدات الرسوم فقط (وليست بالحصص نفسها). يستلم المستلم الكمية كاملةً. كل رسوم المنصّة تُحسب بوحدات الرسوم بدون أي خصم من الحصص.",
    legal: "استناداً إلى أحكام التعاقد في القانون المدني العراقي.",
  },
  {
    title: "الدفع والتحويل",
    icon: "🏦",
    content: "جميع المعاملات المالية الفعلية تتم عبر التحويل البنكي أو الطرق المتفق عليها خارج التطبيق. الدفع يتم بعد الاتفاق عبر المحادثة داخل المنصة.",
    legal: "استناداً إلى القوانين العراقية المنظمة للنشاطات المالية والتحويلات.",
  },
  {
    title: "حقوق الملكية الفكرية",
    icon: "©️",
    content: "جميع محتويات المنصة وعلامتها التجارية محمية قانونياً. لا يجوز نسخ أو إعادة استخدام أي محتوى دون إذن كتابي مسبق.",
    legal: "استناداً إلى قانون حماية حقوق الملكية الفكرية العراقي.",
  },
  {
    title: "إلغاء الحساب والتعليق",
    icon: "🚫",
    content: "يحق للمستخدم حذف حسابه في أي وقت بعد إتمام أو إلغاء جميع الصفقات الجارية. يحق للمنصة تعليق الحساب أو إلغاءه في حال انتهاك الشروط.",
    legal: "استناداً إلى حق المنصة في حماية نزاهة البيئة الاستثمارية.",
  },
  {
    title: "تحديثات الشروط",
    icon: "📋",
    content: "قد يتم تحديث هذه الشروط من وقت لآخر. سيتم إشعار المستخدمين بأي تحديثات مهمة عبر التطبيق. الاستمرار في استخدام المنصة يعني موافقتك على الشروط الجديدة.",
    legal: "استناداً إلى مبادئ العقود المتجددة في القانون المدني.",
  },
]

export default function TermsPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge="TERMS · الشروط والأحكام"
            title="الشروط والأحكام"
            description="آخر تحديث: 25 أبريل 2026"
          />

          {/* Header banner */}
          <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded-2xl p-4 mb-5 flex gap-3 items-start">
            <Scale className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold text-yellow-400 mb-1">قبل البدء باستخدام المنصة</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                يرجى قراءة هذه الشروط بعناية. باستخدامك للمنصة فإنك توافق على الالتزام بكافة البنود المذكورة أدناه.
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-2.5">
            {SECTIONS.map((s, i) => (
              <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full p-4 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-base flex-shrink-0">
                      {s.icon}
                    </div>
                    <span className="text-sm font-bold text-white">{i + 1}. {s.title}</span>
                  </div>
                  <ChevronDown
                    className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", openIdx === i && "rotate-180")}
                    strokeWidth={1.5}
                  />
                </button>
                {openIdx === i && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                    <div className="text-xs text-neutral-300 leading-relaxed mb-3">{s.content}</div>
                    <div className="bg-blue-400/[0.04] border border-blue-400/15 rounded-lg p-3 flex gap-2 items-start">
                      <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="text-[11px] text-neutral-400 leading-relaxed">
                        <span className="text-blue-400 font-bold">المرجعية القانونية: </span>
                        {s.legal}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-center mt-6">
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              للاستفسار حول هذه الشروط، تواصل مع <a href="mailto:railostrade@gmail.com" className="text-blue-400 hover:underline" dir="ltr">railostrade@gmail.com</a> أو <a href="tel:+9647721726518" className="text-blue-400 hover:underline" dir="ltr">07721726518</a>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
