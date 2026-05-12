"use client"

/**
 * Market-settings registry — client wrapper for Phase 14.06.
 *
 * Thin TypeScript layer over the 5 SECURITY DEFINER RPCs introduced
 * in Migration 14.06 (+ 14.06b). The admin UI never touches the
 * tables directly; RLS deny-all guarantees that, and every operation
 * funnels through the typed wrappers below.
 *
 * Public surface:
 *   • Types:    SettingCategory, SettingValueType, MarketSetting,
 *               SettingAuditEntry, UpdateSettingResult, ValidationResult
 *   • RPCs:     getAllMarketSettings, getMarketSetting,
 *               updateMarketSetting, resetMarketSetting,
 *               getSettingAuditLog
 *   • Helpers:  formatSettingValue, getCategoryLabel,
 *               getCategoryEmoji, validateSettingValue,
 *               isSettingModified, isBooleanSetting,
 *               isBigChange, groupSettingsByCategory
 *
 * Numeric coercion note: PostgREST serialises NUMERIC as string in
 * some payload shapes. Every numeric field is run through `Number()`
 * before it leaves this file so consumers always see `number`.
 */

import { createClient } from "@/lib/supabase/client"

// ═══════════════════════════════════════════════════════════════════
// Types — kept in sync with the DB CHECK constraints (Migration 14.06)
// ═══════════════════════════════════════════════════════════════════

export type SettingCategory =
  | "sector_caps"
  | "daily_caps"
  | "yearly_cap"
  | "manual_rise"
  | "layers"
  | "active_user"
  | "cron"
  | "engine_control"

export type SettingValueType =
  | "percent"
  | "days"
  | "hour"
  | "count"
  | "ratio"

export interface MarketSetting {
  key: string
  value: number
  value_type: SettingValueType
  category: SettingCategory
  label_ar: string
  description_ar: string | null
  min_value: number
  max_value: number
  default_value: number
  /** ISO timestamp (UTC). */
  updated_at: string
  /** True when current value differs from default. */
  is_modified: boolean
}

export interface SettingAuditEntry {
  setting_key: string
  setting_label: string
  old_value: number
  new_value: number
  changed_by_name: string | null
  /** ISO timestamp (UTC). */
  changed_at: string
  reason: string | null
}

export interface UpdateSettingResult {
  success: boolean
  /** Arabic-friendly message for the toast (success or error). */
  message?: string
  /** Arabic-friendly error text (set only when success === false). */
  error?: string
  /** Raw machine error code from the RPC, e.g. `value_out_of_range`. */
  reason?: string
  data?: {
    old_value: number
    new_value: number
    label: string
    /** True when old === new (the RPC short-circuited). */
    no_op: boolean
  }
  /** Populated when reason === 'value_out_of_range'. */
  bounds?: { min: number; max: number }
}

export interface ValidationResult {
  valid: boolean
  /** Arabic-friendly reason, set only when valid === false. */
  error?: string
}

// ═══════════════════════════════════════════════════════════════════
// Error map — mirrors RPC error codes
// ═══════════════════════════════════════════════════════════════════

const ARABIC_ERROR: Record<string, string> = {
  unauthenticated: "يجب تسجيل الدخول",
  not_super_admin: "هذا الإجراء مقصور على المدير الأعلى",
  invalid_key: "مفتاح الإعداد غير صالح",
  invalid_value: "القيمة غير صالحة (NaN أو فارغة)",
  setting_not_found: "الإعداد غير موجود",
  setting_disabled: "الإعداد معطّل ولا يمكن تعديله",
  value_out_of_range: "القيمة خارج المدى المسموح",
  rpc_error: "تعذّر الاتصال بقاعدة البيانات",
  exception: "خطأ غير متوقّع",
}

// ═══════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════

/** Coerce PostgREST-style numeric strings without losing precision flag. */
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const arabicErrorFor = (code: string | undefined, fallback?: string): string =>
  (code && ARABIC_ERROR[code]) ?? fallback ?? `خطأ: ${code ?? "غير معروف"}`

// ═══════════════════════════════════════════════════════════════════
// RPC wrappers
// ═══════════════════════════════════════════════════════════════════

/** Lists every enabled setting, sorted by category + key. */
export async function getAllMarketSettings(): Promise<MarketSetting[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_all_market_settings")
    if (error || !data) {
      // eslint-disable-next-line no-console
      console.warn("[market-settings] list failed:", error?.message)
      return []
    }
    const rows = (data ?? []) as Array<{
      key: string
      value: number | string
      value_type: SettingValueType
      category: SettingCategory
      label_ar: string
      description_ar: string | null
      min_value: number | string
      max_value: number | string
      default_value: number | string
      updated_at: string
      is_modified: boolean
    }>
    return rows.map((r) => ({
      key: r.key,
      value: num(r.value),
      value_type: r.value_type,
      category: r.category,
      label_ar: r.label_ar,
      description_ar: r.description_ar,
      min_value: num(r.min_value),
      max_value: num(r.max_value),
      default_value: num(r.default_value),
      updated_at: r.updated_at,
      is_modified: !!r.is_modified,
    }))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[market-settings] list threw:", err)
    return []
  }
}

/**
 * Reads a single setting value. Returns `null` when the key is
 * missing or disabled (matches the RPC's behaviour from 14.06).
 */
export async function getMarketSetting(key: string): Promise<number | null> {
  if (!key) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_market_setting", {
      p_key: key,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[market-settings] get failed:", error.message)
      return null
    }
    if (data === null || data === undefined) return null
    const n = num(data)
    return Number.isFinite(n) ? n : null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[market-settings] get threw:", err)
    return null
  }
}

/**
 * Updates a setting. Performs full local validation BEFORE hitting
 * the RPC so we fail fast on obvious user errors. The server still
 * re-validates (defense in depth) — see Migration 14.06.
 */
export async function updateMarketSetting(
  key: string,
  newValue: number,
  reason?: string,
): Promise<UpdateSettingResult> {
  // ─── Local pre-flight ────────────────────────────────────────
  if (!key || typeof key !== "string") {
    return {
      success: false,
      reason: "invalid_key",
      error: ARABIC_ERROR.invalid_key,
    }
  }
  if (!Number.isFinite(newValue)) {
    return {
      success: false,
      reason: "invalid_value",
      error: ARABIC_ERROR.invalid_value,
    }
  }

  // ─── RPC ────────────────────────────────────────────────────
  try {
    const supabase = createClient()
    const trimmedReason = (reason ?? "").trim()
    const { data, error } = await supabase.rpc("update_market_setting", {
      p_key: key,
      p_new_value: newValue,
      p_reason: trimmedReason.length > 0 ? trimmedReason : null,
    })

    if (error) {
      return {
        success: false,
        reason: "rpc_error",
        error: error.message || ARABIC_ERROR.rpc_error,
      }
    }

    const r = (data ?? {}) as {
      success?: boolean
      error?: string
      note?: string
      old_value?: number | string
      new_value?: number | string
      label?: string
      min?: number | string
      max?: number | string
    }

    if (!r.success) {
      const code = r.error ?? "unknown"
      const result: UpdateSettingResult = {
        success: false,
        reason: code,
        error: arabicErrorFor(code),
      }
      if (code === "value_out_of_range" && r.min !== undefined && r.max !== undefined) {
        result.bounds = { min: num(r.min), max: num(r.max) }
        result.error = `القيمة خارج المدى المسموح (${result.bounds.min} إلى ${result.bounds.max})`
      }
      return result
    }

    const oldValue = num(r.old_value)
    const newVal = num(r.new_value)
    const noOp = r.note === "no_change" || oldValue === newVal
    const label = r.label ?? key

    return {
      success: true,
      message: noOp
        ? `لا تغيير — "${label}" بقي على ${newVal}`
        : `✓ تم حفظ "${label}": ${oldValue} → ${newVal}`,
      data: {
        old_value: oldValue,
        new_value: newVal,
        label,
        no_op: noOp,
      },
    }
  } catch (err) {
    return {
      success: false,
      reason: "exception",
      error: err instanceof Error ? err.message : ARABIC_ERROR.exception,
    }
  }
}

/** Resets a setting to its founder-blessed default. Inherits the audit log. */
export async function resetMarketSetting(
  key: string,
): Promise<UpdateSettingResult> {
  if (!key) {
    return {
      success: false,
      reason: "invalid_key",
      error: ARABIC_ERROR.invalid_key,
    }
  }
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("reset_market_setting", {
      p_key: key,
    })
    if (error) {
      return {
        success: false,
        reason: "rpc_error",
        error: error.message || ARABIC_ERROR.rpc_error,
      }
    }
    const r = (data ?? {}) as {
      success?: boolean
      error?: string
      note?: string
      old_value?: number | string
      new_value?: number | string
      label?: string
    }
    if (!r.success) {
      const code = r.error ?? "unknown"
      return {
        success: false,
        reason: code,
        error: arabicErrorFor(code),
      }
    }
    const oldValue = num(r.old_value)
    const newVal = num(r.new_value)
    const noOp = r.note === "no_change" || oldValue === newVal
    const label = r.label ?? key
    return {
      success: true,
      message: noOp
        ? `"${label}" أصلاً على القيمة الافتراضية`
        : `🔄 تمت استعادة "${label}" إلى الافتراضي (${newVal})`,
      data: {
        old_value: oldValue,
        new_value: newVal,
        label,
        no_op: noOp,
      },
    }
  } catch (err) {
    return {
      success: false,
      reason: "exception",
      error: err instanceof Error ? err.message : ARABIC_ERROR.exception,
    }
  }
}

/**
 * Fetches the audit log. Returns [] for non-super-admins (the RPC
 * silently returns an empty set rather than erroring).
 *
 * @param key   Filter to a single setting; omit for all.
 * @param limit Page size — clamped to [1, 500] server-side.
 */
export async function getSettingAuditLog(
  key?: string,
  limit?: number,
): Promise<SettingAuditEntry[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_setting_audit_log", {
      p_key: key ?? null,
      p_limit: limit ?? 50,
    })
    if (error || !data) {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[market-settings] audit failed:", error.message)
      }
      return []
    }
    const rows = (data ?? []) as Array<{
      setting_key: string
      setting_label: string
      old_value: number | string
      new_value: number | string
      changed_by_name: string | null
      changed_at: string
      reason: string | null
    }>
    return rows.map((r) => ({
      setting_key: r.setting_key,
      setting_label: r.setting_label,
      old_value: num(r.old_value),
      new_value: num(r.new_value),
      changed_by_name: r.changed_by_name,
      changed_at: r.changed_at,
      reason: r.reason,
    }))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[market-settings] audit threw:", err)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════
// Display helpers — pure, no IO
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_META: Record<
  SettingCategory,
  { label: string; emoji: string; order: number }
> = {
  engine_control: { label: "التحكم بالمحرك", emoji: "⚡", order: 0 },
  sector_caps:    { label: "سقوف القطاعات", emoji: "📊", order: 1 },
  daily_caps:     { label: "السقوف اليومية", emoji: "⏱", order: 2 },
  yearly_cap:     { label: "السقف السنوي",   emoji: "📅", order: 3 },
  manual_rise:    { label: "الرفع اليدوي",   emoji: "✋", order: 4 },
  layers:         { label: "الطبقات الثلاث", emoji: "🎯", order: 5 },
  active_user:    { label: "المستخدم النشط", emoji: "👥", order: 6 },
  cron:           { label: "المهمة المجدولة", emoji: "⏰", order: 7 },
}

/** Arabic display name for a category (e.g. "سقوف القطاعات"). */
export function getCategoryLabel(category: SettingCategory): string {
  return CATEGORY_META[category]?.label ?? category
}

/** Single emoji used as a category icon in the UI. */
export function getCategoryEmoji(category: SettingCategory): string {
  return CATEGORY_META[category]?.emoji ?? "🔧"
}

/** Stable ordering for category sections in the admin UI. */
export function getCategoryOrder(category: SettingCategory): number {
  return CATEGORY_META[category]?.order ?? 99
}

/**
 * Renders a value with its unit (e.g. 5.0 + 'percent' → "5%").
 * Stays in en-US for the number itself so RTL/Arabic doesn't mangle
 * digit grouping; the suffix is in Arabic.
 *
 * For `count` settings that are boolean-shaped (0/1), the caller
 * should use `isBooleanSetting` first and render "مفعّل / موقّف"
 * instead — this function only handles the raw scalar form.
 */
export function formatSettingValue(
  value: number,
  type: SettingValueType,
): string {
  if (!Number.isFinite(value)) return "—"

  // Drop trailing .0 for integer-looking values.
  const isWhole = value === Math.trunc(value)
  const display = isWhole ? value.toString() : value.toFixed(2)

  switch (type) {
    case "percent":
      return `${display}%`
    case "days":
      return `${display} يوم`
    case "hour":
      // Always whole hour in [0,23]. Render as "الساعة 14".
      return `الساعة ${Math.trunc(value)}:00`
    case "count":
      return display
    case "ratio":
      // Render as 0..1 with 2 decimals (e.g. "0.50").
      return value.toFixed(2)
    default:
      return display
  }
}

/** True ⇔ live value !== default value. */
export function isSettingModified(setting: MarketSetting): boolean {
  return setting.value !== setting.default_value
}

/**
 * True when the setting acts as a boolean switch — value_type='count'
 * AND bounds are exactly [0, 1]. The UI renders these as a toggle
 * instead of a numeric input. Currently only `engine_enabled`.
 */
export function isBooleanSetting(setting: MarketSetting): boolean {
  return (
    setting.value_type === "count" &&
    setting.min_value === 0 &&
    setting.max_value === 1
  )
}

/**
 * Local pre-flight validation — caller (UI) should run this on every
 * keystroke to disable the save button until valid.
 */
export function validateSettingValue(
  value: number,
  min: number,
  max: number,
): ValidationResult {
  if (!Number.isFinite(value)) {
    return { valid: false, error: "القيمة غير صالحة" }
  }
  if (value < min) {
    return { valid: false, error: `أقل من الحد الأدنى (${min})` }
  }
  if (value > max) {
    return { valid: false, error: `أكبر من الحد الأعلى (${max})` }
  }
  return { valid: true }
}

/**
 * Flags "big" changes for the confirmation dialog. Defaults to >20%
 * relative change vs the current live value. Falls back to absolute
 * threshold for old=0 cases.
 */
export function isBigChange(
  oldValue: number,
  newValue: number,
  thresholdPct: number = 20,
): boolean {
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) return false
  if (oldValue === newValue) return false
  if (oldValue === 0) {
    // Anything-from-zero is big.
    return newValue !== 0
  }
  const changePct = Math.abs(((newValue - oldValue) / oldValue) * 100)
  return changePct > thresholdPct
}

/**
 * Groups a flat settings list by category, ordered by
 * `getCategoryOrder` so the UI renders sections in a stable sequence.
 * Returns a Partial because not every category needs to be present.
 */
export function groupSettingsByCategory(
  settings: MarketSetting[],
): Array<{ category: SettingCategory; items: MarketSetting[] }> {
  const map = new Map<SettingCategory, MarketSetting[]>()
  for (const s of settings) {
    const arr = map.get(s.category) ?? []
    arr.push(s)
    map.set(s.category, arr)
  }
  return Array.from(map.entries())
    .sort((a, b) => getCategoryOrder(a[0]) - getCategoryOrder(b[0]))
    .map(([category, items]) => ({ category, items }))
}
