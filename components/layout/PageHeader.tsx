"use client"

import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { ReactNode } from "react"

interface PageHeaderProps {
  badge?: string
  title: string
  subtitle?: string
  description?: string
  /** Whether to show the back button (default true). */
  showBack?: boolean
  /** Use browser-history back navigation (default true). When false, falls back to backHref. */
  useBrowserBack?: boolean
  /** Optional fallback path. Used only when `useBrowserBack` is false. */
  backHref?: string
  rightAction?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  description,
  showBack = true,
  useBrowserBack = true,
  backHref,
  rightAction,
}: PageHeaderProps) {
  const router = useRouter()
  const finalSubtitle = subtitle || description

  const handleBack = () => {
    if (useBrowserBack) {
      router.back()
    } else if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div className="mb-6 lg:mb-8">

      {/* Main row */}
      <div className="flex items-center justify-between gap-3 mb-1.5">

        {/* Right (in RTL): Back button + dash + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBack && (
            <>
              <button
                onClick={handleBack}
                className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="رجوع"
              >
                <ArrowRight className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
              </button>
              <span className="text-neutral-600 text-lg flex-shrink-0">-</span>
            </>
          )}

          <h1 className="text-xl lg:text-2xl font-bold text-white truncate">
            {title}
          </h1>
        </div>

        {/* Left (in RTL): Right action */}
        {rightAction && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {rightAction}
          </div>
        )}
      </div>

      {/* Subtitle */}
      {finalSubtitle && (
        <p
          className="text-xs lg:text-sm text-neutral-400 leading-relaxed"
          style={{ paddingRight: showBack ? "60px" : "0" }}
        >
          {finalSubtitle}
        </p>
      )}
    </div>
  )
}
