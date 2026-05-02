"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Calendar, Star, ChevronLeft, Clock } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { CompanyCard, ProjectCard } from "@/components/cards"
import { Card, SectionHeader, Tabs, Badge, EmptyState, Modal, SkeletonCard } from "@/components/ui"
import {
  ALL_COMPANIES,
  ALL_PROJECTS,
  SECTORS_LIST as SECTORS,
  RISK_LEVELS_AR as RISK_LEVELS,
  getRecentNews,
  mockAds,
  MOCK_LISTINGS,
  type PlatformNews,
  type NewsType,
} from "@/lib/mock-data"
import { getAllProjects, getAllCompanies } from "@/lib/data"
import { cn } from "@/lib/utils/cn"

// ─── News type → label/color ───────────────────────────────
const NEWS_TYPE_META: Record<NewsType, { label: string; color: "blue" | "purple" | "green" | "yellow" }> = {
  announcement: { label: "إعلان",      color: "blue" },
  feature:      { label: "ميزة جديدة", color: "purple" },
  tip:          { label: "نصيحة",      color: "green" },
  update:       { label: "تحديث",      color: "yellow" },
}

// ─── Sector icon for user offers ──────────────────────────
const sectorIcon = (s: string) => {
  if (s.includes("زراع")) return "🌾"
  if (s.includes("تجار")) return "🏪"
  if (s.includes("صناع")) return "🏭"
  if (s.includes("عقار")) return "🏢"
  return "🏢"
}

type MarketTab = "news" | "projects" | "companies" | "offers"

function MarketContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab from URL
  const tabFromUrl = searchParams?.get("tab") as MarketTab | null
  const companyFilter = searchParams?.get("company")

  const [tab, setTab] = useState<MarketTab>(tabFromUrl || "news")
  const [search, setSearch] = useState("")
  const [sectorFilter, setSectorFilter] = useState("الكل")
  const [riskFilter, setRiskFilter] = useState("الكل")
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc" | "trending">("newest")
  const [openNews, setOpenNews] = useState<PlatformNews | null>(null)

  // ─── Live data (DB-backed with mock fallback) ─────────────
  const [projects, setProjects] = useState(ALL_PROJECTS)
  const [companies, setCompanies] = useState(ALL_COMPANIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([getAllProjects(), getAllCompanies()])
      .then(([p, c]) => {
        if (cancelled) return
        // Cast minimally — DB rows mostly fit the card data interface
        if (p.length > 0) setProjects(p as unknown as typeof ALL_PROJECTS)
        if (c.length > 0) setCompanies(c as unknown as typeof ALL_COMPANIES)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ─── Tab content data ──────────────────────────────────────
  const news = useMemo(() => getRecentNews(12), [])
  // Top user offers — high-reputation sell listings
  const userOffers = useMemo(
    () =>
      MOCK_LISTINGS
        .filter((l) => l.type === "sell" && l.reputation_score >= 85)
        .sort((a, b) => b.reputation_score - a.reputation_score)
        .slice(0, 6),
    [],
  )

  useEffect(() => {
    if (tabFromUrl) setTab(tabFromUrl)
  }, [tabFromUrl])

  const handleTabChange = (newTab: MarketTab) => {
    setTab(newTab)
    router.push("/market?tab=" + newTab)
  }

  // فلترة المشاريع
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => !companyFilter || p.company_id === companyFilter)
      .filter((p) => !search || p.name.includes(search) || (p.company_name?.includes(search) ?? false))
      .filter((p) => sectorFilter === "الكل" || p.sector === sectorFilter)
      .filter((p) => riskFilter === "الكل" || p.risk_level === riskFilter)
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.share_price - b.share_price
        if (sortBy === "price_desc") return b.share_price - a.share_price
        if (sortBy === "trending") return (b.is_trending ? 1 : 0) - (a.is_trending ? 1 : 0)
        return 0
      })
  }, [search, sectorFilter, riskFilter, sortBy, companyFilter, projects])

  // فلترة الشركات
  const filteredCompanies = useMemo(() => {
    return companies
      .filter((c) => !search || c.name.includes(search) || (c.city?.includes(search) ?? false))
      .filter((c) => sectorFilter === "الكل" || c.sector === sectorFilter)
      .filter((c) => riskFilter === "الكل" || c.risk_level === riskFilter)
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.share_price - b.share_price
        if (sortBy === "price_desc") return b.share_price - a.share_price
        if (sortBy === "trending") return (b.is_trending ? 1 : 0) - (a.is_trending ? 1 : 0)
        return 0
      })
  }, [search, sectorFilter, riskFilter, sortBy, companies])

  const filteredCompany = companyFilter ? companies.find((c) => c.id === companyFilter) : null

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-6xl mx-auto pb-20">

          <PageHeader
            title="السوق"
            subtitle="استكشف الفرص الاستثمارية المتاحة"
            showBack={false}
          />

          {/* Filter info chip */}
          {filteredCompany && (
            <div className="bg-blue-400/[0.06] border border-blue-400/25 rounded-xl p-3 mb-4 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-neutral-400">عرض مشاريع: </span>
                <span className="text-white font-bold">{filteredCompany.name}</span>
              </div>
              <button
                onClick={() => router.push("/market?tab=projects")}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                إزالة
              </button>
            </div>
          )}

          {/* Tabs (uses Tabs primitive) — 4 tabs (clean labels only): News (default) | Projects | Companies | Offers */}
          <div className="mb-4">
            <Tabs
              tabs={[
                { id: "news", label: "الأخبار" },
                { id: "projects", label: "المشاريع" },
                { id: "companies", label: "الشركات" },
                { id: "offers", label: "العروض" },
              ]}
              activeTab={tab}
              onChange={(id) => handleTabChange(id as MarketTab)}
              size="sm"
            />
          </div>

          {/* Search — only for projects/companies tabs */}
          {(tab === "projects" || tab === "companies") && (
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "projects" ? "ابحث عن مشروع..." : "ابحث عن شركة..."}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
              />
            </div>
          )}

          {/* Filters + Sort — only for projects/companies tabs */}
          {(tab === "projects" || tab === "companies") && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                {/* Sectors */}
                {SECTORS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSectorFilter(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] flex-shrink-0 transition-colors border whitespace-nowrap",
                      sectorFilter === s
                        ? "bg-white text-black border-transparent font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    {s}
                  </button>
                ))}

                <div className="w-px bg-white/[0.08] flex-shrink-0 mx-1" />

                {/* Risk levels */}
                {RISK_LEVELS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskFilter(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] flex-shrink-0 transition-colors border whitespace-nowrap",
                      riskFilter === r
                        ? "bg-white text-black border-transparent font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:text-white"
                    )}
                  >
                    {r === "الكل" ? "كل المخاطر" : r}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
                {[
                  { key: "newest" as const, label: "الأحدث" },
                  { key: "trending" as const, label: "🔥 الأكثر رواجاً" },
                  { key: "price_asc" as const, label: "السعر: من الأقل" },
                  { key: "price_desc" as const, label: "السعر: من الأعلى" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] flex-shrink-0 transition-colors border whitespace-nowrap",
                      sortBy === s.key
                        ? "bg-yellow-400/[0.1] text-yellow-400 border-yellow-400/30 font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-500 hover:text-white"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ═══ TAB CONTENT: 📰 News ═══ */}
          {tab === "news" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {news.map((n) => {
                const meta = NEWS_TYPE_META[n.type]
                return (
                  <Card key={n.id} onClick={() => setOpenNews(n)} className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-2xl flex-shrink-0">
                      {n.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge color={meta.color} variant="soft" size="xs">{meta.label}</Badge>
                        {n.is_new && <Badge color="green" variant="soft" size="xs">جديد</Badge>}
                        <span className="text-[9px] text-neutral-600 mr-auto flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {n.date}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white mb-1 leading-snug">{n.title}</div>
                      <div className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">{n.excerpt}</div>
                      <button className="text-[11px] text-blue-400 hover:text-blue-300 mt-2 transition-colors">
                        اقرأ المزيد ←
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ═══ TAB CONTENT: ✨ Offers (System + User) ═══ */}
          {tab === "offers" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* System offers */}
              <Card variant="gradient" color="purple">
                <SectionHeader
                  title="✨ عروض النظام"
                  subtitle="عروض ترويجية رسمية من رايلوس"
                />
                <div className="space-y-2">
                  {mockAds.map((ad) => (
                    <button
                      key={ad.id}
                      onClick={() => {
                        if (ad.link_type === "internal" && ad.link_url) router.push(ad.link_url)
                        else if (ad.link_type === "external" && ad.link_url) window.open(ad.link_url, "_blank")
                      }}
                      className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl p-3 transition-colors text-right flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-400/[0.12] border border-purple-400/30 flex items-center justify-center text-xl flex-shrink-0">
                        {ad.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{ad.title}</span>
                          {ad.subtitle && (
                            <Badge color="purple" variant="soft" size="xs">{ad.subtitle}</Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">{ad.description}</div>
                      </div>
                      <span className="text-[10px] text-purple-400 font-bold flex items-center gap-0.5 flex-shrink-0">
                        {ad.action_label}
                        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              {/* User offers */}
              <Card variant="gradient" color="blue">
                <SectionHeader
                  title="👥 عروض المستخدمين"
                  subtitle="أفضل المتداولين في السوق الثانوية"
                  action={{ label: "كل العروض", href: "/exchange" }}
                />

                {userOffers.length === 0 ? (
                  <EmptyState
                    icon="📭"
                    title="لا توجد عروض حالياً"
                    description="تحقّق من السوق الثانوية"
                    size="sm"
                  />
                ) : (
                  <div className="space-y-2">
                    {userOffers.map((l) => {
                      const project = ALL_PROJECTS.find((p) => p.id === l.project_id)
                      return (
                        <button
                          key={l.id}
                          onClick={() => router.push("/exchange?project=" + l.project_id)}
                          className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl p-3 transition-colors text-right flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-xl bg-blue-400/[0.12] border border-blue-400/30 flex items-center justify-center text-xl flex-shrink-0">
                            {sectorIcon(project?.sector ?? "")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-xs font-bold text-white truncate">{l.user_name}</span>
                              <Badge color="green" variant="soft" size="xs" icon={<Star className="w-2 h-2 fill-green-400" />}>
                                {l.reputation_score}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              {l.project_name} · <span className="font-mono text-white">{l.shares}</span> حصة بسعر <span className="font-mono text-yellow-400">{l.price.toLocaleString("en-US")}</span>
                            </div>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-neutral-500 flex-shrink-0" strokeWidth={2} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══ TAB CONTENT: 🏗️ Projects ═══ */}
          {tab === "projects" && (
            loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="لا توجد مشاريع تطابق البحث"
                description="جرّب تغيير الفلاتر"
                size="lg"
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} variant="full" />
                ))}
              </div>
            )
          )}

          {/* ═══ TAB CONTENT: 🏢 Companies ═══ */}
          {tab === "companies" && (
            loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="لا توجد شركات تطابق البحث"
                description="جرّب تغيير الفلاتر"
                size="lg"
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredCompanies.map((c) => (
                  <CompanyCard key={c.id} company={c} variant="full" />
                ))}
              </div>
            )
          )}

        </div>
      </div>

      {/* News detail Modal */}
      {openNews && (
        <Modal
          isOpen={!!openNews}
          onClose={() => setOpenNews(null)}
          title={openNews.title}
          subtitle={openNews.date}
          size="md"
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-2xl">
              {openNews.icon}
            </div>
            <Badge color={NEWS_TYPE_META[openNews.type].color} variant="soft">
              {NEWS_TYPE_META[openNews.type].label}
            </Badge>
            {openNews.is_new && <Badge color="green" variant="soft" size="xs">جديد</Badge>}
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{openNews.excerpt}</p>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
            <Clock className="w-3 h-3 text-neutral-500" />
            <span className="text-[10px] text-neutral-500">{openNews.date}</span>
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}

export default function MarketPage() {
  return (
    <Suspense fallback={null}>
      <MarketContent />
    </Suspense>
  )
}
