"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Check, ChevronLeft, Star, TrendingUp } from "lucide-react"
import { showSuccess } from "@/lib/utils/toast"
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

export interface CompanyCardData {
  id: string
  name: string
  sector: string
  city: string
  joined_days_ago: number
  share_price: number
  projects_count: number
  shareholders_count: number
  risk_level: "منخفض" | "متوسط" | "مرتفع"
  is_verified: boolean
  rating: number
  is_trending?: boolean
  is_new?: boolean
}

interface CompanyCardProps {
  company: CompanyCardData
  variant?: "compact" | "full"
}

export function CompanyCard({ company, variant = "full" }: CompanyCardProps) {
  const router = useRouter()
  const [following, setFollowing] = useState(false)

  const c = sectorColor(company.sector)
  const r = riskColor(company.risk_level)

  const formatPrice = (p: number) => {
    if (p >= 1_000_000) return (p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1) + "M"
    if (p >= 1_000) return (p / 1_000).toFixed(0) + "K"
    return p.toString()
  }

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFollowing(!following)
    showSuccess(following ? "تم إلغاء المتابعة" : "تمت المتابعة ❤️")
  }

  const handleViewCompany = () => {
    router.push("/company/" + company.id)
  }

  const handleViewProjects = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/market?tab=projects&company=" + company.id)
  }

  return (
    <div
      onClick={handleViewCompany}
      className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 backdrop-blur cursor-pointer hover:bg-white/[0.06] transition-colors"
    >

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center text-xl flex-shrink-0", c.bg, c.border)}>
            {sectorIcon(company.sector)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-bold text-white truncate">{company.name}</span>
              {company.is_new && (
                <span className="bg-green-400/[0.12] border border-green-400/30 text-green-400 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                  جديد
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 truncate">
              {company.sector} · {company.city} · انضمت قبل {company.joined_days_ago} أيام
            </div>
          </div>
        </div>
        <button
          onClick={handleFollow}
          className={cn(
            "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors",
            following
              ? "bg-red-400/[0.1] border-red-400/30"
              : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]"
          )}
        >
          <Heart
            className={cn("w-3.5 h-3.5", following ? "text-red-400 fill-red-400" : "text-neutral-400")}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-1">سعر الحصة</div>
          <div className="text-xs font-bold text-yellow-400 font-mono">{formatPrice(company.share_price)}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-1">المشاريع</div>
          <div className="text-xs font-bold text-white font-mono">{company.projects_count}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
          <div className="text-[9px] text-neutral-500 mb-1">المساهمون</div>
          <div className="text-xs font-bold text-white font-mono">{company.shareholders_count}</div>
        </div>
        <div className={cn("rounded-lg p-2 text-center border", r.bg, r.border)}>
          <div className={cn("text-[9px] mb-1", r.text, "opacity-70")}>المخاطر</div>
          <div className={cn("text-[11px] font-bold", r.text)}>{company.risk_level}</div>
        </div>
      </div>

      {/* Tags */}
      {variant === "full" && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {company.is_verified && (
            <span className="bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-[9px] px-2 py-0.5 rounded flex items-center gap-1">
              <Check className="w-2 h-2 text-green-400" strokeWidth={3} />
              موثقة
            </span>
          )}
          <span className="bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-[9px] px-2 py-0.5 rounded flex items-center gap-1">
            <Star className="w-2 h-2 text-yellow-400 fill-yellow-400" />
            {company.rating}
          </span>
          {company.is_trending && (
            <span className="bg-purple-400/[0.06] border border-purple-400/20 text-purple-400 text-[9px] px-2 py-0.5 rounded">
              🔥 رائجة
            </span>
          )}
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleViewCompany()
          }}
          className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2 rounded-lg text-[11px] font-bold hover:bg-white/[0.08] transition-colors"
        >
          عرض الشركة
        </button>
        <button
          onClick={handleViewProjects}
          className="flex-1 bg-neutral-100 text-black py-2 rounded-lg text-[11px] font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1"
        >
          عرض المشاريع
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
