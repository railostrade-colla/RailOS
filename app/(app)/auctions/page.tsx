"use client"

import { memo, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Gavel, Clock, AlertCircle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { getActiveAuctions } from "@/lib/data/auctions-real"
import { readPersistedSync } from "@/lib/data/cache"
import type { AuctionDetails } from "@/lib/mock-data/auctions"

// Local auction list shape — independent from any mock module.
interface AuctionListItem {
  id: string
  title: string
  project: { name: string }
  shares: number
  opening_price: number
  current_price: number
  ends_at: string
  bids_count: number
}
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

/** Loosely-typed translator so module helpers can localize without
 *  importing next-intl's generic signature. */
type TFn = (key: string, values?: Record<string, string | number>) => string

function useCountdown(endsAt: string, endedLabel: string) {
  const [time, setTime] = useState("")
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setTime(endedLabel)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
    }
    calc()
    const iv = setInterval(calc, 1000)
    return () => clearInterval(iv)
  }, [endsAt, endedLabel])
  return time
}

// Phase 14.12 P4 — memo'd. Rendered in a .map() list; each card runs
// its own 1s countdown interval (useCountdown). Without memo, a
// parent re-render (realtime refresh / nav) would re-render every
// card and re-create its interval. `onClick` is a fresh lambda per
// render at the call site, so memo is paired with a stable handler
// there (see the .map below).
function AuctionCardImpl({ auction, onClick }: { auction: AuctionListItem; onClick: () => void }) {
  const t = useTranslations("auctions")
  const countdown = useCountdown(auction.ends_at, t("ended"))
  const isUrgent = new Date(auction.ends_at).getTime() - Date.now() < 3600000 // أقل من ساعة
  const minBidIncrease = Math.floor(auction.current_price * 0.03)

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-white/[0.05] border rounded-2xl p-4 hover:bg-white/[0.07] transition-colors text-right",
        isUrgent ? "border-red-400/20" : "border-white/[0.08]"
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-white mb-1 truncate">{auction.title}</div>
          <div className="text-[11px] text-neutral-500">
            {auction.project.name} • {auction.shares} {t("shareUnit")} • {auction.bids_count} {t("bidsUnit")}
          </div>
        </div>
        <div className={cn(
          "rounded-lg px-3 py-1.5 text-center flex-shrink-0 border",
          isUrgent
            ? "bg-red-400/10 border-red-400/20 text-red-400"
            : "bg-green-400/10 border-green-400/20 text-green-400"
        )}>
          <div className="text-[9px] mb-0.5">{isUrgent ? t("endingSoon") : t("timeRemaining")}</div>
          <div className="text-xs font-bold font-mono">{countdown}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[10px] text-neutral-500 mb-1">{t("highestBid")}</div>
          <div className="text-lg font-bold text-white font-mono">{fmtIQD(auction.current_price)}</div>
          <div className="text-[10px] text-neutral-500">IQD</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[10px] text-neutral-500 mb-1">{t("openingPrice")}</div>
          <div className="text-base font-bold text-neutral-400 font-mono">{fmtIQD(auction.opening_price)}</div>
          <div className="text-[10px] text-neutral-500">IQD</div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-neutral-500">
          {t("minBidLabel")} <span className="text-white font-mono">+{minBidIncrease.toLocaleString("en-US")}</span> IQD
        </span>
        <div className="bg-neutral-100 text-black px-4 py-1.5 rounded-lg text-xs font-bold">
          {t("placeBid")}
        </div>
      </div>
    </button>
  )
}

// Phase 14.12 P4 — memo'd export. The .map() below passes a stable
// per-render router.push lambda; memo still helps because the
// `auction` object reference is stable across the parent's realtime
// refreshes (it comes from the mapped cache array).
const AuctionCard = memo(AuctionCardImpl)

// Phase 14.10 D — same row-mapping the useEffect used to do inline,
// now a pure helper so first paint and subsequent refreshes share
// one transform. AuctionDetails is the row shape produced by
// `lib/data/auctions-real.ts`.
function mapAuctionRows(rows: AuctionDetails[], t: TFn): AuctionListItem[] {
  return rows.map((a) => ({
    id: a.id,
    title: t("auctionOnTitle", { name: a.project_name }),
    project: { name: a.project_name },
    shares: a.shares_offered,
    opening_price: a.starting_price,
    current_price:
      a.current_highest_bid > 0 ? a.current_highest_bid : a.starting_price,
    ends_at: a.ends_at,
    bids_count: a.bid_count,
  }))
}

export default function AuctionsPage() {
  const router = useRouter()
  const t = useTranslations("auctions")
  // Phase 14.10 D — hydrate synchronously from the SWR cache so the
  // page renders the previously-known list on first paint. The
  // background fetcher then refreshes with the latest from the DB.
  // Cache key matches `getActiveAuctions`'s dedupCache key.
  const [auctions, setAuctions] = useState<AuctionListItem[]>(() => {
    const cached = readPersistedSync<AuctionDetails[]>("auctions:active")
    return cached ? mapAuctionRows(cached, t) : []
  })

  useEffect(() => {
    let cancelled = false
    getActiveAuctions().then((rows) => {
      if (!cancelled) setAuctions(mapAuctionRows(rows, t))
    })
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title={t("title")}
            subtitle={t("subtitle")}
          />

          {/* Status banner */}
          <div className="bg-green-400/[0.06] border border-green-400/20 rounded-xl p-3 mb-4 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-bold">{t("activeNow")}</span>
            <span className="text-xs text-neutral-400">• {t("availableNow", { n: auctions.length })}</span>
          </div>

          {/* Empty state */}
          {auctions.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                <Gavel className="w-7 h-7 text-neutral-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white mb-1.5">{t("noActiveAuctions")}</div>
              <div className="text-xs text-neutral-500">{t("checkLater")}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {auctions.map((a) => (
                <AuctionCard key={a.id} auction={a} onClick={() => router.push(`/auctions/${a.id}`)} />
              ))}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
