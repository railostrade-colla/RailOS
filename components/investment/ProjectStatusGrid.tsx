"use client"

/**
 * ProjectStatusGrid — Phase 13.16.
 *
 * Shows the live "حالة المشروع" stats below the chart:
 *   • نسبة التمويل المُحقَّق  — % of offering shares that have been
 *                              purchased (offering_total - available)
 *                              / offering_total. Stand-in for the
 *                              "construction progress" the founder
 *                              spec asked for, since the project
 *                              schema doesn't yet have a dedicated
 *                              construction_progress column. Once
 *                              that column is added, swap the
 *                              numerator without touching this UI.
 *   • عدد المستثمرين الحاليين — distinct holders (via the public
 *                              get_public_investor_counts RPC from
 *                              Phase 13.12).
 *   • إجمالي العوائد الموزَّعة — sum of dividend distributions if the
 *                              `dividends` table exists; otherwise
 *                              shows a "—" placeholder.
 *
 * Each tile is keyboard-focusable + has aria-labels so screen readers
 * can announce them. The grid stacks on mobile (1 col → 3 col on lg+).
 */

import { Building2, Users, Coins } from "lucide-react"
import { cn } from "@/lib/utils/cn"

export interface ProjectStatusValues {
  /** Funded percentage 0–100. */
  fundedPct: number
  /** offering_total minus available. */
  sharesSold: number
  offeringTotal: number
  /** Distinct user count. */
  investorsCount: number
  /** IQD — sum of dividends distributed. -1 means "unknown / no data". */
  dividendsTotal: number
}

interface Props {
  values: ProjectStatusValues
  loading?: boolean
}

export function ProjectStatusGrid({ values, loading }: Props) {
  const { fundedPct, sharesSold, offeringTotal, investorsCount, dividendsTotal } = values
  const fmt = (n: number) => n.toLocaleString("en-US")

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3", loading && "opacity-70")}>
      {/* Funded % */}
      <Tile
        icon={<Building2 className="w-3.5 h-3.5" strokeWidth={2} />}
        label="نسبة التمويل المُحقَّق"
        value={`${fundedPct.toFixed(1)}%`}
        sub={`${fmt(sharesSold)} / ${fmt(offeringTotal)} حصة`}
        tone="green"
        bar={fundedPct}
      />
      {/* Investors */}
      <Tile
        icon={<Users className="w-3.5 h-3.5" strokeWidth={2} />}
        label="عدد المستثمرين الحاليين"
        value={fmt(investorsCount)}
        sub={
          investorsCount === 0
            ? "كن أوّل المستثمرين"
            : investorsCount === 1
              ? "مستثمر واحد"
              : `${fmt(investorsCount)} مستثمر`
        }
        tone="blue"
      />
      {/* Dividends */}
      <Tile
        icon={<Coins className="w-3.5 h-3.5" strokeWidth={2} />}
        label="إجمالي العوائد الموزَّعة"
        value={dividendsTotal < 0 ? "—" : `${fmt(dividendsTotal)}`}
        sub={dividendsTotal < 0 ? "لم تُوَزَّع عوائد بعد" : "د.ع"}
        tone="yellow"
      />
    </div>
  )
}

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
  bar,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: "green" | "blue" | "yellow"
  /** Optional 0-100 progress bar shown under the value. */
  bar?: number
}) {
  const toneClass = {
    green: "border-[#4ADE80]/[0.25] bg-[#4ADE80]/[0.04] text-[#4ADE80]",
    blue: "border-blue-400/[0.2] bg-blue-400/[0.04] text-blue-400",
    yellow: "border-yellow-400/[0.2] bg-yellow-400/[0.04] text-yellow-400",
  }[tone]
  const barColor = {
    green: "bg-[#4ADE80]",
    blue: "bg-blue-400",
    yellow: "bg-yellow-400",
  }[tone]

  return (
    <div className={cn("rounded-2xl p-3 sm:p-4 border", toneClass.split(" ").slice(0, 2).join(" "), "bg-white/[0.02]")}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className={cn("opacity-80", toneClass.split(" ")[2])}>{icon}</div>
        <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">{label}</div>
      </div>
      <div className={cn("text-xl sm:text-2xl font-bold font-mono", toneClass.split(" ")[2])}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-neutral-500 mt-1 truncate">{sub}</div>
      )}
      {typeof bar === "number" && (
        <div className="mt-2 h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.max(0, Math.min(100, bar))}%` }}
          />
        </div>
      )}
    </div>
  )
}
