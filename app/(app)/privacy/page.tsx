"use client"

import { useState } from "react"
import { ChevronDown, Lock, Shield } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

const SECTIONS = [
  {
    title: "المقدمة",
    icon: "📋",
    content: "تلتزم منصة رايلوس بحماية خصوصية المستخدمين والحفاظ على سرية بياناتهم الشخصية. توضح هذه السياسة كيفية جمع البيانات واستخدامها وحمايتها عند استخدام منصة رايلوس أو أي من خدماتها.",
    legal: "استناداً إلى المادة (17) من دستور جمهورية العراق لسنة 2005 التي تكفل حماية الخصوصية الشخصية.",
  },
  {
    title: "البيانات التي نجمعها",
    icon: "📊",
    content: "نجمع: بيانات التسجيل (الاسم، رقم الهاتف، البريد الإلكتروني). بيانات التوثيق KYC (صورة الهوية، صورة شخصية). بيانات الاستخدام (سجل الدخول، التفاعل، الأجهزة، IP التقريبي). بيانات الفرص الاستثمارية وسجل النشاط.",
    legal: "استناداً إلى المادة (40) من دستور العراق الخاصة بسرية الاتصالات والبيانات الإلكترونية.",
  },
  {
    title: "كيف نستخدم البيانات",
    icon: "⚙️",
    content: "نستخدم البيانات لإنشاء وإدارة الحسابات، التحقق من هوية المستخدمين، حماية المستخدمين من الاحتيال، تحسين تجربة المستخدم، تطوير خدمات المنصة، الالتزام بالمتطلبات القانونية، وحل النزاعات.",
    legal: "استناداً إلى أحكام المسؤولية المدنية في القانون المدني العراقي رقم (40) لسنة 1951.",
  },
  {
    title: "مشاركة البيانات",
    icon: "🔗",
    content: "نحن لا نبيع بيانات المستخدمين لأي طرف ثالث. تتم مشاركة البيانات فقط عند: الامتثال للقوانين، طلب الجهات الحكومية، مع مزودي الخدمات التقنية لتشغيل المنصة، أو عند الضرورة لحماية حقوق المنصة والمستخدمين.",
    legal: "استناداً إلى القوانين العراقية المنظمة لمشاركة البيانات مع الجهات الرسمية.",
  },
  {
    title: "حماية البيانات",
    icon: "🔒",
    content: "نلتزم بأعلى معايير الأمان: تشفير البيانات الحساسة، أنظمة حماية من الاختراق، أنظمة كشف الاحتيال، تقييد الوصول الداخلي، ومراقبة الأنظمة بشكل مستمر.",
    legal: "استناداً إلى التشريعات العراقية المتعلقة بحماية الأنظمة المعلوماتية والبيانات الرقمية.",
  },
  {
    title: "مدة الاحتفاظ بالبيانات",
    icon: "📅",
    content: "نحتفظ ببيانات المستخدم طوال فترة استخدام الحساب، أو حسب ما تتطلبه القوانين المحلية، أو عند الحاجة لأغراض قانونية أو أمنية.",
    legal: "استناداً إلى أحكام الدستور العراقي المتعلقة بحماية الخصوصية.",
  },
  {
    title: "حقوق المستخدم",
    icon: "✅",
    content: "للمستخدم الحق في: الوصول لبياناته، تعديل بياناته، طلب حذف الحساب، سحب الموافقة على بعض أنواع المعالجة، وطلب نسخة من بياناته.",
    legal: "استناداً إلى مبادئ حماية الحقوق الشخصية المكفولة في الدستور العراقي.",
  },
  {
    title: "خصوصية القاصرين",
    icon: "👶",
    content: "المنصة غير مخصصة لمن هم دون السن القانوني. قد نقوم بإزالة أي حساب يتم اكتشاف أنه يعود لمستخدم دون السن القانوني.",
    legal: "استناداً إلى القوانين العراقية المتعلقة بحماية القاصرين.",
  },
  {
    title: "إخلاء المسؤولية المالية",
    icon: "⚠️",
    content: "منصة رايلوس لا تقوم بإدارة الأموال أو تنفيذ العمليات المالية مباشرة. المنصة تقتصر على عرض الفرص الاستثمارية وتنظيم التواصل والتعاقد بين الأطراف.",
    legal: "استناداً إلى القوانين العراقية المنظمة للنشاطات المالية والاستثمارية.",
  },
]

export default function PrivacyPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge="PRIVACY · سياسة الخصوصية"
            title="سياسة الخصوصية"
            description="آخر تحديث: 25 أبريل 2026"
          />

          {/* Header banner */}
          <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-2xl p-4 mb-5 flex gap-3 items-start">
            <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold text-blue-400 mb-1">خصوصيتك أولويتنا</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                نلتزم بحماية بياناتك الشخصية وفق أعلى معايير الأمان. لن نشارك بياناتك مع أي طرف خارجي دون موافقتك.
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
                    <div className="bg-purple-400/[0.04] border border-purple-400/15 rounded-lg p-3 flex gap-2 items-start">
                      <Shield className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="text-[11px] text-neutral-400 leading-relaxed">
                        <span className="text-purple-400 font-bold">المرجعية القانونية: </span>
                        {s.legal}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-center mt-6">
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              لطلب أي معلومات حول بياناتك، تواصل مع <a href="mailto:railostrade@gmail.com" className="text-blue-400 hover:underline" dir="ltr">railostrade@gmail.com</a> أو <a href="tel:+9647721726518" className="text-blue-400 hover:underline" dir="ltr">07721726518</a>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
