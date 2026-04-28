"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
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
  getAuctionById,
  getAuctionBids,
  type AuctionBid,
} from "@/lib/mock-data/auctions"
import { showSuccess, showError } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "الآن"
  if (m < 60) return "منذ " + m + " د"
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return "منذ " + h + " س"
  return "منذ " + Math.floor(diff / 86_400_000) + " ي"
}

// ════════════════════════════════════════════════════════════════
export default function AuctionDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const auctionId = (params?.id as string) ?? ""

  const auction = useMemo(() => getAuctionById(auctionId), [auctionId])
  const initialBids = useMemo(() => getAuctionBids(auctionId, 10), [auctionId])

  const [bids, setBids] = useState<AuctionBid[]>(initialBids)
  const [showBidModal, setShowBidModal] = useState(false)
  const [bidShares, setBidShares] = useState("1")
  const [bidPrice, setBidPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const countdown = useCountdown(auction?.ends_at ?? new Date().toISOString())

  if (!auction) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">
            <PageHeader title="تفاصيل المزاد" backHref="/auctions" />
            <EmptyState
              icon="🔍"
              title="المزاد غير موجود"
              description="ربما انتهى أو تم حذفه"
              action={{ label: "كل المزادات", href: "/auctions" }}
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

  const statusLabel = countdown.ended ? "منتهي" : auction.status === "upcoming" ? "قريب" : "نشط"
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
      if (!priceValid) showError(`الحد الأدنى لعرضك: ${fmt(minBidPrice)} د.ع`)
      else if (!sharesValid) showError("عدد الحصص غير صحيح")
      return
    }
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))

    const newBid: AuctionBid = {
      id: "new-" + Date.now(),
      auction_id: auctionId,
      bidder_id: "me",
      bidder_name: "أنت",
      amount: priceNum,
      shares: sharesNum,
      is_current_user: true,
      created_at: new Date().toISOString(),
    }
    setBids((prev) => [newBid, ...prev].slice(0, 10))
    showSuccess(`تم تقديم عرضك بنجاح: ${fmt(total)} د.ع`)
    setShowBidModal(false)
    setBidShares("1")
    setBidPrice("")
    setSubmitting(false)
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="تفاصيل المزاد"
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
                {countdown.ended ? "انتهى المزاد" : "ينتهي خلال"}
              </div>
              {countdown.ended ? (
                <div className="text-2xl font-bold text-neutral-500">—</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: countdown.d, label: "أيام" },
                    { v: countdown.h, label: "ساعات" },
                    { v: countdown.m, label: "دقائق" },
                    { v: countdown.s, label: "ثواني" },
                  ].map((t, i) => (
                    <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-center">
                      <div className={cn(
                        "text-2xl font-bold font-mono",
                        urgent ? "text-red-400" : warning ? "text-yellow-400" : "text-white",
                      )}>
                        {String(t.v).padStart(2, "0")}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-0.5">{t.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* ═══ § 2: 4 stats ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
            <StatCard label="السعر الافتتاحي" value={fmt(auction.starting_price)} />
            <StatCard
              label="أعلى عرض حالي"
              value={fmt(currentHighest)}
              color="green"
              trend={{ value: Math.round((currentHighest / auction.starting_price - 1) * 100), direction: "up" }}
            />
            <StatCard
              label="عدد العروض"
              value={bids.length || auction.bid_count}
              color="blue"
              icon={<Users className="w-3 h-3" />}
            />
            <StatCard
              label="الحصص المعروضة"
              value={auction.shares_offered}
              color="yellow"
            />
          </div>

          {/* ═══ § 3: Auction details ═══ */}
          <Card className="mb-6">
            <SectionHeader title="📜 تفاصيل المزاد" />
            <div className="divide-y divide-white/[0.04]">
              {[
                { label: "نوع المزاد", value: auction.type === "english" ? "صعودي إنجليزي" : "هولندي" },
                { label: "الحد الأدنى للزيادة", value: fmt(auction.min_increment) + " د.ع" },
                { label: "وقت البدء", value: new Date(auction.starts_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) },
                { label: "وقت الانتهاء", value: new Date(auction.ends_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) },
                { label: "الشركة المالكة", value: auction.company_name },
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
                title="📊 تاريخ العروض"
                subtitle={`${bids.length} عرض ${bids.length > 0 ? "(الأحدث أولاً)" : ""}`}
              />
            </div>
            {bids.length === 0 ? (
              <EmptyState
                icon="📭"
                title="لا توجد عروض بعد"
                description="كن أوّل من يقدّم عرضاً!"
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
                        {i === 0 && <Badge color="green" variant="soft" size="xs">أعلى عرض</Badge>}
                        {bid.is_current_user && !bid.is_current_user === false && i !== 0 && (
                          <Badge color="blue" variant="soft" size="xs">أنت</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">{timeAgo(bid.created_at)}</div>
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
            {countdown.ended ? "المزاد منتهي" : "💰 تقديم عرضك"}
          </button>

          {/* ═══ § 6: Rules ═══ */}
          <Card variant="highlighted" color="yellow">
            <div className="text-xs font-bold text-yellow-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" strokeWidth={2} />
              📋 شروط المشاركة
            </div>
            <ul className="space-y-2 text-[11px] text-yellow-300/90 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                الحد الأدنى للزيادة: <span className="font-mono font-bold">{fmt(auction.min_increment)}</span> د.ع
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                العمولة: <span className="font-bold">2%</span> من قيمة الفوز
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                الدفع خلال <span className="font-bold">24 ساعة</span> من الفوز
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                لا يمكن سحب العرض بعد التقديم
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                أعلى عرض في النهاية يفوز بكل الحصص
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
          title="💰 قدّم عرضك"
          subtitle={`أعلى عرض حالي: ${fmt(currentHighest)} د.ع`}
          size="md"
          footer={
            <>
              <button
                onClick={() => setShowBidModal(false)}
                disabled={submitting}
                className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-2.5 rounded-xl text-sm hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
              >
                إلغاء
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
                    جاري...
                  </>
                ) : (
                  <>
                    تأكيد العرض
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
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">عدد الحصص</div>
              <input
                type="number"
                value={bidShares}
                onChange={(e) => setBidShares(e.target.value)}
                min="1"
                max={auction.shares_offered}
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white outline-none font-mono text-center transition-colors"
                dir="ltr"
              />
              <div className="text-[10px] text-neutral-500 mt-1">
                المعروض: <span className="font-mono">{auction.shares_offered}</span> حصة
              </div>
            </div>

            {/* Price input */}
            <div>
              <div className="text-[11px] text-neutral-400 mb-1.5 font-bold">السعر للحصة (د.ع)</div>
              <input
                type="number"
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
                min={minBidPrice}
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
                الحد الأدنى لعرضك: <span className="font-mono font-bold">{fmt(minBidPrice)}</span> د.ع
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
                  <span className="text-xs text-neutral-400">المجموع</span>
                  <span className="text-base font-bold text-white font-mono">
                    {fmt(total)} <span className="text-[10px] text-neutral-500 font-sans">د.ع</span>
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
