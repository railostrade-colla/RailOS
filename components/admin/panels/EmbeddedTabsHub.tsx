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

import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { useSearchParams } from "next/navigation"

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
  // Phase 13.5 — read `?sub=` from the URL so deep-links from
  // notifications land on a specific sub-tab. Falls back to the
  // first tab if `?sub=` is missing or doesn't match.
  const searchParams = useSearchParams()
  const subFromUrl = searchParams?.get("sub")
  const initialKey =
    (subFromUrl && tabs.some((t) => t.key === subFromUrl) ? subFromUrl : tabs[0]?.key) ?? ""

  const [active, setActive] = useState<string>(initialKey)

  // If the user navigates between hubs while staying inside /admin
  // (e.g., bell dropdown jumps from one hub to another), `?sub=` may
  // change without the component remounting; sync state to the URL.
  useEffect(() => {
    if (subFromUrl && tabs.some((t) => t.key === subFromUrl) && subFromUrl !== active) {
      setActive(subFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subFromUrl])

  const ActivePanel = tabs.find((t) => t.key === active)?.Panel ?? tabs[0]?.Panel
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="min-h-screen">
      {/* Header strip + tab bar — sticky so the tabs stay visible while
          the inner panel scrolls. Phase 10.76: removed the yellow
          "↻ تمت إعادة الترتيب" notice — that note was helpful right
          after the Phase 10.36 reshuffle, but it's noise now. */}
      <div className="sticky top-[56px] z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/[0.06] px-6 pt-5 pb-3">
        <div className="text-lg font-bold text-white">{title}</div>
        <div className="text-xs text-neutral-500 mb-3">
          {activeTab?.hint || subtitle}
        </div>

        {/* Tab strip — unified with the user-app pill tab-bar design
            (community/portfolio/etc.): a contained pill strip
            (bg-white/[0.05] + border + rounded-xl + p-1) with a soft
            elevated active tab (bg-white/[0.08] + border). Kept
            horizontally scrollable because admin hubs can have many
            tabs (unlike the 4–5 user tabs which use flex-1). All
            classes are theme-covered so it renders correctly in
            light + dark. */}
        <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={
                  "px-3.5 py-2 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 " +
                  (isActive
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white")
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
