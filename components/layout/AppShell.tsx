"use client"

/**
 * AppShell — Phase 14.10 A.
 *
 * The persistent chrome (headers, BottomNav, footer, global hooks) for
 * every authenticated user page. Mounted ONCE in `app/(app)/layout.tsx`
 * so it survives navigations — meaning BottomNav doesn't disappear,
 * the heartbeat keeps ticking, the presence channel stays connected,
 * and `usePreloadAppData` doesn't re-fire on every nav.
 *
 * Before this, every individual page wrapped itself in `<AppLayout>`,
 * which mounted all of this from scratch on each navigation. That was
 * the root cause of "BottomNav يختفي مع navigation".
 *
 * AppLayout (the older component) is kept as a passthrough so the 68
 * existing call sites continue to compile without per-file edits.
 */

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DesktopHeader } from "./DesktopHeader"
import { MobileHeader } from "./MobileHeader"
import { BottomNav } from "./BottomNav"
import { Footer } from "./Footer"
import { OfflineBanner } from "./OfflineBanner"
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt"
import { DealRequestNotifier } from "@/components/deals/DealRequestNotifier"
import { useHeartbeat } from "@/lib/hooks/useHeartbeat"
import { useGlobalPresenceTracker } from "@/lib/hooks/useGlobalPresenceTracker"
import { usePreloadAppData } from "@/lib/data/preload"

// Footer is intentionally limited to the home + support surfaces
// only (founder spec) — every other page renders without it.
const FOOTER_VISIBLE_PATHS = [
  "/",
  "/dashboard",
  "/support",
]

function shouldShowFooter(pathname: string | null): boolean {
  if (!pathname) return false
  return FOOTER_VISIBLE_PATHS.some((path) => {
    if (path === "/") return pathname === "/"
    return pathname === path || pathname.startsWith(path + "/")
  })
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const showFooter = shouldShowFooter(pathname)

  // Phase 11.31 — fires once on AppShell mount. Survives every page
  // navigation because AppShell now lives in the route layout.
  usePreloadAppData()
  useHeartbeat()
  useGlobalPresenceTracker()

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <OfflineBanner />
      <DesktopHeader />
      <MobileHeader />

      <main className="flex-1 flex flex-col pb-32 lg:pb-12">
        {children}

        {showFooter && (
          <div className="px-4 lg:px-8 max-w-screen-2xl mx-auto w-full">
            <Footer />
          </div>
        )}
      </main>

      <BottomNav />
      <PushPermissionPrompt />
      <DealRequestNotifier />
    </div>
  )
}
