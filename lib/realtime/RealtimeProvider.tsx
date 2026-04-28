"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { PendingDeal, RealtimeNotification } from "./types"

// Mock current user (سيُستبدل بـ auth حقيقي لاحقاً)
const MOCK_USER_ID = "me"

interface RealtimeContextValue {
  pendingDealAsSeller: PendingDeal | null
  notifications: RealtimeNotification[]
  unreadCount: number
  acceptDeal: (dealId: string) => Promise<void>
  rejectDeal: (dealId: string) => Promise<void>
  createDeal: (deal: Omit<PendingDeal, "id" | "status" | "created_at">) => Promise<PendingDeal>
  markNotificationRead: (id: string) => void
  markAllRead: () => void
  dismissPendingDeal: () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pendingDealAsSeller, setPendingDealAsSeller] = useState<PendingDeal | null>(null)
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([])

  const unreadCount = notifications.filter((n) => !n.read).length

  // محاكاة استلام صفقة (للتطوير - يُستبدل بـ Supabase Realtime لاحقاً)
  const simulateIncomingDeal = useCallback((deal: PendingDeal) => {
    if (deal.seller_id === MOCK_USER_ID) {
      setPendingDealAsSeller(deal)
      // صوت تنبيه (اختياري)
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRn4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVoAAAA=")
        audio.volume = 0.3
        audio.play().catch(() => {})
      } catch {}
    }
  }, [])

  // إنشاء صفقة جديدة (المشتري يضغط شراء)
  const createDeal = useCallback(async (deal: Omit<PendingDeal, "id" | "status" | "created_at">): Promise<PendingDeal> => {
    const newDeal: PendingDeal = {
      ...deal,
      id: `deal_${Date.now()}`,
      status: "pending",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 دقائق للرد
    }

    // إضافة إشعار للمشتري
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}_buyer`,
        user_id: deal.buyer_id,
        type: "deal_request",
        title: "تم إرسال طلب الصفقة",
        body: `بانتظار رد ${deal.seller_name} على طلب شراء ${deal.shares} حصة من ${deal.project_name}`,
        link: `/deal-chat/${newDeal.id}`,
        read: false,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])

    // محاكاة الإشعار للبائع (في الإنتاج: Supabase Realtime)
    setTimeout(() => simulateIncomingDeal(newDeal), 300)

    return newDeal
  }, [simulateIncomingDeal])

  // البائع يقبل الصفقة
  const acceptDeal = useCallback(async (dealId: string) => {
    if (!pendingDealAsSeller || pendingDealAsSeller.id !== dealId) return

    // إضافة إشعار للمشتري بالموافقة
    setNotifications((prev) => [
      {
        id: `notif_accept_${Date.now()}`,
        user_id: pendingDealAsSeller.buyer_id,
        type: "deal_accepted",
        title: "✅ تمت الموافقة على الصفقة!",
        body: `${pendingDealAsSeller.seller_name} وافق على البيع. الدردشة مفتوحة الآن.`,
        link: `/deal-chat/${dealId}`,
        read: false,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])

    setPendingDealAsSeller(null)

    // الانتقال لصفحة الدردشة فوراً
    router.push(`/deal-chat/${dealId}`)
  }, [pendingDealAsSeller, router])

  // البائع يرفض الصفقة
  const rejectDeal = useCallback(async (dealId: string) => {
    if (!pendingDealAsSeller || pendingDealAsSeller.id !== dealId) return

    // رسالة دبلوماسية للمشتري
    setNotifications((prev) => [
      {
        id: `notif_reject_${Date.now()}`,
        user_id: pendingDealAsSeller.buyer_id,
        type: "deal_rejected",
        title: "البائع غير متاح حالياً",
        body: `للأسف، ${pendingDealAsSeller.seller_name} غير قادر على إتمام الصفقة في هذا الوقت. يمكنك تجربة بائعين آخرين أو إعادة المحاولة لاحقاً.`,
        link: "/market",
        read: false,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])

    setPendingDealAsSeller(null)
  }, [pendingDealAsSeller])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const dismissPendingDeal = useCallback(() => {
    setPendingDealAsSeller(null)
  }, [])

  // ⚠️ TODO: استبدل هذا بـ Supabase Realtime عند الربط
  // useEffect(() => {
  //   const channel = supabase
  //     .channel("realtime-deals")
  //     .on("postgres_changes", {
  //       event: "INSERT",
  //       schema: "public",
  //       table: "deals",
  //       filter: `seller_id=eq.${userId}`,
  //     }, (payload) => simulateIncomingDeal(payload.new as PendingDeal))
  //     .subscribe()
  //   return () => { supabase.removeChannel(channel) }
  // }, [userId])

  // محاكاة طلب صفقة وارد (للاختبار - يمكن حذفها في الإنتاج)
  // window.__simulateIncomingDeal = (deal) => simulateIncomingDeal(deal)
  useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).__simulateIncomingDeal = simulateIncomingDeal
    }
  }, [simulateIncomingDeal])

  return (
    <RealtimeContext.Provider
      value={{
        pendingDealAsSeller,
        notifications,
        unreadCount,
        acceptDeal,
        rejectDeal,
        createDeal,
        markNotificationRead,
        markAllRead,
        dismissPendingDeal,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error("useRealtime must be used inside RealtimeProvider")
  return ctx
}
