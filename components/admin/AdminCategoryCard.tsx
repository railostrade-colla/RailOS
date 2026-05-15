"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Phase 14.13 Unified UI Part 4 — admin navigation card. Same visual
 * language as SettingsCategoryCard so the whole app reads as one
 * system. Links to an EXISTING admin surface (a ?tab= panel or an
 * App-Router admin page) — Part 4 re-skins navigation, it does NOT
 * restructure routes, so nothing breaks. bg-white/[0.05] → the
 * Part-1 3D shadow system gives depth + hover lift automatically.
 */
export function AdminCategoryCard({
  icon: Icon,
  title,
  subtitle,
  color,
  href,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  color: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="shadow-card group flex items-center gap-3.5 bg-white/[0.05] border border-white/[0.06] rounded-2xl p-3.5 transition-colors hover:bg-white/[0.07]"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}1f`, border: `1px solid ${color}33` }}
      >
        <Icon className="w-5 h-5" strokeWidth={2} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{title}</div>
        <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{subtitle}</div>
      </div>
      <ChevronLeft
        className="w-4 h-4 text-neutral-500 flex-shrink-0 transition-transform group-hover:-translate-x-0.5"
        strokeWidth={2}
      />
    </Link>
  )
}
