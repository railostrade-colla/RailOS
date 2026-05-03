"use client"

/**
 * Discounts admin — DB-backed data layer (Phase 7).
 */

import { createClient } from "@/lib/supabase/client"
import type { Discount, DiscountCategory, UserCoupon, CouponStatus } from "@/lib/mock-data/discounts"

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

// ─── Reads ───────────────────────────────────────────────────

export async function getAllDiscounts(): Promise<Discount[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("discount_brands")
      .select(`*`)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    interface Row {
      id: string
      brand_name: string
      brand_logo_emoji: string
      category: DiscountCategory
      discount_percent: number
      description: string
      conditions: string[]
      branches: string[]
      required_level: string
      starts_at: string
      ends_at: string
      is_active: boolean
      used_count: number
      max_uses: number
      cover_color: "red" | "blue" | "purple" | "orange" | "green" | "yellow"
    }

    return (data as Row[]).map((d): Discount => ({
      id: d.id,
      brand_name: d.brand_name,
      brand_logo_emoji: d.brand_logo_emoji,
      category: d.category,
      discount_percent: d.discount_percent,
      description: d.description,
      conditions: d.conditions ?? [],
      branches: d.branches ?? [],
      // DB has 'elite'; mock RequiredLevel is "basic" | "advanced" | "pro".
      // Collapse 'elite' → 'pro' so the page renders.
      required_level: (d.required_level === "elite" ? "pro" : d.required_level) as "basic" | "advanced" | "pro",
      starts_at: d.starts_at,
      ends_at: d.ends_at,
      is_active: d.is_active,
      used_count: num(d.used_count),
      max_uses: num(d.max_uses),
      cover_color: d.cover_color,
    }))
  } catch {
    return []
  }
}

export async function getAllUserCoupons(): Promise<UserCoupon[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("user_coupons")
      .select(
        `id, user_id, discount_id, code, barcode, status,
         claimed_at, used_at, expires_at,
         brand:discount_brands!discount_id ( brand_name, brand_logo_emoji, discount_percent )`,
      )
      .order("claimed_at", { ascending: false })
      .limit(500)

    if (error || !data) return []

    interface Row {
      id: string
      user_id: string
      discount_id: string
      code: string
      barcode: string
      status: CouponStatus
      claimed_at: string
      used_at?: string | null
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

    return (data as Row[]).map((c): UserCoupon => {
      const b = unwrap(c.brand)
      return {
        id: c.id,
        user_id: c.user_id,
        discount_id: c.discount_id,
        brand_name: b?.brand_name ?? "—",
        brand_logo_emoji: b?.brand_logo_emoji ?? "🛍️",
        discount_percent: num(b?.discount_percent),
        code: c.code,
        barcode: c.barcode,
        status: c.status,
        claimed_at: c.claimed_at,
        used_at: c.used_at ?? undefined,
        expires_at: c.expires_at,
      }
    })
  } catch {
    return []
  }
}

// ─── Writes (RPC) ────────────────────────────────────────────

export interface AdminRpcResult {
  success: boolean
  reason?: string
  error?: string
  discount_id?: string
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<AdminRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (code === "42883" || code === "42P01" ||
          /function .* does not exist/i.test(msg) ||
          /relation .* does not exist/i.test(msg)) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as { success?: boolean; error?: string; discount_id?: string }
    if (!result.success) return { success: false, reason: result.error ?? "unknown" }
    return { success: true, discount_id: result.discount_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCreateDiscount(input: {
  brand_name: string
  brand_logo_emoji?: string
  category: DiscountCategory
  discount_percent: number
  description: string
  starts_at: string
  ends_at: string
  max_uses: number
  required_level?: "basic" | "advanced" | "pro" | "elite"
  cover_color?: "red" | "blue" | "purple" | "orange" | "green" | "yellow"
  conditions?: string[]
  branches?: string[]
}): Promise<AdminRpcResult> {
  return callRpc("admin_create_discount", {
    p_brand_name: input.brand_name,
    p_brand_logo_emoji: input.brand_logo_emoji ?? "🛍️",
    p_category: input.category,
    p_discount_percent: input.discount_percent,
    p_description: input.description,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_max_uses: input.max_uses,
    p_required_level: input.required_level ?? "basic",
    p_cover_color: input.cover_color ?? "blue",
    p_conditions: input.conditions ?? [],
    p_branches: input.branches ?? [],
  })
}

export async function adminSetDiscountActive(
  discountId: string,
  isActive: boolean,
): Promise<AdminRpcResult> {
  return callRpc("admin_set_discount_active", {
    p_discount_id: discountId,
    p_is_active: isActive,
  })
}
