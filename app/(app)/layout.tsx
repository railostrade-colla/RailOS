"use client"

/**
 * Authenticated route group layout.
 *
 * Phase 14.10 A — now also wraps every (app)/* page in <AppShell>,
 * which carries the persistent chrome (headers, BottomNav, footer,
 * global hooks). Before this, every page imported <AppLayout> and
 * mounted the chrome itself, so each navigation re-mounted BottomNav
 * and tore down the heartbeat / presence channel / preload hook.
 *
 * AppShell stays mounted while only `children` swaps between pages,
 * which is exactly the behaviour Next.js App Router layouts give us
 * for free.
 *
 * The legacy <AppLayout> in components/layout/AppLayout.tsx is now a
 * passthrough so the 68 existing call sites keep compiling without
 * per-file edits.
 */

import type { ReactNode } from "react"
import { ActiveAccountProvider } from "@/contexts/ActiveAccountContext"
import { AppShell } from "@/components/layout/AppShell"

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <ActiveAccountProvider>
      <AppShell>{children}</AppShell>
    </ActiveAccountProvider>
  )
}
