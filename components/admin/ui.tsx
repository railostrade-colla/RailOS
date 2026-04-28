"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

// ─── KPI Card ───
export function KPI({
  label,
  val,
  color = "#fff",
  accent,
}: {
  label: string
  val: string | number
  color?: string
  accent?: string
}) {
  return (
    <div
      className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4"
      style={accent ? { background: accent } : undefined}
    >
      <div className="text-[10px] text-neutral-500 mb-2 font-bold">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {val}
      </div>
    </div>
  )
}

// ─── Badge ───
type BadgeColor = "green" | "yellow" | "red" | "blue" | "purple" | "orange" | "gray"
const badgeColors: Record<BadgeColor, string> = {
  green: "bg-green-400/10 border-green-400/30 text-green-400",
  yellow: "bg-yellow-400/10 border-yellow-400/30 text-yellow-400",
  red: "bg-red-400/10 border-red-400/30 text-red-400",
  blue: "bg-blue-400/10 border-blue-400/30 text-blue-400",
  purple: "bg-purple-400/10 border-purple-400/30 text-purple-400",
  orange: "bg-orange-400/10 border-orange-400/30 text-orange-400",
  gray: "bg-white/[0.06] border-white/[0.1] text-neutral-400",
}

export function Badge({ label, color = "gray" }: { label: string; color?: BadgeColor }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap", badgeColors[color])}>
      {label}
    </span>
  )
}

// ─── Action Button ───
type ActionColor = "green" | "red" | "blue" | "yellow" | "gray" | "purple"
const actionColors: Record<ActionColor, string> = {
  green: "bg-green-400/[0.1] border-green-400/[0.25] text-green-400 hover:bg-green-400/[0.15]",
  red: "bg-red-400/[0.1] border-red-400/[0.25] text-red-400 hover:bg-red-400/[0.15]",
  blue: "bg-blue-400/[0.1] border-blue-400/[0.25] text-blue-400 hover:bg-blue-400/[0.15]",
  yellow: "bg-yellow-400/[0.1] border-yellow-400/[0.25] text-yellow-400 hover:bg-yellow-400/[0.15]",
  gray: "bg-white/[0.05] border-white/[0.1] text-neutral-300 hover:bg-white/[0.08]",
  purple: "bg-purple-400/[0.1] border-purple-400/[0.25] text-purple-400 hover:bg-purple-400/[0.15]",
}

export function ActionBtn({
  label,
  color = "gray",
  sm = false,
  onClick,
  disabled = false,
}: {
  label: string
  color?: ActionColor
  sm?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md border transition-colors font-bold whitespace-nowrap",
        sm ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        actionColors[color]
      )}
    >
      {label}
    </button>
  )
}

// ─── Table ───
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-right">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-white/[0.04] border-b border-white/[0.06]">
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({ children }: { children: ReactNode }) {
  return <th className="text-[11px] text-neutral-500 font-bold py-3 px-3 whitespace-nowrap">{children}</th>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
}

export function TR({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn("hover:bg-white/[0.03] transition-colors", onClick && "cursor-pointer")}
    >
      {children}
    </tr>
  )
}

export function TD({ children }: { children: ReactNode }) {
  return <td className="py-3 px-3 text-xs text-white whitespace-nowrap">{children}</td>
}

// ─── Section Header ───
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex justify-between items-center mb-4 gap-3">
      <div>
        <div className="text-lg font-bold text-white">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

// ─── Inner Tab Bar ───
export function InnerTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 border flex items-center gap-1.5",
            active === t.key
              ? "bg-white text-black border-transparent font-bold"
              : "bg-white/[0.05] border-white/[0.08] text-neutral-400 hover:text-white"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                active === t.key ? "bg-black/10 text-black" : "bg-white/[0.08] text-neutral-300"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Empty State ───
export function AdminEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-12 bg-white/[0.03] border border-white/[0.06] rounded-xl">
      <div className="text-3xl mb-2 opacity-40">📭</div>
      <div className="text-sm font-bold text-white mb-1">{title}</div>
      {body && <div className="text-xs text-neutral-500">{body}</div>}
    </div>
  )
}
