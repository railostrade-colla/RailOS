"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRight, ChevronLeft } from "lucide-react"
import { GridBackground } from "@/components/layout/GridBackground"
import {
  InvestmentIllustration,
  TradingIllustration,
  AmbassadorIllustration,
  AnalyticsIllustration,
} from "./SplashIllustrations"
import { cn } from "@/lib/utils/cn"

interface KPI {
  labelKey: string
  value: string
  /** When set, the value itself is localized (Arabic text values). */
  valueKey?: string
  trend?: string
}

interface Slide {
  id: number
  badge: string
  badgeColor: string
  titleKey: string
  descKey: string
  Illustration: typeof InvestmentIllustration
  kpis: KPI[]
}

const slides: Slide[] = [
  {
    id: 1,
    badge: "AI-POWERED INVESTMENT",
    badgeColor: "border-green-400/30 text-green-400 bg-green-400/[0.06]",
    titleKey: "ssSlide1Title",
    descKey: "ssSlide1Desc",
    Illustration: InvestmentIllustration,
    kpis: [
      { labelKey: "ssSlide1Kpi1", value: "47+" },
      { labelKey: "ssSlide1Kpi2", value: "18.4%", trend: "+2.3%" },
      { labelKey: "ssSlide1Kpi3", value: "12k+" },
    ],
  },
  {
    id: 2,
    badge: "LIVE MARKET",
    badgeColor: "border-blue-400/30 text-blue-400 bg-blue-400/[0.06]",
    titleKey: "ssSlide2Title",
    descKey: "ssSlide2Desc",
    Illustration: TradingIllustration,
    kpis: [
      { labelKey: "ssSlide2Kpi1", value: "1,247" },
      { labelKey: "ssSlide2Kpi2", value: "2.4M" },
      { labelKey: "ssSlide2Kpi3", value: "85k" },
    ],
  },
  {
    id: 3,
    badge: "AMBASSADOR PROGRAM",
    badgeColor: "border-purple-400/30 text-purple-400 bg-purple-400/[0.06]",
    titleKey: "ssSlide3Title",
    descKey: "ssSlide3Desc",
    Illustration: AmbassadorIllustration,
    kpis: [
      { labelKey: "ssSlide3Kpi1", value: "", valueKey: "ssSlide3Kpi1Val" },
      { labelKey: "ssSlide3Kpi2", value: "", valueKey: "ssSlide3Kpi2Val" },
      { labelKey: "ssSlide3Kpi3", value: "∞" },
    ],
  },
  {
    id: 4,
    badge: "REAL-TIME ANALYTICS",
    badgeColor: "border-yellow-400/30 text-yellow-400 bg-yellow-400/[0.06]",
    titleKey: "ssSlide4Title",
    descKey: "ssSlide4Desc",
    Illustration: AnalyticsIllustration,
    kpis: [
      { labelKey: "ssSlide4Kpi1", value: "2.4M" },
      { labelKey: "ssSlide4Kpi2", value: "+18.4%", trend: "" },
      { labelKey: "ssSlide4Kpi3", value: "247" },
    ],
  },
]

export function SplashSlider() {
  const router = useRouter()
  const t = useTranslations("extrasUI")
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(0)
  const isDragging = useRef(false)

  const slide = slides[current]
  const isLast = current === slides.length - 1

  const goNext = () => {
    if (isLast) {
      router.push("/login")
    } else {
      setCurrent((c) => c + 1)
    }
  }

  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1)
  }

  const skip = () => {
    router.push("/login")
  }

  // Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    isDragging.current = true
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    // RTL: swipe right = next, swipe left = prev
    if (dx > 50) goNext()
    else if (dx < -50) goPrev()
    isDragging.current = false
  }

  return (
    <div
      className="relative min-h-screen flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <GridBackground />

      {/* Skip button */}
      {!isLast && (
        <button
          onClick={skip}
          className="absolute top-6 left-6 lg:top-8 lg:left-8 z-20 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          {t("ssSkip")}
        </button>
      )}

      {/* Pagination at top */}
      <div className="absolute top-6 lg:top-8 left-1/2 -translate-x-1/2 z-20 font-mono text-xs text-neutral-500">
        {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12 py-20">
        <div className="relative z-10 w-full max-w-4xl mx-auto">

          {/* Status badge */}
          <div className="flex justify-center mb-8">
            <div className={cn(
              "inline-flex items-center gap-2 backdrop-blur-sm border px-3 py-1.5 rounded-full",
              slide.badgeColor
            )}>
              <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
              <span className="text-[10px] tracking-wider font-medium">
                {slide.badge}
              </span>
            </div>
          </div>

          {/* Illustration with corner markers */}
          <div className="relative w-56 h-56 lg:w-72 lg:h-72 mx-auto mb-10">
            {/* Corner markers */}
            <svg className="absolute -top-2 -right-2 w-4 h-4 text-white/40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M 10 0 L 16 0 L 16 6" />
            </svg>
            <svg className="absolute -top-2 -left-2 w-4 h-4 text-white/40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M 6 0 L 0 0 L 0 6" />
            </svg>
            <svg className="absolute -bottom-2 -right-2 w-4 h-4 text-white/40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M 16 10 L 16 16 L 10 16" />
            </svg>
            <svg className="absolute -bottom-2 -left-2 w-4 h-4 text-white/40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M 0 10 L 0 16 L 6 16" />
            </svg>

            {/* Concentric circles + glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full bg-white/[0.02] blur-2xl" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <circle cx="100" cy="100" r="55" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              </svg>
            </div>

            {/* Illustration */}
            <slide.Illustration className="relative z-10 w-full h-full" />
          </div>

          {/* Title */}
          <h1 className="text-2xl lg:text-4xl font-medium tracking-tight text-center mb-4 leading-tight">
            <span className="bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent">
              {t(slide.titleKey)}
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm lg:text-base text-neutral-400 text-center mb-8 max-w-xl mx-auto leading-relaxed">
            {t(slide.descKey)}
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            {slide.kpis.map((kpi, i) => (
              <div
                key={i}
                className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 lg:p-4 text-center"
              >
                <div className="text-[10px] text-neutral-500 mb-1">{t(kpi.labelKey)}</div>
                <div className="text-base lg:text-xl font-bold text-white font-mono">
                  {kpi.valueKey ? t(kpi.valueKey) : kpi.value}
                </div>
                {kpi.trend && (
                  <div className="text-[9px] text-green-400 font-mono mt-1">{kpi.trend}</div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 px-6 lg:px-12 pb-8 lg:pb-12">
        <div className="max-w-2xl mx-auto flex items-center justify-between">

          {/* Next button (على اليمين في RTL — first child) */}
          <button
            onClick={goNext}
            className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full font-medium text-sm transition-colors"
          >
            <span>{isLast ? t("ssStartNow") : t("ssNext")}</span>
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>

          {/* Pagination dots */}
          <div className="flex items-center gap-1.5 mx-auto lg:mx-0">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === current
                    ? "w-8 bg-white"
                    : "w-1.5 bg-white/30 hover:bg-white/50"
                )}
                aria-label={t("ssGoToSlide", { n: i + 1 })}
              />
            ))}
          </div>

          {/* Prev button (على اليسار في RTL — last child، Desktop فقط) */}
          <button
            onClick={goPrev}
            disabled={current === 0}
            className={cn(
              "hidden lg:flex w-11 h-11 items-center justify-center rounded-full border transition-all",
              current === 0
                ? "border-white/[0.04] text-white/20 cursor-not-allowed"
                : "border-white/[0.08] text-white hover:bg-white/[0.05]"
            )}
            aria-label={t("ssPrev")}
          >
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
