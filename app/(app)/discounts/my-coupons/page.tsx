"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Eye } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, Tabs, Badge, EmptyState, Modal } from "@/components/ui"
import {
  getMyCoupons as getMyCouponsMock,
  COUPON_STATUS_LABELS,
  type UserCoupon,
} from "@/lib/mock-data/discounts"
import { getMyCoupons } from "@/lib/data/discounts-real"
import { cn } from "@/lib/utils/cn"

function MiniBarcode({ value }: { value: string }) {
  const bars = value.split("").map((digit, i) => ({
    width: parseInt(digit) % 3 + 1,
    isBar: i % 2 === 0,
  }))
  return (
    <svg viewBox={`0 0 ${bars.reduce((s, b) => s + b.width + 1, 0)} 30`} className="w-full h-8">
      {(() => {
        let x = 0
        return bars.map((b, i) => {
          const rect = b.isBar ? <rect key={i} x={x} y={0} width={b.width} height={30} fill="#fff" /> : null
          x += b.width + 1
          return rect
        })
      })()}
    </svg>
  )
}

function FullBarcode({ value }: { value: string }) {
  const bars = value.split("").map((digit, i) => ({
    width: parseInt(digit) % 3 + 1,
    isBar: i % 2 === 0,
  }))
  return (
    <svg viewBox={`0 0 ${bars.reduce((s, b) => s + b.width + 1, 0)} 80`} className="w-full h-32">
      {(() => {
        let x = 0
        return bars.map((b, i) => {
          const rect = b.isBar ? <rect key={i} x={x} y={0} width={b.width} height={80} fill="#000" /> : null
          x += b.width + 1
          return rect
        })
      })()}
    </svg>
  )
}

export default function MyCouponsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"active" | "used" | "expired">("active")
  const [zoomCoupon, setZoomCoupon] = useState<UserCoupon | null>(null)
  const [allCoupons, setAllCoupons] = useState<UserCoupon[]>(
    getMyCouponsMock("abc123def456"),
  )

  useEffect(() => {
    let cancelled = false
    getMyCoupons().then((rows) => {
      if (cancelled) return
      // Show real list always — empty means user has no coupons.
      setAllCoupons(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = allCoupons.filter((c) => c.status === tab)

  return (
    <AppLayout>
      <div className="relative">
<div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader
            title="🎟️ قسائمي"
            subtitle="القسائم التي حصلت عليها"
            rightAction={
              <button
                onClick={() => router.push("/discounts")}
                className="bg-neutral-100 text-black px-3 py-1.5 rounded-md text-xs font-bold hover:bg-neutral-200 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                المزيد
              </button>
            }
          />

          <div className="mb-5">
            <Tabs
              tabs={[
                { id: "active",  icon: "✅", label: "نشطة",       count: allCoupons.filter((c) => c.status === "active").length },
                { id: "used",    icon: "📦", label: "مُستخدَمة", count: allCoupons.filter((c) => c.status === "used").length },
                { id: "expired", icon: "⏰", label: "منتهية",    count: allCoupons.filter((c) => c.status === "expired").length },
              ]}
              activeTab={tab}
              onChange={(id) => setTab(id as "active" | "used" | "expired")}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🎟️"
              title={tab === "active" ? "لا توجد قسائم نشطة" : tab === "used" ? "لم تستخدم قسائم بعد" : "لا توجد قسائم منتهية"}
              description="تصفّح الخصومات واحصل على قسائم"
              action={{ label: "تصفّح الخصومات", onClick: () => router.push("/discounts") }}
              size="md"
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => {
                const status = COUPON_STATUS_LABELS[c.status]
                return (
                  <Card key={c.id} padding="md">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-orange-400/[0.1] border border-orange-400/[0.25] flex items-center justify-center text-2xl flex-shrink-0">
                          {c.brand_logo_emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white">{c.brand_name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{c.code}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-2xl font-bold text-orange-400 leading-none">-{c.discount_percent}%</div>
                        <Badge color={status.color}>{status.label}</Badge>
                      </div>
                    </div>

                    {/* Mini barcode */}
                    {c.status === "active" && (
                      <div className="bg-black border border-white/[0.05] rounded-lg p-2 mb-3">
                        <MiniBarcode value={c.barcode} />
                        <div className="text-center font-mono text-[10px] text-neutral-500 mt-0.5 tracking-wider" dir="ltr">{c.barcode}</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.05]">
                      <div className="text-neutral-500">
                        {c.status === "used" && c.used_at ? `استُخدمت ${c.used_at}` :
                         c.status === "expired" ? `انتهت ${c.expires_at}` :
                         `صالحة حتى ${c.expires_at}`}
                      </div>
                      {c.status === "active" && (
                        <button
                          onClick={() => setZoomCoupon(c)}
                          className="bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" strokeWidth={2} />
                          عرض كبير
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* Zoom modal */}
      <Modal
        isOpen={!!zoomCoupon}
        onClose={() => setZoomCoupon(null)}
        title="🎟️ القسيمة"
        subtitle={zoomCoupon?.brand_name}
        size="md"
      >
        {zoomCoupon && (
          <>
            <Card variant="gradient" color="orange" padding="md" className="mb-4 text-center">
              <div className="text-5xl mb-2">{zoomCoupon.brand_logo_emoji}</div>
              <div className="text-base font-bold text-white mb-1">{zoomCoupon.brand_name}</div>
              <div className="text-3xl font-bold text-orange-400 font-mono mt-2">-{zoomCoupon.discount_percent}%</div>
            </Card>

            <div className="bg-white rounded-xl p-4 mb-4">
              <FullBarcode value={zoomCoupon.barcode} />
              <div className="text-center font-mono text-sm text-black mt-2 tracking-widest" dir="ltr">{zoomCoupon.barcode}</div>
            </div>

            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
              <div className="text-[10px] text-neutral-500 mb-1 text-center">رمز الكوبون</div>
              <div className="text-base font-mono font-bold text-white text-center tracking-widest" dir="ltr">{zoomCoupon.code}</div>
            </div>

            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 text-[11px] text-yellow-400 text-center">
              📱 اعرض هذا للموظّف عند الدفع · صالحة حتى {zoomCoupon.expires_at}
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}
