"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, Send, Eye } from "lucide-react"
import {
  SectionHeader, InnerTabBar, ActionBtn, Badge,
} from "@/components/admin/ui"
import {
  MOCK_LEGAL_PAGES,
  LEGAL_PAGE_LABELS,
  type LegalPageId,
} from "@/lib/mock-data/legalPages"
import {
  getLegalPageBySlug,
  adminUpsertLegalPage,
  type LegalPageRow,
} from "@/lib/data/legal-pages"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

// Legacy mock ids → new DB slugs (legal_faq has no DB twin yet)
const SLUG_MAP: Record<LegalPageId, string> = {
  terms: "terms",
  privacy: "privacy",
  legal_faq: "legal_faq",
}

export function LegalPagesEditorPanel() {
  const [page, setPage] = useState<LegalPageId>("terms")
  const [content, setContent] = useState(MOCK_LEGAL_PAGES.terms.content)
  const [originalContent, setOriginalContent] = useState(MOCK_LEGAL_PAGES.terms.content)
  const [showPreview, setShowPreview] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // Live row from DB; null until loaded.
  const [dbRow, setDbRow] = useState<LegalPageRow | null>(null)

  const loadPage = useCallback(async (id: LegalPageId) => {
    // First-paint with mock so the UI never blanks.
    const mockContent = MOCK_LEGAL_PAGES[id].content
    setContent(mockContent)
    setOriginalContent(mockContent)
    // Then fetch real DB content.
    const row = await getLegalPageBySlug(SLUG_MAP[id])
    if (row) {
      setDbRow(row)
      setContent(row.content)
      setOriginalContent(row.content)
    } else {
      setDbRow(null)
    }
  }, [])

  useEffect(() => {
    loadPage(page)
  }, [page, loadPage])

  const meta = MOCK_LEGAL_PAGES[page]
  const label = LEGAL_PAGE_LABELS[page]
  const hasChanges = content !== originalContent

  // Display values prefer DB row; fall back to mock.
  const versionLabel = dbRow?.version ?? meta.version
  const isPublished = dbRow?.is_published ?? meta.is_published
  const lastBy = dbRow ? "الإدارة" : meta.last_updated_by
  const lastAt = dbRow?.updated_at?.split("T")[0] ?? meta.last_updated_at

  const handleSave = async () => {
    if (!hasChanges) return showError("لا تغييرات لحفظها")
    setSubmitting(true)
    const result = await adminUpsertLegalPage({
      slug: SLUG_MAP[page],
      title: label.label,
      content,
      publish: false,
    })
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_slug: "معرّف الصفحة غير صحيح",
        invalid_input: "المحتوى أو العنوان فارغ",
        missing_table: "جدول legal_pages غير منشور بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل الحفظ")
      return
    }
    showSuccess(`💾 تم الحفظ — الإصدار ${result.version ?? "—"}`)
    setOriginalContent(content)
    loadPage(page)
  }

  const handlePublish = async () => {
    if (!content.trim()) return showError("المحتوى فارغ")
    setSubmitting(true)
    const result = await adminUpsertLegalPage({
      slug: SLUG_MAP[page],
      title: label.label,
      content,
      publish: true,
    })
    setSubmitting(false)
    if (!result.success) {
      const map: Record<string, string> = {
        not_admin: "صلاحياتك لا تسمح",
        invalid_slug: "معرّف الصفحة غير صحيح",
        invalid_input: "المحتوى أو العنوان فارغ",
        missing_table: "جدول legal_pages غير منشور بعد",
      }
      showError(map[result.reason ?? ""] ?? "فشل النشر")
      return
    }
    showSuccess(`📤 تم النشر (${label.route}) — الإصدار ${result.version ?? "—"}`)
    setOriginalContent(content)
    loadPage(page)
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      <SectionHeader
        title="📜 محرّر الصفحات القانونية"
        subtitle="تعديل + معاينة + نشر مباشر للصفحات العامّة"
      />

      <InnerTabBar
        tabs={[
          { key: "terms",     label: `${LEGAL_PAGE_LABELS.terms.icon} ${LEGAL_PAGE_LABELS.terms.label}` },
          { key: "privacy",   label: `${LEGAL_PAGE_LABELS.privacy.icon} ${LEGAL_PAGE_LABELS.privacy.label}` },
          { key: "legal_faq", label: `${LEGAL_PAGE_LABELS.legal_faq.icon} ${LEGAL_PAGE_LABELS.legal_faq.label}` },
        ]}
        active={page}
        onSelect={(k) => setPage(k as LegalPageId)}
      />

      {/* Meta info */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
        <Badge label={`الإصدار ${versionLabel}`} color="blue" />
        <Badge label={isPublished ? "منشور" : "مسودّة"} color={isPublished ? "green" : "yellow"} />
        {dbRow ? (
          <Badge label="من DB" color="green" />
        ) : (
          <Badge label="بيانات افتراضية" color="yellow" />
        )}
        <span className="text-[11px] text-neutral-400">
          آخر تعديل: <span className="text-white font-bold">{lastBy}</span> ({lastAt})
        </span>
        <span className="text-[10px] text-neutral-500 mr-auto" dir="ltr">{label.route}</span>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          {showPreview ? "إخفاء المعاينة" : "إظهار المعاينة"}
        </button>
      </div>

      {/* Editor + Preview */}
      <div className={cn("grid gap-3", showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>

        {/* Editor */}
        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
          <div className="text-[11px] font-bold text-neutral-400 mb-2">✏️ المحرّر (Markdown)</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={28}
            className="w-full bg-black/[0.4] border border-white/[0.05] rounded-xl px-4 py-3 text-xs text-neutral-200 outline-none focus:border-white/20 resize-none font-mono leading-relaxed"
            dir="auto"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-neutral-500 font-mono">{content.length.toLocaleString("en-US")} حرف</span>
            {hasChanges && <span className="text-[10px] text-yellow-400 font-bold">● تغييرات غير محفوظة</span>}
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4">
            <div className="text-[11px] font-bold text-neutral-400 mb-2">👁️ المعاينة</div>
            <div className="bg-black/[0.4] border border-white/[0.05] rounded-xl p-5 max-h-[600px] overflow-y-auto">
              <div className="prose prose-invert text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap" style={{ direction: "rtl" }}>
                {content || <span className="text-neutral-600">— المحتوى فارغ —</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        <ActionBtn label={submitting ? "جاري الحفظ..." : "💾 حفظ التغييرات"} color="gray" onClick={handleSave} disabled={!hasChanges || submitting} />
        <ActionBtn label={submitting ? "جاري النشر..." : "📤 نشر للصفحة العامّة"} color="green" onClick={handlePublish} disabled={submitting} />
        {hasChanges && (
          <button
            onClick={() => setContent(originalContent)}
            className="px-4 py-1.5 text-xs rounded-md bg-white/[0.05] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.08]"
          >
            تراجع عن التغييرات
          </button>
        )}
      </div>

      <div className="mt-4 bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3 text-[11px] text-blue-400">
        💡 المحرّر يدعم Markdown أساسي — العناوين (#)، النقاط (-)، التشكيلات. النشر يحدّث الصفحة العامّة فوراً.
      </div>
    </div>
  )
}
