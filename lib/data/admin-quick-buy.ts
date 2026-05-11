"use client"

/**
 * admin-quick-buy — Phase 13.59.
 *
 * Two responsibilities:
 *   1. Admin side: toggle "sell to platform" on a project + set
 *      the discount percentage.
 *   2. User side: read the per-project status (so the quick-sale
 *      UI knows whether to enable the "بيع للنظام" button) and
 *      execute the actual sale via RPC.
 */

import { createClient } from "@/lib/supabase/client"

// ─── Admin: toggle + discount ────────────────────────────────────

export interface SetQuickBuyResult {
  success: boolean
  enabled?: boolean | null
  discount_pct?: number | null
  error?: string
}

export async function setAdminProjectQuickBuy(input: {
  projectId: string
  enabled?: boolean
  discountPct?: number
}): Promise<SetQuickBuyResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_set_project_quick_buy", {
      p_project_id: input.projectId,
      p_enabled: input.enabled ?? null,
      p_discount_pct: input.discountPct ?? null,
    })
    if (error) return { success: false, error: error.message }
    type Row = {
      success?: boolean
      enabled?: boolean | null
      discount_pct?: number | null
      error?: string
    }
    const r = (data ?? {}) as Row
    if (!r.success) return { success: false, error: r.error ?? "unknown" }
    return { success: true, enabled: r.enabled, discount_pct: r.discount_pct }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}

// ─── User: read status for a project ─────────────────────────────

export interface QuickBuyStatus {
  enabled: boolean
  discount_pct: number
  market_price: number
  price_per_share: number
}

export async function getProjectQuickBuyStatus(
  projectId: string,
): Promise<QuickBuyStatus | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("projects")
      .select(
        "current_market_price, share_price, admin_quick_buy_enabled, admin_quick_buy_discount_pct",
      )
      .eq("id", projectId)
      .maybeSingle()
    if (error || !data) return null
    type Row = {
      current_market_price?: number | string | null
      share_price?: number | string | null
      admin_quick_buy_enabled?: boolean | null
      admin_quick_buy_discount_pct?: number | string | null
    }
    const r = data as Row
    const market = Number(r.current_market_price ?? r.share_price ?? 0)
    const discount = Number(r.admin_quick_buy_discount_pct ?? 15)
    return {
      enabled: !!r.admin_quick_buy_enabled,
      discount_pct: discount,
      market_price: market,
      price_per_share: Math.floor(market * (1 - discount / 100)),
    }
  } catch {
    return null
  }
}

// ─── User: execute the sale to platform ──────────────────────────

export interface ExecuteQuickBuyResult {
  success: boolean
  ledger_id?: string
  shares?: number
  price_per_share?: number
  market_price?: number
  discount_pct?: number
  total_amount?: number
  error?: string
  free_shares?: number
  requested?: number
}

export async function executeAdminQuickBuy(
  projectId: string,
  shares: number,
): Promise<ExecuteQuickBuyResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("execute_admin_quick_buy", {
      p_project_id: projectId,
      p_shares: shares,
    })
    if (error) return { success: false, error: error.message }
    type Row = Partial<ExecuteQuickBuyResult> & { success?: boolean }
    const r = (data ?? {}) as Row
    if (!r.success) {
      return {
        success: false,
        error: r.error ?? "unknown",
        free_shares: r.free_shares,
        requested: r.requested,
      }
    }
    return {
      success: true,
      ledger_id: r.ledger_id,
      shares: r.shares,
      price_per_share: r.price_per_share,
      market_price: r.market_price,
      discount_pct: r.discount_pct,
      total_amount: r.total_amount,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
