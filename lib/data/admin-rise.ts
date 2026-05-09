"use client"

/**
 * Admin force-rise market price (Phase 12.9).
 *
 * Two RPCs wrapped here:
 *   • getRiseStatus(projectId)      — read-only, returns conditions + blockers
 *   • forceMarketRise(input)        — write, applies rise (with optional override)
 */

import { createClient } from "@/lib/supabase/client"

export type EngineMode = "initial" | "permanent" | "frozen"

export interface RiseConditions {
  total_holders: number
  distinct_pairs: number
  pair_ratio: number     // 0..1
  c1_score: number       // 0..1 — distinct-pair condition
  hold_score: number     // 0..1
  balance_score: number  // 0..1
  c2_score: number       // 0..1 — combined hold+balance
}

export interface RiseStatus {
  success: boolean
  error?: string
  project: {
    id: string
    name: string
    share_price: number
    current_market_price: number
    percent_above_par: number
  }
  engine_mode: EngineMode
  is_frozen: boolean
  conditions: RiseConditions
  monthly_accumulated: number   // 0..1 (e.g. 0.04 = 4%)
  monthly_cap: number           // 0..1
  today_rises: number
  /** What the engine would naturally apply NOW (0 if blocked). */
  allowed_natural_rise: number
  blockers: string[]
  can_rise_naturally: boolean
}

export async function getRiseStatus(
  projectId: string,
): Promise<RiseStatus | null> {
  if (!projectId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_get_rise_status", {
      p_project_id: projectId,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[admin-rise] status read failed:", error.message)
      return null
    }
    if (!data) return null
    const r = data as RiseStatus
    if (!r.success) {
      // eslint-disable-next-line no-console
      console.warn("[admin-rise] status error:", r.error)
      return null
    }
    // Coerce numeric strings (Supabase serialises NUMERIC as string).
    r.project.share_price = Number(r.project.share_price)
    r.project.current_market_price = Number(r.project.current_market_price)
    r.project.percent_above_par = Number(r.project.percent_above_par)
    r.monthly_accumulated = Number(r.monthly_accumulated)
    r.monthly_cap = Number(r.monthly_cap)
    r.allowed_natural_rise = Number(r.allowed_natural_rise)
    r.today_rises = Number(r.today_rises)
    return r
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin-rise] status threw:", err)
    return null
  }
}

export interface ForceRiseInput {
  projectId: string
  /** Decimal percentage (0.05 = 5%). Pass null to use the natural rise. */
  risePct?: number | null
  /** Bypass condition checks. Required when blockers > 0. */
  override?: boolean
  reason?: string
}

export interface ForceRiseResult {
  success: boolean
  error?: string
  reason?: string
  /** Arabic-friendly message for the toast. */
  message?: string
  data?: {
    old_price: number
    new_price: number
    rise_pct: number
    override_used: boolean
    blockers_at_apply: string[]
  }
}

const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول",
  not_admin: "هذا الإجراء مقصور على الأدمن",
  project_not_found: "المشروع غير موجود",
  no_rise_to_apply: "لا توجد قيمة رفع لتطبيقها",
  rise_too_large: "نسبة الرفع تتجاوز الحد المسموح (50%)",
  conditions_not_met: "الشروط غير مستوفاة — استخدم override أو انتظر",
}

export async function forceMarketRise(
  input: ForceRiseInput,
): Promise<ForceRiseResult> {
  if (!input.projectId) {
    return {
      success: false,
      error: "معرّف المشروع مفقود",
      reason: "missing_project",
    }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_force_market_rise", {
      p_project_id: input.projectId,
      p_rise_pct: input.risePct ?? null,
      p_override: input.override ?? false,
      p_reason: input.reason ?? null,
    })
    if (error) {
      return { success: false, error: error.message, reason: "rpc_error" }
    }
    const r = (data ?? {}) as {
      success?: boolean
      error?: string
      blockers?: string[]
      project_name?: string
      old_price?: number | string
      new_price?: number | string
      rise_pct?: number | string
      override_used?: boolean
      blockers_at_apply?: string[]
    }
    if (!r.success) {
      const code = r.error ?? "unknown"
      return {
        success: false,
        reason: code,
        error: ARABIC_ERROR[code] ?? `تعذّر الرفع (${code})`,
      }
    }

    const newPrice = Number(r.new_price)
    const oldPrice = Number(r.old_price)
    const risePct = Number(r.rise_pct)
    return {
      success: true,
      message: `📈 تم رفع سعر ${r.project_name ?? ""} من ${oldPrice.toLocaleString("en-US")} إلى ${newPrice.toLocaleString("en-US")} د.ع (+${(risePct * 100).toFixed(1)}%)`,
      data: {
        old_price: oldPrice,
        new_price: newPrice,
        rise_pct: risePct,
        override_used: !!r.override_used,
        blockers_at_apply: r.blockers_at_apply ?? [],
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
      reason: "exception",
    }
  }
}
