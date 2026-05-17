"use client"

import { memo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Heart, ChevronLeft, TrendingUp, Clock, Users, Calendar } from "lucide-react"
import { showSuccess } from "@/lib/utils/toast"
import { getMarketStateByProject } from "@/lib/mock-data/market"
import { cn } from "@/lib/utils/cn"

const sectorIcon = (s: string) =>
  s?.includes("زراع") ? "🌾" :
  s?.includes("تجار") ? "🏪" :
  s?.includes("صناع") ? "🏭" :
  s?.includes("عقار") ? "🏗️" :
  s?.includes("تقن") ? "💻" :
  s?.includes("طب") ? "🏥" : "🏢"

const sectorColor = (s: string) => {
  if (s?.includes("زراع")) return { bg: "bg-green-400/10", border: "border-green-400/25" }
  if (s?.includes("عقار")) return { bg: "bg-blue-400/10", border: "border-blue-400/25" }
  if (s?.includes("صناع")) return { bg: "bg-orange-400/10", border: "border-orange-400/25" }
  if (s?.includes("تقن")) return { bg: "bg-purple-400/10", border: "border-purple-400/25" }
  if (s?.includes("تجار")) return { bg: "bg-yellow-400/10", border: "border-yellow-400/25" }
  return { bg: "bg-white/[0.04]", border: "border-white/[0.08]" }
}

const riskColor = (r: string) => {
  if (r === "منخفض") return { bg: "bg-green-400/[0.06]", border: "border-green-400/15", text: "text-green-400" }
  if (r === "متوسط") return { bg: "bg-yellow-400/[0.06]", border: "border-yellow-400/15", text: "text-yellow-400" }
  return { bg: "bg-red-400/[0.06]", border: "border-red-400/15", text: "text-red-400" }
}

// risk_level is DB-canonical Arabic; resolve display label via i18n key.
const RISK_KEY: Record<string, string> = {
  "منخفض": "riskLow",
  "متوسط": "riskMedium",
  "مرتفع": "riskHigh",
}

export interface ProjectCardData {
  id: string
  name: string
  company_id: string
  company_name: string
  sector: string
  share_price: number
  expected_return_min: number
  expected_return_max: number
  total_shares: number
  available_shares: number
  investors_count: number
  duration_months: number
  risk_level: "منخفض" | "متوسط" | "مرتفع"
  closes_in_days: number
  status: "open" | "closing_soon" | "closed"
  is_trending?: boolean
  is_new?: boolean

  // Extended (optional — from admin form)
  symbol?: string
  entity_type?: "company" | "project" | "individual" | "partnership"
  quality?: "low" | "medium" | "high"
  distribution_type?: "monthly" | "quarterly" | "semi_annual" | "annual"
  capital_needed?: number
  capital_raised?: number
  /** Phase 10.99b — uploaded brand assets. When `logo_url` exists, the
   *  card renders the real logo image instead of the sector emoji. */
  logo_url?: string
  logo?: string
  /** Phase 11.06 — public offering total (offering_pct × total_shares).
   *  Used as the denominator of the funding-progress bar so the
   *  percentage tracks "sold of what was OFFERED to the public" rather
   *  than "sold of all project shares including the owner bucket". */
  offering_shares?: number
  /** Phase 11.06 — open-ended duration flag from the admin form. When
   *  true (or duration_months is null/0) the المدة stat is hidden on
   *  the card per founder spec. */
  duration_open?: boolean
}

interface ProjectCardProps {
  project: ProjectCardData
  variant?: "compact" | "full"
}

// Phase 14.12 P4 — memo'd. ProjectCard is rendered in .map() grids on
// /market and the /dashboard discover section. Those parents re-render
// on unrelated state (tab switch, search input, realtime tick). The
// `project` object reference is stable across those re-renders (it
// comes from the dedupCache'd array), so default shallow comparison
// lets every card skip re-render unless its own data actually
// changed — big win on large grids.
function ProjectCardImpl({ project, variant = "full" }: ProjectCardProps) {
  const router = useRouter()
  const t = useTranslations("cards")
  const [following, setFollowing] = useState(false)

  const c = sectorColor(project.sector)
  const r = riskColor(project.risk_level)

  // Phase 11.06 — funding bar reflects sales OUT OF the public offering
  // bucket, not out of total project shares (which includes the owner
  // slice that's never for sale). The denominator is offering_shares
  // (offering_pct × total_shares); fundedShares = offering − available.
  // Falls back to the legacy total_shares math if offering_shares isn't
  // populated yet on this row (older API responses).
  //
  // Phase 11.19 — keep the percentage as a float (e.g. 0.22%) so a
  // small sale like 35 of 16,000 doesn't round to 0 and disappear.
  // The bar's visual width is also clamped to a minimum of 2% when
  // the value is non-zero, so the user can see a green sliver even
  // for tiny progress instead of an invisible bar.
  const offeringTotal = project.offering_shares ?? project.total_shares
  const fundedShares = Math.max(0, offeringTotal - project.available_shares)
  const fundedPercentRaw = offeringTotal > 0
    ? Math.min(100, (fundedShares / offeringTotal) * 100)
    : 0
  // For the label: show 1 decimal when below 10%, integer above.
  const fundedPercent =
    fundedPercentRaw === 0 ? 0 :
    fundedPercentRaw < 10 ? Number(fundedPercentRaw.toFixed(2)) :
    Math.round(fundedPercentRaw)
  // For the bar width: floor at 2% so any non-zero progress is visible.
  const fundedBarWidth =
    fundedPercentRaw === 0 ? 0 : Math.max(2, fundedPercentRaw)

  const progressColor =
    fundedPercent >= 75 ? "from-green-400 to-green-500" :
    fundedPercent >= 40 ? "from-yellow-400 to-yellow-500" :
    "from-blue-400 to-blue-500"

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFollowing(!following)
    showSuccess(following ? t("followRemoved") : t("followAdded"))
  }

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/project/" + project.id)
  }

  const handleInvest = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/project/" + project.id + "?action=invest")
  }

  const handleCardClick = () => {
    router.push("/project/" + project.id)
  }

  const isHotProject = project.is_trending && variant === "full"

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "rounded-2xl p-4 backdrop-blur cursor-pointer transition-colors",
        isHotProject
          ? "bg-gradient-to-br from-purple-400/[0.06] to-white/[0.05] border border-purple-400/25 hover:from-purple-400/[0.08]"
          : "bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.06]"
      )}
    >

      {/* Hot badge + market signal badge */}
      {(() => {
        const ms = getMarketStateByProject(project.id)
        const showFrozen = ms?.is_frozen
        const showRising = ms && !ms.is_frozen && ms.monthly_growth_pct > 5
        if (!isHotProject && !showRising && !showFrozen) return null
        return (
          <div className="flex justify-end gap-1 mb-2">
            {showFrozen && (
              <div className="flex items-center gap-1 bg-blue-400/[0.12] border border-blue-400/30 px-2 py-0.5 rounded-full">
                <span className="text-[10px]">⏸️</span>
                <span className="text-[9px] font-bold text-blue-400">{t("frozen")}</span>
              </div>
            )}
            {showRising && !showFrozen && (
              <div className="flex items-center gap-1 bg-orange-400/[0.12] border border-orange-400/30 px-2 py-0.5 rounded-full">
                <span className="text-[10px]">🔥</span>
                <span className="text-[9px] font-bold text-orange-400">{t("rising")}</span>
              </div>
            )}
            {isHotProject && !showFrozen && (
              <div className="flex items-center gap-1 bg-red-400/[0.12] border border-red-400/30 px-2 py-0.5 rounded-full">
                <span className="text-[10px]">🔥</span>
                <span className="text-[9px] font-bold text-red-400">{t("trending")}</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Phase 10.99b — show the uploaded project logo when available,
              otherwise fall back to the sector emoji on a coloured tile. */}
          {(project.logo_url || project.logo) ? (
            <div className="w-11 h-11 rounded-xl border border-white/[0.1] overflow-hidden bg-white/[0.04] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.logo_url || project.logo}
                alt={project.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // If the URL is broken, hide the img so the parent
                  // background colour shows through cleanly.
                  ;(e.currentTarget as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          ) : (
            <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center text-xl flex-shrink-0", c.bg, c.border)}>
              {sectorIcon(project.sector)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-bold text-white truncate">{project.name}</span>
              {project.is_new && (
                <span className="bg-green-400/[0.12] border border-green-400/30 text-green-400 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                  {t("new")}
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 truncate">
              {project.company_name} · {project.sector}
            </div>
          </div>
        </div>

        {project.status === "open" && (
          <div className="flex items-center gap-1 bg-green-400/[0.06] border border-green-400/15 px-2 py-1 rounded-full flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[9px] text-green-400 font-bold">{t("open")}</span>
          </div>
        )}
      </div>

      {/* Extended badges (symbol + quality + distribution) */}
      {(project.symbol || project.quality || project.distribution_type) && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {project.symbol && (
            <span className="bg-blue-400/[0.08] border border-blue-400/20 text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono" dir="ltr">
              {project.symbol}
            </span>
          )}
          {project.quality && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                project.quality === "high" ? "bg-green-400/[0.08] border-green-400/20 text-green-400"
                  : project.quality === "medium" ? "bg-yellow-400/[0.08] border-yellow-400/20 text-yellow-400"
                  : "bg-red-400/[0.08] border-red-400/20 text-red-400"
              )}
            >
              {project.quality === "high" ? t("qualityHigh")
                : project.quality === "medium" ? t("qualityMedium") : t("qualityLow")}
            </span>
          )}
          {project.distribution_type && (
            <span className="bg-white/[0.04] border border-white/[0.08] text-neutral-300 px-2 py-0.5 rounded-md text-[10px]">
              {t("distributionLabel")}{" "}
              {project.distribution_type === "monthly" ? t("distMonthly")
                : project.distribution_type === "quarterly" ? t("distQuarterly")
                : project.distribution_type === "semi_annual" ? t("distSemiAnnual") : t("distAnnual")}
            </span>
          )}
        </div>
      )}

      {/* Price + Returns */}
      <div className="flex items-end justify-between mb-3 pb-3 border-b border-white/[0.05]">
        <div>
          <div className="text-[10px] text-neutral-500 mb-0.5">{t("sharePrice")}</div>
          <div className="text-xl font-bold text-white font-mono leading-none">
            {project.share_price.toLocaleString("en-US")}
          </div>
          <div className="text-[9px] text-neutral-500 font-mono mt-0.5">IQD</div>
        </div>
        <div className="text-left">
          <div className="text-[10px] text-green-400/70 mb-0.5">{t("expectedReturn")}</div>
          <div className="text-base font-bold text-green-400 font-mono flex items-baseline gap-1 justify-end">
            <span>{project.expected_return_min}-{project.expected_return_max}%</span>
            <TrendingUp className="w-2.5 h-2.5 mb-0.5" strokeWidth={2.5} />
          </div>
          <div className="text-[9px] text-green-400/50 mt-0.5">{t("annually")}</div>
        </div>
      </div>

      {/* Funding progress */}
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] text-neutral-500">{t("fundingRatio")}</span>
          <span className="text-[11px] text-white font-bold font-mono">{fundedPercent}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-1.5">
          <div
            className={cn("h-full bg-gradient-to-r rounded-full transition-all", progressColor)}
            style={{ width: fundedBarWidth + "%" }}
          />
        </div>
        {/* Phase 11.06 — sub-line now shows sold/offering, not sold/total */}
        <div className="flex justify-between text-[9px] text-neutral-600 font-mono">
          <span>{fundedShares.toLocaleString("en-US")} / {offeringTotal.toLocaleString("en-US")} SHR</span>
          <span>{project.available_shares.toLocaleString("en-US")} {t("remaining")}</span>
        </div>
      </div>

      {/* Stats grid — Phase 11.06: المدة box hidden when duration is
          open-ended or unset (founder spec). Grid columns adapt: 4 with
          duration, 3 without — investors / risk / closes-in. */}
      {(() => {
        const showDuration =
          !project.duration_open &&
          typeof project.duration_months === "number" &&
          project.duration_months > 0
        const cols = showDuration ? "grid-cols-4" : "grid-cols-3"
        return (
          <div className={cn("grid gap-1.5 mb-3", cols)}>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
              <div className="text-[9px] text-neutral-500 mb-1">{t("investors")}</div>
              <div className="text-xs font-bold text-white font-mono">{project.investors_count}</div>
            </div>
            {showDuration && (
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
                <div className="text-[9px] text-neutral-500 mb-1">{t("duration")}</div>
                <div className="text-xs font-bold text-white font-mono">{t("durationMonths", { n: project.duration_months })}</div>
              </div>
            )}
            <div className={cn("rounded-lg p-2 text-center border", r.bg, r.border)}>
              <div className={cn("text-[9px] mb-1 opacity-70", r.text)}>{t("risk")}</div>
              <div className={cn("text-[11px] font-bold", r.text)}>{t(RISK_KEY[project.risk_level] ?? "riskMedium")}</div>
            </div>
            <div className="bg-blue-400/[0.06] border border-blue-400/15 rounded-lg p-2 text-center">
              <div className="text-[9px] text-blue-400/70 mb-1">{t("closesIn")}</div>
              <div className="text-[11px] text-blue-400 font-bold font-mono">{t("daysValue", { n: project.closes_in_days })}</div>
            </div>
          </div>
        )
      })()}

      {/* CTA buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={handleFollow}
          className={cn(
            "w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors",
            following
              ? "bg-red-400/[0.1] border-red-400/30"
              : "bg-white/[0.05] border-white/[0.1] hover:bg-white/[0.08]"
          )}
        >
          <Heart
            className={cn("w-3.5 h-3.5", following ? "text-red-400 fill-red-400" : "text-neutral-400")}
            strokeWidth={1.5}
          />
        </button>
        <button
          onClick={handleDetails}
          className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2 rounded-lg text-[11px] font-bold hover:bg-white/[0.08] transition-colors"
        >
          {t("details")}
        </button>
        <button
          onClick={handleInvest}
          className="flex-[2] bg-neutral-100 text-black py-2 rounded-lg text-[11px] font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1"
        >
          {t("investNow")}
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// Phase 14.12 P4 — memo'd export (see note on ProjectCardImpl).
export const ProjectCard = memo(ProjectCardImpl)
