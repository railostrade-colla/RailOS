"use client"

import { useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Heart, Building2, TrendingUp, Calendar, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const sectorIcon = (s: string) =>
  s?.includes("طب") ? "🏥" :
  s?.includes("تقن") ? "💻" :
  s?.includes("زراع") ? "🌾" :
  s?.includes("تجار") ? "🏪" :
  s?.includes("صناع") ? "🏭" :
  s?.includes("عقار") ? "🏢" : "🏢"

const riskLabel = (r: string) => r === "low" ? "منخفض" : r === "medium" ? "متوسط" : "مرتفع"
const riskColor = (r: string) => r === "low" ? "text-green-400" : r === "medium" ? "text-yellow-400" : "text-red-400"

// Mock companies + related projects — centralized
import {
  companiesById as mockCompanies,
  relatedProjectsByCompany as mockRelatedProjects,
} from "@/lib/mock-data"

function genChart(base: number, days: number, seed = 1) {
  const d: number[] = []
  let p = base * 0.82
  for (let i = 0; i < days; i++) {
    p = Math.max(p + (Math.sin(i * seed * 0.3) * 0.018 + 0.002) * p, base * 0.7)
    d.push(Math.round(p))
  }
  d.push(base)
  return d
}

function LineChart({ data, color = "#4ADE80" }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const W = 600
  const H = 90
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - ((v - min) / range) * (H - 16) - 8 }))
  const polyline = pts.map((p) => p.x + "," + p.y).join(" ")
  const polygon = "0," + H + " " + polyline + " " + W + "," + H

  return (
    <svg width="100%" height={H} viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygon} fill="url(#cg)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CompanyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || "c1"

  const company = mockCompanies[id] || mockCompanies["c1"]
  const projects = mockRelatedProjects[id] || []

  const [tab, setTab] = useState<"info" | "projects" | "stats">("info")
  const [following, setFollowing] = useState(false)

  const totalShares = company.total_shares || 0
  const soldShares = totalShares - (company.available_shares || 0)
  const fundPct = totalShares > 0 ? Math.round((soldShares / totalShares) * 100) : 0
  const marketCap = company.share_price * totalShares
  const chartData = genChart(company.share_price, 30, company.id?.charCodeAt(0) || 1)

  const TABS = [
    { key: "info" as const, label: "معلومات الشركة" },
    { key: "projects" as const, label: `المشاريع (${projects.length})` },
    { key: "stats" as const, label: "الأداء" },
  ]

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="تفاصيل الشركة"
            subtitle={company.name}
            backHref="/market"
            rightAction={
              <button
                onClick={() => {
                  setFollowing((f) => !f)
                  showSuccess(following ? "تم إلغاء المتابعة" : "تتم متابعة الشركة")
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border",
                  following
                    ? "bg-white/[0.05] border-white/[0.15] text-white hover:bg-white/[0.08]"
                    : "bg-neutral-100 text-black border-transparent hover:bg-neutral-200"
                )}
              >
                <Heart className={cn("w-3.5 h-3.5", following && "fill-current")} strokeWidth={1.5} />
                {following ? "متابَع" : "متابعة"}
              </button>
            }
          />

          {/* Company Identity Card */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-4">

            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-3xl flex-shrink-0">
                {sectorIcon(company.sector)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold text-white mb-1.5 truncate">{company.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-white/[0.06] border border-white/[0.08] text-neutral-300 px-2 py-0.5 rounded text-[10px]">
                    {company.sector}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1",
                    company.status === "active"
                      ? "bg-green-400/10 border-green-400/20 text-green-400"
                      : "bg-neutral-400/10 border-neutral-400/20 text-neutral-400"
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {company.status === "active" ? "نشطة" : "موقوفة"}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <div className="text-xs text-neutral-300 leading-relaxed mb-4">
                {company.description}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "القيمة السوقية", value: fmtIQD(marketCap), unit: "IQD" },
                { label: "سعر الحصة", value: company.share_price?.toLocaleString("en-US"), unit: "IQD" },
                { label: "الحصص الكلية", value: totalShares.toLocaleString("en-US"), unit: "SHR" },
                { label: "نسبة المباع", value: fundPct + "%", unit: "" },
              ].map((s) => (
                <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
                  <div className="text-[10px] text-neutral-500 mb-0.5">{s.label}</div>
                  <div className="text-base font-bold text-white font-mono">
                    {s.value}{" "}
                    {s.unit && <span className="text-[9px] text-neutral-500">{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-neutral-500">تقدم التمويل</span>
                <span className="text-[11px] font-bold text-white">{fundPct}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    fundPct > 70 ? "bg-green-400" : fundPct > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: fundPct + "%" }}
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 mb-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs transition-colors whitespace-nowrap",
                  tab === t.key
                    ? "bg-white/[0.08] text-white font-bold border border-white/[0.1]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Info */}
          {tab === "info" && (
            <>
              {/* Chart */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="text-xs text-neutral-400 mb-2 font-bold">تاريخ سعر الحصة (30 يوم)</div>
                <LineChart data={chartData} color="#4ADE80" />
              </div>

              {/* Details list */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { label: "القطاع", value: company.sector || "—" },
                    {
                      label: "مستوى المخاطرة",
                      value: <span className={riskColor(company.risk_level)}>{riskLabel(company.risk_level)}</span>,
                    },
                    { label: "سنة التأسيس", value: company.founded_year || "—" },
                    { label: "عدد الموظفين", value: company.employees ? company.employees + " موظف" : "—" },
                    { label: "الحصص المتاحة", value: company.available_shares?.toLocaleString("en-US") + " حصة" },
                    { label: "سعر الحصة الابتدائي", value: company.share_price?.toLocaleString("en-US") + " IQD" },
                    { label: "تاريخ الإضافة", value: company.created_at ? new Date(company.created_at).toLocaleDateString("en-US") : "—" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5">
                      <span className="text-xs text-neutral-500">{row.label}</span>
                      <span className="text-xs font-bold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => router.push("/project/" + company.id)}
                className="w-full bg-neutral-100 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" strokeWidth={2} />
                عرض تفاصيل المشروع الكاملة
              </button>
            </>
          )}

          {/* Tab: Projects */}
          {tab === "projects" && (
            <>
              {projects.length === 0 ? (
                <div className="text-center py-12 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                  <Building2 className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                  <div className="text-sm font-bold text-white mb-1">لا توجد مشاريع</div>
                  <div className="text-xs text-neutral-500">لا توجد مشاريع مرتبطة بهذه الشركة حالياً</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projects.map((p) => {
                    const pct = p.total_shares > 0 ? Math.round(((p.total_shares - p.available_shares) / p.total_shares) * 100) : 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => router.push("/project/" + p.id)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-colors text-right"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xl flex-shrink-0">
                            {sectorIcon(p.sector)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{p.name}</div>
                            <div className="text-[11px] text-neutral-500">{p.sector}</div>
                          </div>
                          <div className="text-left flex-shrink-0">
                            <div className="text-sm font-bold text-white font-mono">
                              {p.share_price?.toLocaleString("en-US")}
                            </div>
                            <div className="text-[10px] text-neutral-500">IQD</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              p.risk_level === "low" ? "bg-green-400" :
                              p.risk_level === "medium" ? "bg-yellow-400" : "bg-red-400"
                            )}
                            style={{ width: pct + "%" }}
                          />
                        </div>

                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-neutral-500">مباع {pct}%</span>
                          <span className={cn("text-[10px]", riskColor(p.risk_level))}>
                            خطر {riskLabel(p.risk_level)}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Tab: Stats */}
          {tab === "stats" && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {[
                  { label: "نسبة البيع", value: fundPct + "%", color: fundPct > 70 ? "text-green-400" : "text-yellow-400" },
                  { label: "الحصص المباعة", value: soldShares.toLocaleString("en-US"), color: "text-white" },
                  { label: "القيمة السوقية", value: fmtIQD(marketCap), color: "text-blue-400" },
                  { label: "سعر الحصة", value: fmtIQD(company.share_price), color: "text-white" },
                ].map((s) => (
                  <div key={s.label} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                    <div className="text-[10px] text-neutral-500 mb-1.5">{s.label}</div>
                    <div className={cn("text-2xl font-bold font-mono tracking-tight", s.color)}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" strokeWidth={1.5} />
                  <div className="text-xs font-bold text-white">منحنى السعر</div>
                </div>
                <LineChart data={chartData} color="#4ADE80" />
              </div>

              {/* Performance summary */}
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
                <div className="text-xs font-bold text-white mb-3">ملخص الأداء</div>
                <div className="divide-y divide-white/[0.04]">
                  {[
                    { label: "العائد المتوقع السنوي", value: "12-18%", color: "text-green-400" },
                    { label: "متوسط حجم التداول", value: fmtIQD(Math.round(marketCap * 0.05)) + " IQD" },
                    { label: "عدد المستثمرين النشطين", value: Math.floor(soldShares / 50) + "" },
                    { label: "متوسط النمو الشهري", value: "+5.2%", color: "text-green-400" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <span className="text-xs text-neutral-500">{item.label}</span>
                      <span className={cn("text-xs font-bold", item.color || "text-white")}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
