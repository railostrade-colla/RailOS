"use client"

import { useRouter } from "next/navigation"
import { FileText, Download, Share2, ChevronLeft } from "lucide-react"
import { Card, Badge } from "@/components/ui"
import { INVOICE_TYPE_META, type Invoice } from "@/lib/data/invoices"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

interface Props {
  invoice: Invoice
  /** يُعرَض كـ banner مكتمل أم compact (في القوائم). */
  variant?: "banner" | "compact"
}

/**
 * InvoiceCard — بطاقة الفاتورة المُختصرة (للظهور بعد إتمام عملية).
 *
 * ✅ تظهر تلقائياً في صفحة الصفقة المكتملة + بعد البيع السريع + التحويل + المزاد + إلخ.
 * 🔒 توضّح أن الفاتورة عقد رسمي للحصص.
 * 📄 زر "عرض كاملة" يفتح /invoices/[id] للطباعة + التنزيل + المشاركة.
 */
export function InvoiceCard({ invoice, variant = "banner" }: Props) {
  const router = useRouter()
  const meta = INVOICE_TYPE_META[invoice.type]

  if (variant === "compact") {
    return (
      <button
        onClick={() => router.push(`/invoices/${invoice.id}`)}
        className="w-full bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-3 transition-colors text-right"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono text-blue-400" dir="ltr">{invoice.id}</span>
          <Badge color={meta.color === "yellow" ? "yellow" : meta.color === "orange" ? "orange" : meta.color}>
            {meta.icon} {meta.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-white font-bold truncate flex-1 min-w-0">
            {invoice.project_name}
          </div>
          <div className="text-xs font-mono text-yellow-400 font-bold flex-shrink-0">
            {fmtNum(invoice.total_amount)} د.ع
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
          <span className="text-[10px] text-neutral-500" dir="ltr">
            {new Date(invoice.completed_at).toLocaleDateString("en-GB")}
          </span>
          <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
            عرض الفاتورة
            <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </button>
    )
  }

  // Banner variant (default — for completion screens)
  return (
    <Card variant="gradient" color="green">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-green-400/[0.15] border border-green-400/40 flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-green-400" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-bold text-white">📄 الفاتورة الرسمية</span>
            <Badge color="green">عقد ساري</Badge>
          </div>
          <div className="text-[11px] text-neutral-300 leading-relaxed mb-2">
            هذه الفاتورة عقد رسمي يثبت ملكيتك للحصص. احتفظ بنسخة منها لسجلاتك.
          </div>
          <div className="text-[10px] font-mono text-blue-400 mb-2" dir="ltr">
            {invoice.id}
          </div>
        </div>
      </div>

      {/* Quick details */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <DetailItem label="المشروع" value={invoice.project_name} />
        <DetailItem label="الكمية" value={`${fmtNum(invoice.shares_amount)} حصة`} mono />
        <DetailItem label="السعر للحصة" value={`${fmtNum(invoice.price_per_share)} د.ع`} mono />
        <DetailItem
          label="الإجمالي"
          value={`${fmtNum(invoice.total_amount)} د.ع`}
          mono
          highlight
        />
      </div>

      {/* Parties */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 mb-3 text-[11px]">
        <div className="flex justify-between gap-2 mb-1">
          <span className="text-neutral-500">من</span>
          <span className="text-white font-bold truncate">{invoice.from.name}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-neutral-500">إلى</span>
          <span className="text-white font-bold truncate">{invoice.to.name}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => router.push(`/invoices/${invoice.id}`)}
          className="bg-neutral-100 hover:bg-neutral-200 text-black py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" strokeWidth={2.5} />
          عرض كاملة
        </button>
        <button
          onClick={() => router.push(`/invoices/${invoice.id}?print=1`)}
          className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
          تنزيل
        </button>
        <button
          onClick={() => router.push(`/invoices/${invoice.id}?share=1`)}
          className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          مشاركة
        </button>
      </div>
    </Card>
  )
}

function DetailItem({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
      <div className="text-[10px] text-neutral-500 mb-0.5">{label}</div>
      <div
        className={cn(
          "text-sm font-bold",
          mono && "font-mono",
          highlight ? "text-yellow-400" : "text-white"
        )}
      >
        {value}
      </div>
    </div>
  )
}
