"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, Lock, Shield } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

const SECTION_ICONS = ["📋", "📊", "⚙️", "🔗", "🔒", "📅", "✅", "👶", "⚠️"] as const

export default function PrivacyPage() {
  const t = useTranslations("legal")
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const SECTIONS = SECTION_ICONS.map((icon, i) => ({
    icon,
    title: t(`ps${i + 1}Title`),
    content: t(`ps${i + 1}Content`),
    legal: t(`ps${i + 1}Legal`),
  }))

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge={t("pvBadge")}
            title={t("pvTitle")}
            description={t("pvUpdated")}
          />

          {/* Header banner */}
          <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-2xl p-4 mb-5 flex gap-3 items-start">
            <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-sm font-bold text-blue-400 mb-1">{t("pvBanner")}</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                {t("pvBannerDesc")}
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
                        <span className="text-purple-400 font-bold">{t("legalRef")}</span>
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
              {t("pvFooterPre")}<a href="mailto:railostrade@gmail.com" className="text-blue-400 hover:underline" dir="ltr">railostrade@gmail.com</a>{t("pvFooterOr")}<a href="tel:+9647721726518" className="text-blue-400 hover:underline" dir="ltr">07721726518</a>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
