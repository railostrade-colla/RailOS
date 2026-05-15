"use client"

import type { ReactNode } from "react"

/**
 * Phase 14.13 Unified UI Part 2 — a standalone settings card: a title,
 * an optional description, then arbitrary controls (button group,
 * toggle, select…). bg-white/[0.05] → auto Part-1 shadow depth.
 */
export function SettingsOptionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl p-4">
      <div className="mb-3">
        <div className="text-sm font-medium text-white">{title}</div>
        {description && (
          <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
