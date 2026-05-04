"use client"

import { useState, useMemo, useEffect } from "react"
import { Heart, ChevronLeft, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { CompanyCard, ProjectCard } from "@/components/cards"
import { SectionHeader, StatCard, Tabs, EmptyState } from "@/components/ui"
import { getAllProjects } from "@/lib/data/projects"
import { getAllCompanies } from "@/lib/data/companies"
import { getMyFollows, unfollowTarget } from "@/lib/data/follows"
import type { ProjectCardData, CompanyCardData } from "@/components/cards"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type TabId = "all" | "projects" | "companies"

export default function FollowingPage() {
  const [tab, setTab] = useState<TabId>("all")
  const [unfollowed, setUnfollowed] = useState<Set<string>>(new Set())
  const [dbFollowedProjectIds, setDbFollowedProjectIds] = useState<string[] | null>(null)
  const [dbFollowedCompanyIds, setDbFollowedCompanyIds] = useState<string[] | null>(null)
  const [projectsCatalog, setProjectsCatalog] = useState<ProjectCardData[]>([])
  const [companiesCatalog, setCompaniesCatalog] = useState<CompanyCardData[]>([])

  // Load real follows + project + company catalogs on mount.
  useEffect(() => {
    let cancelled = false
    getMyFollows().then((rows) => {
      if (cancelled) return
      const projects = rows.filter((r) => r.target_type === "project").map((r) => r.target_id)
      const companies = rows.filter((r) => r.target_type === "company").map((r) => r.target_id)
      setDbFollowedProjectIds(projects)
      setDbFollowedCompanyIds(companies)
    })
    getAllProjects().then((rows) => {
      if (cancelled) return
      setProjectsCatalog(rows as unknown as ProjectCardData[])
    })
    getAllCompanies().then((rows) => {
      if (cancelled) return
      setCompaniesCatalog(rows as unknown as CompanyCardData[])
    })
    return () => { cancelled = true }
  }, [])

  // Resolve the followed projects/companies — DB only (production mode).
  // Empty state shows when the user has no follows OR catalog is empty.
  const allProjects = useMemo(() => {
    if (!dbFollowedProjectIds || dbFollowedProjectIds.length === 0) return []
    return projectsCatalog.filter((p) => dbFollowedProjectIds.includes(p.id))
  }, [dbFollowedProjectIds, projectsCatalog])

  const allCompanies = useMemo(() => {
    if (!dbFollowedCompanyIds || dbFollowedCompanyIds.length === 0) return []
    return companiesCatalog.filter((c) => dbFollowedCompanyIds.includes(c.id))
  }, [dbFollowedCompanyIds, companiesCatalog])

  // Filter out unfollowed (for instant UI feedback)
  const projects = allProjects.filter((p) => !unfollowed.has("p-" + p.id))
  const companies = allCompanies.filter((c) => !unfollowed.has("c-" + c.id))

  const stats = useMemo(
    () => ({
      total: projects.length + companies.length,
      projects: projects.length,
      companies: companies.length,
    }),
    [projects.length, companies.length],
  )

  const showProjects = tab === "all" || tab === "projects"
  const showCompanies = tab === "all" || tab === "companies"

  const handleUnfollow = async (key: string, name: string, targetId: string, targetType: "project" | "company") => {
    // Optimistic UI
    setUnfollowed((prev) => new Set(prev).add(key))

    // Best-effort DB unfollow (only matters if it was a DB-sourced row).
    const isDbRow =
      targetType === "project"
        ? (dbFollowedProjectIds?.includes(targetId) ?? false)
        : (dbFollowedCompanyIds?.includes(targetId) ?? false)
    if (isDbRow) {
      const res = await unfollowTarget(targetType, targetId)
      if (!res.success && res.reason !== "missing_table") {
        // Revert on real failure (keep optimistic on missing_table for demo)
        setUnfollowed((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        showError("تعذّر إلغاء المتابعة")
        return
      }
      // Also drop from local DB lists so re-toggle won't bring it back
      if (targetType === "project") {
        setDbFollowedProjectIds((prev) => prev?.filter((id) => id !== targetId) ?? null)
      } else {
        setDbFollowedCompanyIds((prev) => prev?.filter((id) => id !== targetId) ?? null)
      }
    }
    showSuccess(`تم إلغاء متابعة ${name}`)
  }

  const isEmpty = stats.total === 0

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="❤️ متابعتي"
            subtitle="كل المشاريع والشركات التي تتابعها"
            backHref="/dashboard"
          />

          {/* ═══ § 1: Stats ═══ */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <StatCard label="إجمالي المتابَعات" value={stats.total} color="purple" icon={<Heart className="w-3 h-3 fill-purple-400" />} />
            <StatCard label="مشاريع" value={stats.projects} color="green" />
            <StatCard label="شركات" value={stats.companies} color="blue" />
          </div>

          {/* ═══ § 2: Tabs ═══ */}
          <div className="mb-5">
            <Tabs
              tabs={[
                { id: "all",       icon: "✨", label: "الكل",     count: stats.total },
                { id: "projects",  icon: "🏗️", label: "مشاريع",   count: stats.projects },
                { id: "companies", icon: "🏢", label: "شركات",    count: stats.companies },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as TabId)}
            />
          </div>

          {/* ═══ § 3: Empty state OR grids ═══ */}
          {isEmpty ? (
            <EmptyState
              icon="💔"
              title="لا توجد متابعات بعد"
              description="ابدأ بمتابعة مشاريع وشركات تهمّك"
              action={{ label: "اكتشف الفرص", href: "/market" }}
              size="lg"
            />
          ) : (
            <>
              {/* Projects */}
              {showProjects && projects.length > 0 && (
                <div className="mb-7">
                  <SectionHeader
                    title="🏗️ مشاريع متابَعة"
                    subtitle={`${projects.length} مشروع`}
                    action={tab === "all" ? { label: "عرض الكل", onClick: () => setTab("projects") } : undefined}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {projects.map((p) => (
                      <FollowedItemWrapper
                        key={"p-" + p.id}
                        name={p.name}
                        onUnfollow={() => handleUnfollow("p-" + p.id, p.name, p.id, "project")}
                      >
                        <ProjectCard project={p} variant="compact" />
                      </FollowedItemWrapper>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies */}
              {showCompanies && companies.length > 0 && (
                <div className="mb-7">
                  <SectionHeader
                    title="🏢 شركات متابَعة"
                    subtitle={`${companies.length} شركة`}
                    action={tab === "all" ? { label: "عرض الكل", onClick: () => setTab("companies") } : undefined}
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {companies.map((c) => (
                      <FollowedItemWrapper
                        key={"c-" + c.id}
                        name={c.name}
                        onUnfollow={() => handleUnfollow("c-" + c.id, c.name, c.id, "company")}
                      >
                        <CompanyCard company={c} variant="compact" />
                      </FollowedItemWrapper>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state per tab */}
              {tab === "projects" && projects.length === 0 && (
                <EmptyState
                  icon="🏗️"
                  title="لا توجد مشاريع متابَعة"
                  description="ابحث في السوق وتابع ما يهمّك"
                  action={{ label: "السوق", href: "/market" }}
                  size="md"
                />
              )}
              {tab === "companies" && companies.length === 0 && (
                <EmptyState
                  icon="🏢"
                  title="لا توجد شركات متابَعة"
                  description="ابحث في السوق وتابع شركات تثق بها"
                  action={{ label: "السوق", href: "/market?tab=companies" }}
                  size="md"
                />
              )}
            </>
          )}

        </div>
      </div>
    </AppLayout>
  )
}

// ─── Wrapper to add unfollow button overlay ─────────────────
function FollowedItemWrapper({
  name,
  onUnfollow,
  children,
}: {
  name: string
  onUnfollow: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative group">
      {children}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (confirm(`إلغاء متابعة "${name}"؟`)) onUnfollow()
        }}
        aria-label={"إلغاء متابعة " + name}
        className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg bg-red-400/[0.12] border border-red-400/30 hover:bg-red-400/[0.2] text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        title="إلغاء المتابعة"
      >
        <Heart className="w-3.5 h-3.5 fill-red-400" strokeWidth={1.5} />
      </button>
    </div>
  )
}
