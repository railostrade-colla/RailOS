/**
 * Market Health Analysis — تحليل صحّة السوق + اقتراح إطلاق حصص جديدة.
 *
 * في Mock mode: يحلّل البيانات من mock-data (HOLDINGS + PROJECTS + listings).
 * في Production: يُستبدَل بـ Supabase Views (market_pressure + market_concentration).
 *
 * المنطق:
 *   1. ضغط شراء عالي (>70%) + احتكار (>60%) → خطر احتكار → اقترح إطلاق حصص
 *   2. ضغط شراء عالي (>75%) + مشترين كثر → طلب عالي → اقترح إطلاق حصص
 *   3. ضغط بيع عالي (>70%) → قلة طلب → لا تطلق حصصاً
 *   4. غير ذلك → السوق متوازن
 */

import { PROJECTS } from "@/lib/mock-data/projects"
import { HOLDINGS } from "@/lib/mock-data/holdings"
import { MOCK_LISTINGS } from "@/lib/mock-data/listings"
import type { Project } from "@/lib/mock-data/types"

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type MarketRecommendation =
  | "release_shares"   // 🔥 طلب عالي على الحصص — أطلق المزيد
  | "monopoly_risk"    // ⚠️ خطر احتكار — يجب التدخّل
  | "healthy"          // ✅ متوازن — لا حاجة لأي إجراء
  | "low_demand"       // 📉 قلة طلب — لا تطلق حصصاً، حاول التسويق

export interface MarketHealth {
  project_id: string
  project_name: string
  symbol?: string

  // ضغط السوق (نسب مئوية)
  buy_pressure: number     // % من حجم التداول
  sell_pressure: number    // %
  buyers_count: number     // عدد المشترين الفعّالين
  sellers_count: number

  // الاحتكار
  concentration: number    // % الذي يملكه أكبر 10% من المستثمرين
  holders_count: number    // عدد الحاملين

  // التوصية
  recommendation: MarketRecommendation
  reason: string
  suggested_release: number  // عدد الحصص المقترح إطلاقها (0 = لا حاجة)
  severity: "high" | "medium" | "low"
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers (mock-mode analysis using existing data)
// ──────────────────────────────────────────────────────────────────────────

/**
 * يحاكي ضغط الشراء/البيع من listings + holdings:
 * - listings sell type ≈ ضغط بيع
 * - listings buy type  ≈ ضغط شراء
 * - عدد الـ unique users في listings = sellers/buyers count
 */
function getMarketPressure(projectId: string) {
  const projectListings = MOCK_LISTINGS.filter((l) => l.project_id === projectId)

  const sellListings = projectListings.filter((l) => l.type === "sell")
  const buyListings = projectListings.filter((l) => l.type === "buy")

  const sellVolume = sellListings.reduce((s, l) => s + l.shares, 0)
  const buyVolume = buyListings.reduce((s, l) => s + l.shares, 0)

  const sellersCount = new Set(sellListings.map((l) => l.user_id)).size
  const buyersCount = new Set(buyListings.map((l) => l.user_id)).size

  const totalVolume = buyVolume + sellVolume
  const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50
  const sellPressure = 100 - buyPressure

  return {
    buyVolume,
    sellVolume,
    buyersCount,
    sellersCount,
    buyPressure,
    sellPressure,
  }
}

/**
 * يحاكي الاحتكار من HOLDINGS:
 * - يجمع holdings حسب project_id
 * - يحسب نسبة أكبر 10% من المستثمرين
 */
function getMarketConcentration(projectId: string) {
  const projectHoldings = HOLDINGS.filter((h) => h.project_id === projectId)
  const totalShares = projectHoldings.reduce((s, h) => s + h.shares_owned, 0)
  const holdersCount = new Set(projectHoldings.map((h) => h.user_id ?? "me")).size

  if (holdersCount === 0 || totalShares === 0) {
    return { concentration: 0, holdersCount: 0 }
  }

  const top10Count = Math.max(1, Math.floor(holdersCount / 10))
  const sorted = [...projectHoldings].sort((a, b) => b.shares_owned - a.shares_owned)
  const top10Shares = sorted.slice(0, top10Count).reduce((s, h) => s + h.shares_owned, 0)

  return {
    concentration: (top10Shares / totalShares) * 100,
    holdersCount,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Main analyzer
// ──────────────────────────────────────────────────────────────────────────

export function analyzeMarketHealth(project: Project): MarketHealth {
  const pressure = getMarketPressure(project.id)
  const conc = getMarketConcentration(project.id)

  let recommendation: MarketRecommendation = "healthy"
  let reason = ""
  let suggestedRelease = 0
  let severity: MarketHealth["severity"] = "low"

  // 1. ضغط شراء عالي + احتكار = خطر احتكار
  if (pressure.buyPressure > 70 && conc.concentration > 60) {
    recommendation = "monopoly_risk"
    reason = `ضغط شراء عالي (${Math.round(pressure.buyPressure)}%) + احتكار من 10% من المستخدمين (${Math.round(conc.concentration)}%)`
    suggestedRelease = Math.floor(project.total_shares * 0.1)
    severity = "high"
  }
  // 2. ضغط شراء فقط = إطلاق حصص بدون قلق
  else if (pressure.buyPressure > 75 && pressure.buyersCount > 3) {
    recommendation = "release_shares"
    reason = `طلب عالي (${pressure.buyersCount} مشتري) + قلة العرض (${pressure.sellersCount} بائع)`
    suggestedRelease = Math.floor(project.total_shares * 0.05)
    severity = "medium"
  }
  // 3. ضغط بيع عالي = قلة طلب
  else if (pressure.sellPressure > 70) {
    recommendation = "low_demand"
    reason = `ضغط بيع عالي (${Math.round(pressure.sellPressure)}%) — السوق يبيع أكثر من الشراء`
    severity = "medium"
  }
  // 4. السوق صحّي
  else {
    recommendation = "healthy"
    reason = "السوق متوازن — لا حاجة لتدخّل"
    severity = "low"
  }

  return {
    project_id: project.id,
    project_name: project.name,
    symbol: project.symbol,
    buy_pressure: Math.round(pressure.buyPressure),
    sell_pressure: Math.round(pressure.sellPressure),
    buyers_count: pressure.buyersCount,
    sellers_count: pressure.sellersCount,
    concentration: Math.round(conc.concentration),
    holders_count: conc.holdersCount,
    recommendation,
    reason,
    suggested_release: suggestedRelease,
    severity,
  }
}

/**
 * Analyzes every active project on the platform.
 *
 * Production mode — returns an empty array because PROJECTS is the
 * mock list. The MarketHealthPanel that consumes this should be
 * rewired to query the real `projects` table; until then we surface
 * an empty state instead of fake analyses on a zeroed DB.
 */
export function analyzeAllProjects(): MarketHealth[] {
  void PROJECTS // suppress unused warning
  return []
}

/** الإحصائيات الكلّية للوحة الأدمن. */
export function getMarketHealthStats() {
  // Mirrors analyzeAllProjects — zero everything in production mode.
  return {
    total: 0,
    needRelease: 0,
    monopolyRisk: 0,
    healthy: 0,
    lowDemand: 0,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Recommendation labels (for UI)
// ──────────────────────────────────────────────────────────────────────────

export const RECOMMENDATION_META: Record<
  MarketRecommendation,
  {
    label: string
    icon: string
    color: "red" | "orange" | "green" | "blue"
    actionLabel?: string
  }
> = {
  release_shares: { label: "يحتاج إطلاق حصص",   icon: "🔥", color: "red",    actionLabel: "إطلاق حصص" },
  monopoly_risk:  { label: "خطر احتكار",          icon: "⚠️", color: "orange", actionLabel: "تدخّل عاجل" },
  healthy:        { label: "متوازن",             icon: "✅", color: "green"  },
  low_demand:     { label: "قلة طلب",            icon: "📉", color: "blue"   },
}

/** لون شريط الاحتكار حسب النسبة. */
export function concentrationColor(pct: number): "green" | "yellow" | "orange" | "red" {
  if (pct < 30) return "green"
  if (pct < 50) return "yellow"
  if (pct < 70) return "orange"
  return "red"
}
