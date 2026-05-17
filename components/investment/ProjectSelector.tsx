"use client"

/**
 * ProjectSelector — Phase 13.16.
 *
 * Top-of-page dropdown for picking which project the investment page
 * displays. Click outside / pick a row → onChange fires with the new
 * project. The dropdown is a self-contained popover; the parent
 * decides what to do with the selection.
 *
 * Design: matches the Raylos dark-mode aesthetic with the #4ADE80
 * accent on the active row. Searches by name OR symbol.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { ChevronDown, Search, Check } from "lucide-react"
import type { Project } from "@/lib/mock-data/types"
import { cn } from "@/lib/utils/cn"

interface Props {
  projects: Project[]
  value: Project | null
  onChange: (p: Project) => void
  /** Hint label above the trigger. */
  label?: string
  className?: string
}

export function ProjectSelector({ projects, value, onChange, label, className }: Props) {
  const t = useTranslations("portfolioUI")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.symbol?.toLowerCase().includes(q) ?? false) ||
        p.sector?.toLowerCase().includes(q),
    )
  }, [projects, query])

  return (
    <div ref={ref} className={cn("relative", className)}>
      {label && (
        <div className="text-[10px] text-neutral-500 mb-1.5 font-bold tracking-wider uppercase">
          {label}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-right",
          open
            ? "bg-white/[0.08] border-white/[0.15]"
            : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]",
        )}
      >
        {value ? (
          <>
            <ProjectThumb project={value} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{value.name}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                {value.symbol && (
                  <span className="font-mono text-[#4ADE80]" dir="ltr">{value.symbol}</span>
                )}
                <span>·</span>
                <span>{value.sector}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0" />
            <div className="flex-1 text-sm text-neutral-500">{t("psChooseProject")}</div>
          </>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-neutral-500 transition-transform flex-shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full mt-2 right-0 left-0 z-30 bg-[#0a0a0a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("psSearchPlaceholder")}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-white/20"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500">
                {t("psNoResults")}
              </div>
            ) : (
              filtered.map((p) => {
                const active = value?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onChange(p)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-right",
                      active
                        ? "bg-[#4ADE80]/[0.08]"
                        : "hover:bg-white/[0.04]",
                    )}
                  >
                    <ProjectThumb project={p} small />
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "text-xs font-bold truncate",
                          active ? "text-[#4ADE80]" : "text-white",
                        )}
                      >
                        {p.name}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                        {p.symbol && (
                          <span className="font-mono" dir="ltr">{p.symbol}</span>
                        )}
                        {p.sector && (
                          <>
                            <span>·</span>
                            <span>{p.sector}</span>
                          </>
                        )}
                        {p.share_price > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-yellow-400">
                              {p.share_price.toLocaleString("en-US")} {t("iqd")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {active && <Check className="w-3.5 h-3.5 text-[#4ADE80] flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectThumb({ project, small }: { project: Project; small?: boolean }) {
  const size = small ? 32 : 36
  const cls = cn(
    "rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.04] flex items-center justify-center flex-shrink-0",
    small ? "w-8 h-8" : "w-9 h-9",
  )
  if (project.logo_url) {
    return (
      <div className={cls}>
        <Image
          src={project.logo_url}
          alt={project.name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }
  return <div className={cn(cls, "text-base")}>🏗️</div>
}
