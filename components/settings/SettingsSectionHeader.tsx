"use client"

import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

/**
 * Phase 14.13 Unified UI Part 2 — sub-page header with a RTL back
 * affordance (ArrowRight points "back" in an RTL layout). Falls back
 * to router.back() when no onBack/backHref is supplied.
 */
export function SettingsSectionHeader({
  title,
  subtitle,
  backHref,
  onBack,
}: {
  title: string
  subtitle?: string
  backHref?: string
  onBack?: () => void
}) {
  const router = useRouter()
  const goBack = () => {
    if (onBack) return onBack()
    if (backHref) return router.push(backHref)
    router.back()
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={goBack}
        aria-label="رجوع"
        className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition-colors flex-shrink-0"
      >
        <ArrowRight className="w-4 h-4 text-neutral-300" strokeWidth={2} />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
