"use client"

/**
 * Shared forwarder card for legacy admin panels.
 *
 * Several "v1" admin tabs (Users, Market, Shares, Fees, Content,
 * System, Alerts, Log) shipped before the dedicated DB-backed panels
 * existed. Each was a giant JSX shell rendering empty mock arrays.
 * Rather than delete them outright (the nav items they back are
 * referenced from `lib/admin/types.ts` ADMIN_NAV), we render a small
 * forwarder that explains the reorg and links the user straight to
 * the live panels.
 *
 * Each forwarder destination is keyed by the same `?tab=…` query
 * that the admin shell reads.
 */

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export interface ForwardTarget {
  /** Tab key (without `?tab=` prefix). */
  tab: string
  /** Arabic label shown on the button. */
  label: string
  /** Emoji / icon prefix. */
  icon: string
  /** Optional one-line hint shown below the label. */
  hint?: string
}

export interface LegacyForwarderProps {
  /** Page title — usually mirrors the legacy section name. */
  title: string
  /** One-line explanation of why the user landed here. */
  body: string
  /** List of modern panels to forward to. Rendered as button grid. */
  targets: ReadonlyArray<ForwardTarget>
}

export function LegacyForwarder({ title, body, targets }: LegacyForwarderProps) {
  const router = useRouter()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6 mb-4">
        <div className="text-xs text-yellow-400 font-bold uppercase tracking-wide mb-2">
          ↻ تمت إعادة الترتيب
        </div>
        <div className="text-xl font-bold text-white mb-2">{title}</div>
        <div className="text-xs text-neutral-400 leading-relaxed">{body}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {targets.map((t) => (
          <button
            key={t.tab}
            onClick={() => router.push(`/admin?tab=${t.tab}`)}
            className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] rounded-xl p-4 text-right transition-colors flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-lg flex-shrink-0">
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white group-hover:text-blue-300">{t.label}</div>
              {t.hint && (
                <div className="text-[11px] text-neutral-500 mt-0.5">{t.hint}</div>
              )}
            </div>
            <ArrowLeft className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 flex-shrink-0" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  )
}
