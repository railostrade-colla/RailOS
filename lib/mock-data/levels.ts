/**
 * Levels System — Mock data + Types
 *
 * نظام شامل لمستويات المستخدمين:
 * - 4 مستويات: basic / advanced / pro / elite
 * - شروط قابلة للتعديل من الأدمن (LEVEL_SETTINGS_STORE)
 * - استثناءات يدوية (level_override)
 *
 * في Production: تُستبدَل بـ Supabase tables (level_settings + level_history).
 */

export type LevelId = "basic" | "advanced" | "pro" | "elite"

// ──────────────────────────────────────────────────────────────────────────
// Level Settings (إعدادات قابلة للتعديل من الأدمن)
// ──────────────────────────────────────────────────────────────────────────

export interface LevelSetting {
  level: LevelId
  display_name_ar: string
  level_order: number

  // الشروط الأساسية
  min_volume: number          // د.ع
  min_total_trades: number
  min_successful_trades: number
  min_success_rate: number    // %
  min_days_active: number

  // النزاعات والبلاغات
  max_disputes_lost: number
  max_reports_received: number
  max_dispute_rate: number    // %

  // KYC والتقييم
  required_kyc: "basic" | "advanced" | "pro"
  min_rating: number          // 0-5

  // المزايا
  monthly_trade_limit: number  // د.ع
  fee_discount: number         // %
  benefits: string[]

  // meta
  color: string
  icon: string
}

export const DEFAULT_LEVEL_SETTINGS: LevelSetting[] = [
  {
    level: "basic",
    display_name_ar: "أساسي",
    level_order: 1,
    min_volume: 0,
    min_total_trades: 0,
    min_successful_trades: 0,
    min_success_rate: 0,
    min_days_active: 0,
    max_disputes_lost: 999,
    max_reports_received: 5,
    max_dispute_rate: 100,
    required_kyc: "basic",
    min_rating: 0,
    monthly_trade_limit: 10_000_000,
    fee_discount: 0,
    benefits: ["تداول حتى 10 مليون د.ع شهرياً", "عمولة 2% (ثابتة)"],
    color: "#60A5FA",
    icon: "🌱",
  },
  {
    level: "advanced",
    display_name_ar: "متقدّم",
    level_order: 2,
    min_volume: 100_000_000,
    min_total_trades: 50,
    min_successful_trades: 45,
    min_success_rate: 90,
    min_days_active: 30,
    max_disputes_lost: 2,
    max_reports_received: 3,
    max_dispute_rate: 5,
    required_kyc: "advanced",
    min_rating: 4.0,
    monthly_trade_limit: 50_000_000,
    fee_discount: 0,
    benefits: ["تداول حتى 50 مليون د.ع شهرياً", "شارة \"متقدّم\"", "أولوية في الدعم"],
    color: "#4ADE80",
    icon: "⚡",
  },
  {
    level: "pro",
    display_name_ar: "محترف",
    level_order: 3,
    min_volume: 250_000_000,
    min_total_trades: 200,
    min_successful_trades: 190,
    min_success_rate: 95,
    min_days_active: 90,
    max_disputes_lost: 1,
    max_reports_received: 1,
    max_dispute_rate: 2,
    required_kyc: "pro",
    min_rating: 4.5,
    monthly_trade_limit: 250_000_000,
    fee_discount: 0,
    benefits: ["تداول حتى 250 مليون د.ع شهرياً", "شارة \"محترف\"", "دعم VIP", "وصول مبكّر للمزادات"],
    color: "#C084FC",
    icon: "💎",
  },
  {
    level: "elite",
    display_name_ar: "النخبة",
    level_order: 4,
    min_volume: 500_000_000,
    min_total_trades: 500,
    min_successful_trades: 490,
    min_success_rate: 98,
    min_days_active: 180,
    max_disputes_lost: 0,
    max_reports_received: 0,
    max_dispute_rate: 1,
    required_kyc: "pro",
    min_rating: 4.8,
    monthly_trade_limit: 1_000_000_000,
    fee_discount: 0,
    benefits: ["تداول حتى 1 مليار د.ع شهرياً", "شارة \"النخبة\" الذهبية", "مدير حساب مخصّص", "دعوات حصرية"],
    color: "#FBBF24",
    icon: "👑",
  },
]

// In-memory store (يحاكي إعدادات قابلة للتعديل من الأدمن)
export const LEVEL_SETTINGS_STORE: LevelSetting[] = DEFAULT_LEVEL_SETTINGS.map((l) => ({ ...l }))

// ──────────────────────────────────────────────────────────────────────────
// User Stats (إحصائيات المستخدم)
// ──────────────────────────────────────────────────────────────────────────

export interface UserStats {
  id: string
  display_name: string
  email?: string
  level: LevelId
  kyc_status: "basic" | "advanced" | "pro"

  // التداول
  total_trade_volume: number
  total_trades: number
  successful_trades: number
  failed_trades: number
  cancelled_trades: number
  success_rate: number  // محسوبة

  // النزاعات
  disputes_total: number
  disputes_won: number
  disputes_lost: number
  dispute_rate: number  // محسوبة

  // البلاغات
  reports_received: number
  reports_against_others: number

  // التقييم
  rating_average: number
  rating_count: number

  // الزمن
  days_active: number
  account_age_days: number
  first_trade_at?: string
  last_trade_at?: string

  // المستوى
  level_override: LevelId | null
  level_override_reason?: string
  level_overridden_at?: string
  level_locked: boolean
  level_upgraded_at?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Level History (تاريخ التغييرات)
// ──────────────────────────────────────────────────────────────────────────

export type LevelChangeType = "auto_upgrade" | "auto_downgrade" | "admin_override" | "admin_revert"

export interface LevelHistoryEntry {
  id: string
  user_id: string
  from_level: LevelId | null
  to_level: LevelId
  change_type: LevelChangeType
  reason: string
  changed_by?: string  // admin id
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Mock current user stats (CURRENT_USER from profile.ts)
// ──────────────────────────────────────────────────────────────────────────

export const MOCK_USER_STATS: UserStats = {
  id: "abc123def456",
  display_name: "أحمد محمد",
  email: "ahmed.m@example.com",
  level: "advanced",
  kyc_status: "advanced",

  total_trade_volume: 150_000_000,
  total_trades: 152,
  successful_trades: 145,
  failed_trades: 5,
  cancelled_trades: 2,
  success_rate: 95.4,

  disputes_total: 3,
  disputes_won: 2,
  disputes_lost: 1,
  dispute_rate: 1.97,

  reports_received: 1,
  reports_against_others: 0,

  rating_average: 4.7,
  rating_count: 89,

  days_active: 75,
  account_age_days: 120,
  first_trade_at: "2026-01-15T10:00:00",
  last_trade_at: "2026-04-29T16:30:00",

  level_override: null,
  level_locked: false,
  level_upgraded_at: "2026-03-15T14:20:00",
}

// ──────────────────────────────────────────────────────────────────────────
// Mock level history
// ──────────────────────────────────────────────────────────────────────────

export const MOCK_LEVEL_HISTORY: LevelHistoryEntry[] = [
  {
    id: "lh-1",
    user_id: "abc123def456",
    from_level: "basic",
    to_level: "advanced",
    change_type: "auto_upgrade",
    reason: "استوفى جميع شروط المستوى المتقدّم",
    created_at: "2026-03-15T14:20:00",
  },
  {
    id: "lh-2",
    user_id: "abc123def456",
    from_level: null,
    to_level: "basic",
    change_type: "auto_upgrade",
    reason: "حساب جديد",
    created_at: "2026-01-01T08:00:00",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

export function getLevelSetting(level: LevelId): LevelSetting | undefined {
  return LEVEL_SETTINGS_STORE.find((l) => l.level === level)
}

/** يفحص إذا كان المستخدم يستوفي شروط مستوى معيّن. */
export function checkRequirements(stats: UserStats, setting: LevelSetting): boolean {
  return (
    stats.total_trade_volume >= setting.min_volume &&
    stats.total_trades >= setting.min_total_trades &&
    stats.successful_trades >= setting.min_successful_trades &&
    stats.success_rate >= setting.min_success_rate &&
    stats.days_active >= setting.min_days_active &&
    stats.disputes_lost <= setting.max_disputes_lost &&
    stats.reports_received <= setting.max_reports_received &&
    stats.dispute_rate <= setting.max_dispute_rate &&
    stats.rating_average >= setting.min_rating
  )
}

/** يُرجع المستوى التالي في التسلسل. */
export function getNextLevel(currentLevel: LevelId): LevelSetting | null {
  const current = getLevelSetting(currentLevel)
  if (!current) return null
  return LEVEL_SETTINGS_STORE.find((l) => l.level_order === current.level_order + 1) ?? null
}

/** قائمة بالشروط ومدى استيفاء المستخدم لها. */
export function getRequirementChecklist(stats: UserStats, targetLevel: LevelId) {
  const setting = getLevelSetting(targetLevel)
  if (!setting) return []

  return [
    {
      label: "حجم التداول",
      current: stats.total_trade_volume,
      required: setting.min_volume,
      met: stats.total_trade_volume >= setting.min_volume,
      unit: "د.ع",
    },
    {
      label: "عدد الصفقات",
      current: stats.total_trades,
      required: setting.min_total_trades,
      met: stats.total_trades >= setting.min_total_trades,
      unit: "صفقة",
    },
    {
      label: "معدل النجاح",
      current: stats.success_rate,
      required: setting.min_success_rate,
      met: stats.success_rate >= setting.min_success_rate,
      unit: "%",
    },
    {
      label: "أيام النشاط",
      current: stats.days_active,
      required: setting.min_days_active,
      met: stats.days_active >= setting.min_days_active,
      unit: "يوم",
    },
    {
      label: "النزاعات الخاسرة (حد أقصى)",
      current: stats.disputes_lost,
      required: setting.max_disputes_lost,
      met: stats.disputes_lost <= setting.max_disputes_lost,
      unit: "نزاع",
      inverse: true,
    },
    {
      label: "البلاغات المُستلمة (حد أقصى)",
      current: stats.reports_received,
      required: setting.max_reports_received,
      met: stats.reports_received <= setting.max_reports_received,
      unit: "بلاغ",
      inverse: true,
    },
    {
      label: "التقييم",
      current: stats.rating_average,
      required: setting.min_rating,
      met: stats.rating_average >= setting.min_rating,
      unit: "/ 5",
    },
  ]
}
