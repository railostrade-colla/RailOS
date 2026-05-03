/**
 * Levels — Data layer (auto-upgrade + override + history)
 *
 * في Mock mode: يعدّل LEVEL_SETTINGS_STORE + MOCK_USER_STATS + MOCK_LEVEL_HISTORY مباشرة.
 * في Production: يستخدم Supabase RPC + insert في level_history.
 */

import { createClient } from "@/lib/supabase/client"
import {
  LEVEL_SETTINGS_STORE,
  MOCK_USER_STATS,
  MOCK_LEVEL_HISTORY,
  checkRequirements,
  getLevelSetting,
  type LevelId,
  type LevelSetting,
  type UserStats,
  type LevelHistoryEntry,
  type LevelChangeType,
} from "@/lib/mock-data/levels"

// ──────────────────────────────────────────────────────────────────────────
// Auto-upgrade / downgrade logic
// ──────────────────────────────────────────────────────────────────────────

export interface LevelChangeResult {
  changed: boolean
  from?: LevelId
  to?: LevelId
  type?: "upgrade" | "downgrade" | "override_active" | "no_change"
  reason?: string
}

/**
 * يفحص إن كان المستخدم يستحقّ ترقية أو تنزيل، ويُطبّقها إذا لزم.
 * يأخذ في الاعتبار level_override.
 */
export function checkAutoLevelUpgrade(stats: UserStats = MOCK_USER_STATS): LevelChangeResult {
  // إذا override نشط = لا تغيّر
  if (stats.level_override) {
    return {
      changed: false,
      type: "override_active",
      reason: "تجاوز يدوي نشط — لا فحص تلقائي",
    }
  }

  // إذا level_locked = لا تغيّر
  if (stats.level_locked) {
    return {
      changed: false,
      type: "no_change",
      reason: "المستوى مقفل",
    }
  }

  // ابحث عن أعلى مستوى يستحقّه
  const sortedDesc = [...LEVEL_SETTINGS_STORE].sort((a, b) => b.level_order - a.level_order)

  for (const setting of sortedDesc) {
    if (checkRequirements(stats, setting)) {
      const currentSetting = getLevelSetting(stats.level)
      if (!currentSetting) continue

      // ترقية
      if (setting.level_order > currentSetting.level_order) {
        const fromLevel = stats.level
        stats.level = setting.level
        stats.level_upgraded_at = new Date().toISOString()

        addToHistory({
          user_id: stats.id,
          from_level: fromLevel,
          to_level: setting.level,
          change_type: "auto_upgrade",
          reason: `استوفى شروط ${setting.display_name_ar}`,
        })

        return {
          changed: true,
          from: fromLevel,
          to: setting.level,
          type: "upgrade",
          reason: setting.display_name_ar,
        }
      }

      // أعلى من المستوى الحالي = لا تغيير
      return { changed: false, type: "no_change" }
    }
  }

  // فحص التنزيل
  const currentSetting = getLevelSetting(stats.level)
  if (currentSetting && !checkRequirements(stats, currentSetting)) {
    const eligibleLevel = sortedDesc.find((s) => checkRequirements(stats, s))
    if (eligibleLevel && eligibleLevel.level_order < currentSetting.level_order) {
      const fromLevel = stats.level
      stats.level = eligibleLevel.level

      addToHistory({
        user_id: stats.id,
        from_level: fromLevel,
        to_level: eligibleLevel.level,
        change_type: "auto_downgrade",
        reason: "لم يعد يستوفي شروط المستوى السابق",
      })

      return {
        changed: true,
        from: fromLevel,
        to: eligibleLevel.level,
        type: "downgrade",
      }
    }
  }

  return { changed: false, type: "no_change" }
}

// ──────────────────────────────────────────────────────────────────────────
// Admin actions: Override + Lock
// ──────────────────────────────────────────────────────────────────────────

export function setLevelOverride(
  stats: UserStats,
  newLevel: LevelId,
  reason: string,
  adminId: string,
  lock: boolean = false
): { success: boolean; error?: string } {
  if (!reason.trim()) {
    return { success: false, error: "السبب إجباري" }
  }

  const fromLevel = stats.level
  stats.level = newLevel
  stats.level_override = newLevel
  stats.level_override_reason = reason
  stats.level_overridden_at = new Date().toISOString()
  stats.level_locked = lock

  addToHistory({
    user_id: stats.id,
    from_level: fromLevel,
    to_level: newLevel,
    change_type: "admin_override",
    reason,
    changed_by: adminId,
  })

  return { success: true }
}

export function removeLevelOverride(
  stats: UserStats,
  adminId: string
): { success: boolean } {
  const fromLevel = stats.level
  stats.level_override = null
  stats.level_override_reason = undefined
  stats.level_overridden_at = undefined
  stats.level_locked = false

  // Re-check auto level
  const result = checkAutoLevelUpgrade(stats)

  addToHistory({
    user_id: stats.id,
    from_level: fromLevel,
    to_level: stats.level,
    change_type: "admin_revert",
    reason: "تم إزالة التجاوز اليدوي — العودة للحساب التلقائي",
    changed_by: adminId,
  })

  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────
// Admin actions: Update level settings (bulk)
// ──────────────────────────────────────────────────────────────────────────

export function updateLevelSettings(updated: LevelSetting[]): { success: boolean } {
  for (const newSetting of updated) {
    const idx = LEVEL_SETTINGS_STORE.findIndex((l) => l.level === newSetting.level)
    if (idx >= 0) {
      LEVEL_SETTINGS_STORE[idx] = { ...newSetting }
    }
  }
  return { success: true }
}

// ──────────────────────────────────────────────────────────────────────────
// History helpers
// ──────────────────────────────────────────────────────────────────────────

function addToHistory(entry: Omit<LevelHistoryEntry, "id" | "created_at">) {
  MOCK_LEVEL_HISTORY.unshift({
    id: `lh-${Date.now()}`,
    created_at: new Date().toISOString(),
    ...entry,
  })
}

export function getUserLevelHistory(userId: string, limit: number = 20): LevelHistoryEntry[] {
  return MOCK_LEVEL_HISTORY.filter((h) => h.user_id === userId).slice(0, limit)
}

// ──────────────────────────────────────────────────────────────────────────
// Process trade completion (combined update)
// ──────────────────────────────────────────────────────────────────────────

export function processTradeCompletion(
  stats: UserStats,
  amount: number,
  status: "completed" | "failed" | "cancelled"
) {
  stats.total_trade_volume += amount
  stats.total_trades += 1
  if (status === "completed") stats.successful_trades += 1
  if (status === "failed") stats.failed_trades += 1
  if (status === "cancelled") stats.cancelled_trades += 1

  if (stats.total_trades > 0) {
    stats.success_rate = parseFloat(
      ((stats.successful_trades / stats.total_trades) * 100).toFixed(2)
    )
  }

  stats.last_trade_at = new Date().toISOString()
  if (!stats.first_trade_at) stats.first_trade_at = stats.last_trade_at

  // فحص الترقية تلقائياً
  return checkAutoLevelUpgrade(stats)
}

// ──────────────────────────────────────────────────────────────────────────
// Change type meta (for UI)
// ──────────────────────────────────────────────────────────────────────────

export const CHANGE_TYPE_META: Record<
  LevelChangeType,
  { label: string; icon: string; color: "green" | "red" | "purple" | "blue" }
> = {
  auto_upgrade:   { label: "ترقية تلقائية",      icon: "↗️", color: "green"  },
  auto_downgrade: { label: "تنزيل تلقائي",       icon: "↘️", color: "red"    },
  admin_override: { label: "تجاوز يدوي",          icon: "🛡️", color: "purple" },
  admin_revert:   { label: "إزالة التجاوز",       icon: "🔄", color: "blue"   },
}

// ══════════════════════════════════════════════════════════════════════
// Phase C — DB-backed level settings (read-only, public)
// ══════════════════════════════════════════════════════════════════════

interface LevelSettingsRow {
  level: string | null
  display_name_ar: string | null
  level_order: number | null
  min_volume: number | string | null
  min_total_trades: number | null
  min_successful_trades: number | null
  min_success_rate: number | string | null
  min_days_active: number | null
  max_disputes_lost: number | null
  max_reports_received: number | null
  max_dispute_rate: number | string | null
  required_kyc: string | null
  min_rating: number | string | null
  monthly_trade_limit: number | string | null
  fee_discount: number | string | null
  benefits: unknown
  color: string | null
  icon: string | null
}

function isLevelId(s: string): s is LevelId {
  return s === "basic" || s === "advanced" || s === "pro" || s === "elite"
}

function isKycKind(s: string | null): s is "basic" | "advanced" | "pro" {
  return s === "basic" || s === "advanced" || s === "pro"
}

function dbRowToLevelSetting(row: LevelSettingsRow): LevelSetting | null {
  if (!row.level || !isLevelId(row.level)) return null

  const benefits = Array.isArray(row.benefits)
    ? row.benefits.filter((b): b is string => typeof b === "string")
    : []

  return {
    level: row.level,
    display_name_ar: row.display_name_ar ?? row.level,
    level_order: Number(row.level_order ?? 0),
    min_volume: Number(row.min_volume ?? 0),
    min_total_trades: Number(row.min_total_trades ?? 0),
    min_successful_trades: Number(row.min_successful_trades ?? 0),
    min_success_rate: Number(row.min_success_rate ?? 0),
    min_days_active: Number(row.min_days_active ?? 0),
    max_disputes_lost: Number(row.max_disputes_lost ?? 999),
    max_reports_received: Number(row.max_reports_received ?? 999),
    max_dispute_rate: Number(row.max_dispute_rate ?? 100),
    required_kyc: isKycKind(row.required_kyc) ? row.required_kyc : "basic",
    min_rating: Number(row.min_rating ?? 0),
    monthly_trade_limit: Number(row.monthly_trade_limit ?? 0),
    fee_discount: Number(row.fee_discount ?? 0),
    benefits,
    color: row.color ?? "#60A5FA",
    icon: row.icon ?? "⭐",
  }
}

/**
 * Loads the public level catalogue from the `level_settings` table.
 *
 * Returns an empty array on any failure — pages should fall back to
 * the seeded `LEVEL_SETTINGS_STORE` (mock) when this returns nothing,
 * so a missing migration never breaks the page.
 */
export async function getLevelSettings(): Promise<LevelSetting[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("level_settings")
      .select(
        "level, display_name_ar, level_order, min_volume, min_total_trades, min_successful_trades, min_success_rate, min_days_active, max_disputes_lost, max_reports_received, max_dispute_rate, required_kyc, min_rating, monthly_trade_limit, fee_discount, benefits, color, icon",
      )
      .order("level_order", { ascending: true })

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[levels] getLevelSettings:", error.message)
      return []
    }

    const out: LevelSetting[] = []
    for (const row of data as LevelSettingsRow[]) {
      const mapped = dbRowToLevelSetting(row)
      if (mapped) out.push(mapped)
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[levels] getLevelSettings threw:", err)
    return []
  }
}
