"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Calendar } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Badge, Tabs, EmptyState, Modal, SkeletonCard } from "@/components/ui"
import {
  PLATFORM_NEWS,
  getFeaturedNews,
  type PlatformNews,
  type NewsType,
} from "@/lib/mock-data"
import { getAllNews, type DBNews } from "@/lib/data"
import {
  getMyReaction,
  setReaction,
  type ReactionType,
} from "@/lib/data/news-reactions"
import { showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

/** Map DB news row → PlatformNews shape (used by UI). */
function dbToNews(row: DBNews): PlatformNews {
  const typeMap: Record<string, NewsType> = {
    announcement:    "announcement",
    feature:         "feature",
    project_update:  "update",
    alert:           "announcement",
    promo:           "feature",
  }
  return {
    id: row.id,
    type: typeMap[row.news_type ?? ""] ?? "announcement",
    icon: row.news_type === "feature" ? "🎉" : row.news_type === "promo" ? "🎁" : row.news_type === "alert" ? "⚠️" : "📢",
    title: row.title,
    excerpt: row.summary ?? row.content?.slice(0, 120) ?? "",
    date: row.published_at?.split("T")[0] ?? row.created_at?.split("T")[0] ?? "—",
    is_new: row.published_at ? (Date.now() - new Date(row.published_at).getTime()) < 7 * 86_400_000 : false,
  }
}

// ─── Type → label/color/badge mapping ───────────────────────────
const TYPE_META: Record<NewsType, { label: string; color: "blue" | "purple" | "green" | "yellow" }> = {
  announcement: { label: "إعلان",      color: "blue" },
  feature:      { label: "ميزة جديدة", color: "purple" },
  tip:          { label: "نصيحة",      color: "green" },
  update:       { label: "تحديث",      color: "yellow" },
}

type FilterTab = "all" | NewsType

const TABS: Array<{ id: FilterTab; icon: string; label: string }> = [
  { id: "all",          icon: "✨", label: "الكل" },
  { id: "feature",      icon: "🎉", label: "ميزات" },
  { id: "announcement", icon: "📢", label: "إعلانات" },
  { id: "tip",          icon: "💡", label: "نصائح" },
  { id: "update",       icon: "🔄", label: "تحديثات" },
]

// ════════════════════════════════════════════════════════════════
export default function NewsPage() {
  const [tab, setTab] = useState<FilterTab>("all")
  const [search, setSearch] = useState("")
  const [openItem, setOpenItem] = useState<PlatformNews | null>(null)

  // Live news (DB-backed with mock fallback)
  const [allNews, setAllNews] = useState<PlatformNews[]>(PLATFORM_NEWS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getAllNews(50)
      .then((rows) => {
        if (cancelled) return
        if (rows.length > 0) setAllNews(rows.map(dbToNews))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const featured = useMemo(() => allNews[0] ?? getFeaturedNews(), [allNews])

  // Search helper that works on the live or mock list
  const searchInList = (q: string, list: PlatformNews[]) => {
    if (!q.trim()) return list
    const lower = q.toLowerCase().trim()
    return list.filter(
      (n) => n.title.toLowerCase().includes(lower) || n.excerpt.toLowerCase().includes(lower)
    )
  }

  // Apply search → tab filter
  const filtered = useMemo(() => {
    let rows: PlatformNews[] = searchInList(search, allNews)
    if (tab !== "all") rows = rows.filter((n) => n.type === tab)
    return rows.filter((n) => n.id !== featured.id)
  }, [tab, search, featured.id, allNews])

  // Tab counts
  const tabCounts = useMemo(() => {
    const base = searchInList(search, allNews)
    return {
      all: base.length,
      feature: base.filter((n) => n.type === "feature").length,
      announcement: base.filter((n) => n.type === "announcement").length,
      tip: base.filter((n) => n.type === "tip").length,
      update: base.filter((n) => n.type === "update").length,
    }
  }, [search, allNews])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-5xl mx-auto pb-20">

          <PageHeader
            title="📰 آخر الأخبار"
            subtitle="تابع كل جديد على المنصة"
            backHref="/dashboard"
          />

          {/* ═══ Featured (hero) ═══ */}
          <Card variant="gradient" color="purple" className="mb-7 cursor-pointer" onClick={() => setOpenItem(featured)}>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center text-3xl flex-shrink-0">
                {featured.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge color={TYPE_META[featured.type].color} variant="soft">
                    {TYPE_META[featured.type].label}
                  </Badge>
                  {featured.is_new && (
                    <Badge color="green" variant="soft" size="xs">جديد</Badge>
                  )}
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1 mr-auto">
                    <Calendar className="w-2.5 h-2.5" />
                    {featured.date}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mb-2 leading-tight">{featured.title}</h2>
                <p className="text-xs text-neutral-300 leading-relaxed">{featured.excerpt}</p>
                <button className="text-xs text-purple-400 hover:text-purple-300 mt-3 transition-colors">
                  اقرأ المزيد ←
                </button>
              </div>
            </div>
          </Card>

          {/* ═══ Search ═══ */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الأخبار..."
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors"
            />
          </div>

          {/* ═══ Filter Tabs ═══ */}
          <div className="mb-5">
            <Tabs
              tabs={TABS.map((t) => ({ ...t, count: tabCounts[t.id] }))}
              activeTab={tab}
              onChange={(id) => setTab(id as FilterTab)}
            />
          </div>

          {/* ═══ Grid ═══ */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="لا توجد أخبار تطابق البحث"
              description="جرّب تغيير الفلتر أو كلمة البحث"
              size="md"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((n) => {
                const meta = TYPE_META[n.type]
                return (
                  <Card key={n.id} onClick={() => setOpenItem(n)} className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-2xl flex-shrink-0">
                      {n.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge color={meta.color} variant="soft" size="xs">
                          {meta.label}
                        </Badge>
                        {n.is_new && (
                          <Badge color="green" variant="soft" size="xs">جديد</Badge>
                        )}
                        <span className="text-[9px] text-neutral-600 mr-auto">{n.date}</span>
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

        </div>
      </div>

      {/* News detail Modal */}
      {openItem && (
        <Modal
          isOpen={!!openItem}
          onClose={() => setOpenItem(null)}
          title={openItem.title}
          subtitle={openItem.date}
          size="md"
        >
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-2xl">
              {openItem.icon}
            </div>
            <Badge color={TYPE_META[openItem.type].color} variant="soft">
              {TYPE_META[openItem.type].label}
            </Badge>
            {openItem.is_new && (
              <Badge color="green" variant="soft" size="xs">جديد</Badge>
            )}
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{openItem.excerpt}</p>
          <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
            للمزيد من التفاصيل أو الأسئلة حول هذا الإعلان، تواصل مع الدعم.
          </p>

          {/* Reactions strip — Phase P. Persists in news_reactions
              when the user is signed in; no-ops gracefully otherwise. */}
          <NewsReactions newsId={openItem.id} />
        </Modal>
      )}
    </AppLayout>
  )
}

// ─── News reactions strip ────────────────────────────────────
const REACTIONS: ReadonlyArray<{ id: ReactionType; emoji: string; label: string }> = [
  { id: "like",      emoji: "👍", label: "إعجاب" },
  { id: "love",      emoji: "❤️", label: "حب" },
  { id: "celebrate", emoji: "🎉", label: "احتفال" },
  { id: "applause",  emoji: "👏", label: "تصفيق" },
  { id: "fire",      emoji: "🔥", label: "نار" },
]

function NewsReactions({ newsId }: { newsId: string }) {
  const [active, setActive] = useState<ReactionType | null>(null)
  const [busy, setBusy] = useState(false)

  // Load the user's existing reaction (if any) when the modal opens.
  useEffect(() => {
    let cancelled = false
    setActive(null)
    getMyReaction(newsId).then((r) => {
      if (cancelled) return
      setActive(r)
    })
    return () => {
      cancelled = true
    }
  }, [newsId])

  const handleClick = async (type: ReactionType) => {
    if (busy) return
    setBusy(true)
    // Optimistic toggle so the tap feels instant.
    const next: ReactionType | null = active === type ? null : type
    const previous = active
    setActive(next)

    const result = await setReaction(newsId, type)
    if (!result.success) {
      // Roll back on failure and surface a toast.
      setActive(previous)
      showError(result.error || "تعذّر حفظ التفاعل")
    } else {
      // Trust the server's view (handles edge-cases where DB state
      // diverged from client state — e.g. another tab reacted).
      setActive(result.reaction)
    }
    setBusy(false)
  }

  return (
    <div className="mt-5 pt-4 border-t border-white/[0.06]">
      <div className="text-[11px] text-neutral-400 mb-2">كيف وجدت هذا الإعلان؟</div>
      <div className="flex gap-1.5 flex-wrap">
        {REACTIONS.map((r) => {
          const selected = active === r.id
          return (
            <button
              key={r.id}
              onClick={() => handleClick(r.id)}
              disabled={busy}
              aria-label={r.label}
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                selected
                  ? "bg-white/[0.12] border-white/[0.25] text-white"
                  : "bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:bg-white/[0.08]",
                busy && "opacity-60 cursor-not-allowed",
              )}
            >
              <span className="text-base leading-none">{r.emoji}</span>
              <span className="text-[10px]">{r.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
