"use client"

/**
 * Admin manual market-price control (Phase 14.05).
 *
 * After the Phase 14 V7 cleanup, the admin's price tool is radically
 * simpler than the old Phase 12.9 version:
 *
 *   • No more `getRiseStatus` — the `admin_get_rise_status` RPC was
 *     dropped in Migration 14.02 along with the rest of the V7 engine.
 *     The natural-rise calculation now lives entirely inside the
 *     `trg_update_market_price_on_deal_complete` trigger.
 *
 *   • `forceMarketRise` calls the new 3-arg RPC
 *     `admin_force_market_rise(p_project_id UUID, p_rise_pct NUMERIC,
 *     p_reason TEXT)` introduced in Migration 14.02.
 *
 *   • `risePct` is now a PERCENTAGE (5 = 5%, -3 = -3%), not the old
 *     decimal form. Range is -100 ≤ pct ≤ 100; negative values let
 *     the founder correct an upward overshoot.
 *
 *   • `reason` is REQUIRED (≥ 10 chars). Every manual price change
 *     is audited in `price_history` with `trigger_type='admin_manual'`.
 */

import { createClient } from "@/lib/supabase/client"

export interface ForceRiseInput {
  projectId: string
  /** Percentage to apply. 5 = +5%, -3 = -3%. Range: [-100, 100]. */
  risePct: number
  /** Required justification. Stored in the RPC response + Supabase logs. */
  reason: string
}

export interface ForceRiseResult {
  success: boolean
  /** Arabic-friendly error message for the toast. */
  error?: string
  /** Machine-readable error code from the RPC (`not_super_admin`, ...). */
  reason?: string
  /** Arabic-friendly success message for the toast. */
  message?: string
  data?: {
    old_price: number
    new_price: number
    /** Percentage actually applied (e.g. 5.0 = +5%, -3.0 = -3%). */
    change_pct: number
    /** True when old == new (the RPC's no_op short-circuit fired). */
    no_op: boolean
  }
}

/** Maps the new RPC's error codes → Arabic messages. */
const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول",
  not_super_admin: "هذا الإجراء مقصور على المدير الأعلى",
  invalid_project: "معرّف المشروع مفقود",
  invalid_rise_pct: "نسبة التعديل خارج المدى المسموح (-100 إلى 100)",
  project_not_found: "المشروع غير موجود",
  no_base_price: "المشروع لا يملك سعراً مرجعياً صالحاً",
}

/** Local validation thresholds — must match RPC server-side bounds. */
export const RISE_PCT_MIN = -100
export const RISE_PCT_MAX = 100
export const REASON_MIN_LEN = 10
export const REASON_MAX_LEN = 300

/**
 * Applies a manual price change.
 *
 * Returns a discriminated result — never throws.
 * The caller (RaiseMarketPricePanel) is responsible for the
 * confirmation modal and big-change warnings.
 */
export async function forceMarketRise(
  input: ForceRiseInput,
): Promise<ForceRiseResult> {
  // ─── Client-side pre-flight (mirrors RPC bounds, fails fast) ──
  if (!input.projectId) {
    return {
      success: false,
      reason: "invalid_project",
      error: ARABIC_ERROR.invalid_project,
    }
  }
  if (
    !Number.isFinite(input.risePct) ||
    input.risePct < RISE_PCT_MIN ||
    input.risePct > RISE_PCT_MAX
  ) {
    return {
      success: false,
      reason: "invalid_rise_pct",
      error: ARABIC_ERROR.invalid_rise_pct,
    }
  }
  const trimmedReason = (input.reason ?? "").trim()
  if (trimmedReason.length < REASON_MIN_LEN) {
    return {
      success: false,
      reason: "reason_required",
      error: `يجب كتابة سبب (${REASON_MIN_LEN}+ حرف)`,
    }
  }
  if (trimmedReason.length > REASON_MAX_LEN) {
    return {
      success: false,
      reason: "reason_too_long",
      error: `السبب طويل جداً (الحدّ الأقصى ${REASON_MAX_LEN} حرف)`,
    }
  }

  // ─── RPC call ─────────────────────────────────────────────────
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("admin_force_market_rise", {
      p_project_id: input.projectId,
      p_rise_pct: input.risePct,
      p_reason: trimmedReason,
    })

    if (error) {
      return {
        success: false,
        reason: "rpc_error",
        error: error.message || "تعذّر الاتصال بقاعدة البيانات",
      }
    }

    const r = (data ?? {}) as {
      success?: boolean
      error?: string
      old_price?: number | string
      new_price?: number | string
      change_pct?: number | string
      project_id?: string
      project_name?: string
      note?: string
      reason?: string | null
    }

    if (!r.success) {
      const code = r.error ?? "unknown"
      return {
        success: false,
        reason: code,
        error: ARABIC_ERROR[code] ?? `تعذّر التطبيق (${code})`,
      }
    }

    const oldPrice = Number(r.old_price ?? 0)
    const newPrice = Number(r.new_price ?? 0)
    const changePct = Number(r.change_pct ?? 0)
    const noOp = r.note === "no_op" || oldPrice === newPrice

    const projName = r.project_name ?? ""
    const sign = changePct >= 0 ? "+" : ""
    const verb = changePct >= 0 ? "📈 رفع" : "📉 خفض"

    return {
      success: true,
      message: noOp
        ? `لا تغيير — السعر بقي ${newPrice.toLocaleString("en-US")} د.ع`
        : `${verb} سعر ${projName} من ${oldPrice.toLocaleString("en-US")} إلى ${newPrice.toLocaleString("en-US")} د.ع (${sign}${changePct.toFixed(2)}%)`,
      data: {
        old_price: oldPrice,
        new_price: newPrice,
        change_pct: changePct,
        no_op: noOp,
      },
    }
  } catch (err) {
    return {
      success: false,
      reason: "exception",
      error: err instanceof Error ? err.message : "خطأ غير متوقّع",
    }
  }
}

/**
 * Computes the projected new price for the UI preview (no DB hit).
 * Uses the same ROUND/GREATEST rule as the RPC so the preview matches
 * the eventual stored value exactly:
 *   new_price = GREATEST(1, ROUND(old × (1 + pct/100)))
 */
export function previewNewPrice(oldPrice: number, risePct: number): number {
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) return 0
  if (!Number.isFinite(risePct)) return oldPrice
  const raw = Math.round(oldPrice * (1 + risePct / 100))
  return Math.max(1, raw)
}
