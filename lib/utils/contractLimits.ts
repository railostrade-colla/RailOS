/**
 * نظام حساب حدود الاستخدام في رايلوس
 *
 * القاعدة الأساسية:
 * - المستثمر الفرد له حد شهري حسب مستواه
 * - في العقود الجماعية: حد العقد = (مجموع حدود الأعضاء) × 1.25
 *
 * المستويات:
 * - أساسي: 10,000,000 د.ع/شهر
 * - متقدم: 50,000,000 د.ع/شهر (شروط: 100 صفقة + 90 يوم + 95% نجاح)
 * - محترف: 250,000,000 د.ع/شهر (شروط: 500 صفقة + 180 يوم + 98% نجاح)
 *
 * ملاحظة: العمولة ثابتة 2% لجميع المستويات (بدون خصومات)
 */

export type InvestorLevel = "basic" | "advanced" | "pro"

export const LEVEL_LIMITS: Record<InvestorLevel, number> = {
  basic: 10_000_000,
  advanced: 50_000_000,
  pro: 250_000_000,
}

export const LEVEL_LABELS: Record<InvestorLevel, string> = {
  basic: "أساسي",
  advanced: "متقدم",
  pro: "محترف",
}

export const LEVEL_ICONS: Record<InvestorLevel, string> = {
  basic: "🟢",
  advanced: "🔵",
  pro: "🟣",
}

export const LEVEL_COLORS: Record<InvestorLevel, string> = {
  basic: "#4ADE80",
  advanced: "#60A5FA",
  pro: "#C084FC",
}

// شروط الترقية بين المستويات
export const LEVEL_REQUIREMENTS = {
  advanced: {
    minTrades: 100,
    minDays: 90,
    minSuccessRate: 95,
    kycLevel: "متقدم",
  },
  pro: {
    minTrades: 500,
    minDays: 180,
    minSuccessRate: 98,
    kycLevel: "احترافي",
  },
} as const

// نسبة المكافأة في العقود الجماعية
export const CONTRACT_BONUS_PERCENT = 25

// العمولة الثابتة على كل صفقة (لجميع المستويات)
export const TRADE_COMMISSION_PERCENT = 2

export interface ContractMember {
  user_id: string
  name: string
  level: InvestorLevel
  share_percent: number
}

/**
 * حساب الحد الشهري لعقد جماعي
 *
 * @example
 * computeContractLimit([
 *   { level: "basic" }, { level: "basic" },
 *   { level: "basic" }, { level: "basic" },
 * ])
 * // returns: { sumLimit: 40000000, bonus: 10000000, totalLimit: 50000000 }
 */
export function computeContractLimit(members: Pick<ContractMember, "level">[]) {
  const sumLimit = members.reduce((sum, m) => sum + LEVEL_LIMITS[m.level], 0)
  const bonus = Math.floor((sumLimit * CONTRACT_BONUS_PERCENT) / 100)
  const totalLimit = sumLimit + bonus

  return {
    sumLimit,
    bonus,
    totalLimit,
    bonusPercent: CONTRACT_BONUS_PERCENT,
    memberCount: members.length,
  }
}

/**
 * تنسيق رقم بالدينار العراقي بصيغة مختصرة
 * 10000000 → "10M"
 * 1500000000 → "1.5B"
 */
export function fmtLimit(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(amount % 1_000_000_000 === 0 ? 0 : 2) + "B"
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1) + "M"
  }
  return amount.toLocaleString("en-US")
}
