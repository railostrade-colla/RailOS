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

// ──────────────────────────────────────────────────────────────────────
// Phase G — DB-backed user stats + level history (replaces mock fixtures)
// ──────────────────────────────────────────────────────────────────────

interface UserStatsViewRow {
  id: string
  display_name: string | null
  level: string | null
  kyc_status: string | null
  total_trade_volume: number | string | null
  total_trades: number | null
  successful_trades: number | null
  failed_trades: number | null
  cancelled_trades: number | null
  success_rate: number | string | null
  disputes_total: number | null
  disputes_won: number | null
  disputes_lost: number | null
  dispute_rate: number | string | null
  reports_received: number | null
  reports_against_others: number | null
  rating_average: number | string | null
  rating_count: number | null
  days_active: number | null
  first_trade_at: string | null
  last_trade_at: string | null
  account_age_days: number | null
  level_override: string | null
  level_overridden_at: string | null
}

interface LevelHistoryRow {
  id: string
  user_id: string | null
  from_level: string | null
  to_level: string | null
  change_type: string | null
  reason: string | null
  changed_by: string | null
  created_at: string | null
}

/** Defensive coerce: PostgREST returns BIGINT/NUMERIC as string. */
function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback
  const x = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : fallback
}

/**
 * Loads the current user's level / trading / disputes stats from the
 * `user_stats_view` (created by migration 10). Returns `null` only when
 * the user is unauthenticated or the view is unavailable — callers
 * should fall back to the mock UserStats fixture in that case.
 *
 * Booleans for `level_locked` aren't on the view; we read them from
 * profiles separately to avoid changing the migration.
 */
export async function getMyUserStats(): Promise<UserStats | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("user_stats_view")
      .select(
        "id, display_name, level, kyc_status, total_trade_volume, total_trades, successful_trades, failed_trades, cancelled_trades, success_rate, disputes_total, disputes_won, disputes_lost, dispute_rate, reports_received, reports_against_others, rating_average, rating_count, days_active, first_trade_at, last_trade_at, account_age_days, level_override, level_overridden_at",
      )
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[levels] user_stats_view unavailable:", error.message)
      return null
    }
    if (!data) return null

    const row = data as UserStatsViewRow
    const level = isLevelId(row.level ?? "") ? (row.level as LevelId) : "basic"
    const kycRaw = row.kyc_status
    const kyc: UserStats["kyc_status"] =
      kycRaw === "advanced" ? "advanced" : kycRaw === "pro" ? "pro" : "basic"

    // level_locked + level_upgraded_at + level_override_reason live on
    // profiles (not on the view) — fetch them as a best-effort top-up.
    let levelLocked = false
    let levelUpgradedAt: string | undefined
    let levelOverrideReason: string | undefined
    try {
      const { data: pdata } = await supabase
        .from("profiles")
        .select("level_locked, level_upgraded_at, level_override_reason")
        .eq("id", user.id)
        .maybeSingle()
      if (pdata) {
        const p = pdata as {
          level_locked?: boolean | null
          level_upgraded_at?: string | null
          level_override_reason?: string | null
        }
        levelLocked = p.level_locked ?? false
        levelUpgradedAt = p.level_upgraded_at ?? undefined
        levelOverrideReason = p.level_override_reason ?? undefined
      }
    } catch {
      /* keep defaults */
    }

    const overrideRaw = row.level_override
    const levelOverride: LevelId | null =
      overrideRaw && isLevelId(overrideRaw) ? overrideRaw : null

    return {
      id: row.id,
      display_name: row.display_name ?? "—",
      level,
      kyc_status: kyc,

      total_trade_volume: num(row.total_trade_volume),
      total_trades: num(row.total_trades),
      successful_trades: num(row.successful_trades),
      failed_trades: num(row.failed_trades),
      cancelled_trades: num(row.cancelled_trades),
      success_rate: num(row.success_rate),

      disputes_total: num(row.disputes_total),
      disputes_won: num(row.disputes_won),
      disputes_lost: num(row.disputes_lost),
      dispute_rate: num(row.dispute_rate),

      reports_received: num(row.reports_received),
      reports_against_others: num(row.reports_against_others),

      rating_average: num(row.rating_average),
      rating_count: num(row.rating_count),

      days_active: num(row.days_active),
      account_age_days: num(row.account_age_days),
      first_trade_at: row.first_trade_at ?? undefined,
      last_trade_at: row.last_trade_at ?? undefined,

      level_override: levelOverride,
      level_override_reason: levelOverrideReason,
      level_overridden_at: row.level_overridden_at ?? undefined,
      level_locked: levelLocked,
      level_upgraded_at: levelUpgradedAt,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[levels] getMyUserStats threw:", err)
    return null
  }
}

/** Maps a raw `change_type` text to the strict UI enum. */
function asChangeType(s: string | null): LevelChangeType | null {
  if (s === "auto_upgrade" || s === "auto_downgrade") return s
  if (s === "admin_override" || s === "admin_revert") return s
  return null
}

/**
 * Loads the current user's level-history rows (latest first), validated
 * against the strict UI types. Drops malformed rows silently so a single
 * bad record can't break the whole list.
 */
export async function getMyLevelHistory(
  limit: number = 20,
): Promise<LevelHistoryEntry[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("level_history")
      .select(
        "id, user_id, from_level, to_level, change_type, reason, changed_by, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error)
        // eslint-disable-next-line no-console
        console.warn("[levels] level_history:", error.message)
      return []
    }

    const out: LevelHistoryEntry[] = []
    for (const row of data as LevelHistoryRow[]) {
      const changeType = asChangeType(row.change_type)
      if (!changeType) continue
      const fromLevel =
        row.from_level && isLevelId(row.from_level)
          ? (row.from_level as LevelId)
          : null
      if (!row.to_level || !isLevelId(row.to_level)) continue
      out.push({
        id: row.id,
        user_id: row.user_id ?? user.id,
        from_level: fromLevel,
        to_level: row.to_level as LevelId,
        change_type: changeType,
        reason: row.reason ?? "",
        changed_by: row.changed_by ?? undefined,
        created_at: row.created_at ?? new Date().toISOString(),
      })
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[levels] getMyLevelHistory threw:", err)
    return []
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
