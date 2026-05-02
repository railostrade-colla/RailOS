"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Gavel, Clock, AlertCircle } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { mockAuctions } from "@/lib/mock-data"
import { cn } from "@/lib/utils/cn"

const fmtIQD = (n: number) => n.toLocaleString("en-US")

function useCountdown(endsAt: string) {
  const [time, setTime] = useState("")
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setTime("انتهى")
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [endsAt])
  return time
}

function AuctionCard({ auction, onClick }: { auction: typeof mockAuctions[0]; onClick: () => void }) {
  const countdown = useCountdown(auction.ends_at)
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
            {auction.project.name} • {auction.shares} حصة • {auction.bids_count} مزايدة
          </div>
        </div>
        <div className={cn(
          "rounded-lg px-3 py-1.5 text-center flex-shrink-0 border",
          isUrgent
            ? "bg-red-400/10 border-red-400/20 text-red-400"
            : "bg-green-400/10 border-green-400/20 text-green-400"
        )}>
          <div className="text-[9px] mb-0.5">{isUrgent ? "ينتهي قريباً" : "الوقت المتبقي"}</div>
          <div className="text-xs font-bold font-mono">{countdown}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[10px] text-neutral-500 mb-1">أعلى عرض حالي</div>
          <div className="text-lg font-bold text-white font-mono">{fmtIQD(auction.current_price)}</div>
          <div className="text-[10px] text-neutral-500">IQD</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[10px] text-neutral-500 mb-1">سعر الافتتاح</div>
          <div className="text-base font-bold text-neutral-400 font-mono">{fmtIQD(auction.opening_price)}</div>
          <div className="text-[10px] text-neutral-500">IQD</div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-neutral-500">
          الحد الأدنى للمزايدة: <span className="text-white font-mono">+{minBidIncrease.toLocaleString("en-US")}</span> IQD
        </span>
        <div className="bg-neutral-100 text-black px-4 py-1.5 rounded-lg text-xs font-bold">
          تقديم عرض
        </div>
      </div>
    </button>
  )
}

export default function AuctionsPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">

          <PageHeader
            title="المزادات"
            subtitle="مزادات نشطة على حصص المشاريع"
          />

          {/* Status banner */}
          <div className="bg-green-400/[0.06] border border-green-400/20 rounded-xl p-3 mb-4 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-bold">نشط الآن</span>
            <span className="text-xs text-neutral-400">• {mockAuctions.length} مزاد متاح حالياً</span>
          </div>

          {/* Empty state */}
          {mockAuctions.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
                <Gavel className="w-7 h-7 text-neutral-400" strokeWidth={1.5} />
              </div>
              <div className="text-base font-bold text-white mb-1.5">لا توجد مزادات نشطة</div>
              <div className="text-xs text-neutral-500">تحقق لاحقاً للاطلاع على المزادات الجديدة</div>
            </div>
          ) : (
            <div className="space-y-3">
              {mockAuctions.map((a) => (
                <AuctionCard key={a.id} auction={a} onClick={() => router.push(`/auctions/${a.id}`)} />
              ))}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
