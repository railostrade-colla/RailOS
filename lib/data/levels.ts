/**
 * Levels — Data layer (auto-upgrade + override + history)
 *
 * في Mock mode: يعدّل LEVEL_SETTINGS_STORE + MOCK_USER_STATS + MOCK_LEVEL_HISTORY مباشرة.
 * في Production: يستخدم Supabase RPC + insert في level_history.
 */

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
