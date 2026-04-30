"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, AlertTriangle, Lightbulb, Search, ShoppingCart, Wallet, ChevronDown, ChevronLeft, FileText, Users, BarChart3, ArrowLeftRight, Gavel, Heart, Bell, Info, Sparkles } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

// خطوات الاستثمار - من الصفر للنجاح
const STEPS = [
  {
    n: 1,
    icon: Search,
    title: "اكتشف الفرص",
    color: "blue",
    desc: "تصفّح المشاريع المتاحة في صفحة السوق. اطلع على كل التفاصيل: القطاع، الحصص المتاحة، السعر، مستوى المخاطرة، والعوائد المتوقعة.",
    tips: [
      "ابدأ بالمشاريع منخفضة المخاطرة",
      "اقرأ وصف المشروع بالكامل قبل الاستثمار",
      "تابع الحركة السعرية في المخطط البياني",
    ],
  },
  {
    n: 2,
    icon: BarChart3,
    title: "ادرس وحلّل",
    color: "purple",
    desc: "افحص الأداء التاريخي للمشروع، نسبة التمويل، عدد المستثمرين، آلية توزيع الأرباح، وتقييمات الشركة. كل هذه المعلومات متاحة في صفحة تفاصيل المشروع.",
    tips: [
      "تحقق من نسبة الإنجاز قبل الشراء",
      "قارن بين مشاريع نفس القطاع",
      "راجع تقييمات المستثمرين السابقين",
    ],
  },
  {
    n: 3,
    icon: ShoppingCart,
    title: "اشترِ بثقة",
    color: "green",
    desc: "اضغط \"شراء حصص\" واختر بين الشراء المباشر من المنصة أو الشراء من المستثمرين الآخرين. حدد عدد الحصص واتمّ الصفقة بضغطة زر.",
    tips: [
      "ابدأ بكميات صغيرة في أول استثمار",
      "تحقق من السعر قبل الشراء",
      "اقرأ شروط الصفقة بعناية",
    ],
  },
  {
    n: 4,
    icon: Wallet,
    title: "تابع محفظتك",
    color: "yellow",
    desc: "من صفحة المحفظة، شاهد كل حصصك في مكان واحد. تابع قيمة استثماراتك بشكل لحظي، اطلع على العوائد المتوقعة والأرباح المحققة.",
    tips: [
      "افحص محفظتك مرة واحدة على الأقل أسبوعياً",
      "احتفظ بسجل لكل صفقة تمت",
      "احذر من اتخاذ قرارات متسرعة",
    ],
  },
  {
    n: 5,
    icon: ArrowLeftRight,
    title: "بِع متى تريد",
    color: "orange",
    desc: "عندما تريد بيع حصصك، توجه لصفحة التبادل وأنشئ إعلان بيع، أو استخدم البيع السريع للحصول على سيولة فورية بخصم 15%. أنت تتحكم في توقيت البيع.",
    tips: [
      "اختر الوقت المناسب للبيع - عندما يرتفع السعر",
      "البيع السريع للحالات الطارئة فقط",
      "تفاوض مع المشترين عبر الدردشة",
    ],
  },
  {
    n: 6,
    icon: Gavel,
    title: "شارك في المزادات",
    color: "red",
    desc: "المزادات فرصة للحصول على حصص بأسعار مخفضة. ادخل صفحة المزادات، اختر المزاد، وضع عرضك. إذا فزت، تحصل على الحصص بسعر أقل من السوق.",
    tips: [
      "ضع حد أعلى لعرضك ولا تتجاوزه",
      "راقب الوقت المتبقي في المزاد",
      "ابدأ بمزادات صغيرة للتعلم",
    ],
  },
]

// كيف يحقق المستثمر فائدة من رايلوس
const BENEFITS = [
  {
    icon: TrendingUp,
    color: "green",
    title: "نمو رأس المال",
    desc: "مع نمو المشاريع وزيادة الطلب، ترتفع قيمة حصصك تدريجياً. يمكن بيعها لاحقاً بسعر أعلى.",
  },
  {
    icon: Wallet,
    color: "blue",
    title: "عوائد دورية",
    desc: "تحصل على عوائد ربع/نصف سنوية أو سنوية من أرباح المشاريع المُستثمر بها (بشرط الاحتفاظ 30 يوم).",
  },
  {
    icon: Users,
    color: "purple",
    title: "تنويع المحفظة",
    desc: "استثمر في قطاعات متعددة (زراعة، عقارات، صناعة، تجارة) لتقليل المخاطر.",
  },
  {
    icon: Lightbulb,
    color: "yellow",
    title: "فرص حصرية",
    desc: "وصول لمشاريع غير متاحة للعامة، مزادات بخصومات تصل لـ 40%، وفرص الشراء المبكر.",
  },
]

// ميزات رايلوس التي تساعد المستثمر
const PLATFORM_FEATURES = [
  {
    icon: BarChart3,
    title: "تحليلات مفصّلة",
    desc: "مخططات بيانية + بيانات مالية + تقييمات لكل مشروع",
  },
  {
    icon: ArrowLeftRight,
    title: "تبادل بين المستثمرين",
    desc: "بِع واشترِ بسعر السوق دون انتظار",
  },
  {
    icon: Bell,
    title: "إشعارات لحظية",
    desc: "تنبيهات لحظية بأي تغيير في استثماراتك",
  },
  {
    icon: FileText,
    title: "عقود شراكة",
    desc: "أنشئ عقود مع مستثمرين آخرين بنسب محددة",
  },
  {
    icon: Heart,
    title: "متابعة المشاريع",
    desc: "تابع المشاريع المفضلة وكن أول من يعرف بالتحديثات",
  },
  {
    icon: Users,
    title: "مجتمع نشط",
    desc: "تواصل مع مستثمرين آخرين وتعلم من تجاربهم",
  },
]

// مستويات المستثمرين
const INVESTOR_LEVELS = [
  {
    level: "أساسي",
    color: "green",
    icon: "🟢",
    badge: "للمبتدئين",
    limit: "10 مليون",
    limitUnit: "د.ع / شهر",
    desc: "نقطة البداية لكل مستثمر جديد - اكتشف وتعلم بأمان",
    requirements: [
      "تسجيل حساب جديد",
      "توثيق KYC أساسي (هوية)",
      "بدون رسوم تسجيل",
    ],
    perks: [
      "الدخول الكامل للسوق",
      "شراء وبيع الحصص",
      "الوصول لمحفظتك الشخصية",
      "خاصية البيع السريع",
      "الدخول في الصفقات العادية",
      "دعم فني خلال 24-48 ساعة",
    ],
  },
  {
    level: "متقدم",
    color: "blue",
    icon: "🔵",
    badge: "للنشطين",
    limit: "50 مليون",
    limitUnit: "د.ع / شهر",
    desc: "للمستثمر الذي أثبت نشاطه واستقراره على المنصة",
    requirements: [
      "توثيق KYC متقدم (هوية + إثبات سكن)",
      "100 صفقة ناجحة على الأقل",
      "90 يوم نشاط متواصل",
      "نسبة نجاح أعلى من 95%",
    ],
    perks: [
      "كل صلاحيات المستوى الأساسي",
      "إنشاء عقود شراكة",
      "أولوية في فرص استثمارية",
      "وصول مبكر للمشاريع الجديدة",
      "أدوات تحليل أوسع",
      "دعم فني خلال 12 ساعة",
    ],
  },
  {
    level: "محترف",
    color: "purple",
    icon: "🟣",
    badge: "للنخبة",
    limit: "250 مليون",
    limitUnit: "د.ع / شهر",
    desc: "نخبة المستثمرين - وصول حصري لأفضل الفرص",
    requirements: [
      "توثيق KYC احترافي (إثبات دخل + سجل تجاري للشركات)",
      "500 صفقة ناجحة على الأقل",
      "180 يوم نشاط متواصل",
      "نسبة نجاح أعلى من 98%",
    ],
    perks: [
      "كل صلاحيات المستوى المتقدم",
      "وصول حصري لمزادات VIP",
      "وصول مبكر للفرص (48 ساعة قبل العامة)",
      "مدير حساب شخصي",
      "تقارير تحليلية متقدمة",
      "دعوات لزيارات ميدانية للمشاريع",
    ],
  },
]

const CONTRACT_LIMIT_EXAMPLES = [
  {
    title: "4 مستثمرين أساسيين",
    icon: "🟢",
    color: "green",
    members: "4 × أساسي",
    calculation: "(4 × 10M) + 25%",
    result: "50M / شهر",
    note: "بدلاً من 10M فردياً",
  },
  {
    title: "3 مستثمرين متقدمين",
    icon: "🔵",
    color: "blue",
    members: "3 × متقدم",
    calculation: "(3 × 50M) + 25%",
    result: "187.5M / شهر",
    note: "بدلاً من 50M فردياً",
  },
  {
    title: "2 مستثمرين محترفين",
    icon: "🟣",
    color: "purple",
    members: "2 × محترف",
    calculation: "(2 × 250M) + 25%",
    result: "625M / شهر",
    note: "بدلاً من 250M فردياً",
  },
  {
    title: "عقد مختلط (3 أعضاء)",
    icon: "💎",
    color: "yellow",
    members: "1 محترف + 2 متقدم",
    calculation: "(250M + 50M + 50M) + 25%",
    result: "437.5M / شهر",
    note: "تنويع المستويات",
  },
]

// قطاعات الاستثمار
const SECTORS = [
  { icon: "🌾", name: "الزراعة", desc: "محاصيل، بيوت زجاجية، مناحل" },
  { icon: "🐄", name: "الثروة الحيوانية", desc: "مواشي، دواجن، ألبان" },
  { icon: "🏭", name: "الصناعة", desc: "مواد خام، صناعات غذائية" },
  { icon: "⛏️", name: "التعدين والطاقة", desc: "نفط، غاز، طاقة متجددة" },
  { icon: "🏗️", name: "العقارات", desc: "تطوير عقاري، بيع، تأجير" },
  { icon: "🏪", name: "التجارة", desc: "استيراد وتصدير، تجزئة" },
  { icon: "💻", name: "التقنية", desc: "برمجيات، تطبيقات، AI" },
  { icon: "💰", name: "المالية", desc: "تأمين، تقنية مالية" },
]

// نصائح ذهبية
const TIPS = [
  { icon: "📊", title: "نوّع استثماراتك", body: "لا تضع كل أموالك في مشروع واحد. التنويع بين قطاعات مختلفة يقلل المخاطر بشكل كبير." },
  { icon: "📖", title: "اقرأ قبل الاستثمار", body: "راجع دراسة الجدوى وخطة العمل وسجل الشركة قبل أي قرار. المعلومة هي مفتاح القرار الصائب." },
  { icon: "⏳", title: "فكّر طويل الأمد", body: "المشاريع الجيدة تحتاج وقتاً لتنمو. لا تتخذ قرارات بناءً على تقلبات قصيرة المدى." },
  { icon: "🔍", title: "راقب الأداء", body: "تابع نسب التمويل وتقارير المشاريع بانتظام للحفاظ على قرارات مدروسة." },
  { icon: "⚠️", title: "افهم المخاطر", body: "كل استثمار ينطوي على مخاطر. استثمر فقط ما تستطيع تحمل خسارته." },
  { icon: "💎", title: "اصبر على الجواهر", body: "أفضل الاستثمارات تأتي من الصبر. لا تبع بسبب تذبذب مؤقت في السعر." },
]

const colorMap: Record<string, { bg: string; border: string; text: string; bgLight: string }> = {
  green: { bg: "bg-green-400/[0.08]", border: "border-green-400/30", text: "text-green-400", bgLight: "bg-green-400/[0.04]" },
  blue: { bg: "bg-blue-400/[0.08]", border: "border-blue-400/30", text: "text-blue-400", bgLight: "bg-blue-400/[0.04]" },
  purple: { bg: "bg-purple-400/[0.08]", border: "border-purple-400/30", text: "text-purple-400", bgLight: "bg-purple-400/[0.04]" },
  yellow: { bg: "bg-yellow-400/[0.08]", border: "border-yellow-400/30", text: "text-yellow-400", bgLight: "bg-yellow-400/[0.04]" },
  orange: { bg: "bg-orange-400/[0.08]", border: "border-orange-400/30", text: "text-orange-400", bgLight: "bg-orange-400/[0.04]" },
  red: { bg: "bg-red-400/[0.08]", border: "border-red-400/30", text: "text-red-400", bgLight: "bg-red-400/[0.04]" },
}

export default function InvestmentGuidePage() {
  const router = useRouter()
  const [openStep, setOpenStep] = useState<number | null>(1)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-4xl mx-auto">

          <PageHeader
            title="دليل الاستثمار"
            subtitle="رحلتك من المبتدئ إلى المستثمر الذكي"
          />

          {/* Hero */}
          <div className="bg-gradient-to-br from-purple-400/[0.1] to-blue-400/[0.04] border border-purple-400/20 rounded-2xl p-5 mb-6">
            <TrendingUp className="w-9 h-9 text-purple-400 mb-3" strokeWidth={1.5} />
            <div className="text-base font-bold text-white mb-1">كيف تستثمر في رايلوس؟</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              هذا الدليل يأخذك خطوة بخطوة من اكتشاف الفرص حتى البيع وتحقيق العوائد. ستفهم كل ميزات التطبيق وكيف تستفيد منها لتحقيق أقصى استفادة من استثماراتك.
            </div>
          </div>

          {/* خطوات الاستثمار */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">📋 خطوات الاستثمار في رايلوس</div>
            <div className="text-xs text-neutral-500 mb-4">6 خطوات بسيطة من البداية حتى تحقيق العوائد</div>

            <div className="space-y-3">
              {STEPS.map((step) => {
                const c = colorMap[step.color]
                const isOpen = openStep === step.n
                const Icon = step.icon
                return (
                  <div
                    key={step.n}
                    className={cn(
                      "rounded-2xl border transition-colors overflow-hidden",
                      isOpen ? c.bgLight : "bg-white/[0.05] border-white/[0.08]",
                      isOpen && c.border
                    )}
                  >
                    <button
                      onClick={() => setOpenStep(isOpen ? null : step.n)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 relative", c.bg, c.border)}>
                          <Icon className={cn("w-5 h-5", c.text)} strokeWidth={1.5} />
                          <div className={cn("absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-black border flex items-center justify-center text-[10px] font-bold", c.border, c.text)}>
                            {step.n}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5", c.text)}>
                            خطوة {step.n}
                          </div>
                          <div className="text-sm font-bold text-white">{step.title}</div>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn("w-4 h-4 text-neutral-400 transition-transform flex-shrink-0", isOpen && "rotate-180")}
                        strokeWidth={1.5}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-white/[0.04] pt-4">
                        <div className="text-xs text-neutral-300 leading-relaxed mb-4">
                          {step.desc}
                        </div>

                        <div className={cn("rounded-xl p-3 border", c.bgLight, c.border)}>
                          <div className={cn("text-[11px] font-bold mb-2 flex items-center gap-1.5", c.text)}>
                            <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
                            نصائح لهذه الخطوة
                          </div>
                          <ul className="space-y-1.5">
                            {step.tips.map((tip, i) => (
                              <li key={i} className="text-xs text-neutral-300 flex gap-2">
                                <span className={cn("flex-shrink-0", c.text)}>✓</span>
                                <span className="leading-relaxed">{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* الفوائد */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">💎 ماذا تستفيد من رايلوس؟</div>
            <div className="text-xs text-neutral-500 mb-4">الفوائد الحقيقية للمستثمر في المنصة</div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {BENEFITS.map((b, i) => {
                const c = colorMap[b.color]
                const Icon = b.icon
                return (
                  <div key={i} className={cn("rounded-2xl p-4 border", c.bgLight, c.border)}>
                    <Icon className={cn("w-6 h-6 mb-3", c.text)} strokeWidth={1.5} />
                    <div className={cn("text-sm font-bold mb-1.5", c.text)}>{b.title}</div>
                    <div className="text-xs text-neutral-300 leading-relaxed">{b.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ميزات المنصة */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">🛠 الأدوات اللي تساعدك</div>
            <div className="text-xs text-neutral-500 mb-4">ميزات رايلوس التي تجعل الاستثمار أسهل وأذكى</div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PLATFORM_FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5">
                    <Icon className="w-5 h-5 text-blue-400 mb-2" strokeWidth={1.5} />
                    <div className="text-sm font-bold text-white mb-1">{f.title}</div>
                    <div className="text-[11px] text-neutral-400 leading-relaxed">{f.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* === القسم 1: مستويات المستثمرين === */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">📈 مستويات المستثمرين</div>
            <div className="text-xs text-neutral-500 mb-4">
              ابدأ بالأساسي وارتقِ تلقائياً مع نشاطك على المنصة
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {INVESTOR_LEVELS.map((lvl) => {
                const c = colorMap[lvl.color]
                return (
                  <div key={lvl.level} className={cn("rounded-2xl p-5 border", c.bgLight, c.border)}>

                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{lvl.icon}</div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", c.bg, c.border, c.text)}>
                        {lvl.badge}
                      </span>
                    </div>

                    {/* Title + Limit */}
                    <div className={cn("text-lg font-bold mb-1", c.text)}>{lvl.level}</div>
                    <div className="flex items-baseline gap-1.5 mb-3">
                      <span className={cn("text-2xl font-bold font-mono", c.text)}>{lvl.limit}</span>
                      <span className="text-[11px] text-neutral-500">{lvl.limitUnit}</span>
                    </div>

                    {/* Description */}
                    <div className="text-[11px] text-neutral-300 leading-relaxed mb-4 pb-4 border-b border-white/[0.05]">
                      {lvl.desc}
                    </div>

                    {/* Requirements */}
                    <div className="mb-4">
                      <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", c.text)}>
                        متطلبات الوصول
                      </div>
                      <ul className="space-y-1.5">
                        {lvl.requirements.map((req, i) => (
                          <li key={i} className="text-[11px] text-neutral-300 flex gap-1.5 leading-relaxed">
                            <span className={cn("flex-shrink-0", c.text)}>◆</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Perks */}
                    <div>
                      <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", c.text)}>
                        المزايا
                      </div>
                      <ul className="space-y-1.5">
                        {lvl.perks.map((p, i) => (
                          <li key={i} className="text-[11px] text-neutral-300 flex gap-1.5 leading-relaxed">
                            <span className={cn("flex-shrink-0", c.text)}>✓</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                )
              })}
            </div>

            {/* ملاحظة العمولة الثابتة */}
            <div className="bg-yellow-400/[0.06] border border-yellow-400/25 rounded-xl p-4 mt-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <div className="text-xs font-bold text-yellow-400 mb-1.5">عمولة موحّدة لجميع المستويات</div>
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  رايلوس تطبّق عمولة ثابتة <span className="font-bold text-yellow-400 font-mono">2%</span> على كل صفقة ناجحة بغض النظر عن مستوى المستثمر. لا توجد خصومات أو فروقات في الرسوم بين المستويات. الترقية تمنحك حدوداً أعلى ومزايا حصرية - وليس خصومات على العمولة.
                </div>
              </div>
            </div>
          </div>

          {/* === القسم 2: شروط الترقية والنزول === */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">⬆️ كيف تترقى بين المستويات؟</div>
            <div className="text-xs text-neutral-500 mb-4">
              نظام ترقية تلقائي يكافئ النشاط ويحمي المنصة
            </div>

            {/* شرح آلية الترقية */}
            <div className="bg-gradient-to-br from-blue-400/[0.06] to-transparent border border-blue-400/20 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-1.5">الترقية تلقائية</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">
                    عندما تستوفي شروط المستوى التالي، يقوم النظام بترقيتك تلقائياً خلال 24 ساعة. ستتلقى إشعاراً فورياً بترقيتك وستكتسب جميع المزايا الجديدة فوراً.
                  </div>
                </div>
              </div>
            </div>

            {/* بطاقتي الترقية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">

              {/* Basic → Advanced */}
              <div className="bg-blue-400/[0.04] border border-blue-400/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🟢</span>
                  <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                  <span className="text-2xl">🔵</span>
                  <span className="text-sm font-bold text-white mr-2">الترقية لـ متقدم</span>
                </div>
                <ul className="space-y-2">
                  {[
                    { icon: "📋", text: "إكمال توثيق KYC المتقدم (هوية + إثبات سكن)" },
                    { icon: "🎯", text: "إتمام 100 صفقة ناجحة على الأقل" },
                    { icon: "📅", text: "90 يوم نشاط متواصل على المنصة" },
                    { icon: "✨", text: "نسبة نجاح أعلى من 95% في الصفقات" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advanced → Pro */}
              <div className="bg-purple-400/[0.04] border border-purple-400/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🔵</span>
                  <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                  <span className="text-2xl">🟣</span>
                  <span className="text-sm font-bold text-white mr-2">الترقية لـ محترف</span>
                </div>
                <ul className="space-y-2">
                  {[
                    { icon: "📋", text: "إكمال توثيق KYC الاحترافي (إثبات دخل + سجل تجاري)" },
                    { icon: "🎯", text: "إتمام 500 صفقة ناجحة على الأقل" },
                    { icon: "📅", text: "180 يوم نشاط متواصل على المنصة" },
                    { icon: "✨", text: "نسبة نجاح أعلى من 98% في الصفقات" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* النزول التلقائي */}
            <div className="bg-orange-400/[0.04] border border-orange-400/20 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-400/[0.15] border border-orange-400/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-orange-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-orange-400 mb-1.5">النزول التلقائي عند الإهمال</div>
                  <div className="text-xs text-neutral-300 leading-relaxed mb-3">
                    للحفاظ على نشاط المنصة وعدالة الترقيات، يطبّق النظام مراجعة دورية:
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      "إذا لم يقم مستثمر محترف بأي صفقة لمدة 3 أشهر متواصلة → ينزل تلقائياً للمستوى المتقدم",
                      "إذا لم يقم مستثمر متقدم بأي صفقة لمدة 6 أشهر متواصلة → ينزل للمستوى الأساسي",
                      "ستتلقى إشعاراً تحذيرياً قبل النزول بـ 30 يوماً",
                      "يمكن استرجاع المستوى السابق فور استئناف النشاط واستيفاء الشروط",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                        <span className="text-orange-400 flex-shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* === القسم 3: ميزة جمع الحدود في العقود === */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-base font-bold text-white">🤝 ميزة جمع الحدود في العقود</div>
              <span className="bg-purple-400/[0.12] border border-purple-400/30 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded">
                جديد
              </span>
            </div>
            <div className="text-xs text-neutral-500 mb-4">
              عندما تشترك في عقد جماعي، تتضاعف قدرتك الاستثمارية الشهرية
            </div>

            {/* الشرح المفاهيمي */}
            <div className="bg-gradient-to-br from-purple-400/[0.08] to-blue-400/[0.04] border border-purple-400/25 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-1.5">كيف تعمل الميزة؟</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">
                    عند إنشاء عقد شراكة بين عدة مستثمرين، تُجمع حدودهم الشهرية ويُضاف عليها{" "}
                    <span className="font-bold text-purple-400">25% مكافأة إضافية</span>{" "}
                    من المنصة لتشجيع الاستثمار الجماعي.
                  </div>
                </div>
              </div>

              {/* المعادلة */}
              <div className="bg-black/40 border border-white/[0.08] rounded-lg p-3 text-center mb-3">
                <div className="text-[10px] text-neutral-500 font-mono mb-1.5 tracking-wider">FORMULA</div>
                <div className="text-sm text-white font-mono font-bold">
                  حد العقد = (مجموع حدود الأعضاء) × 1.25
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 leading-relaxed">
                الحد الجماعي يُحسب شهرياً ويُقسم على الأعضاء حسب نسبة شراكتهم في العقد.
              </div>
            </div>

            {/* أمثلة عملية */}
            <div className="text-xs text-neutral-500 mb-3 font-bold">📊 أمثلة عملية:</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {CONTRACT_LIMIT_EXAMPLES.map((ex, i) => {
                const c = colorMap[ex.color]
                return (
                  <div key={i} className={cn("rounded-xl p-4 border", c.bgLight, c.border)}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{ex.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">{ex.title}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{ex.members}</div>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2.5 mb-2">
                      <div className="text-[10px] text-neutral-500 font-mono mb-1">CALCULATION</div>
                      <div className="text-xs text-white font-mono">{ex.calculation}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-500">{ex.note}</span>
                      <span className={cn("text-base font-bold font-mono", c.text)}>
                        {ex.result}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ملاحظة مهمة */}
            <div className="bg-yellow-400/[0.04] border border-yellow-400/20 rounded-xl p-3.5 mt-4 flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="text-[11px] leading-relaxed">
                <div className="font-bold text-yellow-400 mb-1">ملاحظة مهمة</div>
                <ul className="space-y-1 text-neutral-300">
                  <li>• الحد الشهري يتجدد في أول كل شهر ميلادي</li>
                  <li>• الحد الجماعي مستقل عن الحد الفردي لكل عضو</li>
                  <li>• عند فسخ العقد، يعود كل عضو لحده الفردي</li>
                  <li>• استخدام الحد يُحسب من المجموع الكلي، وليس على كل عضو</li>
                </ul>
              </div>
            </div>
          </div>

          {/* القطاعات */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">🏢 قطاعات الاستثمار المتاحة</div>
            <div className="text-xs text-neutral-500 mb-4">اختر القطاع الذي تفهمه أو يناسب اهتماماتك</div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {SECTORS.map((s, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-sm font-bold text-white mb-1">{s.name}</div>
                  <div className="text-[10px] text-neutral-500 leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* النصائح الذهبية */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">💡 نصائح ذهبية للمستثمر</div>
            <div className="text-xs text-neutral-500 mb-4">قواعد ذهبية تعلّمناها من تجارب آلاف المستثمرين</div>

            <div className="space-y-2.5">
              {TIPS.map((t, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg flex-shrink-0">
                    {t.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white mb-1">{t.title}</div>
                    <div className="text-xs text-neutral-400 leading-relaxed">{t.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* تحذير */}
          <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-4 mb-6 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold text-red-400 mb-1">إخلاء مسؤولية</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                هذا الدليل لأغراض تعليمية فقط ولا يُعتبر نصيحة استثمارية. قراراتك الاستثمارية مسؤوليتك الكاملة. منصة رايلوس تنظم التواصل بين الأطراف ولا تقدم ضمانات على العوائد.
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-white/[0.06] to-transparent border border-white/[0.1] rounded-2xl p-5 text-center mb-6">
            <div className="text-base font-bold text-white mb-2">جاهز للبدء؟</div>
            <div className="text-xs text-neutral-400 mb-4">
              اكتشف الفرص الاستثمارية المتاحة الآن
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/market")}
                className="flex-1 bg-neutral-100 text-black py-3 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
              >
                استكشف السوق
              </button>
              <button
                onClick={() => router.push("/auctions")}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white py-3 rounded-xl text-xs font-bold hover:bg-white/[0.08] transition-colors"
              >
                المزادات
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
