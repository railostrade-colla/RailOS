"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, BookOpen, Smartphone, Wallet, ShoppingCart, BarChart3, Shield, Users, ArrowLeftRight, Gavel, FileText, Bell, Search, Star } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

// ─── رسومات SVG توضيحية ───
const SVG_ONBOARDING = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <defs>
      <linearGradient id="phoneGr" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(96,165,250,0.2)"/>
        <stop offset="100%" stopColor="rgba(96,165,250,0.05)"/>
      </linearGradient>
    </defs>
    <rect x="80" y="15" width="40" height="80" rx="6" fill="url(#phoneGr)" stroke="rgba(96,165,250,0.5)" strokeWidth="1.5"/>
    <rect x="86" y="22" width="28" height="50" rx="2" fill="rgba(255,255,255,0.05)"/>
    <circle cx="100" cy="84" r="3" fill="rgba(96,165,250,0.5)"/>
    <text x="100" y="40" textAnchor="middle" fontSize="6" fill="#60A5FA" fontWeight="bold">رايلوس</text>
    <circle cx="100" cy="50" r="6" fill="none" stroke="#60A5FA" strokeWidth="1.5"/>
    <path d="M97 50 L99 52 L103 48" stroke="#60A5FA" strokeWidth="1.5" fill="none"/>
    <text x="100" y="63" textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.5)">جاهز للبدء</text>
  </svg>
)

const SVG_KYC = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <defs>
      <linearGradient id="cardGr" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(251,191,36,0.15)"/>
        <stop offset="100%" stopColor="rgba(251,191,36,0.05)"/>
      </linearGradient>
    </defs>
    <rect x="40" y="30" width="120" height="60" rx="8" fill="url(#cardGr)" stroke="rgba(251,191,36,0.4)" strokeWidth="1.5"/>
    <circle cx="65" cy="55" r="12" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.5)" strokeWidth="1"/>
    <path d="M65 50 a3 3 0 1 0 0.001 0 M58 65 q7 -5 14 0" stroke="#FBBF24" strokeWidth="1.5" fill="none"/>
    <rect x="85" y="42" width="55" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
    <rect x="85" y="50" width="40" height="3" rx="1" fill="rgba(255,255,255,0.25)"/>
    <rect x="85" y="58" width="50" height="3" rx="1" fill="rgba(255,255,255,0.25)"/>
    <circle cx="135" cy="78" r="6" fill="rgba(74,222,128,0.2)" stroke="rgba(74,222,128,0.6)" strokeWidth="1.5"/>
    <path d="M132 78 L134 80 L138 75" stroke="#4ADE80" strokeWidth="1.5" fill="none"/>
  </svg>
)

const SVG_WALLET = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <rect x="50" y="35" width="100" height="65" rx="10" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.4)" strokeWidth="1.5"/>
    <rect x="60" y="50" width="40" height="3" rx="1" fill="rgba(255,255,255,0.3)"/>
    <text x="60" y="73" fontSize="10" fill="#4ADE80" fontWeight="bold">2,500,000</text>
    <text x="125" y="73" fontSize="6" fill="rgba(255,255,255,0.5)">د.ع</text>
    <rect x="60" y="83" width="20" height="8" rx="2" fill="rgba(74,222,128,0.2)"/>
    <text x="70" y="89" textAnchor="middle" fontSize="5" fill="#4ADE80">إرسال</text>
    <rect x="85" y="83" width="20" height="8" rx="2" fill="rgba(96,165,250,0.2)"/>
    <text x="95" y="89" textAnchor="middle" fontSize="5" fill="#60A5FA">استلام</text>
    <circle cx="160" cy="55" r="14" fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5"/>
    <path d="M155 55 L160 50 L165 55 M160 50 L160 60" stroke="#4ADE80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const SVG_MARKET = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
    <line x1="20" y1="100" x2="20" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
    <polyline points="25,80 45,70 65,55 85,60 105,40 125,45 145,30 165,25" stroke="#C084FC" strokeWidth="2.5" fill="none"/>
    <polyline points="25,80 45,70 65,55 85,60 105,40 125,45 145,30 165,25 165,100 25,100" fill="rgba(192,132,252,0.15)"/>
    <circle cx="165" cy="25" r="3" fill="#C084FC"/>
    <text x="170" y="22" fontSize="6" fill="#C084FC" fontWeight="bold">+15%</text>
    <text x="100" y="115" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.4)">حركة الأسعار</text>
  </svg>
)

const SVG_PROJECTS = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <rect x="20" y="40" width="50" height="70" rx="6" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.35)" strokeWidth="1.5"/>
    <rect x="30" y="50" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
    <text x="45" y="70" textAnchor="middle" fontSize="14" fill="#4ADE80">🌾</text>
    <rect x="30" y="90" width="30" height="2" rx="1" fill="rgba(74,222,128,0.4)"/>
    <rect x="30" y="95" width="20" height="2" rx="1" fill="rgba(74,222,128,0.7)"/>

    <rect x="75" y="25" width="50" height="85" rx="6" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.35)" strokeWidth="1.5"/>
    <rect x="85" y="35" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
    <text x="100" y="55" textAnchor="middle" fontSize="14" fill="#FBBF24">🏗️</text>
    <rect x="85" y="75" width="30" height="2" rx="1" fill="rgba(251,191,36,0.4)"/>
    <rect x="85" y="80" width="22" height="2" rx="1" fill="rgba(251,191,36,0.7)"/>

    <rect x="130" y="50" width="50" height="60" rx="6" fill="rgba(96,165,250,0.1)" stroke="rgba(96,165,250,0.35)" strokeWidth="1.5"/>
    <rect x="140" y="60" width="30" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
    <text x="155" y="80" textAnchor="middle" fontSize="14" fill="#60A5FA">💻</text>
    <rect x="140" y="98" width="30" height="2" rx="1" fill="rgba(96,165,250,0.4)"/>
    <rect x="140" y="103" width="15" height="2" rx="1" fill="rgba(96,165,250,0.7)"/>
  </svg>
)

const SVG_SECURITY = (
  <svg viewBox="0 0 200 120" className="w-full h-full">
    <path d="M100 20 L130 35 L130 65 Q130 90 100 105 Q70 90 70 65 L70 35 Z" fill="rgba(248,113,113,0.1)" stroke="rgba(248,113,113,0.4)" strokeWidth="2"/>
    <circle cx="100" cy="60" r="10" fill="none" stroke="#F87171" strokeWidth="1.5"/>
    <path d="M93 60 L98 65 L107 56" stroke="#F87171" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <text x="100" y="85" textAnchor="middle" fontSize="6" fill="#F87171" fontWeight="bold">آمن ومُشفّر</text>
  </svg>
)

const SECTIONS = [
  {
    id: "start",
    icon: Smartphone,
    iconEmoji: "🚀",
    title: "البداية مع رايلوس",
    color: "blue",
    description: "تعرّف على أساسيات التطبيق وكيفية البدء بأول تجربة استثمارية لك",
    illustration: SVG_ONBOARDING,
    items: [
      {
        q: "ما هي منصة رايلوس؟",
        a: "رايلوس منصة تقنية لإدارة وتنظيم الفرص الاستثمارية، تربط المستثمرين بالشركات وأصحاب المشاريع. تتيح لك تداول الحصص الاستثمارية، متابعة المشاريع، والتواصل مع المستثمرين الآخرين بطريقة آمنة ومنظمة.",
      },
      {
        q: "كيف أسجل في المنصة؟",
        a: "افتح التطبيق واضغط على \"إنشاء حساب\". أدخل رقم هاتفك والاسم الكامل، أكمل التحقق برمز OTP، ثم استكمل ملفك الشخصي. بعدها يمكنك استخدام جميع ميزات المنصة.",
      },
      {
        q: "هل التسجيل مجاني؟",
        a: "نعم، التسجيل مجاني تماماً. تُفرض عمولة بنسبة 2% فقط على عمليات إرسال الحصص، وعمولات بسيطة على الصفقات المكتملة (يتم الإعلان عنها بوضوح قبل تأكيد أي عملية).",
      },
    ],
  },
  {
    id: "kyc",
    icon: Shield,
    iconEmoji: "🪪",
    title: "التوثيق (KYC)",
    color: "yellow",
    description: "خطوات التحقق من الهوية لرفع سقف الاستثمار وتفعيل ميزات متقدمة",
    illustration: SVG_KYC,
    items: [
      {
        q: "لماذا التوثيق مطلوب؟",
        a: "التوثيق يحمي جميع المستخدمين ويضمن بيئة استثمارية آمنة وموثوقة. يُطلب لرفع سقف المعاملات والوصول لميزات متقدمة مثل المزادات الحصرية والاستثمار في المشاريع الكبيرة.",
      },
      {
        q: "ما المستندات المطلوبة للتوثيق؟",
        a: "صورة واضحة من الهوية الوطنية أو جواز السفر، وصورة شخصية (سيلفي) أثناء حمل الهوية. قد تُطلب مستندات إضافية للحسابات التجارية أو الاستثمارية الكبيرة.",
      },
      {
        q: "كم تستغرق مراجعة التوثيق؟",
        a: "عادةً من 24-72 ساعة عمل. ستتلقى إشعاراً فورياً بنتيجة المراجعة، وفي حالة الرفض ستحصل على سبب واضح وفرصة لإعادة التقديم.",
      },
    ],
  },
  {
    id: "wallet",
    icon: Wallet,
    iconEmoji: "💼",
    title: "المحفظة والحصص",
    color: "green",
    description: "كيف تدير حصصك وترسلها وتستلمها بأمان كامل",
    illustration: SVG_WALLET,
    items: [
      {
        q: "ما هي الحصة الاستثمارية؟",
        a: "الحصة (SHR) هي وحدة الاستثمار في مشروع معين داخل رايلوس. كل حصة لها سعر محدد ونسبة في المشروع، وتمنحك حق الحصول على عوائد المشروع بنسبة حصصك من إجمالي الحصص.",
      },
      {
        q: "كيف أرسل حصصاً لمستخدم آخر؟",
        a: "من صفحة المحفظة → \"إرسال حصص\"، أدخل ID المستلم أو امسح باركود محفظته، اختر الحصة والكمية، ثم أكد العملية. يستلم المستلم الكمية كاملةً بدون أي خصم بالحصص — رسوم التحويل تُخصم فقط من رصيد وحدات الرسوم.",
      },
      {
        q: "ما هو البيع السريع؟",
        a: "ميزة تتيح نشر حصصك للبيع في السوق فوراً بسعر مخفض 15% من السعر الحالي، مما يزيد احتمالية البيع السريع. مفيد عندما تحتاج سيولة فورية. السعر يُحدد تلقائياً من النظام.",
      },
    ],
  },
  {
    id: "market",
    icon: ShoppingCart,
    iconEmoji: "📊",
    title: "السوق والتداول",
    color: "purple",
    description: "تعلم كيف تشتري حصصاً وتفاوض مع البائعين وتغتنم الفرص",
    illustration: SVG_MARKET,
    items: [
      {
        q: "كيف أشتري حصصاً في مشروع؟",
        a: "يتوفر خياران: (1) الشراء المباشر من المنصة بالسعر الرسمي، أو (2) الشراء من المستثمرين عبر صفحة التبادل. يمكنك أيضاً من صفحة المشروع طلب الشراء المباشر من المنصة.",
      },
      {
        q: "ما الفرق بين عروض النظام وعروض المستثمرين؟",
        a: "عروض النظام تُضاف من إدارة رايلوس وتمثل فرصاً مميزة مباشرة بأسعار رسمية. عروض المستثمرين هي حصص يبيعها مستخدمون آخرون من محافظهم - قد تجد أسعاراً أفضل أو فرصاً للتفاوض.",
      },
      {
        q: "هل يمكنني التفاوض على السعر؟",
        a: "نعم، في صفحة التبادل يمكنك التفاوض مع البائع عبر المحادثة الخاصة بالصفقة قبل إتمامها. لديك 15 دقيقة من فتح الصفقة للوصول إلى اتفاق.",
      },
    ],
  },
  {
    id: "projects",
    icon: BarChart3,
    iconEmoji: "🏢",
    title: "المشاريع والمتابعة",
    color: "orange",
    description: "تابع أداء استثماراتك وافهم مستويات المخاطرة",
    illustration: SVG_PROJECTS,
    items: [
      {
        q: "كيف أتابع مشروعاً أو شركة؟",
        a: "افتح صفحة المشروع أو الشركة واضغط زر \"متابعة\". ستجد قائمة متابعتك في القائمة الرئيسية → \"المتابعة\"، وستتلقى إشعارات عند أي تحديث مهم في المشروع.",
      },
      {
        q: "كيف أعرف مستوى مخاطرة المشروع؟",
        a: "كل مشروع لديه تصنيف واضح: منخفض (أخضر) للمشاريع المستقرة، متوسط (أصفر) للمشاريع متوسطة الخطر، مرتفع (أحمر) للمشاريع الواعدة لكنها مخاطرة. تجد التصنيف في صفحة تفاصيل المشروع.",
      },
      {
        q: "ما هي مستويات المستثمرين؟",
        a: "ثلاثة مستويات: أساسي (حتى 10 مليون/شهر) للمستثمرين الجدد، متقدم (حتى 50 مليون/شهر)، محترف (حتى 250 مليون/شهر) لكبار المستثمرين. تُرقّى تلقائياً بناءً على نشاطك وتوثيقك.",
      },
    ],
  },
  {
    id: "security",
    icon: Shield,
    iconEmoji: "🔒",
    title: "الأمان والخصوصية",
    color: "red",
    description: "كيف نحمي بياناتك وأموالك بأعلى معايير الأمان",
    illustration: SVG_SECURITY,
    items: [
      {
        q: "هل بياناتي آمنة؟",
        a: "نعم، نستخدم تشفير SSL لجميع البيانات. كلمات المرور مشفرة ومحمية. لا يمكن لأي موظف الاطلاع على رمز مرورك. نلتزم بأعلى معايير الخصوصية وفق التشريعات العراقية.",
      },
      {
        q: "ماذا أفعل إذا نسيت كلمة المرور؟",
        a: "اضغط \"نسيت كلمة المرور\" في صفحة الدخول، وأدخل رقم هاتفك المسجل لاستقبال رمز إعادة التعيين عبر SMS. اتبع التعليمات لإنشاء كلمة مرور جديدة قوية.",
      },
      {
        q: "هل يمكن حذف حسابي؟",
        a: "نعم، من الإعدادات → \"حذف الحساب\". يجب إتمام أو إلغاء جميع الصفقات الجارية قبل الحذف. بعض البيانات قد تُحفظ لأغراض قانونية وفق القانون العراقي.",
      },
    ],
  },
]

const FEATURES = [
  { icon: Search, label: "بحث متقدم", color: "text-blue-400" },
  { icon: ArrowLeftRight, label: "تبادل فوري", color: "text-green-400" },
  { icon: Gavel, label: "مزادات نشطة", color: "text-yellow-400" },
  { icon: FileText, label: "عقود شراكة", color: "text-purple-400" },
  { icon: Bell, label: "إشعارات لحظية", color: "text-orange-400" },
  { icon: Users, label: "مجتمع مستثمرين", color: "text-pink-400" },
  { icon: Star, label: "تقييمات شفافة", color: "text-cyan-400" },
  { icon: Shield, label: "حماية كاملة", color: "text-red-400" },
]

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-400/[0.06]", border: "border-blue-400/20", text: "text-blue-400" },
  yellow: { bg: "bg-yellow-400/[0.06]", border: "border-yellow-400/20", text: "text-yellow-400" },
  green: { bg: "bg-green-400/[0.06]", border: "border-green-400/20", text: "text-green-400" },
  purple: { bg: "bg-purple-400/[0.06]", border: "border-purple-400/20", text: "text-purple-400" },
  orange: { bg: "bg-orange-400/[0.06]", border: "border-orange-400/20", text: "text-orange-400" },
  red: { bg: "bg-red-400/[0.06]", border: "border-red-400/20", text: "text-red-400" },
}

export default function AppGuidePage() {
  const router = useRouter()
  const [openSection, setOpenSection] = useState<string | null>("start")
  const [openItem, setOpenItem] = useState<string | null>(null)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="دليل التطبيق"
            subtitle="تعرّف على رايلوس وكيفية الاستفادة القصوى من ميزاته"
          />

          {/* Hero banner */}
          <div className="bg-gradient-to-br from-blue-400/[0.1] to-transparent border border-blue-400/30 rounded-2xl p-5 mb-5 flex gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-white mb-1">مرحباً بك في رايلوس</div>
              <div className="text-xs text-neutral-300 leading-relaxed mb-2">
                هذا الدليل سيساعدك على فهم كل ميزات التطبيق بسرعة - من التسجيل حتى أول استثمار ناجح.
              </div>
              <button
                onClick={() => router.push("/support")}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold"
              >
                لم تجد إجابتك؟ تواصل مع الدعم →
              </button>
            </div>
          </div>

          {/* Features grid */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-5">
            <div className="text-sm font-bold text-white mb-3">⭐ ميزات رايلوس الرئيسية</div>
            <div className="grid grid-cols-4 gap-2">
              {FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-center">
                    <Icon className={cn("w-5 h-5 mx-auto mb-1.5", f.color)} strokeWidth={1.5} />
                    <div className="text-[10px] text-neutral-400 leading-tight">{f.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {SECTIONS.map((section) => {
              const c = colorMap[section.color]
              const isOpen = openSection === section.id
              const Icon = section.icon
              return (
                <div
                  key={section.id}
                  className={cn(
                    "rounded-2xl border transition-colors overflow-hidden",
                    isOpen ? c.bg : "bg-white/[0.05] border-white/[0.08]",
                    isOpen && c.border
                  )}
                >
                  <button
                    onClick={() => {
                      setOpenSection(isOpen ? null : section.id)
                      setOpenItem(null)
                    }}
                    className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0", c.bg, c.border)}>
                        <Icon className={cn("w-5 h-5", c.text)} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white">{section.title}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{section.description}</div>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", isOpen && "rotate-180")}
                      strokeWidth={1.5}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-white/[0.04] pt-4">

                      {/* SVG illustration */}
                      <div className={cn("rounded-xl p-3 mb-4 border h-32 flex items-center justify-center", c.bg, c.border)}>
                        {section.illustration}
                      </div>

                      {/* FAQ items */}
                      <div className="space-y-2">
                        {section.items.map((item, i) => {
                          const itemKey = section.id + "-" + i
                          const isItemOpen = openItem === itemKey
                          return (
                            <div key={itemKey} className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
                              <button
                                onClick={() => setOpenItem(isItemOpen ? null : itemKey)}
                                className="w-full p-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-right"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className={cn("text-xs font-bold", c.text)}>?</span>
                                  <span className="text-xs font-bold text-white">{item.q}</span>
                                </div>
                                <ChevronDown
                                  className={cn("w-3.5 h-3.5 text-neutral-500 transition-transform flex-shrink-0", isItemOpen && "rotate-180")}
                                  strokeWidth={1.5}
                                />
                              </button>
                              {isItemOpen && (
                                <div className="px-3 pb-3 pt-1 text-[11px] text-neutral-300 leading-relaxed border-t border-white/[0.04]">
                                  <div className="pt-2">{item.a}</div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-white/[0.06] to-transparent border border-white/[0.1] rounded-2xl p-5 text-center mt-6">
            <div className="text-sm font-bold text-white mb-2">جاهز للبدء؟</div>
            <div className="text-xs text-neutral-400 mb-4">
              ابدأ رحلتك الاستثمارية الآن أو تواصل معنا لأي استفسار
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/market")}
                className="flex-1 bg-neutral-100 text-black py-3 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
              >
                استكشف السوق
              </button>
              <button
                onClick={() => router.push("/support")}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white py-3 rounded-xl text-xs font-bold hover:bg-white/[0.08] transition-colors"
              >
                دعم فني
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
