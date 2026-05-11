"use client"

/**
 * News detail page — Phase 13.63.
 *
 * Renders a single news item with:
 *   • Cover image (large)
 *   • Title, summary, full content
 *   • Reactions strip (5 types) — live counts via realtime
 *   • Comments section — post, list, delete (own/admin)
 *
 * Realtime subscribes to news_comments + news_reactions for this
 * news_id so the page updates without reload.
 */

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Heart, MessageCircle, Eye, Send, Trash2, ChevronRight,
  ThumbsUp, Sparkles, PartyPopper, Flame,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { getNewsById, incrementNewsViews, type DBNews } from "@/lib/data/news"
import {
  getMyReaction, setReaction, type ReactionType,
} from "@/lib/data/news-reactions"
import {
  getNewsComments, submitNewsComment, deleteNewsComment,
  type NewsComment,
} from "@/lib/data/news-comments"
import { createClient } from "@/lib/supabase/client"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const REACTIONS: { type: ReactionType; icon: typeof Heart; label: string; color: string }[] = [
  { type: "like",      icon: ThumbsUp,    label: "إعجاب",  color: "text-blue-400" },
  { type: "love",      icon: Heart,       label: "حبّ",     color: "text-red-400" },
  { type: "celebrate", icon: PartyPopper, label: "احتفال", color: "text-yellow-400" },
  { type: "applause",  icon: Sparkles,    label: "تصفيق",  color: "text-purple-400" },
  { type: "fire",      icon: Flame,       label: "ناري",   color: "text-orange-400" },
]

const fmtDateTime = (s?: string): string => {
  if (!s) return ""
  try { return new Date(s).toLocaleString("en-GB") } catch { return s }
}

const fmtRelative = (s?: string): string => {
  if (!s) return ""
  try {
    const d = new Date(s).getTime()
    const diff = Date.now() - d
    if (diff < 60_000) return "الآن"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} دقيقة`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ساعة`
    if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} يوم`
    return new Date(s).toLocaleDateString("en-GB")
  } catch { return s }
}

export default function NewsDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params?.id as string) || ""

  const [news, setNews] = useState<DBNews | null>(null)
  const [loading, setLoading] = useState(true)
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null)
  const [reactingType, setReactingType] = useState<ReactionType | null>(null)
  const [comments, setComments] = useState<NewsComment[]>([])
  const [commentText, setCommentText] = useState("")
  const [posting, setPosting] = useState(false)

  const reloadNews = useCallback(async () => {
    const n = await getNewsById(id)
    setNews(n)
  }, [id])

  const reloadComments = useCallback(async () => {
    const c = await getNewsComments(id, 200)
    setComments(c)
  }, [id])

  // Initial paint + view increment.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getNewsById(id),
      getNewsComments(id, 200),
      getMyReaction(id),
    ]).then(([n, c, r]) => {
      if (cancelled) return
      setNews(n)
      setComments(c)
      setMyReaction(r)
      setLoading(false)
    })
    // Fire-and-forget view counter.
    incrementNewsViews(id).catch(() => {})
    return () => { cancelled = true }
  }, [id])

  // Realtime — react to comment + reaction changes for this news_id.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const debounceCommentReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { if (!cancelled) reloadComments() }, 250)
    }
    const debounceNewsReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { if (!cancelled) reloadNews() }, 250)
    }

    const channel = supabase
      .channel(`news:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "news_comments", filter: `news_id=eq.${id}` },
        () => debounceCommentReload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "news_reactions", filter: `news_id=eq.${id}` },
        () => debounceNewsReload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "news", filter: `id=eq.${id}` },
        () => debounceNewsReload(),
      )
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [id, reloadComments, reloadNews])

  const handleReact = async (type: ReactionType) => {
    setReactingType(type)
    const r = await setReaction(id, type)
    setReactingType(null)
    if (!r.success) {
      showError(r.error ?? "فشل تسجيل التفاعل")
      return
    }
    setMyReaction(r.reaction)
    // Realtime will reload the count.
  }

  const handleSubmitComment = async () => {
    const text = commentText.trim()
    if (text.length < 1) return showError("اكتب تعليقاً")
    if (text.length > 2000) return showError("التعليق أكثر من 2000 حرف")
    setPosting(true)
    const r = await submitNewsComment(id, text)
    setPosting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        invalid_content: "محتوى التعليق غير صالح",
        news_not_found: "الخبر غير موجود",
        news_not_published: "الخبر غير منشور",
      }
      showError(map[r.error ?? ""] ?? "فشل نشر التعليق")
      return
    }
    setCommentText("")
    showSuccess("تم نشر التعليق")
    // Realtime will refresh the list within 250ms.
  }

  const handleDeleteComment = async (commentId: string) => {
    const r = await deleteNewsComment(commentId)
    if (!r.success) {
      showError(r.error ?? "فشل حذف التعليق")
      return
    }
    showSuccess("تم حذف التعليق")
  }

  const visibleReaction = useMemo(
    () => REACTIONS.find((r) => r.type === myReaction) ?? null,
    [myReaction],
  )

  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
          <div className="text-center py-20 text-xs text-neutral-500 animate-pulse">
            جاري التحميل…
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!news) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
          <div className="text-center py-20">
            <div className="text-4xl mb-2 opacity-50">📰</div>
            <div className="text-sm font-bold text-white">الخبر غير موجود</div>
            <button
              onClick={() => router.push("/")}
              className="mt-3 text-blue-400 text-xs hover:underline"
            >
              العودة إلى الرئيسيّة
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
          <PageHeader
            title="📰 الأخبار"
            description="اقرأ، تفاعَل وعلِّق"
            showBack
            backHref="/"
          />

          {/* Cover */}
          {news.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={news.cover_image_url}
              alt={news.title}
              className="w-full h-56 lg:h-72 rounded-2xl object-cover border border-white/[0.08] mb-4"
            />
          )}

          {/* Header */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-4">
            <h1 className="text-xl lg:text-2xl font-bold text-white mb-2 leading-tight">
              {news.title}
            </h1>
            {news.summary && (
              <p className="text-sm text-neutral-300 leading-relaxed mb-3">{news.summary}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-neutral-500" dir="ltr">
              <span>{fmtDateTime(news.published_at ?? news.created_at)}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Eye className="w-3 h-3" /> {news.views_count ?? 0}
              </span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Heart className="w-3 h-3" /> {news.reactions_count ?? 0}
              </span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MessageCircle className="w-3 h-3" /> {comments.length}
              </span>
            </div>
          </div>

          {/* Body */}
          {news.content && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-4">
              <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {news.content}
              </div>
            </div>
          )}

          {/* Reactions strip */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 mb-4">
            <div className="text-[11px] text-neutral-400 font-bold mb-3">تفاعل مع الخبر</div>
            <div className="flex flex-wrap gap-2">
              {REACTIONS.map((r) => {
                const Icon = r.icon
                const active = myReaction === r.type
                const isLoading = reactingType === r.type
                return (
                  <button
                    key={r.type}
                    onClick={() => handleReact(r.type)}
                    disabled={isLoading}
                    className={cn(
                      "px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors",
                      active
                        ? "bg-white/[0.1] border-white/[0.25] text-white font-bold"
                        : "bg-white/[0.04] border-white/[0.08] text-neutral-400 hover:bg-white/[0.07] hover:text-white",
                      isLoading && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", active ? r.color : "")} strokeWidth={active ? 2.5 : 2} />
                    {r.label}
                  </button>
                )
              })}
            </div>
            {visibleReaction && (
              <div className="mt-2 text-[10px] text-neutral-400">
                تفاعلك الحالي: {visibleReaction.label} — اضغطه مرّة أخرى لإلغائه
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-neutral-400" />
              <div className="text-sm font-bold text-white">
                التعليقات ({comments.length})
              </div>
            </div>

            {/* Composer */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="اكتب تعليقك..."
                rows={3}
                maxLength={2000}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/20 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] text-neutral-500">
                  {commentText.length}/2000
                </div>
                <button
                  onClick={handleSubmitComment}
                  disabled={posting || !commentText.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5",
                    !posting && commentText.trim()
                      ? "bg-[#deff9a] text-black hover:bg-[#c9eb78]"
                      : "bg-white/[0.05] border border-white/[0.08] text-neutral-500 cursor-not-allowed",
                  )}
                >
                  <Send className="w-3 h-3" strokeWidth={2.5} />
                  {posting ? "جاري النشر..." : "نشر"}
                </button>
              </div>
            </div>

            {/* List */}
            {comments.length === 0 ? (
              <div className="text-center py-8 text-xs text-neutral-500">
                لا توجد تعليقات بعد — كن أوّل من يعلّق
              </div>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex gap-3"
                  >
                    {c.author_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.author_avatar}
                        alt={c.author_name}
                        className="w-9 h-9 rounded-full object-cover border border-white/[0.08] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {c.author_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-white">{c.author_name}</span>
                        <span className="text-[10px] text-neutral-500">{fmtRelative(c.created_at)}</span>
                        {c.is_mine && (
                          <span className="bg-blue-400/[0.12] border border-blue-400/[0.25] text-blue-400 text-[9px] font-bold px-1 py-0.5 rounded">
                            أنت
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
                        {c.content}
                      </div>
                    </div>
                    {c.is_mine && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
                        aria-label="حذف التعليق"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Back link */}
          <button
            onClick={() => router.back()}
            className="mt-5 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
            رجوع
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
