/**
 * Escrow Helpers — pure operations on shares + deals.
 *
 * تستخدم store.ts كمصدر للحالة، والـ HOLDINGS من mock-data كمصدر لرصيد الحصص.
 */

import { HOLDINGS } from "@/lib/mock-data/holdings"
import {
  getDealById,
  setDeal,
  getActiveDealByUserAndListing,
  getTotalLockedShares,
  addLockedShares,
  removeLockedShares,
} from "./store"
import type { CanCreateDealResult, EscrowDeal, EscrowResult } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Shares accounting
// ──────────────────────────────────────────────────────────────────────────

/**
 * إجمالي الحصص التي يملكها المستخدم في مشروع معيّن.
 * في mock mode، نأخذها من HOLDINGS؛ في prod من جدول holdings.
 */
export function getOwnedShares(userId: string, projectId: string): number {
  return HOLDINGS
    .filter((h) => (h.user_id ?? "me") === userId && h.project_id === projectId)
    .reduce((s, h) => s + h.shares_owned, 0)
}

/** الحصص المتاحة (بعد خصم المُعلَّق). */
export function getAvailableShares(userId: string, projectId: string): number {
  const owned = getOwnedShares(userId, projectId)
  const locked = getTotalLockedShares(userId, projectId)
  return Math.max(0, owned - locked)
}

/** هل المستخدم يملك ما يكفي من الحصص لتعليقها؟ */
export function canLockShares(userId: string, projectId: string, amount: number): boolean {
  return getAvailableShares(userId, projectId) >= amount
}

// ──────────────────────────────────────────────────────────────────────────
// Lock / Unlock / Transfer
// ──────────────────────────────────────────────────────────────────────────

export function lockShares(
  userId: string,
  projectId: string,
  amount: number,
  dealId: string
): EscrowResult {
  if (amount <= 0) return { success: false, reason: "الكمية يجب أن تكون أكبر من صفر" }
  if (!canLockShares(userId, projectId, amount)) {
    return { success: false, reason: "حصص غير كافية للتعليق" }
  }
  addLockedShares({
    user_id: userId,
    project_id: projectId,
    deal_id: dealId,
    amount,
    locked_at: new Date().toISOString(),
  })
  return { success: true }
}

export function unlockShares(dealId: string): EscrowResult {
  removeLockedShares(dealId)
  return { success: true }
}

/**
 * نقل حصص بين مستخدمين (عند تحرير البائع للحصص للمشتري).
 * في mock mode نُحدِّث HOLDINGS مباشرة.
 */
export function transferShares(
  fromUserId: string,
  toUserId: string,
  projectId: string,
  amount: number
): EscrowResult {
  // 1. خصم من البائع
  const sellerHolding = HOLDINGS.find(
    (h) => (h.user_id ?? "me") === fromUserId && h.project_id === projectId
  )
  if (!sellerHolding || sellerHolding.shares_owned < amount) {
    return { success: false, reason: "البائع لا يملك حصص كافية" }
  }
  sellerHolding.shares_owned -= amount

  // 2. إضافة للمشتري (أو إنشاء holding جديد)
  const buyerHolding = HOLDINGS.find(
    (h) => (h.user_id ?? "me") === toUserId && h.project_id === projectId
  )
  if (buyerHolding) {
    buyerHolding.shares_owned += amount
  } else {
    HOLDINGS.push({
      id: `h_${Date.now()}_${toUserId}_${projectId}`,
      project_id: projectId,
      project: { ...sellerHolding.project },
      shares_owned: amount,
      user_id: toUserId,
      buy_price: sellerHolding.project.share_price,
      current_value: amount * sellerHolding.project.share_price,
    })
  }

  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────
// Deal lifecycle
// ──────────────────────────────────────────────────────────────────────────

/**
 * هل يستطيع المستخدم فتح صفقة جديدة على هذا الإعلان؟
 * (منع الصفقات المزدوجة على نفس الإعلان من نفس المستخدم).
 */
export function canCreateDeal(userId: string, listingId: string): CanCreateDealResult {
  const activeDeal = getActiveDealByUserAndListing(userId, listingId)
  if (activeDeal) {
    const timeLeft = new Date(activeDeal.expires_at).getTime() - Date.now()
    return {
      allowed: false,
      reason: "لديك صفقة نشطة بالفعل على هذا الإعلان",
      activeDeal,
      timeLeft: Math.max(0, timeLeft),
    }
  }
  return { allowed: true }
}

export interface CreateDealInput {
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  listingId: string
  projectId: string
  projectName: string
  amount: number
  pricePerShare: number
  durationHours: 24 | 48 | 72
  notes?: string
}

export function createDeal(input: CreateDealInput): EscrowResult<EscrowDeal> {
  const { buyerId, sellerId, listingId, projectId, amount } = input

  // 1. منع الصفقات المزدوجة
  const can = canCreateDeal(buyerId, listingId)
  if (!can.allowed) return { success: false, reason: can.reason }

  // 2. تحقّق من حصص البائع
  if (!canLockShares(sellerId, projectId, amount)) {
    return { success: false, reason: "البائع لا يملك حصص كافية" }
  }

  // 3. إنشاء الصفقة
  const dealId = `deal_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const nowIso = new Date().toISOString()
  const expiresAt = new Date(Date.now() + input.durationHours * 3_600_000).toISOString()

  const deal: EscrowDeal = {
    id: dealId,
    listing_id: listingId,
    project_id: projectId,
    project_name: input.projectName,
    buyer_id: buyerId,
    buyer_name: input.buyerName,
    seller_id: sellerId,
    seller_name: input.sellerName,
    shares_amount: amount,
    price_per_share: input.pricePerShare,
    total_amount: amount * input.pricePerShare,
    status: "pending",
    shares_locked: true,
    locked_at: nowIso,
    expires_at: expiresAt,
    buyer_confirmed_payment: false,
    seller_released_shares: false,
    notes: input.notes,
    created_at: nowIso,
  }
  setDeal(deal)

  // 4. تعليق حصص البائع
  const lockResult = lockShares(sellerId, projectId, amount, dealId)
  if (!lockResult.success) return { success: false, reason: lockResult.reason }

  return { success: true, data: deal }
}

// ──────────────────────────────────────────────────────────────────────────
// Buyer / seller actions
// ──────────────────────────────────────────────────────────────────────────

export function buyerConfirmPayment(dealId: string, userId: string): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.buyer_id !== userId) return { success: false, reason: "غير مصرّح — لست المشتري" }
  if (deal.status !== "pending") return { success: false, reason: "حالة الصفقة لا تسمح بهذا الإجراء" }

  setDeal({
    ...deal,
    status: "payment_confirmed",
    buyer_confirmed_payment: true,
    buyer_confirmed_at: new Date().toISOString(),
  })
  return { success: true }
}

export function sellerReleaseShares(dealId: string, userId: string): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.seller_id !== userId) return { success: false, reason: "غير مصرّح — لست البائع" }
  if (deal.status !== "payment_confirmed") return { success: false, reason: "بانتظار تأكيد المشتري للدفع أولاً" }

  // 1. نقل الحصص من البائع للمشتري
  const transfer = transferShares(deal.seller_id, deal.buyer_id, deal.project_id, deal.shares_amount)
  if (!transfer.success) return transfer

  // 2. فكّ التعليق
  unlockShares(dealId)

  // 3. تحديث حالة الصفقة
  const nowIso = new Date().toISOString()
  setDeal({
    ...deal,
    status: "completed",
    shares_locked: false,
    seller_released_shares: true,
    seller_released_at: nowIso,
    completed_at: nowIso,
  })
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────
// Cancellation flow
// ──────────────────────────────────────────────────────────────────────────

export function sellerRequestCancellation(
  dealId: string,
  userId: string,
  reason: string
): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.seller_id !== userId) return { success: false, reason: "غير مصرّح — لست البائع" }
  if (deal.status !== "pending") return { success: false, reason: "لا يمكن طلب الإلغاء في هذه المرحلة" }

  setDeal({
    ...deal,
    status: "cancellation_requested",
    cancellation_requested_by: "seller",
    cancellation_reason: reason,
    cancellation_requested_at: new Date().toISOString(),
  })
  return { success: true }
}

export function buyerAcceptCancellation(dealId: string, userId: string): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.buyer_id !== userId) return { success: false, reason: "غير مصرّح" }
  if (deal.status !== "cancellation_requested") return { success: false, reason: "لا يوجد طلب إلغاء" }

  unlockShares(dealId)
  setDeal({
    ...deal,
    status: "cancelled_mutual",
    shares_locked: false,
    buyer_response_to_cancel: "accept",
    cancelled_at: new Date().toISOString(),
  })
  return { success: true }
}

export function buyerRejectCancellation(dealId: string, userId: string): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.buyer_id !== userId) return { success: false, reason: "غير مصرّح" }
  if (deal.status !== "cancellation_requested") return { success: false, reason: "لا يوجد طلب إلغاء" }

  // المشتري يدّعي الدفع → نزاع
  const disputeId = `DSP-${Date.now().toString().slice(-6)}`
  setDeal({
    ...deal,
    status: "disputed",
    buyer_response_to_cancel: "reject_and_paid",
    dispute_id: disputeId,
  })
  return { success: true, data: { dispute_id: disputeId } as never }
}

// ──────────────────────────────────────────────────────────────────────────
// Disputes (open by either side)
// ──────────────────────────────────────────────────────────────────────────

export function openDispute(dealId: string, userId: string, _reason: string): EscrowResult {
  const deal = getDealById(dealId)
  if (!deal) return { success: false, reason: "الصفقة غير موجودة" }
  if (deal.buyer_id !== userId && deal.seller_id !== userId) {
    return { success: false, reason: "غير مصرّح" }
  }

  const disputeId = `DSP-${Date.now().toString().slice(-6)}`
  setDeal({
    ...deal,
    status: "disputed",
    dispute_id: disputeId,
  })
  return { success: true, data: { dispute_id: disputeId } as never }
}

// ──────────────────────────────────────────────────────────────────────────
// Auto-expire (called periodically — e.g. cron or page load)
// ──────────────────────────────────────────────────────────────────────────

export function checkAndExpireDeals(allDeals: EscrowDeal[]): { expired: number; cancelled: number } {
  const now = Date.now()
  let expired = 0
  let cancelled = 0

  for (const deal of allDeals) {
    // 1. Pending صفقات انتهى وقتها بدون تأكيد
    if (deal.status === "pending" && now > new Date(deal.expires_at).getTime()) {
      unlockShares(deal.id)
      setDeal({
        ...deal,
        status: "cancelled_expired",
        shares_locked: false,
        cancelled_at: new Date().toISOString(),
      })
      expired++
    }

    // 2. طلبات إلغاء بدون رد لـ 24 ساعة → تُعتبر موافقة
    if (deal.status === "cancellation_requested" && deal.cancellation_requested_at) {
      const requestedAt = new Date(deal.cancellation_requested_at).getTime()
      if (now - requestedAt > 24 * 3_600_000) {
        unlockShares(deal.id)
        setDeal({
          ...deal,
          status: "cancelled_mutual",
          shares_locked: false,
          buyer_response_to_cancel: "no_response",
          cancelled_at: new Date().toISOString(),
        })
        cancelled++
      }
    }
  }

  return { expired, cancelled }
}
