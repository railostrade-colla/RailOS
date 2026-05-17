"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { TrendingUp, AlertTriangle, Lightbulb, Search, ShoppingCart, Wallet, ChevronDown, ChevronLeft, FileText, Users, BarChart3, ArrowLeftRight, Gavel, Heart, Bell, Info, Sparkles } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

// icon/color stay here; text resolved via t.raw("igSteps") by index.
const STEP_META = [
  { n: 1, icon: Search,        color: "blue" },
  { n: 2, icon: BarChart3,     color: "purple" },
  { n: 3, icon: ShoppingCart,  color: "green" },
  { n: 4, icon: Wallet,        color: "yellow" },
  { n: 5, icon: ArrowLeftRight, color: "orange" },
  { n: 6, icon: Gavel,         color: "red" },
] as const

const BENEFIT_META = [
  { icon: TrendingUp, color: "green" },
  { icon: Wallet,     color: "blue" },
  { icon: Users,      color: "purple" },
  { icon: Lightbulb,  color: "yellow" },
] as const

const PF_META = [
  { icon: BarChart3 }, { icon: ArrowLeftRight }, { icon: Bell },
  { icon: FileText }, { icon: Heart }, { icon: Users },
] as const

type LText = { title: string; desc: string; tips: string[] }
type LSimple = { title: string; desc: string }
type LLevel = { level: string; badge: string; limit: string; limitUnit: string; desc: string; requirements: string[]; perks: string[] }
type LExample = { title: string; members: string; result: string; note: string }
type LSector = { name: string; desc: string }
type LTip = { title: string; body: string }

// مستويات المستثمرين — مُحدَّث مع نظام الترقية الشامل (Volume + Trades + Disputes + Reports + Rating)
// المصدر: lib/mock-data/levels.ts (LEVEL_SETTINGS_STORE) — قابل للتعديل من الأدمن
const LEVEL_META = [
  { color: "blue",   icon: "🌱" },
  { color: "green",  icon: "⚡" },
  { color: "purple", icon: "💎" },
  { color: "yellow", icon: "👑" },
] as const

// calculation is a language-neutral formula → stays here.
const EXAMPLE_META = [
  { icon: "🌱", color: "blue",   calculation: "(4 × 10M) + 25%" },
  { icon: "⚡", color: "green",  calculation: "(3 × 50M) + 25%" },
  { icon: "💎", color: "purple", calculation: "(2 × 250M) + 25%" },
  { icon: "👑", color: "yellow", calculation: "(2 × 1B) + 25%" },
] as const

const SECTOR_ICONS = ["🌾", "🐄", "🏭", "⛏️", "🏗️", "🏪", "💻", "💰"] as const
const TIP_ICONS = ["📊", "📖", "⏳", "🔍", "⚠️", "💎"] as const

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
  const t = useTranslations("guides")
  const [openStep, setOpenStep] = useState<number | null>(1)
  const igSteps = t.raw("igSteps") as LText[]
  const igBenefits = t.raw("igBenefits") as LSimple[]
  const igPf = t.raw("igPf") as LSimple[]
  const igLevels = t.raw("igLevels") as LLevel[]
  const igExamples = t.raw("igExamples") as LExample[]
  const igSectors = t.raw("igSectors") as LSector[]
  const igTips = t.raw("igTips") as LTip[]
  const STEPS = STEP_META.map((m, i) => ({ ...m, ...igSteps[i] }))
  const BENEFITS = BENEFIT_META.map((m, i) => ({ ...m, ...igBenefits[i] }))
  const PLATFORM_FEATURES = PF_META.map((m, i) => ({ ...m, ...igPf[i] }))
  const INVESTOR_LEVELS = LEVEL_META.map((m, i) => ({ ...m, ...igLevels[i] }))
  const CONTRACT_LIMIT_EXAMPLES = EXAMPLE_META.map((m, i) => ({ ...m, ...igExamples[i] }))
  const SECTORS = SECTOR_ICONS.map((icon, i) => ({ icon, ...igSectors[i] }))
  const TIPS = TIP_ICONS.map((icon, i) => ({ icon, ...igTips[i] }))

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-4xl mx-auto">

          <PageHeader
            title={t("igTitle")}
            subtitle={t("igSubtitle")}
          />

          {/* Hero */}
          <div className="bg-gradient-to-br from-purple-400/[0.1] to-blue-400/[0.04] border border-purple-400/20 rounded-2xl p-5 mb-6">
            <TrendingUp className="w-9 h-9 text-purple-400 mb-3" strokeWidth={1.5} />
            <div className="text-base font-bold text-white mb-1">{t("igHeroTitle")}</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              {t("igHeroDesc")}
            </div>
          </div>

          {/* خطوات الاستثمار */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">{t("igStepsTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">{t("igStepsSub")}</div>

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
                            {t("igStepWord")} {step.n}
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
                            {t("igStepTipsLabel")}
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
            <div className="text-base font-bold text-white mb-1">{t("igBenefitsTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">{t("igBenefitsSub")}</div>

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
            <div className="text-base font-bold text-white mb-1">{t("igPfTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">{t("igPfSub")}</div>

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
            <div className="text-base font-bold text-white mb-1">{t("igLevelsTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">
              {t("igLevelsSub")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                        {t("igReqLabel")}
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
                        {t("igPerksLabel")}
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
                <div className="text-xs font-bold text-yellow-400 mb-1.5">{t("igFlatFeeTitle")}</div>
                <div className="text-[11px] text-neutral-300 leading-relaxed">
                  {t("igFlatFeePre")}<span className="font-bold text-yellow-400 font-mono">2%</span>{t("igFlatFeePost")}
                </div>
              </div>
            </div>
          </div>

          {/* === القسم 2: شروط الترقية والنزول === */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">{t("igUpgradeTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">
              {t("igUpgradeSub")}
            </div>

            {/* شرح آلية الترقية */}
            <div className="bg-gradient-to-br from-blue-400/[0.06] to-transparent border border-blue-400/20 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-1.5">{t("igAutoUpTitle")}</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">
                    {t("igAutoUpDesc")}
                  </div>
                </div>
              </div>
            </div>

            {/* بطاقات الترقية — مسار 4 مستويات */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

              {/* Basic → Advanced */}
              <div className="bg-green-400/[0.04] border border-green-400/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🌱</span>
                  <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                  <span className="text-2xl">⚡</span>
                  <span className="text-sm font-bold text-white mr-2">{t("igUpTo1")}</span>
                </div>
                <ul className="space-y-2">
                  {(t.raw("igUp1") as [string, string][]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="flex-shrink-0">{item[0]}</span>
                      <span>{item[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advanced → Pro */}
              <div className="bg-purple-400/[0.04] border border-purple-400/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⚡</span>
                  <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                  <span className="text-2xl">💎</span>
                  <span className="text-sm font-bold text-white mr-2">{t("igUpTo2")}</span>
                </div>
                <ul className="space-y-2">
                  {(t.raw("igUp2") as [string, string][]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="flex-shrink-0">{item[0]}</span>
                      <span>{item[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro → Elite */}
              <div className="bg-yellow-400/[0.04] border border-yellow-400/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">💎</span>
                  <ChevronLeft className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
                  <span className="text-2xl">👑</span>
                  <span className="text-sm font-bold text-yellow-400 mr-2">{t("igUpTo3")}</span>
                </div>
                <ul className="space-y-2">
                  {(t.raw("igUp3") as [string, string][]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-relaxed">
                      <span className="flex-shrink-0">{item[0]}</span>
                      <span>{item[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* المعايير الجديدة في النظام */}
            <div className="bg-blue-400/[0.04] border border-blue-400/20 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-400/[0.15] border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-blue-400 mb-1.5">{t("igCriteriaTitle")}</div>
                  <div className="text-xs text-neutral-300 leading-relaxed mb-2">
                    {t("igCriteriaPre")}<span className="text-white font-bold">{t("igCriteriaBold")}</span>{t("igCriteriaPost")}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-neutral-300">
                    {(t.raw("igCriteria") as string[]).map((cr, i) => (
                      <div key={i}>• <span className="text-white">{cr}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* النزول التلقائي */}
            <div className="bg-orange-400/[0.04] border border-orange-400/20 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-400/[0.15] border border-orange-400/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-orange-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-orange-400 mb-1.5">{t("igDownTitle")}</div>
                  <div className="text-xs text-neutral-300 leading-relaxed mb-3">
                    {t("igDownDesc")}
                  </div>
                  <ul className="space-y-1.5">
                    {(t.raw("igDown") as string[]).map((item, i) => (
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
              <div className="text-base font-bold text-white">{t("igContractTitle")}</div>
              <span className="bg-purple-400/[0.12] border border-purple-400/30 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded">
                {t("igNewBadge")}
              </span>
            </div>
            <div className="text-xs text-neutral-500 mb-4">
              {t("igContractSub")}
            </div>

            {/* الشرح المفاهيمي */}
            <div className="bg-gradient-to-br from-purple-400/[0.08] to-blue-400/[0.04] border border-purple-400/25 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-1.5">{t("igHowTitle")}</div>
                  <div className="text-xs text-neutral-300 leading-relaxed">
                    {t("igHowPre")}<span className="font-bold text-purple-400">{t("igHowBold")}</span>{t("igHowPost")}
                  </div>
                </div>
              </div>

              {/* المعادلة */}
              <div className="bg-black/40 border border-white/[0.08] rounded-lg p-3 text-center mb-3">
                <div className="text-[10px] text-neutral-500 font-mono mb-1.5 tracking-wider">FORMULA</div>
                <div className="text-sm text-white font-mono font-bold">
                  {t("igFormula")}
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 leading-relaxed">
                {t("igFormulaNote")}
              </div>
            </div>

            {/* أمثلة عملية */}
            <div className="text-xs text-neutral-500 mb-3 font-bold">{t("igExamplesLabel")}</div>
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
                <div className="font-bold text-yellow-400 mb-1">{t("igImportantTitle")}</div>
                <ul className="space-y-1 text-neutral-300">
                  {(t.raw("igImportant") as string[]).map((it, i) => (
                    <li key={i}>• {it}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* القطاعات */}
          <div className="mb-7">
            <div className="text-base font-bold text-white mb-1">{t("igSectorsTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">{t("igSectorsSub")}</div>

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
            <div className="text-base font-bold text-white mb-1">{t("igTipsTitle")}</div>
            <div className="text-xs text-neutral-500 mb-4">{t("igTipsSub")}</div>

            <div className="space-y-2.5">
              {TIPS.map((tp, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg flex-shrink-0">
                    {tp.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white mb-1">{tp.title}</div>
                    <div className="text-xs text-neutral-400 leading-relaxed">{tp.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* تحذير */}
          <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-4 mb-6 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold text-red-400 mb-1">{t("igDisclaimerTitle")}</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                {t("igDisclaimerDesc")}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-white/[0.06] to-transparent border border-white/[0.1] rounded-2xl p-5 text-center mb-6">
            <div className="text-base font-bold text-white mb-2">{t("igCtaTitle")}</div>
            <div className="text-xs text-neutral-400 mb-4">
              {t("igCtaDesc")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/market")}
                className="flex-1 bg-neutral-100 text-black py-3 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-colors"
              >
                {t("igExploreMarket")}
              </button>
              <button
                onClick={() => router.push("/auctions")}
                className="flex-1 bg-white/[0.05] border border-white/[0.08] text-white py-3 rounded-xl text-xs font-bold hover:bg-white/[0.08] transition-colors"
              >
                {t("igAuctions")}
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
