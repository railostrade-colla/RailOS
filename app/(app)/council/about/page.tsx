"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, X, Vote, Users, FileSearch, Crown, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Badge } from "@/components/ui"

export default function CouncilAboutPage() {
  const router = useRouter()
  const t = useTranslations("council")

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title={t("aboutTitle")}
            subtitle={t("aboutSubtitle")}
            backHref="/council"
          />

          {/* ═══ § 1: Intro ═══ */}
          <Card className="mb-6">
            <h3 className="text-sm font-bold text-white mb-2">{t("whatIsTitle")}</h3>
            <p className="text-xs text-neutral-300 leading-relaxed mb-3">
              {t("whatIsP1")}
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {t("whatIsP2Pre")}<strong className="text-white">{t("whatIsP2Bold")}</strong>{t("whatIsP2Post")}
            </p>
          </Card>

          {/* ═══ § 2: Composition ═══ */}
          <Card className="mb-6">
            <SectionHeader title={t("compTitle")} subtitle={t("compSubtitle")} />
            <div className="space-y-3">
              <div className="bg-purple-400/[0.06] border border-purple-400/25 rounded-xl p-3 flex items-start gap-3">
                <Crown className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">{t("compFounder")}</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {t("compFounderDesc")}
                  </p>
                </div>
              </div>
              <div className="bg-blue-400/[0.06] border border-blue-400/25 rounded-xl p-3 flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">{t("compAppointed")}</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {t("compAppointedDesc")}
                  </p>
                </div>
              </div>
              <div className="bg-green-400/[0.06] border border-green-400/25 rounded-xl p-3 flex items-start gap-3">
                <Vote className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <div className="text-sm font-bold text-white mb-1">{t("compElected")}</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {t("compElectedDesc")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ═══ § 3: Eligibility ═══ */}
          <Card variant="highlighted" color="blue" className="mb-6">
            <SectionHeader title={t("eligTitle")} subtitle={t("eligSubtitle")} />
            <div className="space-y-2">
              {[
                t("req1"),
                t("req2"),
                t("req3"),
                t("req4"),
                t("req5"),
                t("req6"),
              ].map((req) => (
                <div key={req} className="flex items-center gap-2 text-xs text-neutral-300">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={2.5} />
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ═══ § 4: Powers (2 cols) ═══ */}
          <SectionHeader title={t("powersTitle")} subtitle={t("powersSubtitle")} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <Card variant="highlighted" color="green">
              <div className="text-sm font-bold text-green-400 mb-3 flex items-center gap-1.5">
                {t("canTitle")}
              </div>
              <ul className="space-y-2 text-xs text-neutral-300">
                {[
                  t("can1"),
                  t("can2"),
                  t("can3"),
                  t("can4"),
                  t("can5"),
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
                {t("cannotTitle")}
              </div>
              <ul className="space-y-2 text-xs text-neutral-300">
                {[
                  t("cannot1"),
                  t("cannot2"),
                  t("cannot3"),
                  t("cannot4"),
                  t("cannot5"),
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
            <SectionHeader title={t("flowTitle")} />
            <div className="relative">
              <div className="absolute right-4 top-2 bottom-2 w-0.5 bg-white/[0.08]" />
              <div className="space-y-4 relative">
                {[
                  { num: 1, title: t("step1Title"), desc: t("step1Desc") },
                  { num: 2, title: t("step2Title"), desc: t("step2Desc") },
                  { num: 3, title: t("step3Title"), desc: t("step3Desc") },
                  { num: 4, title: t("step4Title"), desc: t("step4Desc") },
                  { num: 5, title: t("step5Title"), desc: t("step5Desc") },
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
            <SectionHeader title={t("termTitle")} />
            <div className="space-y-2 mb-4">
              {[
                { label: t("termRow1Label"), value: t("termRow1Val") },
                { label: t("termRow2Label"), value: t("termRow2Val") },
                { label: t("termRow3Label"), value: t("termRow3Val") },
                { label: t("termRow4Label"), value: t("termRow4Val") },
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
              {t("viewElections")}
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </Card>

        </div>
      </div>
    </AppLayout>
  )
}
