"use client"

/**
 * Authenticated route group layout.
 *
 * Wraps every page under /app(app)/* with the ActiveAccountProvider so
 * the AccountSwitcher (and any consumer of useActiveAccount) sees the
 * same shared state across navigation.
 */

import type { ReactNode } from "react"
import { ActiveAccountProvider } from "@/contexts/ActiveAccountContext"

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <ActiveAccountProvider>{children}</ActiveAccountProvider>
}
