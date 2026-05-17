"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { X, Tag, ShoppingCart, Lock, Building2, Users as UsersIcon, Zap } from "lucide-react"
import {
  createSellListing,
  createBuyListing,
  QS_SELL_DISCOUNT,
  QS_BUY_DISCOUNT_MIN,
  QS_BUY_DISCOUNT_MAX,
} from "@/lib/data/quick-sale"
import {
  getProjectQuickBuyStatus,
  executeAdminQuickBuy,
  type QuickBuyStatus,
} from "@/lib/data/admin-quick-buy"
import { showError, showSuccess } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"
// Phase 11.27 — IntegerInput prevents wheel/arrow-key/spinner from
// silently mutating share-count inputs.
import { IntegerInput } from "@/components/ui/IntegerInput"
import { cn } from "@/lib/utils/cn"

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
  const t = useTranslations("quickSale")
  const [tab, setTab] = useState<"sell" | "buy">("sell")
  // Phase 13.59 — when tab === "sell" the user picks WHO they sell to:
  //   • "users"  — existing P2P listing (the legacy flow)
  //   • "system" — instant sale to the platform at a fixed discount
  //                (requires admin toggle on the project)
  const [sellTarget, setSellTarget] = useState<"users" | "system">("users")
  const [quickBuyStatus, setQuickBuyStatus] = useState<QuickBuyStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectId, setProjectId] = useState<string>("")
  const [shares, setShares] = useState<string>("")
  const [unlimited, setUnlimited] = useState(false)
  const [discount, setDiscount] = useState<number>(QS_BUY_DISCOUNT_MIN)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Refresh the system-buy status whenever the project or mode changes.
  useEffect(() => {
    if (tab !== "sell" || sellTarget !== "system" || !projectId) {
      setQuickBuyStatus(null)
      return
    }
    let cancelled = false
    setStatusLoading(true)
    getProjectQuickBuyStatus(projectId).then((s) => {
      if (!cancelled) {
        setQuickBuyStatus(s)
        setStatusLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [tab, sellTarget, projectId])

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
  // Phase 13.59 — when selling to the system, the discount comes from
  // the project's admin_quick_buy_discount_pct (per-project, admin-set).
  const isSystemMode = tab === "sell" && sellTarget === "system"
  const effectiveDiscount =
    isSystemMode ? (quickBuyStatus?.discount_pct ?? 15) :
    tab === "sell" ? QS_SELL_DISCOUNT :
    discount
  const finalPrice = Math.floor((marketPrice * (100 - effectiveDiscount)) / 100)

  const sharesNum = unlimited ? 0 : parseInt(shares) || 0

  // The system mode requires a specific (non-unlimited) share count
  // AND the feature must be ON for this project.
  const canSubmit =
    !!projectId &&
    !submitting &&
    (isSystemMode
      ? (sharesNum > 0 && !!quickBuyStatus?.enabled && !statusLoading)
      : (unlimited || sharesNum > 0))

  async function handleSubmit() {
    if (!canSubmit || !selectedProject) return

    setSubmitting(true)
    try {
      if (isSystemMode) {
        // Phase 13.59 — instant sell to platform.
        const r = await executeAdminQuickBuy(projectId, sharesNum)
        if (!r.success) {
          const map: Record<string, string> = {
            unauthenticated: t("errUnauth"),
            invalid_input: t("errInvalidInput"),
            project_not_found: t("errProjectNotFound"),
            feature_disabled: t("errFeatureDisabled"),
            no_market_price: t("errNoMarketPrice"),
            no_holdings: t("errNoHoldings"),
            insufficient_shares:
              t("errInsufficientShares", { free: r.free_shares ?? 0, req: r.requested ?? sharesNum }),
          }
          showError(map[r.error ?? ""] ?? r.error ?? t("errSellFailed"))
          setSubmitting(false)
          return
        }
        showSuccess(
          t("soldToSystem", { shares: r.shares ?? 0, amount: (r.total_amount ?? 0).toLocaleString("en-US") }),
        )
      } else if (tab === "sell") {
        await createSellListing({
          project_id: projectId,
          total_shares: unlimited ? 1 : sharesNum,
          is_unlimited: unlimited,
          note: note.trim() || undefined,
        })
        showSuccess(t("sellListingPublished"))
      } else {
        await createBuyListing({
          project_id: projectId,
          total_shares: unlimited ? 1 : sharesNum,
          is_unlimited: unlimited,
          discount_percent: discount,
          note: note.trim() || undefined,
        })
        showSuccess(t("buyListingPublished"))
      }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("failCreateListing")
      showError(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white">{t("newListing")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
            aria-label={t("close")}
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
              {t("sellListing")}
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
              {t("buyListing")}
            </button>
          </div>
          <div
            className={`mt-3 text-[11px] ${
              tab === "sell" ? "text-[#F87171]" : "text-[#4ADE80]"
            }`}
          >
            {tab === "sell"
              ? t("sellDiscountFixed", { pct: QS_SELL_DISCOUNT })
              : t("buyDiscountChoose", { min: QS_BUY_DISCOUNT_MIN, max: QS_BUY_DISCOUNT_MAX })}
          </div>

          {/* Phase 13.59 — sell-target picker (only in sell tab) */}
          {tab === "sell" && (
            <div className="mt-3">
              <div className="text-[10px] text-neutral-500 mb-1.5 font-bold">
                {t("whoSellTo")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSellTarget("users")}
                  className={cn(
                    "py-2.5 rounded-xl border text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5",
                    sellTarget === "users"
                      ? "bg-white/[0.08] border-white/[0.15] text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:bg-white/[0.05]",
                  )}
                >
                  <UsersIcon className="w-3.5 h-3.5" strokeWidth={2} />
                  {t("toUsersNegotiate")}
                </button>
                <button
                  onClick={() => setSellTarget("system")}
                  className={cn(
                    "py-2.5 rounded-xl border text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5",
                    sellTarget === "system"
                      ? "bg-[#4ADE80]/[0.12] border-[#4ADE80]/[0.4] text-[#4ADE80]"
                      : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:bg-white/[0.05]",
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" strokeWidth={2} />
                  {t("toSystemInstant")}
                </button>
              </div>
              <div className={cn(
                "mt-1.5 text-[10px] leading-relaxed",
                sellTarget === "system" ? "text-[#4ADE80]" : "text-neutral-500",
              )}>
                {sellTarget === "system"
                  ? t("sellSystemDesc")
                  : t("sellUsersDesc")}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Project selector */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              {t("chooseProject")}
            </label>
            {loadingProjects ? (
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-neutral-500">
                {t("loadingProjects")}
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-yellow-400/[0.05] border border-yellow-400/20 rounded-xl px-4 py-3 text-xs text-yellow-400">
                {t("noProjects")}
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
              >
                <option value="">{t("chooseProjectOption")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f0f0f]">
                    {p.name} {p.symbol ? `(${p.symbol})` : ""} —{" "}
                    {fmtIQD(p.current_market_price)} {t("iqd")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Phase 13.59 — system mode unavailable banner */}
          {isSystemMode && projectId && (
            <>
              {statusLoading ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-xs text-neutral-400 animate-pulse text-center">
                  {t("checkingFeature")}
                </div>
              ) : !quickBuyStatus?.enabled ? (
                <div className="bg-red-500/[0.06] border border-red-500/[0.2] rounded-xl p-3 text-xs text-red-300 leading-relaxed">
                  ⛔ <span className="font-bold">{t("dsNotAvailable")}</span>
                  <span className="block mt-1 text-red-300/80">
                    {t("dsDisabledBody")}
                  </span>
                </div>
              ) : (
                <div className="bg-[#4ADE80]/[0.06] border border-[#4ADE80]/[0.25] rounded-xl p-3 text-xs text-[#4ADE80] leading-relaxed flex items-start gap-2">
                  <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span>
                    {t("dsEnabledPre")}<b>{t("dsEnabledBold")}</b>{t("dsEnabledMid")}{" "}
                    {t("dsDiscountPre")}<span className="font-mono">{quickBuyStatus.discount_pct}%</span> ·{" "}
                    {t("dsPricePre")}<span className="font-mono">{fmtIQD(quickBuyStatus.price_per_share)} IQD</span>
                  </span>
                </div>
              )}
            </>
          )}

          {/* Quantity type — system mode forces a specific count */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              {isSystemMode ? t("sharesToSell") : t("qtyType")}
            </label>
            {!isSystemMode && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setUnlimited(false)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    !unlimited
                      ? "bg-white/[0.08] text-white border-white/[0.15]"
                      : "bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:bg-white/[0.05]"
                  }`}
                >
                  {t("fixedQty")}
                </button>
                <button
                  onClick={() => setUnlimited(true)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                    unlimited
                      ? "bg-white/[0.08] text-white border-white/[0.15]"
                      : "bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:bg-white/[0.05]"
                  }`}
                >
                  {t("openQtyTag")}
                </button>
              </div>
            )}
            {(!unlimited || isSystemMode) && (
              <IntegerInput
                value={shares}
                onValueChange={setShares}
                placeholder={t("sharesPlaceholder")}
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
                  {t("discountPct")}
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
                {t("autoPricing")}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">{t("marketPrice")}</span>
                <span className="font-mono font-bold text-white">
                  {fmtIQD(marketPrice)} {t("iqd")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">
                  {t("discountParen", { pct: effectiveDiscount })}
                </span>
                <span
                  className={`font-mono font-bold ${
                    tab === "sell" ? "text-[#F87171]" : "text-[#4ADE80]"
                  }`}
                >
                  −{fmtIQD(marketPrice - finalPrice)} {t("iqd")}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/[0.06] pt-2 mt-1">
                <span className="text-neutral-300 font-bold">
                  {t("finalPrice")}
                </span>
                <span className="font-mono font-bold text-yellow-400">
                  {fmtIQD(finalPrice)} {t("iqd")}
                </span>
              </div>
              {/* Phase 13.59 — total proceeds for system mode */}
              {isSystemMode && sharesNum > 0 && (
                <div className="flex justify-between text-sm border-t border-[#4ADE80]/[0.15] pt-2 mt-1">
                  <span className="text-[#4ADE80] font-bold">
                    {t("totalAmountShares", { n: sharesNum.toLocaleString("en-US") })}
                  </span>
                  <span className="font-mono font-bold text-[#4ADE80]">
                    {fmtIQD(finalPrice * sharesNum)} IQD
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block font-bold">
              {t("noteOptional")}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
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
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-opacity",
              canSubmit
                ? (isSystemMode
                    ? "bg-[#4ADE80] text-black hover:opacity-90"
                    : "bg-gradient-to-r from-[#FB923C] to-[#F87171] text-white hover:opacity-90")
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed",
            )}
          >
            {submitting
              ? (isSystemMode ? t("executing") : t("publishing"))
              : isSystemMode ? t("instantSellSystem") : t("createListing")}
          </button>
        </div>
      </div>
    </div>
  )
}
