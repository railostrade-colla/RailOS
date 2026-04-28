"use client"

import { useState, useEffect } from "react"
import { Save, Send, Eye } from "lucide-react"
import {
  SectionHeader, InnerTabBar, ActionBtn, Badge,
} from "@/components/admin/ui"
import {
  MOCK_LEGAL_PAGES,
  LEGAL_PAGE_LABELS,
  updateLegalContent,
  type LegalPageId,
} from "@/lib/mock-data/legalPages"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

export function LegalPagesEditorPanel() {
  const [page, setPage] = useState<LegalPageId>("terms")
  const [content, setContent] = useState(MOCK_LEGAL_PAGES.terms.content)
  const [originalContent, setOriginalContent] = useState(MOCK_LEGAL_PAGES.terms.content)
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    const c = MOCK_LEGAL_PAGES[page].content
    setContent(c)
    setOriginalContent(c)
  }, [page])

  const meta = MOCK_LEGAL_PAGES[page]
  const label = LEGAL_PAGE_LABELS[page]
  const hasChanges = content !== originalContent

  const handleSave = () => {
    if (!hasChanges) return showError("لا تغييرات لحفظها")
    const result = updateLegalContent(page, content, false)
    if (result.success) {
      showSuccess(`💾 تم الحفظ — الإصدار ${result.version}`)
      setOriginalContent(content)
    }
  }

  const handlePublish = () => {
    if (!content.trim()) return showError("المحتوى فارغ")
    const result = updateLegalContent(page, content, true)
    if (result.success) {
      showSuccess(`📤 تم النشر للصفحة العامّة (${label.route}) — الإصدار ${result.version}`)
      setOriginalContent(content)
    }
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
        <Badge label={`الإصدار ${meta.version}`} color="blue" />
        <Badge label={meta.is_published ? "منشور" : "مسودّة"} color={meta.is_published ? "green" : "yellow"} />
        <span className="text-[11px] text-neutral-400">
          آخر تعديل: <span className="text-white font-bold">{meta.last_updated_by}</span> ({meta.last_updated_at})
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
        <ActionBtn label="💾 حفظ التغييرات" color="gray" onClick={handleSave} disabled={!hasChanges} />
        <ActionBtn label="📤 نشر للصفحة العامّة" color="green" onClick={handlePublish} />
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
