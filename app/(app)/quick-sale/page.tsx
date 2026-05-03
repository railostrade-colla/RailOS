"use client"

import { useEffect, useState, useCallback } from "react"
import { Zap, Lock, ShoppingCart, TrendingDown, Plus, Clock, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  getSubscriptionStatus,
  getQuickSaleListings,
  QS_SUBSCRIPTION_FEE,
  type QuickSaleListing,
  type SubscriptionStatus,
} from "@/lib/data/quick-sale"
import { SubscriptionModal } from "@/components/quick-sale/SubscriptionModal"
import { CreateListingModal } from "@/components/quick-sale/CreateListingModal"
import { QuickSaleListingCard } from "@/components/quick-sale/QuickSaleListingCard"

const EMPTY_STATUS: SubscriptionStatus = {
  active: false,
  expires_at: null,
  days_left: 0,
  near_expiry: false,
  row: null,
}

export default function QuickSalePage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SubscriptionStatus>(EMPTY_STATUS)
  const [showSubModal, setShowSubModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [listings, setListings] = useState<QuickSaleListing[]>([])
  const [activeTab, setActiveTab] = useState<"sell" | "buy">("sell")

  const isSubscribed = status.active

  const loadListings = useCallback(async () => {
    const data = await getQuickSaleListings()
    setListings(data)
  }, [])

  const checkAccess = useCallback(async () => {
    setLoading(true)
    const s = await getSubscriptionStatus()
    setStatus(s)
    if (s.active) {
      await loadListings()
    }
    setLoading(false)
  }, [loadListings])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-sm text-neutral-400">جاري التحقّق...</div>
        </div>
      </AppLayout>
    )
  }

  // ─── Non-subscriber: hero + subscription gate ──────────────
  if (!isSubscribed) {
    return (
      <AppLayout>
        <div className="relative">
          <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
            <PageHeader
              badge="⚡ QUICK SALE · اشتراك"
              title="البيع السريع"
              description="حلول استثنائية للبيع والشراء بأسعار مميّزة"
              showBack
            />

            {/* Hero block */}
            <div className="text-center py-8 mb-6">
              <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#FB923C] to-[#F87171] flex items-center justify-center shadow-2xl shadow-orange-400/20">
                <Zap size={40} className="text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                وصول دائم لعروض حصرية
              </h1>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                اشترك مرّة واحدة واحصل على فرص استثنائية للبيع والشراء بأسعار
                ديناميكية أقل من السوق
              </p>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-white/[0.05] rounded-2xl p-5 border border-white/[0.06] text-center">
                <TrendingDown
                  size={28}
                  className="text-[#4ADE80] mb-3 mx-auto"
                  strokeWidth={2}
                />
                <h3 className="font-bold text-white mb-1 text-sm">
                  أسعار حصرية
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  بيع بـ 15% أقل من السوق تلقائياً
                </p>
              </div>
              <div className="bg-white/[0.05] rounded-2xl p-5 border border-white/[0.06] text-center">
                <Zap
                  size={28}
                  className="text-[#FBBF24] mb-3 mx-auto"
                  strokeWidth={2}
                />
                <h3 className="font-bold text-white mb-1 text-sm">
                  تنفيذ سريع
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  صفقات فورية مع المشتركين الموثوقين
                </p>
              </div>
              <div className="bg-white/[0.05] rounded-2xl p-5 border border-white/[0.06] text-center">
                <ShoppingCart
                  size={28}
                  className="text-[#60A5FA] mb-3 mx-auto"
                  strokeWidth={2}
                />
                <h3 className="font-bold text-white mb-1 text-sm">
                  عروض شراء
                </h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  حدّد نسبة الخصم بنفسك (3-10%)
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <button
                onClick={() => setShowSubModal(true)}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#FB923C] to-[#F87171] hover:opacity-90 rounded-xl font-bold text-white transition-opacity shadow-lg"
              >
                <Lock size={16} strokeWidth={2.5} />
                اشترك الآن ({QS_SUBSCRIPTION_FEE.toLocaleString("en-US")} وحدة
                رسوم / شهر)
              </button>
              <p className="text-[11px] text-neutral-500 mt-3">
                اشتراك شهري — صالح لـ 30 يوم وقابل للتجديد
              </p>
            </div>
          </div>
        </div>

        {showSubModal && (
          <SubscriptionModal
            onClose={() => setShowSubModal(false)}
            onSuccess={() => {
              setShowSubModal(false)
              checkAccess()
            }}
          />
        )}
      </AppLayout>
    )
  }

  // ─── Subscriber view ───────────────────────────────────────
  const sellListings = listings.filter((l) => l.type === "sell")
  const buyListings = listings.filter((l) => l.type === "buy")
  const displayedListings = activeTab === "sell" ? sellListings : buyListings

  return (
    <AppLayout>
      <div className="relative">
        <div className="relative z-10 px-3 lg:px-8 py-6 lg:py-12 max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Zap
                  size={22}
                  className="text-[#FB923C]"
                  strokeWidth={2.5}
                />
                <h1 className="text-2xl font-bold text-white">البيع السريع</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30">
                  مشترك ✓
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                عروض حصرية للمشتركين فقط
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#F87171] hover:opacity-90 rounded-xl font-bold text-white text-sm transition-opacity"
            >
              <Plus size={14} strokeWidth={2.5} />
              إعلان جديد
            </button>
          </div>

          {/* Subscription status banner */}
          {status.active && (
            <div
              className={`mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 flex-wrap text-xs ${
                status.near_expiry
                  ? "bg-[#FBBF24]/[0.08] border-[#FBBF24]/30 text-[#FBBF24]"
                  : "bg-[#4ADE80]/[0.06] border-[#4ADE80]/25 text-[#4ADE80]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock size={14} strokeWidth={2.5} />
                <span className="font-bold">
                  {status.near_expiry
                    ? `اشتراكك ينتهي خلال ${status.days_left} يوم`
                    : `اشتراكك نشط — متبقّي ${status.days_left} يوم`}
                </span>
                {status.expires_at && (
                  <span className="text-[10px] opacity-80 font-mono" dir="ltr">
                    · ينتهي {status.expires_at.split("T")[0]}
                  </span>
                )}
              </div>
              {status.near_expiry && (
                <button
                  onClick={() => setShowSubModal(true)}
                  className="bg-[#FBBF24]/20 hover:bg-[#FBBF24]/30 border border-[#FBBF24]/40 rounded-lg px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5"
                >
                  <RefreshCw size={11} strokeWidth={2.5} />
                  جدّد الآن (+30 يوم)
                </button>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4 bg-white/[0.04] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("sell")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                activeTab === "sell"
                  ? "bg-[#F87171]/15 text-[#F87171]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              🔥 إعلانات بيع ({sellListings.length})
            </button>
            <button
              onClick={() => setActiveTab("buy")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                activeTab === "buy"
                  ? "bg-[#4ADE80]/15 text-[#4ADE80]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              💰 إعلانات شراء ({buyListings.length})
            </button>
          </div>

          {/* Info banner */}
          <div
            className={`mb-4 p-3 rounded-xl border text-xs ${
              activeTab === "sell"
                ? "bg-[#F87171]/5 border-[#F87171]/20 text-[#F87171]"
                : "bg-[#4ADE80]/5 border-[#4ADE80]/20 text-[#4ADE80]"
            }`}
          >
            {activeTab === "sell"
              ? "💡 إعلانات البيع: السعر تلقائياً 15% أقل من سعر السوق"
              : "💡 إعلانات الشراء: المشتري يحدّد نسبة الخصم (3% - 10%)"}
          </div>

          {/* Listings */}
          {displayedListings.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3 opacity-50">
                {activeTab === "sell" ? "🔥" : "💰"}
              </div>
              <p className="text-sm text-neutral-400 mb-4">
                لا توجد {activeTab === "sell" ? "إعلانات بيع" : "إعلانات شراء"}{" "}
                حالياً
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs font-bold text-white transition-colors"
              >
                <Plus size={12} strokeWidth={2.5} />
                أنشئ أوّل إعلان
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedListings.map((l) => (
                <QuickSaleListingCard
                  key={l.id}
                  listing={l}
                  onUpdate={loadListings}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadListings()
          }}
        />
      )}

      {/* Renewal modal (re-uses SubscriptionModal — shows "تجديد" copy) */}
      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          onSuccess={() => {
            setShowSubModal(false)
            checkAccess()
          }}
        />
      )}
    </AppLayout>
  )
}
