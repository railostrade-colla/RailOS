"use client"

import { useState, useMemo } from "react"
import { X, ShoppingCart, TrendingUp, AlertCircle, Lock, Clock } from "lucide-react"
import { cn } from "@/lib/utils/cn"

/**
 * QuantityModal — نافذة تحديد الكمية قبل فتح صفقة من إعلان.
 *
 * ───────── النموذج المالي (هام) ─────────
 * RailOS لا يتعامل بالمال الحقيقي داخل التطبيق:
 *   • سعر الحصة × الكمية = مبلغ الصفقة الإجمالي بالدينار العراقي
 *     يتمّ دفعه/استلامه **خارج التطبيق** بين الطرفين.
 *   • التطبيق يخصم فقط عمولة بنسبة 2% من **رصيد وحدات الرسوم**
 *     لكلا الطرفَين بعد إتمام الصفقة.
 *   • كل وحدة رسوم = 1 دينار. لذلك العمولة المطلوبة بالوحدات
 *     = Math.ceil(الكمية × سعر الحصة × 0.02).
 *   • بمجرد التأكيد تُعلَّق الحصص في Escrow وتفتح دردشة مدّتها 15 دقيقة
 *     بين البائع والمشتري لإكمال التحويل خارجياً.
 *
 * ────────────── السلوك ──────────────
 * - أرقام صحيحة فقط (بدون كسور).
 * - أزرار سريعة: 25% / 50% / 75% / الكل (مبنية على الحد الأقصى الفعلي).
 * - التحقق من توفّر **وحدات الرسوم الكافية** للعمولة، لا من رصيد دنانير.
 * - يمنع تجاوز الكمية المتاحة في الإعلان أو الحصص المملوكة (للبيع).
 * - النافذة تُعرض **في وسط الشاشة** على كل المقاسات.
 */

// ─── ثوابت العمولة ───────────────────────────────────
/** نسبة العمولة الثابتة على الطرفَين (2%). */
const COMMISSION_RATE = 0.02
/** قيمة وحدة الرسوم الواحدة بالدينار (1:1). */
const FEE_UNIT_VALUE_IQD = 1
/** مدّة الدردشة لإكمال الصفقة بعد التأكيد (دقائق). */
const DEAL_CHAT_DURATION_MINUTES = 15

export interface QuantityModalListing {
  id: string
  type: "buy" | "sell"
  user_id: string
  user_name: string
  project_id: string
  project_name: string
  project_symbol?: string
  price_per_share: number
  available_shares: number
  min_shares?: number
  max_shares?: number
}

interface Props {
  listing: QuantityModalListing | null
  /** رصيد وحدات الرسوم للمستخدم (1 وحدة = 1 د.ع). يُستخدم للتحقق من العمولة. */
  userBalance?: number
  /** عدد حصص المستخدم في هذا المشروع (للبيع). */
  userShares?: number
  /**
   * مدّة الصفقة بالساعات — يُمرَّر إلى onConfirm للحفاظ على توافق الواجهة
   * مع الـ backend. لم يعد قابلاً للاختيار من المستخدم — الصفقة تفتح
   * دردشة 15 دقيقة دائماً (انظر DEAL_CHAT_DURATION_MINUTES).
   */
  defaultDurationHours?: 24 | 48 | 72
  onClose: () => void
  onConfirm: (quantity: number, durationHours: 24 | 48 | 72) => Promise<void> | void
}

export function QuantityModal({
  listing,
  userBalance = 0,
  userShares = 0,
  defaultDurationHours = 24,
  onClose,
  onConfirm,
}: Props) {
  // ⚠ ALL hooks must run unconditionally on every render — moving an
  // `if (!listing) return null` early-return ABOVE the useMemos was the
  // hooks-order violation that triggered React error #310. The hooks
  // now read from `listing` defensively so they're safe to call when
  // listing is null. The early return happens AFTER the hooks.
  const [quantityInput, setQuantityInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [agreed, setAgreed] = useState(false)

  // Pre-compute fields that work with a possibly-null listing.
  const userAction: "buy" | "sell" = listing?.type === "sell" ? "buy" : "sell"
  const actionLabel = userAction === "buy" ? "شراء" : "بيع"
  const minAllowed = listing?.min_shares ?? 1
  const pricePerShare = listing?.price_per_share ?? 0
  const availableShares = listing?.available_shares ?? 0
  const maxShares = listing?.max_shares ?? Infinity

  // ─── الحد الأقصى الفعلي ───
  // مقيَّد بعدة عوامل:
  //   1) المتاح في الإعلان (available_shares)
  //   2) سقف الإعلان (max_shares)
  //   3) للبيع فقط: ما يملكه المستخدم (userShares)
  //   4) **وحدات الرسوم**: المستخدم يدفع 2% عمولة من قيمة الصفقة
  //      كوحدات رسوم. لذلك:
  //        max_qty_by_fees = floor(userBalance / (pricePerShare × 0.02))
  const maxAllowed = useMemo(() => {
    const feeCostPerShare = pricePerShare * COMMISSION_RATE
    const byFeeUnits = feeCostPerShare > 0
      ? Math.floor(userBalance / feeCostPerShare)
      : Infinity

    const baseCap = Math.min(byFeeUnits, availableShares, maxShares)

    if (userAction === "sell") {
      return Math.min(baseCap, userShares)
    }
    return baseCap
  }, [userAction, userBalance, userShares, pricePerShare, availableShares, maxShares])

  // ─── معالجة الإدخال (أرقام صحيحة فقط) ───
  const handleQuantityChange = (value: string) => {
    setError("")
    const cleaned = value.replace(/[^0-9]/g, "")
    const normalized = cleaned.replace(/^0+/, "") || ""
    setQuantityInput(normalized)
  }

  const quantity = parseInt(quantityInput) || 0

  // ─── الحسابات المعروضة ───
  // مبلغ الصفقة الإجمالي بالدينار (يُدفع خارج التطبيق).
  const totalSharesValue = quantity * pricePerShare
  // العمولة المطلوبة بوحدات الرسوم (مُقرَّبة لأعلى لتجنّب الفقد على الكسور).
  const requiredFeeUnits = Math.ceil(totalSharesValue * COMMISSION_RATE)

  // ─── التحقّق ───
  const validationError = useMemo((): string => {
    if (quantity === 0) return ""
    if (quantity < minAllowed) return `الحد الأدنى ${minAllowed.toLocaleString("en-US")} حصة`
    if (quantity > availableShares) {
      return `المتوفّر فقط ${availableShares.toLocaleString("en-US")} حصة`
    }
    if (userAction === "sell" && quantity > userShares) {
      return `لا تملك سوى ${userShares.toLocaleString("en-US")} حصة`
    }
    if (requiredFeeUnits > userBalance) {
      const shortBy = requiredFeeUnits - userBalance
      return `وحدات الرسوم غير كافية — تحتاج ${requiredFeeUnits.toLocaleString("en-US")} وحدة (ينقصك ${shortBy.toLocaleString("en-US")})`
    }
    return ""
  }, [quantity, minAllowed, availableShares, userAction, userShares, requiredFeeUnits, userBalance])

  // Now safe to bail out — every hook above ran unconditionally.
  if (!listing) return null

  const canSubmit = quantity > 0 && !validationError && agreed && !submitting

  const handleConfirm = async () => {
    if (!canSubmit) {
      if (!agreed) setError("يجب الموافقة على شروط الـ Escrow")
      return
    }

    setSubmitting(true)
    try {
      // نمرّر defaultDurationHours للحفاظ على توافق توقيع onConfirm مع
      // الـ backend الحالي. الـ UX الجديد لا يعرض المدّة للمستخدم —
      // الصفقة تفتح دردشة 15 دقيقة بعد التأكيد.
      await onConfirm(quantity, defaultDurationHours)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل فتح الصفقة"
      setError(msg)
      setSubmitting(false)
    }
  }

  // أزرار النسب السريعة
  const quickButtons = [
    { label: "25%", value: Math.floor(maxAllowed * 0.25) },
    { label: "50%", value: Math.floor(maxAllowed * 0.5) },
    { label: "75%", value: Math.floor(maxAllowed * 0.75) },
    { label: "الكل", value: maxAllowed },
  ].filter((b) => b.value >= minAllowed && b.value > 0)

  return (
    <div
      // ✅ النافذة في **وسط الشاشة** على كل المقاسات (لا bottom-sheet).
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border",
                userAction === "buy"
                  ? "text-green-400 bg-green-400/10 border-green-400/30"
                  : "text-red-400 bg-red-400/10 border-red-400/30"
              )}
            >
              {userAction === "buy" ? <ShoppingCart size={18} /> : <TrendingUp size={18} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{actionLabel} حصص</h3>
              <p className="text-xs text-neutral-400">
                {listing.project_name}
                {listing.project_symbol && (
                  <span className="text-blue-400 font-mono mr-1.5" dir="ltr">
                    ({listing.project_symbol})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X size={16} className="text-neutral-400" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-5 space-y-4">
          {/* معلومات الإعلان */}
          <div className="bg-white/[0.03] rounded-xl p-4 space-y-2 border border-white/[0.04]">
            <Row label="صاحب الإعلان" value={listing.user_name} />
            <Row label="سعر الحصة" value={`${listing.price_per_share.toLocaleString("en-US")} د.ع`} mono />
            <Row
              label="الكمية المتاحة"
              value={`${listing.available_shares.toLocaleString("en-US")} حصة`}
              mono
              valueColor="text-blue-400"
            />
          </div>

          {/* Input الكمية */}
          <div>
            <label className="block text-xs text-neutral-400 mb-2">
              الكمية المرغوبة <span className="text-neutral-600">(أرقام صحيحة فقط)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-black/40 border border-white/[0.08] rounded-xl text-white text-2xl font-bold font-mono text-center focus:outline-none focus:border-green-400/50 transition-colors"
              dir="ltr"
              autoFocus
            />

            {/* أزرار سريعة */}
            {quickButtons.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {quickButtons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => setQuantityInput(String(btn.value))}
                    className={cn(
                      "py-2 text-xs rounded-lg transition-colors border",
                      quantity === btn.value
                        ? "bg-blue-400/15 border-blue-400/40 text-blue-400 font-bold"
                        : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] text-neutral-300"
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-neutral-500 mt-2 text-center">
              الحد الأقصى:{" "}
              <span className="font-mono text-white">{maxAllowed.toLocaleString("en-US")}</span> حصة
            </p>
          </div>

          {/* الحساب التلقائي — يعرض مبلغ الصفقة (خارجي) + وحدات الرسوم (داخلية) */}
          {quantity > 0 && !validationError && (
            <div className="bg-gradient-to-br from-green-400/[0.05] to-blue-400/[0.05] border border-green-400/20 rounded-xl p-4 space-y-2.5">
              <Row label="الكمية" value={`${quantity.toLocaleString("en-US")} حصة`} mono />
              <Row
                label="السعر للحصة"
                value={`× ${listing.price_per_share.toLocaleString("en-US")} د.ع`}
                mono
                valueColor="text-neutral-300"
              />
              <div className="h-px bg-white/[0.06]" />

              {/* مبلغ الصفقة الإجمالي — يُدفع خارج التطبيق */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">مبلغ الحصص</span>
                <span className="text-base font-bold font-mono text-green-400">
                  {totalSharesValue.toLocaleString("en-US")} د.ع
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                يُدفع/يُستلم بين الطرفَين خارج التطبيق خلال نافذة الدردشة (15 دقيقة).
              </p>

              <div className="h-px bg-white/[0.06]" />

              {/* العمولة بوحدات الرسوم — تُخصم من رصيدك */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  وحدات الرسوم للعمولة
                  <span className="text-[10px] font-normal text-neutral-500 mr-1.5">(2%)</span>
                </span>
                <span className="text-base font-bold font-mono text-blue-400">
                  {requiredFeeUnits.toLocaleString("en-US")} وحدة
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-relaxed">
                تُخصم من رصيد وحدات الرسوم بعد إتمام الصفقة. كل وحدة = 1 د.ع.
              </p>
            </div>
          )}

          {/* لافتة الدردشة 15 دقيقة (تستبدل أزرار اختيار المدّة المحذوفة) */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-400/[0.06] border border-blue-400/20 rounded-lg">
            <Clock size={14} className="text-blue-400 shrink-0" />
            <p className="text-[11px] text-blue-300 leading-relaxed">
              بعد التأكيد تُعلَّق الحصص وتفتح دردشة <strong>{DEAL_CHAT_DURATION_MINUTES} دقيقة</strong>{" "}
              بين الطرفَين لإكمال التحويل خارجياً.
            </p>
          </div>

          {/* رسالة الخطأ */}
          {(error || validationError) && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/30 rounded-lg">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error || validationError}</p>
            </div>
          )}

          {/* رصيد المستخدم — وحدات الرسوم لا دنانير */}
          <div className="text-center text-xs text-neutral-500">
            <span>رصيد وحدات الرسوم: </span>
            <span className="font-mono text-neutral-300">
              {userBalance.toLocaleString("en-US")} وحدة
            </span>
            {userAction === "sell" && (
              <span className="block mt-1 text-[11px]">
                حصصك في {listing.project_name}:{" "}
                <span className="font-mono text-neutral-300">
                  {userShares.toLocaleString("en-US")} حصة
                </span>
              </span>
            )}
          </div>

          {/* Escrow agreement */}
          <button
            onClick={() => setAgreed(!agreed)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-right",
              agreed
                ? "bg-green-400/[0.06] border-green-400/30"
                : "bg-white/[0.04] border-white/[0.08]"
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                agreed ? "bg-green-400 border-green-400" : "border-neutral-500"
              )}
            >
              {agreed && <span className="text-black text-[9px] font-bold">✓</span>}
            </div>
            <span className={cn("text-[11px] leading-relaxed", agreed ? "text-green-400" : "text-neutral-400")}>
              أوافق على تعليق الحصص في Escrow وخصم {requiredFeeUnits > 0 ? requiredFeeUnits.toLocaleString("en-US") : "ما يقابل 2%"}{" "}
              وحدة رسوم كعمولة. الدفع يتمّ خارج التطبيق خلال {DEAL_CHAT_DURATION_MINUTES} دقيقة من فتح الصفقة.
            </span>
          </button>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex gap-2 p-5 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-sm text-neutral-300 transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={cn(
              "flex-[2] py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2",
              canSubmit
                ? userAction === "buy"
                  ? "bg-green-500 hover:bg-green-600 text-black"
                  : "bg-red-500 hover:bg-red-600 text-white"
                : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
            )}
          >
            <Lock className="w-4 h-4" strokeWidth={2} />
            {submitting ? "جاري الفتح..." : `🔒 تأكيد ${actionLabel} + تعليق`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string
  value: string
  mono?: boolean
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-400">{label}</span>
      <span
        className={cn(
          "text-sm font-bold",
          mono && "font-mono",
          valueColor ?? "text-white"
        )}
      >
        {value}
      </span>
    </div>
  )
}
