"use client"

/**
 * PaymentProofViewer — Phase 12.7.
 *
 * Shown on the deal page when the deal is past payment-submission
 * (status='payment_submitted' in DB / 'payment_confirmed' in the
 * mock-page enum). Loads the buyer's uploaded proof image + metadata
 * so the seller can verify the off-platform transfer before
 * releasing shares.
 */

import { useEffect, useState } from "react"
import { ZoomIn, X, Receipt, AlertTriangle, Loader2 } from "lucide-react"
import {
  getLatestDealProof,
  type DealPaymentProof,
} from "@/lib/data/deal-proof"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

const METHOD_LABEL: Record<string, string> = {
  zain_cash: "📱 زين كاش",
  master_card: "💳 ماستركارد",
  bank_transfer: "🏦 حوالة بنكية",
  other: "🔗 أخرى",
}

interface Props {
  dealId: string
  /** The amount the seller actually expects (deal.total_amount). */
  expectedAmount: number
  /** Optional title override. */
  title?: string
}

export function PaymentProofViewer({
  dealId,
  expectedAmount,
  title = "🧾 إثبات الدفع المُرفَق",
}: Props) {
  const [proof, setProof] = useState<DealPaymentProof | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    getLatestDealProof(dealId).then((p) => {
      if (cancelled) return
      setProof(p)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [dealId])

  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-center text-xs text-neutral-500">
        <Loader2 className="w-4 h-4 animate-spin ml-2" />
        جاري تحميل الإثبات...
      </div>
    )
  }

  if (!proof) {
    return (
      <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-yellow-200/80 leading-relaxed">
            لم يتم العثور على إثبات الدفع. ربما أُرسلت الصفقة مباشرة بدون
            إرفاق إثبات — راجع البيانات قبل تحرير الحصص.
          </div>
        </div>
      </div>
    )
  }

  const amountMatch = proof.amount_paid === expectedAmount
  const methodLabel = METHOD_LABEL[proof.payment_method] ?? proof.payment_method

  return (
    <>
      <div className="bg-gradient-to-br from-blue-400/[0.05] to-green-400/[0.05] border border-blue-400/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-400" strokeWidth={2} />
          <div className="text-xs font-bold text-white">{title}</div>
        </div>

        {/* Image */}
        {proof.proof_image_url && (
          <button
            onClick={() => setZoomed(true)}
            className="block w-full bg-black border border-white/[0.08] rounded-lg overflow-hidden relative group"
          >
            <img
              src={proof.proof_image_url}
              alt="إثبات الدفع"
              className="w-full h-auto max-h-72 object-contain mx-auto"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
              <ZoomIn className="w-6 h-6 text-white" />
            </div>
          </button>
        )}

        {/* Details */}
        <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3 space-y-2">
          <Row label="طريقة الدفع" value={methodLabel} />
          <Row
            label="المبلغ المُرفَق"
            value={`${fmtNum(proof.amount_paid)} د.ع`}
            valueColor={amountMatch ? "text-green-400" : "text-yellow-400"}
            mono
          />
          {!amountMatch && (
            <div className="bg-yellow-400/[0.06] border border-yellow-400/20 rounded p-2 text-[10px] text-yellow-300 leading-relaxed">
              ⚠ المبلغ المُرفَق يختلف عن المتوقَّع (
              <span className="font-mono">{fmtNum(expectedAmount)}</span>{" "}
              د.ع). راجع قبل تحرير الحصص.
            </div>
          )}
          {proof.transaction_reference && (
            <Row label="رقم العملية" value={proof.transaction_reference} mono dirLtr />
          )}
          {proof.notes && (
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="text-[10px] text-neutral-500 mb-1">ملاحظة المشتري:</div>
              <div className="text-xs text-neutral-200 leading-relaxed">{proof.notes}</div>
            </div>
          )}
          <Row
            label="وقت الإرسال"
            value={new Date(proof.submitted_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>
      </div>

      {/* Zoom modal */}
      {zoomed && proof.proof_image_url && (
        <div
          onClick={() => setZoomed(false)}
          className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setZoomed(false)
            }}
            className="absolute top-4 left-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={proof.proof_image_url}
            alt="إثبات الدفع"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

function Row({
  label,
  value,
  mono,
  dirLtr,
  valueColor,
}: {
  label: string
  value: string
  mono?: boolean
  dirLtr?: boolean
  valueColor?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] text-neutral-500 shrink-0">{label}</span>
      <span
        className={cn(
          "text-xs font-bold text-left",
          mono && "font-mono",
          valueColor ?? "text-white",
        )}
        dir={dirLtr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  )
}
