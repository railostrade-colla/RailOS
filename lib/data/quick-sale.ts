/**
 * Quick Sale data layer
 * — Subscription-gated marketplace with dynamic pricing.
 * — Sell listings: fixed -15% off market price.
 * — Buy listings: user-chosen 3-10% off market price.
 * — Buyer pays 2% commission on every quick-sale deal.
 *
 * All functions hit Supabase. Requires migration `30-quick-sale.sql`
 * to be applied (creates tables + RLS + RPC).
 */

import { createClient } from "@/lib/supabase/client"

// ─── Types ─────────────────────────────────────────────────────

export interface QuickSaleSubscription {
  id: string
  user_id: string
  subscribed_at: string
  expires_at: string | null
  fee_paid: number
  is_active: boolean
  cancelled_at: string | null
}

export interface QuickSaleListingUser {
  display_name: string | null
  rating_average: number | null
  total_trades: number | null
  successful_trades: number | null
  disputes_total: number | null
  reports_received: number | null
}

export interface QuickSaleListingProject {
  name: string
  symbol: string | null
  current_market_price: number
}

export interface QuickSaleListing {
  id: string
  user_id: string
  project_id: string
  type: "sell" | "buy"
  market_price: number
  discount_percent: number
  final_price: number
  total_shares: number
  available_shares: number
  is_unlimited: boolean
  status: "active" | "paused" | "completed" | "expired" | "cancelled"
  note: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  // joined
  user?: QuickSaleListingUser | null
  project?: QuickSaleListingProject | null
}

export interface CreateSellParams {
  project_id: string
  total_shares: number
  is_unlimited: boolean
  note?: string
}

export interface CreateBuyParams {
  project_id: string
  total_shares: number
  is_unlimited: boolean
  discount_percent: number // 3-10
  note?: string
}

export interface OpenDealParams {
  listing_id: string
  quantity: number
}

// ─── Constants ─────────────────────────────────────────────────

export const QS_SUBSCRIPTION_FEE = 10_000
export const QS_SELL_DISCOUNT = 15
export const QS_BUY_DISCOUNT_MIN = 3
export const QS_BUY_DISCOUNT_MAX = 10
export const QS_BUYER_COMMISSION_PCT = 0.02 // 2%
export const QS_LISTING_TTL_DAYS = 7
export const QS_DEAL_TTL_HOURS = 24

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

// ─── Subscription ──────────────────────────────────────────────

/** Returns the current user's active subscription, or null. */
export async function checkSubscription(): Promise<QuickSaleSubscription | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("quick_sale_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  return data as QuickSaleSubscription | null
}

/** Subscribes the current user via the `subscribe_to_quick_sale` RPC. */
export async function subscribeToQuickSale(): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "يجب تسجيل الدخول" }

  const { data, error } = await supabase.rpc("subscribe_to_quick_sale", {
    p_user_id: user.id,
  })

  if (error) return { success: false, error: error.message }

  // RPC returns a JSONB { success, error?, ... }
  const result = (data ?? {}) as { success?: boolean; error?: string }
  if (!result.success) {
    return { success: false, error: result.error || "فشل الاشتراك" }
  }
  return { success: true }
}

/** Reads the current user's fee-units balance from profiles. */
export async function getFeeUnitsBalance(): Promise<number> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data } = await supabase
    .from("profiles")
    .select("fee_units_balance")
    .eq("id", user.id)
    .single()

  return Number((data as { fee_units_balance?: number } | null)?.fee_units_balance ?? 0)
}

// ─── Listings ──────────────────────────────────────────────────

/** Fetches all active listings (filtered by type if provided). */
export async function getQuickSaleListings(
  type?: "sell" | "buy"
): Promise<QuickSaleListing[]> {
  const supabase = createClient()

  let query = supabase
    .from("quick_sale_listings")
    .select(
      `
      *,
      user:profiles!user_id (
        display_name,
        rating_average,
        total_trades,
        successful_trades,
        disputes_total,
        reports_received
      ),
      project:projects!project_id (
        name,
        symbol,
        current_market_price
      )
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })

  if (type) query = query.eq("type", type)

  const { data } = await query
  return (data || []) as unknown as QuickSaleListing[]
}

/** Lists owned by the current user (any status). */
export async function getMyListings(): Promise<QuickSaleListing[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from("quick_sale_listings")
    .select(
      `
      *,
      project:projects!project_id (name, symbol, current_market_price)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (data || []) as unknown as QuickSaleListing[]
}

/** Creates a sell listing — discount is fixed at 15%. */
export async function createSellListing(params: CreateSellParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("يجب تسجيل الدخول")

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("current_market_price")
    .eq("id", params.project_id)
    .single()

  if (projErr || !project) throw new Error("المشروع غير موجود")

  const marketPrice = Number(
    (project as { current_market_price: number }).current_market_price
  )
  const discountPercent = QS_SELL_DISCOUNT
  const finalPrice = Math.floor((marketPrice * (100 - discountPercent)) / 100)

  const { data, error } = await supabase
    .from("quick_sale_listings")
    .insert({
      user_id: user.id,
      project_id: params.project_id,
      type: "sell",
      market_price: marketPrice,
      discount_percent: discountPercent,
      final_price: finalPrice,
      total_shares: params.total_shares,
      available_shares: params.total_shares,
      is_unlimited: params.is_unlimited,
      note: params.note,
      expires_at: new Date(Date.now() + QS_LISTING_TTL_DAYS * DAY_MS).toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Creates a buy listing — discount user-chosen between 3% and 10%. */
export async function createBuyListing(params: CreateBuyParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("يجب تسجيل الدخول")

  if (
    params.discount_percent < QS_BUY_DISCOUNT_MIN ||
    params.discount_percent > QS_BUY_DISCOUNT_MAX
  ) {
    throw new Error(
      `نسبة الخصم يجب أن تكون بين ${QS_BUY_DISCOUNT_MIN}% و ${QS_BUY_DISCOUNT_MAX}%`
    )
  }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("current_market_price")
    .eq("id", params.project_id)
    .single()

  if (projErr || !project) throw new Error("المشروع غير موجود")

  const marketPrice = Number(
    (project as { current_market_price: number }).current_market_price
  )
  const finalPrice = Math.floor(
    (marketPrice * (100 - params.discount_percent)) / 100
  )

  const { data, error } = await supabase
    .from("quick_sale_listings")
    .insert({
      user_id: user.id,
      project_id: params.project_id,
      type: "buy",
      market_price: marketPrice,
      discount_percent: params.discount_percent,
      final_price: finalPrice,
      total_shares: params.total_shares,
      available_shares: params.total_shares,
      is_unlimited: params.is_unlimited,
      note: params.note,
      expires_at: new Date(Date.now() + QS_LISTING_TTL_DAYS * DAY_MS).toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Deals ─────────────────────────────────────────────────────

/**
 * Opens a deal from a quick-sale listing.
 * Buyer always pays 2% commission. Seller pays nothing.
 */
export async function openQuickSaleDeal(params: OpenDealParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("يجب تسجيل الدخول")

  const { data: listing, error: lErr } = await supabase
    .from("quick_sale_listings")
    .select("*")
    .eq("id", params.listing_id)
    .single()

  if (lErr || !listing) throw new Error("الإعلان غير موجود")

  const l = listing as QuickSaleListing
  if (l.user_id === user.id) throw new Error("لا يمكنك فتح صفقة على إعلانك")
  if (l.status !== "active") throw new Error("الإعلان غير نشط")
  if (!l.is_unlimited && params.quantity > l.available_shares) {
    throw new Error(`المتوفّر فقط ${l.available_shares} حصة`)
  }
  if (params.quantity < 1) throw new Error("أدخل كمية صحيحة")

  // تحديد المشتري والبائع
  const buyer_id = l.type === "sell" ? user.id : l.user_id
  const seller_id = l.type === "sell" ? l.user_id : user.id

  const totalAmount = params.quantity * l.final_price
  // ⚠️ عمولة المنصّة دائماً على المشتري (2% من القيمة)
  const buyerCommission = Math.floor(totalAmount * QS_BUYER_COMMISSION_PCT)

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      project_id: l.project_id,
      buyer_id,
      seller_id,
      shares_amount: params.quantity,
      price_per_share: l.final_price,
      total_amount: totalAmount,
      // ميزات البيع السريع
      source: "quick_sale",
      quick_sale_listing_id: l.id,
      buyer_commission: buyerCommission,
      seller_commission: 0,
      status: "pending",
      shares_locked: false,
      expires_at: new Date(Date.now() + QS_DEAL_TTL_HOURS * HOUR_MS).toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  // تقليل الكمية المتاحة (إذا ليست unlimited)
  if (!l.is_unlimited) {
    const newAvailable = l.available_shares - params.quantity
    await supabase
      .from("quick_sale_listings")
      .update({
        available_shares: newAvailable,
        status: newAvailable <= 0 ? "completed" : "active",
      })
      .eq("id", l.id)
  }

  return deal
}

// ─── Owner actions ─────────────────────────────────────────────

/** Cancels a listing (owner only — RLS enforces). */
export async function cancelListing(listingId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("quick_sale_listings")
    .update({ status: "cancelled" })
    .eq("id", listingId)
  if (error) throw error
}

/** Pauses or resumes a listing. */
export async function setListingStatus(
  listingId: string,
  status: "active" | "paused"
) {
  const supabase = createClient()
  const { error } = await supabase
    .from("quick_sale_listings")
    .update({ status })
    .eq("id", listingId)
  if (error) throw error
}

// ─── Helpers ───────────────────────────────────────────────────

/** Computes success-rate (%) safely from totals. */
export function computeSuccessRate(user?: QuickSaleListingUser | null): number {
  if (!user) return 0
  const total = user.total_trades ?? 0
  const ok = user.successful_trades ?? 0
  if (total <= 0) return 0
  return Math.round((ok / total) * 100)
}
