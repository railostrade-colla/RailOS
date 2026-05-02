"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Shield, AlertTriangle, Flag, Zap, X } from "lucide-react"
import {
  cancelListing,
  computeSuccessRate,
  openQuickSaleDeal,
  QS_BUYER_COMMISSION_PCT,
  type QuickSaleListing,
} from "@/lib/data/quick-sale"
import { showError, showSuccess } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"

interface Props {
  listing: QuickSaleListing
  onUpdate: () => void
}

const fmtIQD = (n: number) => n.toLocaleString("en-US")

export function QuickSaleListingCard({ listing, onUpdate }: Props) {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [quantity, setQuantity] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  const isOwner = currentUserId === listing.user_id
  const isSell = listing.type === "sell"
  const successRate = computeSuccessRate(listing.user)
  const hasDisputes = (listing.user?.disputes_total ?? 0) > 0
  const hasReports = (listing.user?.reports_received ?? 0) > 0

  const qtyNum = parseInt(quantity) || 0
  const totalAmount = qtyNum * listing.final_price
  const commission = Math.floor(totalAmount * QS_BUYER_COMMISSION_PCT)

  async function handleOpenDeal() {
    if (!qtyNum || qtyNum < 1) {
      showError("أدخل كمية صحيحة")
      return
    }
    if (!listing.is_unlimited && qtyNum > listing.available_shares) {
      showError(`المتوفّر فقط ${listing.available_shares} حصة`)
      return
    }

    setSubmitting(true)
    try {
      const deal = await openQuickSaleDeal({
        listing_id: listing.id,
        quantity: qtyNum,
      })
      showSuccess("✅ تم فتح الصفقة")
      setShowQuantityModal(false)
      onUpdate()
      // Navigate to deal details if available
      const dealId = (deal as { id?: string } | null)?.id
      if (dealId) router.push(`/deals/${dealId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل فتح الصفقة"
      showError(msg)
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await cancelListing(listing.id)
      showSuccess("تم إلغاء الإعلان")
      onUpdate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل الإلغاء"
      showError(msg)
      setCancelling(false)
    }
  }

  return (
    <>
      <div
        className={`bg-white/[0.05] border rounded-2xl p-4 transition-colors ${
          isSell
            ? "border-[#F87171]/15 hover:border-[#F87171]/30"
            : "border-[#4ADE80]/15 hover:border-[#4ADE80]/30"
        }`}
      >
        {/* Top row: Type badge + project + status */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                isSell
                  ? "bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30"
                  : "bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30"
              }`}
            >
              {isSell ? "🔥" : "💰"} {isSell ? "بيع سريع" : "شراء"} −
              {listing.discount_percent}%
            </span>
            {isOwner && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-400/15 text-blue-400 border border-blue-400/30">
                إعلانك
              </span>
            )}
          </div>
          {listing.is_unlimited && (
            <span className="text-[10px] text-neutral-400">🌊 كميات مفتوحة</span>
          )}
        </div>

        {/* Project name */}
        <div className="mb-3">
          <div className="text-base font-bold text-white">
            {listing.project?.name || "—"}
            {listing.project?.symbol && (
              <span className="text-xs text-neutral-500 mr-2">
                ({listing.project.symbol})
              </span>
            )}
          </div>
        </div>

        {/* Price block */}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 mb-3">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold font-mono text-yellow-400">
              {fmtIQD(listing.final_price)}
            </span>
            <span className="text-xs text-neutral-500">د.ع / حصة</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">سعر السوق:</span>
            <span className="font-mono text-neutral-400 line-through">
              {fmtIQD(listing.market_price)}
            </span>
            <span
              className={`font-bold ${
                isSell ? "text-[#F87171]" : "text-[#4ADE80]"
              }`}
            >
              −{listing.discount_percent}%
            </span>
          </div>
        </div>

        {/* Quantity */}
        <div className="text-xs text-neutral-400 mb-3">
          {listing.is_unlimited ? (
            <span className="text-[#4ADE80]">🌊 كميات مفتوحة (غير محدودة)</span>
          ) : (
            <>
              متاح:{" "}
              <span className="font-mono font-bold text-white">
                {fmtIQD(listing.available_shares)}
              </span>{" "}
              من{" "}
              <span className="font-mono text-neutral-500">
                {fmtIQD(listing.total_shares)}
              </span>{" "}
              حصة
            </>
          )}
        </div>

        {/* Note (if any) */}
        {listing.note && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 mb-3 text-[11px] text-neutral-300 leading-relaxed">
            💬 {listing.note}
          </div>
        )}

        {/* User trust block */}
        <div className="border-t border-white/[0.06] pt-3 mb-3">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="text-sm font-bold text-white">
              {listing.user?.display_name || "مستخدم"}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="font-mono font-bold text-yellow-400">
                {(listing.user?.rating_average ?? 0).toFixed(1)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-white/[0.04] rounded-lg px-2 py-1.5">
              <div className="text-neutral-500">الصفقات</div>
              <div className="font-mono font-bold text-white mt-0.5">
                {fmtIQD(listing.user?.total_trades ?? 0)}{" "}
                <span className="text-neutral-500">
                  (نجح {fmtIQD(listing.user?.successful_trades ?? 0)})
                </span>
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-lg px-2 py-1.5">
              <div className="text-neutral-500">نسبة النجاح</div>
              <div
                className={`font-mono font-bold mt-0.5 ${
                  successRate >= 90
                    ? "text-[#4ADE80]"
                    : successRate >= 70
                    ? "text-yellow-400"
                    : "text-[#F87171]"
                }`}
              >
                {successRate}%
              </div>
            </div>
            <div
              className={`rounded-lg px-2 py-1.5 ${
                hasDisputes
                  ? "bg-yellow-400/[0.05] border border-yellow-400/20"
                  : "bg-white/[0.04]"
              }`}
            >
              <div className="text-neutral-500 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                النزاعات
              </div>
              <div
                className={`font-mono font-bold mt-0.5 ${
                  hasDisputes ? "text-yellow-400" : "text-white"
                }`}
              >
                {fmtIQD(listing.user?.disputes_total ?? 0)}
              </div>
            </div>
            <div
              className={`rounded-lg px-2 py-1.5 ${
                hasReports
                  ? "bg-[#F87171]/[0.05] border border-[#F87171]/20"
                  : "bg-white/[0.04]"
              }`}
            >
              <div className="text-neutral-500 flex items-center gap-1">
                <Flag className="w-2.5 h-2.5" />
                البلاغات
              </div>
              <div
                className={`font-mono font-bold mt-0.5 ${
                  hasReports ? "text-[#F87171]" : "text-white"
                }`}
              >
                {fmtIQD(listing.user?.reports_received ?? 0)}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        {isOwner ? (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[#F87171] text-sm font-bold hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            {cancelling ? "جاري الإلغاء..." : "إلغاء الإعلان"}
          </button>
        ) : (
          <button
            onClick={() => setShowQuantityModal(true)}
            className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity ${
              isSell
                ? "bg-gradient-to-r from-[#FB923C] to-[#F87171] text-white hover:opacity-90"
                : "bg-gradient-to-r from-[#22D3EE] to-[#4ADE80] text-black hover:opacity-90"
            }`}
          >
            <Zap className="w-4 h-4" strokeWidth={2.5} />
            فتح صفقة
          </button>
        )}
      </div>

      {/* Quantity Modal */}
      {showQuantityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="text-base font-bold text-white">حدّد الكمية</h3>
              <button
                onClick={() => setShowQuantityModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X size={16} className="text-neutral-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="flex justify-between mb-2 text-xs">
                  <span className="text-neutral-400">عدد الحصص</span>
                  {!listing.is_unlimited && (
                    <button
                      onClick={() =>
                        setQuantity(String(listing.available_shares))
                      }
                      className="text-neutral-400 hover:text-white"
                    >
                      الحد الأقصى ({fmtIQD(listing.available_shares)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
                  max={listing.is_unlimited ? undefined : listing.available_shares}
                  dir="ltr"
                  className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-2xl font-bold font-mono text-white text-center outline-none"
                />
              </div>

              {qtyNum > 0 && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">القيمة الإجمالية</span>
                    <span className="font-mono font-bold text-white">
                      {fmtIQD(totalAmount)} د.ع
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      عمولة المنصّة (
                      {(QS_BUYER_COMMISSION_PCT * 100).toFixed(0)}%)
                    </span>
                    <span className="font-mono font-bold text-blue-400">
                      {fmtIQD(commission)} د.ع
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-500 pt-1 border-t border-white/[0.04] mt-1">
                    💡 العمولة على المشتري دائماً في البيع السريع
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowQuantityModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleOpenDeal}
                  disabled={submitting || !qtyNum}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-opacity ${
                    qtyNum && !submitting
                      ? "bg-gradient-to-r from-[#FB923C] to-[#F87171] text-white hover:opacity-90"
                      : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  }`}
                >
                  {submitting ? "جاري الفتح..." : "فتح الصفقة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
