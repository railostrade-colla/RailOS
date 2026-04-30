/**
 * Finance helpers — computations around expected returns.
 *
 * مصدر الحقيقة الوحيد: حقول العائد على الـ Project نفسه:
 *   - expected_return_min / expected_return_max  (نسب مئوية، مثلاً 12 = 12%)
 *   - return_min / return_max                    (alias قديم)
 *   - distribution_type                           (شهري / ربعي / نصف سنوي / سنوي)
 *
 * كل صفحة تعرض عوائد يجب أن تستخدم هذه الـ helpers — لا hardcoded values.
 */

import type { Project, Holding } from "@/lib/mock-data/types"

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

export type YieldPeriod = "monthly" | "quarterly" | "semi_annual" | "annual"

const PERIODS_PER_YEAR: Record<YieldPeriod, number> = {
  monthly:     12,
  quarterly:   4,
  semi_annual: 2,
  annual:      1,
}

const PERIOD_LABELS: Record<YieldPeriod, string> = {
  monthly:     "شهري",
  quarterly:   "ربعي",
  semi_annual: "نصف سنوي",
  annual:      "سنوي",
}

// ──────────────────────────────────────────────────────────────────────────
// Reading return % from a Project (handles both naming conventions)
// ──────────────────────────────────────────────────────────────────────────

/**
 * يقرأ الحد الأدنى/الأعلى للعائد بالنسبة المئوية من المشروع.
 * يُفضّل expected_return_* (الجديد) ويستخدم return_* كاحتياطي.
 * إذا لم يُحدَّد أيّهما → 0.
 */
export function getProjectReturnRange(project: Project | null | undefined): { min: number; max: number } {
  if (!project) return { min: 0, max: 0 }
  const min = project.expected_return_min ?? project.return_min ?? 0
  const max = project.expected_return_max ?? project.return_max ?? min
  return { min, max }
}

/** متوسط نسبة العائد على المشروع (used in single-number displays). */
export function getProjectAverageReturn(project: Project | null | undefined): number {
  const { min, max } = getProjectReturnRange(project)
  return (min + max) / 2
}

/** Formatted display: "12% — 18%" أو "15%" إذا متساويين. */
export function formatProjectReturnRange(project: Project | null | undefined): string {
  const { min, max } = getProjectReturnRange(project)
  if (min === max) return `${min}%`
  return `${min}% — ${max}%`
}

/** التوزيع كنص عربي. */
export function getDistributionLabel(project: Project | null | undefined): string {
  const t = project?.distribution_type ?? "annual"
  const map: Record<string, string> = {
    monthly:     "شهري",
    quarterly:   "ربعي",
    semi_annual: "نصف سنوي",
    annual:      "سنوي",
  }
  return map[t] ?? "سنوي"
}

// ──────────────────────────────────────────────────────────────────────────
// Expected return on an investment amount
// ──────────────────────────────────────────────────────────────────────────

export interface ExpectedReturn {
  min: number   // العائد المالي الأدنى المتوقّع (د.ع)
  max: number   // العائد المالي الأعلى المتوقّع
  avg: number
  minPct: number  // النسب الأصلية للرجوع إليها في UI
  maxPct: number
}

/**
 * احسب العائد المالي المتوقّع على مبلغ استثمار في مشروع معيّن.
 *
 * @param amount  المبلغ المُستثمَر (د.ع)
 * @param project المشروع
 * @param period  الفترة المراد عرض العائد عنها (افتراضياً: سنوي)
 */
export function calculateExpectedReturn(
  amount: number,
  project: Project | null | undefined,
  period: YieldPeriod = "annual"
): ExpectedReturn {
  const { min: minPct, max: maxPct } = getProjectReturnRange(project)
  const annualMin = amount * (minPct / 100)
  const annualMax = amount * (maxPct / 100)

  const divisor = PERIODS_PER_YEAR[period]
  const min = annualMin / divisor
  const max = annualMax / divisor

  return {
    min,
    max,
    avg: (min + max) / 2,
    minPct,
    maxPct,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Aggregate: total expected return across all holdings
// ──────────────────────────────────────────────────────────────────────────

/**
 * إجمالي العائد المتوقَّع عبر مجموعة holdings (تستخدم متوسط العائد لكل مشروع).
 *
 * @param holdings مصفوفة الـ holdings (مع .project مضمَّن)
 * @param period   الفترة (افتراضياً: سنوي)
 */
export function calculatePortfolioExpectedReturn(
  holdings: Holding[],
  period: YieldPeriod = "annual"
): number {
  return holdings.reduce((sum, h) => {
    const invested =
      typeof h.buy_price === "number"
        ? h.buy_price * h.shares_owned
        : h.shares_owned * (h.project?.share_price ?? 0)

    // مع mock data، الـ Holding embeds project بدون expected_return_*؛
    // إذا غير موجود، استخدم 0 (أو fallback غير hardcoded — يقرأ من المشروع المرتبط).
    const proj = h.project as Partial<Project>
    const minPct = proj.expected_return_min ?? proj.return_min ?? 0
    const maxPct = proj.expected_return_max ?? proj.return_max ?? minPct
    const avgPct = (minPct + maxPct) / 2

    const annual = invested * (avgPct / 100)
    return sum + annual / PERIODS_PER_YEAR[period]
  }, 0)
}

// ──────────────────────────────────────────────────────────────────────────
// Convenience: pretty-printers
// ──────────────────────────────────────────────────────────────────────────

export function formatPercent(n: number, decimals: number = 1): string {
  return `${n.toFixed(decimals)}%`
}

export function formatPeriodLabel(period: YieldPeriod): string {
  return PERIOD_LABELS[period]
}

export function getPeriodsPerYear(period: YieldPeriod): number {
  return PERIODS_PER_YEAR[period]
}
