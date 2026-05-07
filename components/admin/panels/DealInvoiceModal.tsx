"use client"

/**
 * Phase 10.99f — Deal Invoice / Ownership Contract modal.
 *
 * Founder spec: "زر الفاتورة انشا نافذة لفاتورة عملية الشراء ويتم
 * تحميلها او حفضها وتكون هي عقد الاثبات الاساسي للحصص ... ضيف حقل
 * في الفاتورة اذا المشترك يملك الحصص يضهر مملوكة واذا لا يملك
 * الحصص يضهر غير مملوكة".
 *
 * Renders an A4-sized printable card with all deal details + an
 * ownership flag derived from the deal status:
 *   • status='completed' → "✓ مملوكة"
 *   • else                → "✗ غير مملوكة"
 *
 * Print/Save uses window.print() with a print-only stylesheet so
 * users can save as PDF from the browser dialog.
 */

import { useEffect } from "react"
import { X, Printer, Download } from "lucide-react"
import type { SharePurchaseRequestRow } from "@/lib/data/share-purchase-requests"

const fmtNum = (n: number) => n.toLocaleString("en-US")
const fmtMoney = (n: number) => fmtNum(n) + " د.ع"
const fmtDate = (iso: string | null | undefined) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  zain_cash:     "Zain Cash",
  master_card:   "Master Card",
  bank_transfer: "تحويل بنكي",
  asia_hawala:   "حوالة آسيا",
  ki_card:       "Ki Card",
  other:         "أخرى",
}

interface Props {
  open: boolean
  onClose: () => void
  deal: SharePurchaseRequestRow
}

export function DealInvoiceModal({ open, onClose, deal }: Props) {
  // Hide the rest of the page during print
  useEffect(() => {
    if (!open) return
    const styleEl = document.createElement("style")
    styleEl.id = "deal-invoice-print-style"
    styleEl.textContent = `
      @media print {
        body * { visibility: hidden; }
        #deal-invoice-printable, #deal-invoice-printable * { visibility: visible; }
        #deal-invoice-printable {
          position: absolute;
          left: 0; top: 0; width: 100%;
          background: white !important;
          color: black !important;
        }
        .invoice-no-print { display: none !important; }
      }
    `
    document.head.appendChild(styleEl)
    return () => { styleEl.remove() }
  }, [open])

  if (!open) return null

  const isOwned = deal.status === "completed"
  const pricePerShare = deal.shares_amount > 0
    ? Math.round(deal.total_amount / deal.shares_amount)
    : 0
  const paymentMethodLabel = deal.payment_proof
    ? PAYMENT_METHOD_LABELS[deal.payment_proof.payment_method] ?? "—"
    : "—"

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 invoice-no-print">
      <div className="w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        {/* Header bar */}
        <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-t-2xl px-5 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="text-sm font-bold text-white">📄 فاتورة عقد ملكية الحصص</div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-500/[0.15] border border-blue-500/[0.3] text-blue-400 text-xs font-bold hover:bg-blue-500/[0.2] flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> طباعة
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-green-500/[0.15] border border-green-500/[0.3] text-green-400 text-xs font-bold hover:bg-green-500/[0.2] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> حفظ PDF
            </button>
            <button onClick={onClose} className="text-neutral-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div
          id="deal-invoice-printable"
          className="bg-white text-black p-8 font-sans"
          dir="rtl"
          style={{ minHeight: "29.7cm" }}
        >
          {/* Brand header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-2xl font-bold tracking-tight">RailOS</div>
              <div className="text-xs text-gray-600 mt-1">منصة رايلوس للاستثمار في الحصص</div>
            </div>
            <div className="text-left">
              <div className="text-xs text-gray-600">رقم الفاتورة</div>
              <div className="font-mono text-sm font-bold" dir="ltr">#{deal.id.slice(0, 12).toUpperCase()}</div>
              <div className="text-xs text-gray-600 mt-2">التاريخ</div>
              <div className="font-mono text-xs" dir="ltr">{fmtDate(deal.created_at)}</div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <div className="text-xl font-bold mb-1">عقد ملكية حصص استثمارية</div>
            <div className="text-xs text-gray-600">
              يُعدّ هذا المستند الإثبات الرسمي لملكية الحصص المُحدَّدة أدناه
            </div>
          </div>

          {/* Ownership status banner */}
          <div className={
            isOwned
              ? "border-2 border-green-600 bg-green-50 rounded-lg p-4 mb-6 flex items-center justify-center gap-3"
              : "border-2 border-orange-500 bg-orange-50 rounded-lg p-4 mb-6 flex items-center justify-center gap-3"
          }>
            <div className={isOwned ? "text-3xl text-green-600" : "text-3xl text-orange-600"}>
              {isOwned ? "✓" : "⏳"}
            </div>
            <div>
              <div className={
                isOwned
                  ? "text-lg font-bold text-green-700"
                  : "text-lg font-bold text-orange-700"
              }>
                {isOwned ? "حصص مملوكة" : "حصص غير مملوكة"}
              </div>
              <div className="text-xs text-gray-700 mt-0.5">
                {isOwned
                  ? "تم تأكيد الدفع وتحويل الحصص إلى المالك"
                  : "بانتظار تأكيد الدفع من قبل الإدارة"}
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">المشتري</div>
              <div className="text-base font-bold">{deal.buyer_name}</div>
              {deal.buyer_email && (
                <div className="text-xs text-gray-600 mt-1" dir="ltr">{deal.buyer_email}</div>
              )}
              {deal.buyer_username && (
                <div className="text-xs text-gray-600" dir="ltr">@{deal.buyer_username}</div>
              )}
              <div className="text-[10px] text-gray-500 mt-1 font-mono" dir="ltr">
                ID: {deal.buyer_id.slice(0, 12)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">البائع / الجهة</div>
              <div className="text-base font-bold">{deal.seller_name}</div>
              {deal.seller_username && (
                <div className="text-xs text-gray-600 mt-1" dir="ltr">@{deal.seller_username}</div>
              )}
              <div className="text-[10px] text-gray-500 mt-1 font-mono" dir="ltr">
                ID: {deal.seller_id.slice(0, 12)}
              </div>
            </div>
          </div>

          {/* Project + shares table */}
          <div className="border-2 border-black rounded mb-6 overflow-hidden">
            <div className="bg-black text-white px-4 py-2 text-sm font-bold">
              تفاصيل الحصص
            </div>
            <table className="w-full text-sm" dir="rtl">
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="px-4 py-3 text-gray-600 w-1/3">اسم المشروع</td>
                  <td className="px-4 py-3 font-bold">{deal.project_name ?? "—"}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-4 py-3 text-gray-600">رقم المشروع</td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">{deal.project_id}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-4 py-3 text-gray-600">عدد الحصص</td>
                  <td className="px-4 py-3 font-mono font-bold text-base">{fmtNum(deal.shares_amount)} حصة</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="px-4 py-3 text-gray-600">سعر الحصة الواحدة</td>
                  <td className="px-4 py-3 font-mono">{fmtMoney(pricePerShare)}</td>
                </tr>
                <tr className="bg-gray-100 border-b-2 border-black">
                  <td className="px-4 py-3 text-gray-700 font-bold">الإجمالي</td>
                  <td className="px-4 py-3 font-mono font-bold text-lg">{fmtMoney(deal.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment details */}
          <div className="border border-gray-300 rounded mb-6 overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 text-sm font-bold">معلومات الدفع</div>
            <table className="w-full text-sm" dir="rtl">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600 w-1/3">طريقة الدفع</td>
                  <td className="px-4 py-2 font-bold">{paymentMethodLabel}</td>
                </tr>
                {deal.payment_proof?.amount_paid !== undefined && (
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-600">المبلغ المُحوَّل</td>
                    <td className="px-4 py-2 font-mono">{fmtMoney(deal.payment_proof.amount_paid)}</td>
                  </tr>
                )}
                {deal.payment_proof?.transaction_reference && (
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-600">رقم المرجع</td>
                    <td className="px-4 py-2 font-mono text-xs" dir="ltr">
                      {deal.payment_proof.transaction_reference}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-2 text-gray-600">حالة الصفقة</td>
                  <td className="px-4 py-2 font-bold">
                    {isOwned ? "مكتملة (الحصص محوّلة)" : "بانتظار التأكيد"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Proof image */}
          {deal.payment_proof?.proof_image_url && (
            <div className="border border-gray-300 rounded p-3 mb-6">
              <div className="text-xs font-bold text-gray-700 mb-2">صورة إثبات الدفع</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={deal.payment_proof.proof_image_url}
                alt="إثبات الدفع"
                className="max-w-full max-h-64 object-contain mx-auto"
              />
            </div>
          )}

          {/* Footer / signatures */}
          <div className="border-t border-gray-300 pt-6 grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="border-t-2 border-black pt-2 mt-12">
                <div className="text-xs font-bold">توقيع المشتري</div>
                <div className="text-[10px] text-gray-600 mt-1">{deal.buyer_name}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-black pt-2 mt-12">
                <div className="text-xs font-bold">إدارة منصة RailOS</div>
                <div className="text-[10px] text-gray-600 mt-1">ختم الإدارة</div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 pt-4 border-t border-gray-300 text-[10px] text-gray-500 leading-relaxed">
            هذا المستند مُولَّد إلكترونياً من منصة RailOS ويُعدّ صالحاً بدون توقيع يدوي بموجب
            البصمة الإلكترونية المُسجَّلة في قاعدة البيانات. للتحقق من صحة هذا العقد يُرجى الرجوع
            إلى صفحة الصفقة برقم: <span className="font-mono" dir="ltr">{deal.id}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
