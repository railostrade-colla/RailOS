"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Star, AlertTriangle, X, ShoppingCart, Inbox } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { showSuccess, showError } from "@/lib/utils/toast"
// Production mode — orders/trades come from /deals (real DB) now.
// This legacy page renders empty until it migrates to lib/data/deals.
// We type these `any[]` because the legacy page reads many fields
// (buyer_id, payment_due_at, admin_note, etc.) that won't exist on
// new DB rows; the arrays are always empty so render is a no-op.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTrades: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDirectBuys: any[] = []
import { submitRating } from "@/lib/data/ratings"
import { cn } from "@/lib/utils/cn"

type OrderTab = "trades" | "direct_buy"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

const reportReasons = [
  { v: "no_payment", lKey: "reasonNoPayment" },
  { v: "no_delivery", lKey: "reasonNoDelivery" },
  { v: "fraud", lKey: "reasonFraud" },
  { v: "abuse", lKey: "reasonAbuse" },
  { v: "other", lKey: "reasonOther" },
]

const dbStatusKey: Record<string, string> = {
  pending: "statusPending",
  approved: "statusApproved",
  postponed: "statusPostponed",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
  expired: "statusExpired",
}

const dbStatusColor = (s: string) => {
  if (s === "approved") return "bg-blue-400/15 border-blue-400/30 text-blue-400"
  if (s === "pending") return "bg-yellow-400/15 border-yellow-400/30 text-yellow-400"
  if (s === "postponed") return "bg-purple-400/15 border-purple-400/30 text-purple-400"
  if (s === "completed") return "bg-green-400/15 border-green-400/30 text-green-400"
  return "bg-red-400/15 border-red-400/30 text-red-400"
}

export default function OrdersPage() {
  const router = useRouter()
  const t = useTranslations("orders")
  const tc = useTranslations("common")
  const [tab, setTab] = useState<OrderTab>("trades")
  const [trades] = useState(mockTrades)
  const [directBuys] = useState(mockDirectBuys)

  const [reportTrade, setReportTrade] = useState<typeof mockTrades[0] | null>(null)
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const [submittingReport, setSubmittingReport] = useState(false)

  const [rateTrade, setRateTrade] = useState<typeof mockTrades[0] | null>(null)
  const [rateStars, setRateStars] = useState<1 | 2 | 3 | 4 | 5>(5)
  const [rateComment, setRateComment] = useState("")
  const [submittingRate, setSubmittingRate] = useState(false)

  const submitReport = () => {
    if (!reportReason.trim()) {
      showError(t("toastSelectReason"))
      return
    }
    setSubmittingReport(true)
    setTimeout(() => {
      showSuccess(t("toastReportSent"))
      setReportTrade(null)
      setReportReason("")
      setReportDetails("")
      setSubmittingReport(false)
    }, 1000)
  }

  const submitRate = async () => {
    if (rateStars < 1 || rateStars > 5) {
      showError(t("toastSelectRating"))
      return
    }
    if (!rateTrade) return

    // The "rated" party is whichever side the current user isn't on.
    const meIsBuyer = (rateTrade.buyer_id ?? "me") === "me"
    const ratedUserId = meIsBuyer
      ? rateTrade.seller_id ?? ""
      : rateTrade.buyer_id ?? ""

    setSubmittingRate(true)
    const result = await submitRating({
      deal_id: rateTrade.id,
      rated_user_id: ratedUserId,
      stars: rateStars,
      comment: rateComment.trim() || undefined,
    })
    setSubmittingRate(false)

    if (result.success) {
      showSuccess(t("toastRatingSent"))
      setRateTrade(null)
      setRateStars(5)
      setRateComment("")
      return
    }

    // Friendly fallbacks per failure reason.
    if (result.reason === "already_rated") {
      showError(t("toastAlreadyRated"))
      setRateTrade(null)
      return
    }
    if (result.reason === "self_rating") {
      showError(t("toastCantRateSelf"))
      return
    }
    if (result.reason === "missing_table") {
      // Migration not applied yet — accept locally so user-flow tests
      // work, but make the toast accurate.
      showError(t("toastRatingNotEnabled"))
      setRateTrade(null)
      return
    }
    if (result.reason === "unauthenticated") {
      showError(t("toastLoginToRate"))
      return
    }
    showError(result.error || t("toastRatingFailed"))
  }

  const pendingDirectBuys = directBuys.filter((r) => r.status === "pending" || r.status === "approved").length

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            badge={t("headerBadge")}
            title={t("title")}
            description={t("description")}
          />

          {/* Tabs */}
          <div className="flex gap-1.5 mb-4">
            {([
              { key: "trades" as const, label: t("tabTrades"), count: trades.length },
              { key: "direct_buy" as const, label: t("tabDirectBuy"), count: pendingDirectBuys, badge: pendingDirectBuys > 0 },
            ]).map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm transition-colors border flex items-center justify-center gap-2",
                  tab === tb.key
                    ? "bg-white/[0.06] border-white/[0.25] text-white font-bold"
                    : "bg-transparent border-white/[0.08] text-neutral-400 hover:text-white"
                )}
              >
                {tb.label}
                {tb.badge && (
                  <span className="bg-yellow-400 text-black rounded px-1.5 py-0.5 text-[10px] font-bold">
                    {tb.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Trades Tab */}
          {tab === "trades" && (
            trades.length === 0 ? (
              <div className="text-center py-16">
                <Inbox className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm text-neutral-500">{t("noTrades")}</div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {trades.map((o) => {
                  const otherName = o.buyer_id === "me" ? (o.seller?.name ?? "") : (o.buyer?.name ?? "")
                  return (
                    <div
                      key={o.id}
                      className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4"
                    >
                      <button
                        onClick={() => router.push(`/contracts/${o.id}`)}
                        className="w-full text-right"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-white">{o.project.name}</span>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded text-[11px] font-bold border",
                            o.status === "confirmed" && "bg-green-400/15 border-green-400/30 text-green-400",
                            o.status === "in_progress" && "bg-yellow-400/15 border-yellow-400/30 text-yellow-400",
                            o.status === "cancelled" && "bg-red-400/15 border-red-400/30 text-red-400"
                          )}>
                            {o.status === "confirmed" ? t("tradeConfirmed") : o.status === "in_progress" ? t("tradeInProgress") : t("tradeCancelled")}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-neutral-400 mb-3">
                          <span>{o.shares} {t("sharesUnit")}</span>
                          <span>{fmtIQD(o.price ?? 0)} {t("iqd")}</span>
                          <span>{o.created_at}</span>
                        </div>
                      </button>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {o.status === "confirmed" && (
                          <button
                            onClick={() => {
                              setRateTrade(o)
                              setRateStars(5)
                              setRateComment("")
                            }}
                            className="flex-1 py-2 rounded-lg bg-green-400/[0.08] border border-green-400/[0.2] text-green-400 text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Star className="w-3.5 h-3.5" />
                            {t("rateAction", { name: otherName })}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setReportTrade(o)
                            setReportReason("")
                            setReportDetails("")
                          }}
                          className="flex-1 py-2 rounded-lg bg-red-400/[0.08] border border-red-400/[0.2] text-red-400 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t("reportProblem")}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Direct Buy Tab */}
          {tab === "direct_buy" && (
            directBuys.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-12 h-12 text-neutral-600 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm text-neutral-500">{t("noDirectBuys")}</div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {directBuys.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/project/${r.project_id}`)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-colors text-right"
                  >
                    <div className="flex justify-between items-center mb-2 gap-2">
                      <span className="text-sm font-bold text-white">{r.project_name}</span>
                      <span className={cn("px-2.5 py-0.5 rounded text-[11px] font-bold border", dbStatusColor(r.status))}>
                        {t(dbStatusKey[r.status] ?? "statusPending")}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-neutral-400 flex-wrap">
                      <span>{r.shares} {t("sharesUnit")}</span>
                      <span>{fmtIQD(r.shares * r.price_per_share)} {t("iqd")}</span>
                      <span>{r.created_at}</span>
                    </div>
                    {r.status === "approved" && r.payment_due_at && (
                      <div className="mt-2 text-[11px] text-blue-400">
                        {t("paymentDuePrefix")} {r.payment_due_at}
                      </div>
                    )}
                    {r.status === "postponed" && r.admin_note && (
                      <div className="mt-2 text-[11px] text-purple-400">{t("notePrefix")} {r.admin_note}</div>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

        </div>
      </div>

      {/* Report Modal */}
      {reportTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-[#0a0a0a] border-t border-white/[0.1] rounded-t-3xl p-5 w-full max-w-md">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-base font-bold text-white mb-1">{t("reportProblem")}</div>
                <div className="text-xs text-neutral-400">
                  {t("dealLabel", { name: reportTrade.project.name })}
                </div>
              </div>
              <button onClick={() => setReportTrade(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="text-xs text-neutral-400 mb-2 block">{t("reportReasonLabel")}</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/20 mb-3"
            >
              <option value="">{t("chooseReasonOption")}</option>
              {reportReasons.map((r) => (
                <option key={r.v} value={r.v} className="bg-[#0a0a0a]">{t(r.lKey)}</option>
              ))}
            </select>

            <label className="text-xs text-neutral-400 mb-2 block">{t("extraDetailsLabel")}</label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={4}
              placeholder={t("explainPlaceholder")}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setReportTrade(null)}
                disabled={submittingReport}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                {tc("buttons.cancel")}
              </button>
              <button
                onClick={submitReport}
                disabled={submittingReport || !reportReason}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-colors",
                  reportReason && !submittingReport
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white/[0.05] text-neutral-600 cursor-not-allowed"
                )}
              >
                {submittingReport ? t("sending") : t("sendReport")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {rateTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="bg-[#0a0a0a] border-t border-white/[0.1] rounded-t-3xl p-5 w-full max-w-md">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-base font-bold text-white mb-1">{t("rateCounterparty")}</div>
                <div className="text-xs text-neutral-400">
                  {rateTrade.buyer_id === "me" ? (rateTrade.seller?.name ?? "") : (rateTrade.buyer?.name ?? "")}
                </div>
              </div>
              <button onClick={() => setRateTrade(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-4 py-3">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setRateStars(n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn("w-9 h-9", n <= rateStars ? "fill-yellow-400 text-yellow-400" : "text-neutral-700")}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <label className="text-xs text-neutral-400 mb-2 block">{t("commentLabel")}</label>
            <textarea
              value={rateComment}
              onChange={(e) => setRateComment(e.target.value)}
              rows={3}
              placeholder={t("shareExperiencePlaceholder")}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setRateTrade(null)}
                disabled={submittingRate}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
              >
                {tc("buttons.cancel")}
              </button>
              <button
                onClick={submitRate}
                disabled={submittingRate}
                className="flex-1 py-3 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
              >
                {submittingRate ? t("sending") : t("sendRating")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
