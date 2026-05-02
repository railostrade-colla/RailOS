"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Copy, Check, Calendar, MapPin } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, SectionHeader, Modal, Badge, EmptyState } from "@/components/ui"
import {
  getDiscountById,
  claimCoupon,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  type UserCoupon,
} from "@/lib/mock-data/discounts"
import { showError, showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const fmtNum = (n: number) => n.toLocaleString("en-US")

// Simple SVG barcode generator (visual only — code-39 style)
function Barcode({ value }: { value: string }) {
  const bars = value.split("").map((digit, i) => ({
    width: parseInt(digit) % 3 + 1,
    isBar: i % 2 === 0,
  }))
  return (
    <svg viewBox={`0 0 ${bars.reduce((s, b) => s + b.width + 1, 0)} 60`} className="w-full h-16">
      {(() => {
        let x = 0
        return bars.map((b, i) => {
          const rect = b.isBar ? <rect key={i} x={x} y={0} width={b.width} height={60} fill="#000" /> : null
          x += b.width + 1
          return rect
        })
      })()}
    </svg>
  )
}

export default function DiscountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const discount = getDiscountById(id)
  const [showCoupon, setShowCoupon] = useState<UserCoupon | null>(null)
  const [copied, setCopied] = useState(false)

  if (!discount) {
    return (
      <AppLayout>
        <div className="relative">
          <GridBackground showCircles={false} />
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader title="غير موجود" />
            <EmptyState icon="🔍" title="هذا الخصم غير متاح" action={{ label: "العودة للخصومات", onClick: () => router.push("/discounts") }} />
          </div>
        </div>
      </AppLayout>
    )
  }

  const cat = CATEGORY_LABELS[discount.category]
  const lvl = LEVEL_LABELS[discount.required_level]
  const daysLeft = Math.max(0, Math.ceil((new Date(discount.ends_at).getTime() - Date.now()) / 86_400_000))

  const handleClaim = () => {
    const coupon = claimCoupon("me", discount)
    setShowCoupon(coupon)
    showSuccess("✅ تم الحصول على القسيمة")
  }

  const handleCopy = async () => {
    if (!showCoupon) return
    try {
      await navigator.clipboard.writeText(showCoupon.code)
      setCopied(true)
      showSuccess("تم نسخ الرمز")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError("تعذّر النسخ")
    }
  }

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto pb-20">

          <PageHeader title={discount.brand_name} subtitle={cat.label} />

          {/* Hero */}
          <Card variant="gradient" color={discount.cover_color} padding="lg" className="mb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center text-5xl",
                  discount.cover_color === "red"    && "bg-red-400/[0.1] border border-red-400/[0.3]",
                  discount.cover_color === "blue"   && "bg-blue-400/[0.1] border border-blue-400/[0.3]",
                  discount.cover_color === "purple" && "bg-purple-400/[0.1] border border-purple-400/[0.3]",
                  discount.cover_color === "orange" && "bg-orange-400/[0.1] border border-orange-400/[0.3]",
                  discount.cover_color === "green"  && "bg-green-400/[0.1] border border-green-400/[0.3]",
                  discount.cover_color === "yellow" && "bg-yellow-400/[0.1] border border-yellow-400/[0.3]",
                )}>
                  {discount.brand_logo_emoji}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{discount.brand_name}</div>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-1">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                </div>
              </div>
              <div className={cn(
                "px-4 py-3 rounded-2xl text-2xl font-bold",
                discount.cover_color === "red"    && "bg-red-400/[0.2] border border-red-400/[0.4] text-red-400",
                discount.cover_color === "blue"   && "bg-blue-400/[0.2] border border-blue-400/[0.4] text-blue-400",
                discount.cover_color === "purple" && "bg-purple-400/[0.2] border border-purple-400/[0.4] text-purple-400",
                discount.cover_color === "orange" && "bg-orange-400/[0.2] border border-orange-400/[0.4] text-orange-400",
                discount.cover_color === "green"  && "bg-green-400/[0.2] border border-green-400/[0.4] text-green-400",
                discount.cover_color === "yellow" && "bg-yellow-400/[0.2] border border-yellow-400/[0.4] text-yellow-400",
              )}>
                -{discount.discount_percent}%
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card padding="md" className="mb-3">
            <div className="text-base font-bold text-white mb-2">📝 الوصف</div>
            <div className="text-sm text-neutral-200 leading-relaxed">{discount.description}</div>
          </Card>

          {/* Conditions */}
          {discount.conditions.length > 0 && (
            <Card padding="md" className="mb-3">
              <div className="text-base font-bold text-white mb-3">📋 الشروط</div>
              <div className="space-y-2">
                {discount.conditions.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                    <span className="text-yellow-400 flex-shrink-0">•</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Period */}
          <Card padding="md" className="mb-3">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              <div className="text-base font-bold text-white">⏰ المدّة</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-neutral-500 mb-0.5">يبدأ</div>
                <div className="text-white font-mono" dir="ltr">{discount.starts_at}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 mb-0.5">ينتهي</div>
                <div className="text-white font-mono" dir="ltr">{discount.ends_at}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.05] text-[11px] text-yellow-400 text-center">
              ⏳ متبقّي <span className="font-bold font-mono">{daysLeft}</span> يوماً
            </div>
          </Card>

          {/* Branches */}
          <Card padding="md" className="mb-3">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-4 h-4 text-green-400" strokeWidth={1.5} />
              <div className="text-base font-bold text-white">📍 الفروع المشاركة</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {discount.branches.map((b, i) => (
                <span key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-neutral-300">
                  📍 {b}
                </span>
              ))}
            </div>
          </Card>

          {/* Required level */}
          <Card padding="md" className="mb-5">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{lvl.icon}</div>
              <div>
                <div className="text-[10px] text-neutral-500">المستوى المطلوب</div>
                <div className="text-sm text-white font-bold">{lvl.label} فأعلى</div>
              </div>
            </div>
          </Card>

          {/* CTA */}
          <button
            onClick={handleClaim}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-base font-bold hover:from-orange-600 hover:to-pink-600 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            احصل على القسيمة
          </button>

        </div>
      </div>

      {/* Coupon modal */}
      <Modal
        isOpen={!!showCoupon}
        onClose={() => setShowCoupon(null)}
        title="🎟️ قسيمتك"
        subtitle={discount.brand_name}
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowCoupon(null)
                showSuccess("💾 تم حفظ القسيمة في قسائمي")
                router.push("/discounts/my-coupons")
              }}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm hover:bg-white/[0.08]"
            >
              💾 حفظ في قسائمي
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-black text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "تم النسخ" : "نسخ الرمز"}
            </button>
          </>
        }
      >
        {showCoupon && (
          <>
            <Card variant="gradient" color={discount.cover_color} padding="md" className="mb-4 text-center">
              <div className="text-5xl mb-2">{discount.brand_logo_emoji}</div>
              <div className="text-base font-bold text-white mb-1">{discount.brand_name}</div>
              <div className={cn(
                "text-3xl font-bold font-mono mt-2",
                discount.cover_color === "red"    && "text-red-400",
                discount.cover_color === "blue"   && "text-blue-400",
                discount.cover_color === "purple" && "text-purple-400",
                discount.cover_color === "orange" && "text-orange-400",
                discount.cover_color === "green"  && "text-green-400",
                discount.cover_color === "yellow" && "text-yellow-400",
              )}>
                -{discount.discount_percent}%
              </div>
            </Card>

            {/* Barcode */}
            <div className="bg-white rounded-xl p-4 mb-4">
              <Barcode value={showCoupon.barcode} />
              <div className="text-center font-mono text-sm text-black mt-1 tracking-widest" dir="ltr">{showCoupon.barcode}</div>
            </div>

            {/* Code */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 mb-3">
              <div className="text-[10px] text-neutral-500 mb-1 text-center">رمز الكوبون</div>
              <div className="text-lg font-mono font-bold text-white text-center tracking-widest" dir="ltr">{showCoupon.code}</div>
            </div>

            <div className="bg-yellow-400/[0.05] border border-yellow-400/[0.2] rounded-xl p-3 text-[11px] text-yellow-400 text-center">
              📱 اعرض هذا للموظّف عند الدفع · صالح حتى {showCoupon.expires_at}
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  )
}
