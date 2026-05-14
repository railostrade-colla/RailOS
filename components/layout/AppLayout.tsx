"use client"

/**
 * AppLayout — Phase 14.10 A passthrough.
 *
 * BEFORE Phase 14.10: this component wrapped each page in the full
 * application chrome (BottomNav + headers + footer + global hooks).
 * Every page in `app/(app)/*` imported it and wrapped its tree, which
 * meant the chrome remounted on every navigation. BottomNav flickered,
 * the heartbeat reset, and Realtime channels reopened.
 *
 * AFTER Phase 14.10: the chrome moved into `components/layout/AppShell.tsx`,
 * mounted ONCE inside `app/(app)/layout.tsx`. AppShell persists across
 * navigations because Next.js layouts share state with their children.
 *
 * This file is kept as a passthrough so the 68 existing import sites
 * (`<AppLayout>...children...</AppLayout>`) keep compiling without
 * per-file edits. The props are intentionally accepted-but-ignored:
 *   - `hideBottomNav`: only ever set by one page (no — actually zero
 *     pages set this in the current tree). Skipped silently.
 *   - `hideFooter`: only set by /invoices/[id], which isn't in the
 *     FOOTER_VISIBLE_PATHS list anyway, so the footer was never shown
 *     there. The flag was redundant pre-14.10.
 *
 * If a future page genuinely needs to hide chrome (e.g. a full-screen
 * chat page), introduce a context inside AppShell rather than reviving
 * this wrapper's responsibilities.
 */

import { ReactNode } from "react"

interface AppLayoutProps {
  children: ReactNode
  /** Phase 14.10 A: accepted for backward-compat, no-op. */
  hideBottomNav?: boolean
  /** Phase 14.10 A: accepted for backward-compat, no-op. */
  hideFooter?: boolean
}

export function AppLayout({ children }: AppLayoutProps) {
  return <>{children}</>
}
