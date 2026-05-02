"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Tag, ShoppingCart, Lock } from "lucide-react"
import {
  createSellListing,
  createBuyListing,
  QS_SELL_DISCOUNT,
  QS_BUY_DISCOUNT_MIN,
  QS_BUY_DISCOUNT_MAX,
} from "@/lib/data/quick-sale"
import { showError, showSuccess } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"

interface CreateListingModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ProjectOption {
  id: string
  name: string
  symbol: string | null
  current_market_price: number
}

const fmtIQD = (n: number) => n.toLocaleString("en-US")

export function CreateListingModal({ onClose, onSuccess }: CreateListingModalProps) {
  const [tab, setTab] = useState<"sell" | "buy">("sell")
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectId, setProjectId] = useState<string>("")
  const [shares, setShares] = useState<string>("")
  const [unlimited, setUnlimited] = useState(false)
  const [discount, setDiscount] = useState<number>(QS_BUY_DISCOUNT_MIN)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Load projects from Supabase
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("projects")
        .select("id, name, symbol, current_market_price")
        .order("name")
      if (!cancelled) {
        setProjects((data || []) as ProjectOption[])
        setLoadingProjects(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const marketPrice = selectedProject?.current_market_price ?? 0
  const effectiveDiscount = tab === "sell" ? QS_SELL_DISCOUNT : discount
  const finalPrice = Math.floor((marketPrice * (100 - effectiveDiscount)) / 100)

  const sharesNum = unlimited ? 0 : parseInt(shares) || 0

  const canSubmit =
    !!projectId &&
    (unlimited || sharesNum > 0) &&
    !submitting

  async function handleSubmit() {
    if (!canSubmit || !selectedProject) return

    setSubmitting(true)
    try {
      if (tab === "sell") {
        await createSellListing({
          project_id: projectId,
          total_shares: unlimited ? 1 : sharesNum, // placeholder when unlimited
          is_unlimited: unlimited,
          note: note.trim() || undefined,
        })
        showSuccess("✅ تم نشر إعلان البيع")
      } else {
        await createBuyListing({
          project_id: projectId,
          total_shares: unlimited ? 1 : sharesNum,
          is_unlimited: unlimited,
          discount_percent: discount,
          note: note.trim() || undefined,
        })
        showSuccess("✅ تم نشر إعلان الشراء")
      }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل إنشاء الإعلان"
      showError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white">📢 إعلان جديد</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X size={16} className="text-neutral-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-2 bg-white/[0.04] p-1 rounded-xl">
            <button
              onClick={() => setTab("sell")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
                tab === "sell"
                  ? "bg-[#F87171]/20 text-[#F87171]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Tag size={14} />
              إعلان بيع
            </button>
            <button
              onClick={() => setTab("buy")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
                tab === "buy"
                  ? "bg-[#4ADE80]/20 text-[#4ADE80]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <ShoppingCart size={14} />
              إعلان شراء
            </button>
          </div>
          <div
            className={`mt-3 text-[11px] ${
              tab === "sell" ? "text-[#F87171]" : "text-[#4ADE80]"
            }`}
          >
            {tab === "sell"
              ? `🔥 الخصم ثابت ${QS_SELL_DISCOUNT}% (يحدّده النظام)`
              : `💰 أنت تحدّد نسبة الخصم (${QS_BUY_DISCOUNT_MIN}% إلى ${QS_BUY_DISCOUNT_MAX}%)`}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Project selector */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              اختر المشروع
            </label>
            {loadingProjects ? (
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-neutral-500">
                جاري تحميل المشاريع...
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl px-4 py-3 text-xs text-yellow-400">
                ⚠ لا توجد مشاريع متاحة حالياً
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              >
                <option value="">— اختر مشروع —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f0f0f]">
                    {p.name} {p.symbol ? `(${p.symbol})` : ""} —{" "}
                    {fmtIQD(p.current_market_price)} د.ع
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity type */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              نوع الكمية
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setUnlimited(false)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  !unlimited
                    ? "bg-white/[0.08] text-white border-white/[0.15]"
                    : "bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:bg-white/[0.05]"
                }`}
              >
                كمية محدّدة
              </button>
              <button
                onClick={() => setUnlimited(true)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  unlimited
                    ? "bg-white/[0.08] text-white border-white/[0.15]"
                    : "bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:bg-white/[0.05]"
                }`}
              >
                🌊 كميات مفتوحة
              </button>
            </div>
            {!unlimited && (
              <input
                type="number"
                inputMode="numeric"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="عدد الحصص"
                min="1"
                dir="ltr"
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white text-center font-mono outline-none transition-colors"
              />
            )}
          </div>

          {/* Discount slider (buy only) */}
          {tab === "buy" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-neutral-400 font-bold">
                  نسبة الخصم
                </label>
                <span className="text-base font-bold text-[#4ADE80] font-mono">
                  {discount}%
                </span>
              </div>
              <input
                type="range"
                min={QS_BUY_DISCOUNT_MIN}
                max={QS_BUY_DISCOUNT_MAX}
                step="1"
                value={discount}
                onChange={(e) => setDiscount(parseInt(e.target.value))}
                className="w-full accent-[#4ADE80]"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono">
                <span>{QS_BUY_DISCOUNT_MIN}%</span>
                <span>{QS_BUY_DISCOUNT_MAX}%</span>
              </div>
            </div>
          )}

          {/* Auto-price preview */}
          {selectedProject && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-bold mb-1">
                <Lock className="w-3 h-3" />
                التسعير التلقائي
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">سعر السوق</span>
                <span className="font-mono font-bold text-white">
                  {fmtIQD(marketPrice)} د.ع
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">
                  الخصم ({effectiveDiscount}%)
                </span>
                <span
                  className={`font-mono font-bold ${
                    tab === "sell" ? "text-[#F87171]" : "text-[#4ADE80]"
                  }`}
                >
                  −{fmtIQD(marketPrice - finalPrice)} د.ع
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2 mt-1">
                <span className="text-neutral-300 font-bold">
                  السعر النهائي
                </span>
                <span className="font-mono font-bold text-yellow-400">
                  {fmtIQD(finalPrice)} د.ع
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              ملاحظة (اختياري)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أي تفاصيل إضافية..."
              rows={2}
              className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08] transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-opacity ${
              canSubmit
                ? "bg-gradient-to-r from-[#FB923C] to-[#F87171] text-white hover:opacity-90"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {submitting ? "جاري النشر..." : "إنشاء الإعلان"}
          </button>
        </div>
      </div>
    </div>
  )
}
