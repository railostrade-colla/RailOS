"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Gavel,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, StatCard, Badge, Modal, EmptyState } from "@/components/ui"
import {
  getAuctionById as getAuctionByIdMock,
  getAuctionBids as getAuctionBidsMock,
  type AuctionBid,
  type AuctionDetails,
} from "@/lib/mock-data/auctions"
import {
  getAuctionById,
  getAuctionBids,
  placeBid,
} from "@/lib/data/auctions-real"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"
// Phase 11.27 — IntegerInput prevents wheel/arrow-key/spinner from
// silently mutating bid/share inputs.
import { IntegerInput } from "@/components/ui/IntegerInput"

const fmt = (n: number) => n.toLocaleString("en-US")

// ─── Countdown hook ────────────────────────────────────────
function useCountdown(endsAt: string) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0, total: 0, ended: false })

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setParts({ d: 0, h: 0, m: 0, s: 0, total: 0, ended: true })
        return
      }
      const total = Math.floor(diff / 1000)
      const d = Math.floor(diff / 86_400_000)
      const h = Math.floor((diff % 86_400_000) / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1000)
      setParts({ d, h, m, s, total, ended: false })
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [endsAt])

  return parts
}

type TFn = (key: string, values?: Record<string, string | number>) => string

function timeAgo(dateStr: string, t: TFn) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return t("nowLabel")
  if (m < 60) return t("minsAgo", { n: m })
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return t("hoursAgo", { n: h })
  return t("daysAgo", { n: Math.floor(diff / 86_400_000) })
}

// ════════════════════════════════════════════════════════════════
export default function AuctionDetailsPage() {
  const router = useRouter()
  const t = useTranslations("auctions")
  const tc = useTranslations("common")
  const params = useParams()
  const auctionId = (params?.id as string) ?? ""

  // Mock first-paint, real DB on mount.
  const [auction, setAuction] = useState<AuctionDetails | undefined>(
    getAuctionByIdMock(auctionId),
  )
  const [bids, setBids] = useState<AuctionBid[]>(
    getAuctionBidsMock(auctionId, 10),
  )
  const [showBidModal, setShowBidModal] = useState(false)
  const [bidShares, setBidShares] = useState("1")
  const [bidPrice, setBidPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    const [a, b] = await Promise.all([
      getAuctionById(auctionId),
      getAuctionBids(auctionId, 10),
    ])
    if (a) setAuction(a)
    if (b.length > 0) setBids(b)
  }

  useEffect(() => {
    let cancelled = false
    refresh().catch(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId])

  const countdown = useCountdown(auction?.ends_at ?? new Date().toISOString())

  if (!auction) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">
            <PageHeader title={t("detailsTitle")} backHref="/auctions" />
            <EmptyState
              icon="🔍"
              title={t("notFoundTitle")}
              description={t("notFoundDesc")}
              action={{ label: t("allAuctions"), href: "/auctions" }}
              size="lg"
            />
          </div>
        </div>
      </AppLayout>
    )
  }

  const currentHighest = bids[0]?.amount ?? auction.current_highest_bid
  const minBidPrice = currentHighest + auction.min_increment

  // ─── Status / urgency ────────────────────────────────────
  const totalSecondsLeft = countdown.total
  const urgent = !countdown.ended && totalSecondsLeft < 3600
  const warning = !countdown.ended && totalSecondsLeft < 21_600 && !urgent

  const statusLabel = countdown.ended ? t("stEnded") : auction.status === "upcoming" ? t("stUpcoming") : t("stActive")
  const statusColor: "red" | "yellow" | "green" | "neutral" =
    countdown.ended ? "neutral" :
    urgent ? "red" :
    warning ? "yellow" : "green"

  // ─── Bid validation ───────────────────────────────────────
  const sharesNum = parseInt(bidShares) || 0
  const priceNum = parseInt(bidPrice) || 0
  const total = sharesNum * priceNum
  const priceValid = priceNum >= minBidPrice
  const sharesValid = sharesNum >= 1 && sharesNum <= auction.shares_offered
  const canSubmit = priceValid && sharesValid && !submitting && !countdown.ended

  // ─── Quick add buttons ───────────────────────────────────
  const handleQuickAdd = (delta: number) => {
    const newPrice = Math.max(minBidPrice, priceNum) + delta
    setBidPrice(String(newPrice))
  }

  const handleSubmitBid = async () => {
    if (!canSubmit) {
      if (!priceValid) showError(t("minBidToast", { amount: fmt(minBidPrice) }))
      else if (!sharesValid) showError(t("invalidShares"))
      return
    }
    setSubmitting(true)
    const result = await placeBid(auctionId, priceNum, sharesNum)
    setSubmitting(false)

    if (result.success) {
      showSuccess(t("bidSuccess", { amount: fmt(total) }))
      setShowBidModal(false)
      setBidShares("1")
      setBidPrice("")
      await refresh()
      return
    }

    // Friendly error mapping.
    if (result.reason === "amount_below_min" && result.min_required) {
      showError(t("minBidToast", { amount: fmt(result.min_required) }))
    } else if (result.reason === "shares_exceed_offered") {
      showError(t("maxShares", { n: result.max_shares ?? "" }))
    } else if (result.reason === "auction_not_active") {
      showError(t("notActive"))
    } else if (result.reason === "expired") {
      showError(t("auctionEnded"))
    } else if (result.reason === "not_started") {
      showError(t("notStarted"))
    } else if (result.reason === "unauthenticated") {
      showError(t("loginToBid"))
    } else if (result.reason === "missing_table") {
      showError(t("featureUnavailable"))
    } else {
      showError(result.error || t("bidFailed"))
    }
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title={t("detailsTitle")}
            subtitle={auction.project_name}
            backHref="/auctions"
          />

          {/* ═══ § 1: Hero Card with countdown ═══ */}
          <Card variant="gradient" color={statusColor === "red" ? "red" : statusColor === "yellow" ? "yellow" : "purple"} className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-purple-400/[0.15] border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                  <Gavel className="w-6 h-6 text-purple-400" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">{auction.project_name}</h2>
                  <p className="text-[11px] text-neutral-400 truncate">{auction.company_name}</p>
                </div>
              </div>
              <Badge color={statusColor} variant="soft">{statusLabel}</Badge>
            </div>

            {/* Countdown */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4">
              <div className="text-[11px] text-neutral-400 mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" strokeWidth={2} />
                {countdown.ended ? t("auctionEndedLabel") : t("endsWithin")}
              </div>
              {countdown.ended ? (
                <div className="text-2xl font-bold text-neutral-500">—</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: countdown.d, label: t("days") },
                    { v: countdown.h, label: t("hours") },
                    { v: countdown.m, label: t("minutes") },
                    { v: countdown.s, label: t("seconds") },
                  ].map((cp, i) => (
                    <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
                      <div className={cn(
                        "text-2xl font-bold font-mono",
                        urgent ? "text-red-400" : warning ? "text-yellow-400" : "text-white",
                      )}>
                        {String(cp.v).padStart(2, "0")}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-0.5">{cp.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* ═══ § 2: 4 stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
            <StatCard label={t("startingPrice")} value={fmt(auction.starting_price)} />
            <StatCard
              label={t("highestBid")}
              value={fmt(currentHighest)}
              color="green"
              trend={{ value: Math.round((currentHighest / auction.starting_price - 1) * 100), direction: "up" }}
            />
            <StatCard
              label={t("bidsCount")}
              value={bids.length || auction.bid_count}
              color="blue"
              icon={<Users className="w-3 h-3" />}
            />
            <StatCard
              label={t("sharesOffered")}
              value={auction.shares_offered}
              color="yellow"
            />
          </div>

          {/* ═══ § 3: Auction details ═══ */}
          <Card className="mb-6">
            <SectionHeader title={t("detailsCardTitle")} />
            <div className="divide-y divide-white/[0.04]">
              {[
                { label: t("auctionType"), value: auction.type === "english" ? t("englishType") : t("dutchType") },
                { label: t("minIncrement"), value: fmt(auction.min_increment) + " " + t("iqd") },
                { label: t("startTime"), value: new Date(auction.starts_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) },
                { label: t("endTime"), value: new Date(auction.ends_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) },
                { label: t("ownerCompany"), value: auction.company_name },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2.5">
                  <span className="text-[11px] text-neutral-500">{row.label}</span>
                  <span className="text-xs font-bold text-white" dir="ltr">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ═══ § 4: Bids history ═══ */}
          <Card className="mb-6" padding="sm">
            <div className="px-2 py-2">
              <SectionHeader
                title={t("bidsHistoryTitle")}
                subtitle={`${t("bidsCountLabel", { n: bids.length })} ${bids.length > 0 ? t("newestFirst") : ""}`}
              />
            </div>
            {bids.length === 0 ? (
              <EmptyState
                icon="📭"
                title={t("noBids")}
                description={t("beFirst")}
                size="sm"
              />
            ) : (
              <div className="space-y-1">
                {bids.map((bid, i) => (
                  <div
                    key={bid.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      i === 0 ? "bg-green-400/[0.06] border border-green-400/20" : "bg-white/[0.03] border border-white/[0.05]",
                      bid.is_current_user && "ring-1 ring-blue-400/40",
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {bid.bidder_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs font-bold truncate", bid.is_current_user ? "text-blue-400" : "text-white")}>
                          {bid.bidder_name}
                        </span>
                        {i === 0 && <Badge color="green" variant="soft" size="xs">{t("topBid")}</Badge>}
                        {bid.is_current_user && !bid.is_current_user === false && i !== 0 && (
                          <Badge color="blue" variant="soft" size="xs">{t("you")}</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{timeAgo(bid.created_at, t)}</div>
                    </div>
                    <div className={cn(
                      "text-sm font-bold font-mono flex-shrink-0",
                      i === 0 ? "text-green-400" : "text-white",
                    )}>
                      {fmt(bid.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ═══ § 5: Submit bid CTA ═══ */}
          <button
            onClick={() => {
              setBidPrice(String(minBidPrice))
              setShowBidModal(true)
            }}
            disabled={countdown.ended}
            className={cn(
              "w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors mb-6",
              countdown.ended
                ? "bg-white/[0.05] text-neutral-500 cursor-not-allowed"
                : "bg-neutral-100 text-black hover:bg-neutral-200",
            )}
          >
            <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
            {countdown.ended ? t("auctionFinished") : t("submitYourBid")}
          </button>

          {/* ═══ § 6: Rules ═══ */}
          <Card variant="highlighted" color="yellow">
            <div className="text-xs font-bold text-yellow-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              {t("rulesTitle")}
            </div>
            <ul className="space-y-2 text-[11px] text-yellow-300/90 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                {t("minIncrement")}: <span className="font-mono font-bold">{fmt(auction.min_increment)}</span> {t("iqd")}
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                {t("ruleCommissionPre")} <span className="font-bold">2%</span> {t("ruleCommissionPost")}
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                {t("rulePaymentPre")} <span className="font-bold">{t("ruleHours")}</span> {t("rulePaymentPost")}
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                {t("ruleNoWithdraw")}
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                {t("ruleWinnerTakesAll")}
              </li>
            </ul>
          </Card>

        </div>
      </div>

      {/* ═══ Bid Modal ═══ */}
      {showBidModal && (
        <Modal
          isOpen={showBidModal}
          onClose={() => !submitting && setShowBidModal(false)}
          title={t("modalTitle")}
          subtitle={t("modalSubtitle", { amount: fmt(currentHighest) })}
          size="md"
          footer={
            <>
              <button
                onClick={() => setShowBidModal(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                {tc("buttons.cancel")}
              </button>
              <button
                onClick={handleSubmitBid}
                disabled={!canSubmit}
                className={cn(
                  "flex-[2] py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  canSubmit
                    ? "bg-neutral-100 text-black hover:bg-neutral-200"
                    : "bg-white/[0.05] text-neutral-500 cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  <>
                    {t("confirmBid")}
                    <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Shares input */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">{t("sharesCount")}</div>
              <IntegerInput
                value={bidShares}
                onValueChange={setBidShares}
                max={auction.shares_offered}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono text-center transition-colors"
                dir="ltr"
              />
              <div className="text-[10px] text-neutral-500 mt-1">
                {t("offeredLabel")} <span className="font-mono">{auction.shares_offered}</span> {t("shareUnit")}
              </div>
            </div>

            {/* Price input */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">{t("pricePerShareLabel")}</div>
              <IntegerInput
                value={bidPrice}
                onValueChange={setBidPrice}
                placeholder={fmt(minBidPrice)}
                className={cn(
                  "w-full bg-white/[0.05] border focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono text-center transition-colors",
                  bidPrice && !priceValid ? "border-red-500/40" : "border-white/[0.08]",
                )}
                dir="ltr"
              />
              <div className={cn(
                "text-[10px] mt-1",
                bidPrice && !priceValid ? "text-red-400" : "text-neutral-500",
              )}>
                {t("minYourBidLabel")} <span className="font-mono font-bold">{fmt(minBidPrice)}</span> {t("iqd")}
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              {[5000, 10000, 25000].map((delta) => (
                <button
                  key={delta}
                  onClick={() => handleQuickAdd(delta)}
                  className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-blue-400 text-[11px] font-bold py-2 rounded-lg transition-colors"
                >
                  +{(delta / 1000)}K
                </button>
              ))}
            </div>

            {/* Summary */}
            {sharesNum > 0 && priceNum > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-400">{t("totalLabel")}</span>
                  <span className="text-base font-bold text-white font-mono">
                    {fmt(total)} <span className="text-[10px] text-neutral-500 font-sans">{t("iqd")}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}
