"use client"

import { useEffect, useState, use, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Printer, Download, Share2, Mail, MessageCircle, Copy, Check, ArrowLeft } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { Card, Modal } from "@/components/ui"
import { InvoiceQR } from "@/components/invoices/InvoiceQR"
import { getInvoiceById, INVOICE_TYPE_META, seedMockInvoices, type Invoice } from "@/lib/data/invoices"
import { showSuccess, showError } from "@/lib/utils/toast"
import { APP_NAME, APP_NAME_EN } from "@/lib/utils/version"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

function InvoiceContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = use(params)

  const [invoice, setInvoice] = useState<Invoice | undefined>()
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    seedMockInvoices()
    const found = getInvoiceById(id)
    setInvoice(found)

    // Auto-trigger print/share if URL params requested it
    if (found) {
      if (searchParams?.get("print") === "1") {
        setTimeout(() => window.print(), 500)
      }
      if (searchParams?.get("share") === "1") {
        setShowShare(true)
      }
    }
  }, [id, searchParams])

  if (!invoice) {
    return (
      <div className="relative">
        <GridBackground showCircles={false} />
        <div className="relative z-10 px-4 py-12 max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-4 opacity-50">🔍</div>
          <div className="text-lg font-bold text-white mb-2">الفاتورة غير موجودة</div>
          <div className="text-xs text-neutral-400 mb-6">قد يكون الرقم غير صحيح أو الفاتورة محذوفة</div>
          <button
            onClick={() => router.push("/invoices")}
            className="bg-neutral-100 text-black px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200"
          >
            عرض كل فواتيري
          </button>
        </div>
      </div>
    )
  }

  const meta = INVOICE_TYPE_META[invoice.type]
  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/invoices/${invoice.id}`
    : `/invoices/${invoice.id}`

  const handlePrint = () => {
    window.print()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      setCopied(true)
      showSuccess("📋 تم نسخ رابط الفاتورة")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError("تعذّر نسخ الرابط")
    }
  }

  const handleShareEmail = () => {
    const subject = `فاتورة رايلوس ${invoice.id}`
    const body = `إليكم نسخة من فاتورة رايلوس:\n\nالرقم: ${invoice.id}\nالمشروع: ${invoice.project_name}\nالكمية: ${invoice.shares_amount} حصة\nالإجمالي: ${fmtNum(invoice.total_amount)} د.ع\n\nالعقد الرسمي: ${verifyUrl}\n\nرايلوس — منصّة تنظيم الفرص الاستثمارية`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const handleShareWhatsApp = () => {
    const text = `📄 فاتورة رايلوس\n\n*الرقم:* ${invoice.id}\n*المشروع:* ${invoice.project_name}\n*الكمية:* ${invoice.shares_amount} حصة\n*الإجمالي:* ${fmtNum(invoice.total_amount)} د.ع\n\n*العقد الرسمي:* ${verifyUrl}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          [data-no-print] { display: none !important; }
          [data-print-area] {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            max-width: none !important;
            padding: 24px !important;
          }
          [data-print-area] * {
            color: black !important;
            border-color: #ddd !important;
            background: transparent !important;
          }
          [data-print-area] .qr-bg { background: white !important; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>

      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 max-w-3xl mx-auto pb-20">
          {/* Header — hidden in print */}
          <div data-no-print className="flex items-center justify-between mb-5">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center"
              aria-label="رجوع"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-300 rotate-180" strokeWidth={1.5} />
            </button>
            <div className="text-sm text-neutral-400">
              <span className="text-blue-400 font-mono" dir="ltr">{invoice.id}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="bg-neutral-100 hover:bg-neutral-200 text-black px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة / PDF
              </button>
              <button
                onClick={() => setShowShare(true)}
                className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                مشاركة
              </button>
            </div>
          </div>

          {/* ═══ Invoice (printable area) ═══ */}
          <div
            data-print-area
            className="bg-[#0f0f0f] border-2 border-white/[0.08] rounded-2xl p-6 lg:p-8 shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6 pb-5 border-b-2 border-white/[0.1]">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-black border border-white/[0.15] flex items-center justify-center text-2xl">
                    🚂
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{APP_NAME}</div>
                    <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                      {APP_NAME_EN}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-500 leading-relaxed">
                  منصّة تنظيم الفرص الاستثمارية
                  <br />
                  العراق • railostrade@gmail.com
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-wider">فاتورة رسمية</div>
                <div className="text-xs text-blue-400 font-mono mb-2" dir="ltr">{invoice.id}</div>
                <div
                  className={cn(
                    "inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                    "bg-green-400/[0.1] border-green-400/30 text-green-400"
                  )}
                >
                  ✅ {invoice.status === "issued" ? "صادرة + ساريّة" : "مُلغاة"}
                </div>
              </div>
            </div>

            {/* Type + dates */}
            <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
              <div>
                <div className="text-[10px] text-neutral-500 mb-1">نوع العملية</div>
                <div className="text-base font-bold text-white">
                  {meta.icon} {meta.label}
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-neutral-500 mb-1">تاريخ الإصدار</div>
                <div className="text-sm font-mono text-white" dir="ltr">{fmtDate(invoice.issued_at)}</div>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div className="bg-white/[0.04] border-2 border-white/[0.08] rounded-xl p-4">
                <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase tracking-wider">📤 من (الطرف الأول)</div>
                <div className="text-sm text-white font-bold mb-1">{invoice.from.name}</div>
                <div className="text-[10px] text-neutral-500 font-mono" dir="ltr">{invoice.from.id}</div>
                {invoice.from.email && (
                  <div className="text-[10px] text-neutral-500 mt-1" dir="ltr">{invoice.from.email}</div>
                )}
              </div>
              <div className="bg-white/[0.04] border-2 border-white/[0.08] rounded-xl p-4">
                <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase tracking-wider">📥 إلى (الطرف الثاني)</div>
                <div className="text-sm text-white font-bold mb-1">{invoice.to.name}</div>
                <div className="text-[10px] text-neutral-500 font-mono" dir="ltr">{invoice.to.id}</div>
                {invoice.to.email && (
                  <div className="text-[10px] text-neutral-500 mt-1" dir="ltr">{invoice.to.email}</div>
                )}
              </div>
            </div>

            {/* Project */}
            <div className="bg-blue-400/[0.05] border-2 border-blue-400/[0.2] rounded-xl p-4 mb-6">
              <div className="text-[10px] text-neutral-500 mb-2 font-bold uppercase tracking-wider">🏗️ المشروع</div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-base font-bold text-white">{invoice.project_name}</div>
                  {invoice.project_symbol && (
                    <div className="text-xs text-blue-400 font-mono mt-0.5" dir="ltr">{invoice.project_symbol}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Shares table */}
            <div className="mb-6 overflow-hidden rounded-xl border-2 border-white/[0.08]">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04]">
                  <tr>
                    <th className="text-right p-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">البند</th>
                    <th className="text-center p-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">الكمية</th>
                    <th className="text-center p-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">السعر للحصة</th>
                    <th className="text-left p-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-white/[0.06]">
                    <td className="p-3 text-white">حصص في {invoice.project_name}</td>
                    <td className="p-3 text-center font-mono text-white">{fmtNum(invoice.shares_amount)}</td>
                    <td className="p-3 text-center font-mono text-white">{fmtNum(invoice.price_per_share)} د.ع</td>
                    <td className="p-3 text-left font-mono text-white font-bold">{fmtNum(invoice.subtotal)} د.ع</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-2 mb-6 pb-6 border-b-2 border-white/[0.1]">
              <Row label="المجموع الفرعي" value={`${fmtNum(invoice.subtotal)} د.ع`} mono />
              {invoice.platform_fee_units > 0 && (
                <Row
                  label="رسوم المنصّة (مدفوعة بوحدات الرسوم)"
                  value={`${fmtNum(invoice.platform_fee_units)} وحدة`}
                  mono
                  muted
                />
              )}
              <div className="h-px bg-white/[0.1] my-2" />
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-white">الإجمالي النهائي</span>
                <span className="text-2xl font-bold text-yellow-400 font-mono">
                  {fmtNum(invoice.total_amount)} د.ع
                </span>
              </div>
            </div>

            {/* QR + Signature */}
            <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-5 items-center mb-6 pb-6 border-b-2 border-white/[0.1]">
              <div className="flex justify-center">
                <div className="qr-bg">
                  <InvoiceQR value={verifyUrl} size={140} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-1 font-bold uppercase tracking-wider">🔒 التوقيع الرقمي</div>
                <div className="text-xs font-mono text-blue-400 mb-3 break-all" dir="ltr">
                  {invoice.digital_signature}
                </div>
                <div className="text-[10px] text-neutral-400 leading-relaxed">
                  امسح الـ QR للتحقّق من صحّة الفاتورة + رابط النسخة الرسميّة على المنصّة.
                  هذا التوقيع الرقمي يُثبت صحّة وأصالة الفاتورة.
                </div>
              </div>
            </div>

            {/* Legal notice */}
            <div className="bg-yellow-400/[0.05] border-2 border-yellow-400/[0.2] rounded-xl p-4 mb-4">
              <div className="text-[10px] font-bold text-yellow-400 mb-1.5 uppercase tracking-wider">⚖️ إشعار قانوني</div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                هذه الفاتورة تُعتبر <span className="font-bold text-white">عقداً رسمياً</span> يثبت
                ملكية الحصص وتنفيذ العملية بين الطرفين عبر منصّة رايلوس. تحتفظ بحقوقك القانونية
                الكاملة بموجب هذه الوثيقة. أيّ تعديل أو تزوير يُعرّض صاحبه للملاحقة القانونية.
              </p>
            </div>

            {invoice.notes && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 mb-4">
                <div className="text-[10px] font-bold text-neutral-400 mb-1">ملاحظات</div>
                <div className="text-[11px] text-neutral-300 leading-relaxed">{invoice.notes}</div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-neutral-500 pt-4">
              صدرت من منصّة <span className="text-white font-bold">{APP_NAME}</span> ({APP_NAME_EN}) في{" "}
              <span dir="ltr">{fmtDate(invoice.completed_at)}</span>
              <br />
              للتحقّق امسح الـ QR أو زُر:{" "}
              <span className="text-blue-400" dir="ltr">{verifyUrl}</span>
            </div>
          </div>

          {/* Actions footer (hidden in print) */}
          <div data-no-print className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={handlePrint}
              className="bg-neutral-100 hover:bg-neutral-200 text-black py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" strokeWidth={2.5} />
              تنزيل / طباعة PDF
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" strokeWidth={2.5} />
              مشاركة
            </button>
          </div>

          {/* How to PDF tip */}
          <div data-no-print className="mt-4 bg-blue-400/[0.05] border border-blue-400/[0.2] rounded-xl p-3">
            <div className="text-[11px] text-blue-400 leading-relaxed">
              💡 <span className="font-bold">لتنزيل PDF:</span> اضغط "طباعة" واختر "حفظ كـ PDF" من خيارات الطابعة.
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title="📤 مشاركة الفاتورة"
        subtitle={invoice.id}
        size="sm"
      >
        <div className="space-y-2">
          <ShareButton
            icon={<Mail className="w-4 h-4 text-blue-400" />}
            label="عبر البريد الإلكتروني"
            description="إرسال نسخة كـ email"
            onClick={handleShareEmail}
          />
          <ShareButton
            icon={<MessageCircle className="w-4 h-4 text-green-400" />}
            label="عبر واتساب"
            description="إرسال رابط الفاتورة"
            onClick={handleShareWhatsApp}
          />
          <ShareButton
            icon={copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-yellow-400" />}
            label={copied ? "تم النسخ ✓" : "نسخ الرابط"}
            description="نسخ رابط الفاتورة للحافظة"
            onClick={handleCopy}
          />
        </div>
      </Modal>
    </>
  )
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppLayout hideFooter>
      <Suspense fallback={<div className="p-8 text-center text-neutral-500">جاري التحميل...</div>}>
        <InvoiceContent params={params} />
      </Suspense>
    </AppLayout>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
  muted,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={cn("text-xs", muted ? "text-neutral-500" : "text-neutral-400")}>{label}</span>
      <span className={cn("text-sm font-bold", mono && "font-mono", muted ? "text-neutral-400" : "text-white")}>
        {value}
      </span>
    </div>
  )
}

function ShareButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-3 text-right transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-[10px] text-neutral-500">{description}</div>
      </div>
    </button>
  )
}
