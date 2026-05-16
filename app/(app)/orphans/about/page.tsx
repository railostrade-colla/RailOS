"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Info, ListChecks, Home, BookOpen, Heart, FileText } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader } from "@/components/ui"
import { SPONSORSHIP_PLANS } from "@/lib/mock-data/orphans"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// plan id → name key + cover keys (lib monthly/color stay canonical).
const PLAN_NAME_KEY: Record<string, string> = {
  basic: "planBasic", advanced: "planAdvanced", comprehensive: "planComprehensive",
}
const PLAN_COVER_KEYS: Record<string, string[]> = {
  basic: ["coverBasic1", "coverBasic2"],
  advanced: ["coverAdv1", "coverAdv2", "coverAdv3", "coverAdv4"],
  comprehensive: ["coverComp1", "coverComp2", "coverComp3", "coverComp4"],
}

export default function OrphansAboutPage() {
  const router = useRouter()
  const t = useTranslations("orphans")
  const SECTIONS = [
    { icon: Info,       color: "blue" as const,   title: t("s1Title"), body: t("s1Body") },
    { icon: ListChecks, color: "green" as const,  title: t("s2Title"), body: t("s2Body") },
    {
      icon: Heart,      color: "red" as const,    title: t("s3Title"),
      bodyList: [
        { icon: "🏠", title: t("bl1Title"), body: t("bl1Body") },
        { icon: "📚", title: t("bl2Title"), body: t("bl2Body") },
        { icon: "🍎", title: t("bl3Title"), body: t("bl3Body") },
        { icon: "💊", title: t("bl4Title"), body: t("bl4Body") },
      ],
    },
    { icon: FileText,   color: "purple" as const, title: t("s4Title"), body: t("s4Body") },
  ]

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title={t("aboutTitle")} subtitle={t("aboutSubtitle")} />

          <Card variant="gradient" color="blue" padding="lg" className="mb-6 text-center">
            <div className="text-4xl mb-3">👶</div>
            <div className="text-base font-bold text-white mb-2">{t("heroTitle")}</div>
            <div className="text-xs text-neutral-300 leading-relaxed">
              {t("heroDesc")}
            </div>
          </Card>

          {/* Sponsorship plans */}
          <SectionHeader title={t("plansTitle")} subtitle={t("plansSubtitle")} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {SPONSORSHIP_PLANS.map((plan) => (
              <Card key={plan.id} variant="gradient" color={plan.color} padding="md">
                <div className="text-base font-bold text-white mb-1">{t(PLAN_NAME_KEY[plan.id] ?? "planBasic")}</div>
                <div className={cn(
                  "text-2xl font-bold font-mono mb-1",
                  plan.color === "blue"   && "text-blue-400",
                  plan.color === "purple" && "text-purple-400",
                  plan.color === "green"  && "text-green-400",
                )}>
                  {fmtNum(plan.monthly)}
                </div>
                <div className="text-[10px] text-neutral-500 mb-3">{t("perMonth")}</div>
                <div className="space-y-1.5">
                  {plan.covers.map((c, i) => {
                    const ck = PLAN_COVER_KEYS[plan.id]?.[i]
                    return (
                    <div key={i} className="text-[11px] text-neutral-300 flex items-center gap-1">
                      <span className="text-green-400">✓</span>
                      <span>{ck ? t(ck) : c}</span>
                    </div>
                  )})}
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
              {t("browseChildren")}
            </button>
            <button
              onClick={() => router.push("/orphans/sponsor")}
              className="bg-neutral-100 text-black py-3 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              {t("startSponsorship")}
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
