"use client"

/**
 * Discounts program — DB-backed data layer (Phase 6.1).
 *
 * Wraps discount_brands + user_coupons + the claim_discount RPC
 * (20260503_phase6_discounts_schema.sql). The RPC handles the
 * atomic claim flow (level/window/max_uses validation + INSERT
 * + bump used_count) so we never over-claim under concurrency.
 *
 * Named *-real to avoid colliding with the existing mock module
 * `lib/mock-data/discounts.ts` (kept for first-paint fallback).
 */

import { createClient } from "@/lib/supabase/client"
import type {
  Discount,
  UserCoupon,
  DiscountCategory,
  CouponStatus,
  RequiredLevel,
} from "@/lib/mock-data/discounts"

// ─── Helpers ─────────────────────────────────────────────────

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

function asCategory(s: string): DiscountCategory {
  const all = ["restaurants", "clothing", "electronics", "services", "travel", "groceries"]
  return (all.includes(s) ? s : "services") as DiscountCategory
}

function asLevel(s: string): RequiredLevel {
  // Mock has 3 levels (basic|advanced|pro); DB allows elite too.
  // Collapse elite → pro for the UI.
  if (s === "advanced") return "advanced"
  if (s === "pro" || s === "elite") return "pro"
  return "basic"
}

function asCouponStatus(s: string): CouponStatus {
  if (s === "used" || s === "expired") return s
  return "active"
}

function asColor(s: string): Discount["cover_color"] {
  const all = ["red", "blue", "purple", "orange", "green", "yellow"]
  return (all.includes(s) ? s : "blue") as Discount["cover_color"]
}

interface BrandRow {
  id: string
  brand_name: string
  brand_logo_emoji: string
  category: string
  discount_percent: number
  description: string
  conditions: string[] | null
  required_level: string
  branches: string[] | null
  starts_at: string
  ends_at: string
  is_active: boolean
  used_count: number
  max_uses: number
  cover_color: string
}

interface CouponRow {
  id: string
  user_id: string
  discount_id: string
  code: string
  barcode: string
  status: string
  claimed_at: string
  used_at: string | null
  expires_at: string
  brand?:
    | { brand_name?: string | null; brand_logo_emoji?: string | null; discount_percent?: number | null }
    | { brand_name?: string | null; brand_logo_emoji?: string | null; discount_percent?: number | null }[]
    | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function rowToDiscount(r: BrandRow): Discount {
  return {
    id: r.id,
    brand_name: r.brand_name,
    brand_logo_emoji: r.brand_logo_emoji,
    category: asCategory(r.category),
    discount_percent: r.discount_percent,
    description: r.description,
    conditions: Array.isArray(r.conditions)
      ? r.conditions.filter((s): s is string => typeof s === "string")
      : [],
    required_level: asLevel(r.required_level),
    branches: Array.isArray(r.branches)
      ? r.branches.filter((s): s is string => typeof s === "string")
      : [],
    starts_at: r.starts_at?.slice(0, 10) ?? "",
    ends_at: r.ends_at?.slice(0, 10) ?? "",
    is_active: r.is_active,
    used_count: r.used_count,
    max_uses: r.max_uses,
    cover_color: asColor(r.cover_color),
  }
}

function rowToCoupon(r: CouponRow): UserCoupon {
  const brand = unwrap(r.brand)
  return {
    id: r.id,
    user_id: r.user_id,
    discount_id: r.discount_id,
    brand_name: brand?.brand_name ?? "—",
    brand_logo_emoji: brand?.brand_logo_emoji ?? "🛍️",
    discount_percent: num(brand?.discount_percent),
    code: r.code,
    barcode: r.barcode,
    status: asCouponStatus(r.status),
    claimed_at: r.claimed_at?.slice(0, 16).replace("T", " ") ?? "",
    used_at: r.used_at?.slice(0, 16).replace("T", " ") ?? undefined,
    expires_at: r.expires_at?.slice(0, 10) ?? "",
  }
}

// ─── Reads ───────────────────────────────────────────────────

export async function getActiveDiscounts(): Promise<Discount[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discount_brands")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return (data as BrandRow[]).map(rowToDiscount)
  } catch {
    return []
  }
}

export async function getDiscountById(id: string): Promise<Discount | null> {
  if (!id) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discount_brands")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return rowToDiscount(data as BrandRow)
  } catch {
    return null
  }
}

export async function getMyCoupons(): Promise<UserCoupon[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from("user_coupons")
      .select(
        `*, brand:discount_brands!discount_id (
           brand_name, brand_logo_emoji, discount_percent
         )`,
      )
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false })
    if (error || !data) return []
    return (data as CouponRow[]).map(rowToCoupon)
  } catch {
    return []
  }
}

// ─── Stats ───────────────────────────────────────────────────

export interface DiscountsStats {
  total_brands: number
  active_discounts: number
}

export async function getDiscountsStats(): Promise<DiscountsStats> {
  const empty: DiscountsStats = { total_brands: 0, active_discounts: 0 }
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("discount_brands")
      .select("id, is_active, ends_at")
    if (!Array.isArray(data)) return empty
    const now = Date.now()
    const stats = { ...empty }
    for (const d of data as { id: string; is_active: boolean; ends_at: string }[]) {
      stats.total_brands++
      const ends = new Date(d.ends_at).getTime()
      if (d.is_active && Number.isFinite(ends) && ends > now) {
        stats.active_discounts++
      }
    }
    return stats
  } catch {
    return empty
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface ClaimResult {
  success: boolean
  coupon_id?: string
  code?: string
  barcode?: string
  reason?:
    | "unauthenticated"
    | "not_found"
    | "inactive"
    | "not_started"
    | "expired"
    | "fully_claimed"
    | "insufficient_level"
    | "already_claimed"
    | "missing_table"
    | "rls"
    | "unknown"
  required_level?: RequiredLevel
  current_level?: string
  error?: string
}

export async function claimDiscount(discountId: string): Promise<ClaimResult> {
  if (!discountId) return { success: false, reason: "not_found" }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: "unauthenticated" }

    const { data, error } = await supabase.rpc("claim_discount", {
      p_discount_id: discountId,
    })

    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }

    const result = (data ?? {}) as {
      success?: boolean
      coupon_id?: string
      code?: string
      barcode?: string
      error?: string
      required?: string
      current?: string
    }
    if (!result.success) {
      return {
        success: false,
        reason: (result.error as ClaimResult["reason"]) ?? "unknown",
        required_level: result.required as RequiredLevel | undefined,
        current_level: result.current,
      }
    }
    return {
      success: true,
      coupon_id: result.coupon_id,
      code: result.code,
      barcode: result.barcode,
    }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function markCouponUsed(
  couponId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!couponId) return { success: false, error: "missing id" }
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("user_coupons")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", couponId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
