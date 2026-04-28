"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Building2, Layers, Flame, Clock, ChevronLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { CompanyCard, ProjectCard } from "@/components/cards"
import {
  getNewCompanies,
  getNewProjects,
  getTrendingProjects,
  getClosingSoonProjects,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

type Tab = "all" | "companies" | "projects" | "trending"

export default function MarketNewPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("all")

  // ─── Pull from centralized helpers (no inline mock data) ──────────
  const newCompanies = useMemo(() => getNewCompanies(), [])
  const newProjects = useMemo(() => getNewProjects(), [])
  const trendingProjects = useMemo(() => getTrendingProjects(), [])
  const closingSoon = useMemo(() => getClosingSoonProjects(15), [])

  // ─── Stats for hero chips ─────────────────────────────────────────
  const stats = {
    companies: newCompanies.length,
    projects: newProjects.length,
    closingSoon: closingSoon.length,
  }

  // ─── Show/hide based on active tab ────────────────────────────────
  const showCompanies = tab === "all" || tab === "companies"
  const showNewProjects = tab === "all" || tab === "projects"
  const showTrending = tab === "all" || tab === "trending"

  const totalVisible =
    (showCompanies ? newCompanies.length : 0) +
    (showNewProjects ? newProjects.length : 0) +
    (showTrending ? trendingProjects.length : 0)

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-6xl mx-auto pb-20">

          <PageHeader
            title="الجديد في السوق"
            subtitle="اكتشف أحدث الفرص الاستثمارية"
            backHref="/market"
          />

          {/* ═══ Hero ═══ */}
          <div className="bg-gradient-to-br from-purple-400/[0.08] via-blue-400/[0.04] to-white/[0.05] border border-purple-400/20 rounded-2xl p-5 mb-5 backdrop-blur relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl -translate-x-12 -translate-y-12 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl translate-x-12 translate-y-12 pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" strokeWidth={2} />
                </div>
                <h1 className="text-lg font-bold text-white">🆕 الجديد في السوق</h1>
              </div>
              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                اكتشف أحدث الشركات والمشاريع المضافة هذا الشهر، والفرص التي تنتهي قريباً.
              </p>

              {/* Stat chips */}
              <div className="flex flex-wrap gap-2">
                <StatChip
                  icon={<Building2 className="w-3 h-3" strokeWidth={2} />}
                  value={stats.companies}
                  label="شركة جديدة"
                  color="green"
                />
                <StatChip
                  icon={<Layers className="w-3 h-3" strokeWidth={2} />}
                  value={stats.projects}
                  label="مشروع جديد"
                  color="blue"
                />
                <StatChip
                  icon={<Clock className="w-3 h-3" strokeWidth={2} />}
                  value={stats.closingSoon}
                  label="فرصة تنتهي قريباً"
                  color="red"
                />
              </div>
            </div>
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 mb-5 overflow-x-auto">
            <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon="✨" label="الكل" />
            <TabBtn active={tab === "companies"} onClick={() => setTab("companies")} icon="🏢" label="شركات جديدة" count={newCompanies.length} />
            <TabBtn active={tab === "projects"} onClick={() => setTab("projects")} icon="🏗️" label="مشاريع جديدة" count={newProjects.length} />
            <TabBtn active={tab === "trending"} onClick={() => setTab("trending")} icon="🔥" label="الأكثر رواجاً" count={trendingProjects.length} />
          </div>

          {/* ═══ Empty state ═══ */}
          {totalVisible === 0 && (
            <div className="text-center py-20 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <div className="text-5xl mb-3 opacity-50">🔍</div>
              <div className="text-sm text-neutral-400 mb-1">لا توجد عناصر في هذا التبويب</div>
              <div className="text-[11px] text-neutral-600">جرّب اختيار تبويب آخر</div>
            </div>
          )}

          {/* ═══ Companies section ═══ */}
          {showCompanies && newCompanies.length > 0 && (
            <Section
              title="🏢 شركات حديثة الانضمام"
              subtitle={`${newCompanies.length} شركة جديدة هذا الشهر`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {newCompanies.map((c) => (
                  <CompanyCard key={c.id} company={c} variant="full" />
                ))}
              </div>
            </Section>
          )}

          {/* ═══ New projects section ═══ */}
          {showNewProjects && newProjects.length > 0 && (
            <Section
              title="🏗️ مشاريع حديثة الإطلاق"
              subtitle={`${newProjects.length} فرصة استثمارية جديدة`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {newProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} variant="full" />
                ))}
              </div>
            </Section>
          )}

          {/* ═══ Closing soon (always shown when tab=all) ═══ */}
          {tab === "all" && closingSoon.length > 0 && (
            <Section
              title="⏰ فرص ذهبية — تنتهي قريباً"
              subtitle="مشاريع باب الاكتتاب فيها يقفل خلال أسبوعين"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {closingSoon.map((p) => (
                  <ProjectCard key={"close-" + p.id} project={p} variant="full" />
                ))}
              </div>
            </Section>
          )}

          {/* ═══ Trending section ═══ */}
          {showTrending && trendingProjects.length > 0 && (
            <Section
              title="🔥 الأكثر رواجاً الآن"
              subtitle="المشاريع التي تحظى بأكبر اهتمام من المستثمرين"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {trendingProjects.map((p) => (
                  <ProjectCard key={"trend-" + p.id} project={p} variant="full" />
                ))}
              </div>
            </Section>
          )}

          {/* ═══ Bottom CTA banner ═══ */}
          <div className="bg-gradient-to-br from-purple-400/[0.1] via-purple-400/[0.05] to-white/[0.04] border border-purple-400/30 rounded-2xl p-5 mt-6 backdrop-blur relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl translate-x-16 -translate-y-16 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-400/[0.2] border border-purple-400/40 flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-purple-400" strokeWidth={2} />
              </div>
              <div className="flex-1 text-right">
                <div className="text-base font-bold text-white mb-1">هل لديك مشروع جديد؟</div>
                <div className="text-xs text-neutral-300 leading-relaxed">
                  انضم لرايلوس وأطلق مشروعك بثقة — نحن نوصلك بالمستثمرين المناسبين.
                </div>
              </div>
              <button
                onClick={() => router.push("/investment")}
                className="bg-neutral-100 text-black px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                اعرف المزيد
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: number
  label: string
  color: "green" | "blue" | "red"
}) {
  const colorMap = {
    green: "bg-green-400/[0.08] border-green-400/25 text-green-400",
    blue: "bg-blue-400/[0.08] border-blue-400/25 text-blue-400",
    red: "bg-red-400/[0.08] border-red-400/25 text-red-400",
  }
  return (
    <div className={cn("flex items-center gap-2 border rounded-full px-3 py-1.5", colorMap[color])}>
      {icon}
      <span className="text-sm font-bold font-mono">{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-fit py-2.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap",
        active
          ? "bg-white text-black font-bold"
          : "text-neutral-400 hover:text-white",
      )}
    >
      <span>{icon}</span>
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-mono",
            active ? "bg-black/10" : "bg-white/[0.05]",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-7">
      <div className="mb-4">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
