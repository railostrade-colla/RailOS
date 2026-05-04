"use client"

/**
 * Shared "tabbed hub" container for the rearranged legacy admin pages.
 *
 * Each former-forwarder page now renders its sub-panels in-place via a
 * sticky tab strip at the top. Clicking a tab swaps the body without
 * navigating anywhere — the URL stays on the parent (`?tab=fees` etc.)
 * and the user stays in flow.
 *
 * Why a shared component:
 *   • All 8 hubs share identical chrome (header card + tab bar).
 *   • Lazy-rendering the active panel only is cheaper than mounting
 *     all of them up front (which would also fight for data fetches).
 */

import { useState } from "react"
import type { ComponentType } from "react"

export interface EmbeddedTab {
  /** Stable key, also stored in `?sub=` if you want bookmarkable URLs later. */
  key: string
  /** Pre-formatted Arabic label including the icon, e.g. "💎 وحدات الرسوم". */
  label: string
  /** Optional hint shown in the header card under the title. */
  hint?: string
  /** The panel component to render when this tab is active. */
  Panel: ComponentType
}

export interface EmbeddedTabsHubProps {
  /** Page title — shown in the header card. */
  title: string
  /** One-line subtitle below the title. */
  subtitle: string
  /** Tab list. The first tab is the default active one. */
  tabs: ReadonlyArray<EmbeddedTab>
}

export function EmbeddedTabsHub({ title, subtitle, tabs }: EmbeddedTabsHubProps) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "")

  const ActivePanel = tabs.find((t) => t.key === active)?.Panel ?? tabs[0]?.Panel
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="min-h-screen">
      {/* Header strip + tab bar — sticky so the tabs stay visible while
          the inner panel scrolls. */}
      <div className="sticky top-[56px] z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06] px-6 pt-5 pb-3">
        <div className="text-xs text-yellow-400 font-bold uppercase tracking-wide mb-1">
          ↻ تمت إعادة الترتيب
        </div>
        <div className="text-lg font-bold text-white">{title}</div>
        <div className="text-xs text-neutral-500 mb-3">
          {activeTab?.hint || subtitle}
        </div>

        {/* Horizontal-scroll tab strip */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {tabs.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={
                  "px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 border " +
                  (isActive
                    ? "bg-white text-black border-transparent font-bold"
                    : "bg-white/[0.05] border-white/[0.08] text-neutral-400 hover:text-white")
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active panel — rendered as-is (each panel keeps its own padding
          + max-width + section header). */}
      {ActivePanel && <ActivePanel />}
    </div>
  )
}
