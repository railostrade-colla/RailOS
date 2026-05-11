"use client"

/**
 * NewsAdminPanel — Phase 13.63.
 *
 * Replaces the legacy LegalPagesEditorPanel inside Admin → Content.
 * Lets the admin create / edit / delete news that lights up:
 *   • Dashboard "📰 آخر الأخبار" card
 *   • Market page → news tab
 *   • /news/[id] detail page (with reactions + comments)
 *
 * Cover image is uploaded to the `news-images` bucket (admin RLS).
 */

import { useEffect, useState } from "react"
import {
  Plus, Pencil, Trash2, X, Upload, Pin,
  Eye, EyeOff, Heart, RefreshCw,
} from "lucide-react"
import { ActionBtn, SectionHeader } from "@/components/admin/ui"
import { adminGetAllNews, type DBNews } from "@/lib/data/news"
import {
  adminCreateNews, adminUpdateNews, adminDeleteNews,
  uploadNewsImage,
} from "@/lib/data/news-admin"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

type NewsType = "announcement" | "market_update" | "project_news" | "platform_update" | "educational"

const NEWS_TYPES: { value: NewsType; label: string; icon: string }[] = [
  { value: "announcement",   label: "إعلان عام",     icon: "📢" },
  { value: "market_update",  label: "تحديث سوق",     icon: "📈" },
  { value: "project_news",   label: "أخبار مشروع",   icon: "🏗️" },
  { value: "platform_update",label: "تحديث منصّة",   icon: "⚙️" },
  { value: "educational",    label: "محتوى تعليمي",  icon: "📚" },
]

interface FormState {
  id?: string
  title: string
  summary: string
  content: string
  news_type: NewsType
  cover_image_url: string
  is_pinned: boolean
  is_published: boolean
}

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  content: "",
  news_type: "announcement",
  cover_image_url: "",
  is_pinned: false,
  is_published: true,
}

const fmtDate = (s?: string): string => {
  if (!s) return "—"
  try { return new Date(s).toLocaleString("en-GB") } catch { return s }
}

export function NewsAdminPanel() {
  const [items, setItems] = useState<DBNews[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DBNews | null>(null)

  const reload = () => {
    setLoading(true)
    adminGetAllNews(100).then((rows) => {
      setItems(rows)
      setLoading(false)
    })
  }

  useEffect(() => { reload() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (n: DBNews) => {
    setForm({
      id: n.id,
      title: n.title ?? "",
      summary: n.summary ?? "",
      content: n.content ?? "",
      news_type: (n.news_type ?? "announcement") as NewsType,
      cover_image_url: n.cover_image_url ?? "",
      is_pinned: !!n.is_pinned,
      is_published: !!n.is_published,
    })
    setShowForm(true)
  }

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    const r = await uploadNewsImage(file)
    setUploading(false)
    if ("error" in r) {
      showError(r.error)
      return
    }
    setForm((f) => ({ ...f, cover_image_url: r.url }))
    showSuccess("✅ تم رفع الصورة")
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || form.title.trim().length < 3) {
      return showError("العنوان مطلوب (3 أحرف على الأقل)")
    }
    if (!form.content.trim()) {
      return showError("المحتوى مطلوب")
    }
    setSubmitting(true)
    const r = form.id
      ? await adminUpdateNews({
          news_id: form.id,
          title: form.title,
          content: form.content,
          summary: form.summary || undefined,
          news_type: form.news_type,
          cover_image_url: form.cover_image_url || undefined,
          is_pinned: form.is_pinned,
          is_published: form.is_published,
        })
      : await adminCreateNews({
          title: form.title,
          content: form.content,
          summary: form.summary || undefined,
          news_type: form.news_type,
          cover_image_url: form.cover_image_url || undefined,
          is_pinned: form.is_pinned,
          publish: form.is_published,
        })
    setSubmitting(false)
    if (!r.success) {
      const map: Record<string, string> = {
        unauthenticated: "سجّل دخولك أولاً",
        not_admin: "صلاحياتك لا تسمح",
        invalid_title: "العنوان غير صالح",
        invalid_content: "المحتوى غير صالح",
        not_found: "الخبر غير موجود",
      }
      showError(map[r.error ?? ""] ?? r.error ?? "فشل الحفظ")
      return
    }
    showSuccess(form.id ? "✅ تم تحديث الخبر" : "✅ تم نشر الخبر")
    setShowForm(false)
    setForm(EMPTY_FORM)
    reload()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    const r = await adminDeleteNews(deleteTarget.id)
    setSubmitting(false)
    if (!r.success) {
      showError(r.error ?? "فشل الحذف")
      return
    }
    showSuccess("تم حذف الخبر")
    setDeleteTarget(null)
    reload()
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="📰 الأخبار"
        subtitle="نشر الأخبار التي تظهر في الرئيسيّة + صفحة السوق"
      />

      <div className="flex flex-wrap gap-2">
        <ActionBtn label="➕ خبر جديد" color="purple" onClick={openCreate} />
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[12px] text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} strokeWidth={2} />
          تحديث
        </button>
      </div>

      {/* News list */}
      {loading ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center text-xs text-neutral-500 animate-pulse">
          جاري التحميل…
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2 opacity-50">📰</div>
          <div className="text-sm font-bold text-white">لا توجد أخبار بعد</div>
          <div className="text-xs text-neutral-500 mt-1">انشر أوّل خبر باستخدام زر «خبر جديد»</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const typeMeta = NEWS_TYPES.find((t) => t.value === n.news_type) ?? NEWS_TYPES[0]
            return (
              <div
                key={n.id}
                className={cn(
                  "bg-white/[0.04] border rounded-2xl p-4 flex items-start gap-3",
                  n.is_pinned ? "border-[#deff9a]/30" : "border-white/[0.08]",
                )}
              >
                {n.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.cover_image_url} alt={n.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-white/[0.08]" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-2xl flex-shrink-0">
                    {typeMeta.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-white truncate">{n.title}</span>
                    {n.is_pinned && <Pin className="w-3 h-3 text-[#deff9a]" strokeWidth={2.5} />}
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                      n.is_published
                        ? "bg-green-400/[0.12] border-green-400/[0.3] text-green-400"
                        : "bg-neutral-500/[0.12] border-neutral-500/[0.3] text-neutral-400",
                    )}>
                      {n.is_published ? "منشور" : "مسودة"}
                    </span>
                    <span className="text-[9px] text-neutral-500">{typeMeta.icon} {typeMeta.label}</span>
                  </div>
                  {n.summary && (
                    <div className="text-[11px] text-neutral-400 leading-snug line-clamp-2 mb-1">
                      {n.summary}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                    <span>{fmtDate(n.published_at ?? n.created_at)}</span>
                    <span className="flex items-center gap-0.5">
                      <Eye className="w-3 h-3" /> {n.views_count ?? 0}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-3 h-3" /> {n.reactions_count ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(n)}
                    className="bg-blue-400/[0.1] border border-blue-400/[0.25] text-blue-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    تعديل
                  </button>
                  <button
                    onClick={() => setDeleteTarget(n)}
                    className="bg-red-400/[0.1] border border-red-400/[0.18] text-red-400 rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    حذف
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start lg:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border-2 border-purple-400/40 rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex justify-between items-start mb-4">
              <div className="text-base font-bold text-white">
                {form.id ? "✏️ تعديل خبر" : "➕ خبر جديد"}
              </div>
              <button
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Cover image */}
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block font-bold">صورة الغلاف</label>
                {form.cover_image_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.cover_image_url} alt="cover" className="w-full h-40 rounded-xl object-cover border border-white/[0.08]" />
                    <button
                      onClick={() => setForm((f) => ({ ...f, cover_image_url: "" }))}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center"
                      aria-label="حذف الصورة"
                    >
                      <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    "w-full bg-white/[0.04] border-2 border-dashed border-white/[0.15] rounded-xl p-6 hover:border-white/[0.25] transition-colors flex flex-col items-center gap-2 cursor-pointer",
                    uploading && "opacity-50 cursor-not-allowed",
                  )}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleImageUpload(f)
                        e.target.value = ""
                      }}
                      className="hidden"
                    />
                    {uploading ? (
                      <>
                        <RefreshCw className="w-6 h-6 text-neutral-400 animate-spin" strokeWidth={1.5} />
                        <span className="text-xs text-neutral-400">جاري الرفع…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-neutral-400" strokeWidth={1.5} />
                        <span className="text-xs text-neutral-300 font-bold">رفع صورة</span>
                        <span className="text-[10px] text-neutral-500">PNG / JPG / WEBP — أقصى 5MB</span>
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block font-bold">العنوان *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="مثلاً: إطلاق ميزة البيع المباشر للنظام"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                />
              </div>

              {/* Type + Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block font-bold">نوع الخبر</label>
                  <select
                    value={form.news_type}
                    onChange={(e) => setForm((f) => ({ ...f, news_type: e.target.value as NewsType }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-purple-400/40"
                  >
                    {NEWS_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-[#0f0f0f]">
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                      className="w-4 h-4 accent-[#deff9a]"
                    />
                    <Pin className="w-3.5 h-3.5 text-[#deff9a]" />
                    تثبيت
                  </label>
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                      className="w-4 h-4 accent-green-400"
                    />
                    {form.is_published
                      ? <Eye className="w-3.5 h-3.5 text-green-400" />
                      : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
                    منشور
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block font-bold">ملخّص (اختياري)</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="سطر مختصر يظهر في بطاقة الخبر بالرئيسيّة..."
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40 resize-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block font-bold">المحتوى *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="اكتب نصّ الخبر بالكامل — يمكنك استخدام أسطر فارغة للفقرات..."
                  rows={8}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-400/40 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className="flex-1 py-3 rounded-xl bg-purple-500/[0.18] border border-purple-500/[0.4] text-purple-300 text-sm font-bold hover:bg-purple-500/[0.25] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting
                  ? "جارٍ..."
                  : form.id
                    ? <><Pencil className="w-4 h-4" /> حفظ التعديلات</>
                    : <><Plus className="w-4 h-4" /> نشر الخبر</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-red-400/40 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <div className="text-base font-bold text-white">حذف الخبر</div>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
                className="text-neutral-500 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-red-400/[0.05] border border-red-400/[0.2] rounded-xl p-3 mb-4 text-xs text-red-300 leading-relaxed">
              ⚠ سيتم حذف الخبر "<b className="text-white">{deleteTarget.title}</b>" وكل التعليقات والإعجابات المرتبطة به. الإجراء نهائي.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-red-500/[0.18] border border-red-500/[0.4] text-red-300 text-sm font-bold hover:bg-red-500/[0.25] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {submitting ? "جارٍ..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

