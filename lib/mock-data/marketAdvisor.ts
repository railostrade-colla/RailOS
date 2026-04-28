/**
 * Market advisor — health analysis + recommendations + action plan.
 * Used by Monitor admin panel.
 */

export type MarketHealthLevel = "healthy" | "watch" | "critical"
export type LiquidityLevel = "high" | "medium" | "low"
export type RecommendationType = "stagnant" | "volatility" | "liquidity" | "general"
export type RecommendationPriority = "high" | "medium" | "low"

export interface MarketHealth {
  project_id?: string  // undefined = whole market
  health_score: number // 0-100
  health_level: MarketHealthLevel
  current_deals: number
  required_deals: number
  liquidity: LiquidityLevel
  turnover_rate: number   // % daily
  volatility_pct: number  // standard deviation of recent prices
  trend: "up" | "down" | "flat"
}

export interface AdvisorRecommendation {
  id: string
  type: RecommendationType
  priority: RecommendationPriority
  icon: string
  title: string
  body: string
  estimated_impact: string
}

export interface ActionPlanItem {
  id: string
  action: string
  priority: RecommendationPriority
  estimated_impact: string
  estimated_cost?: string
  category: "auction" | "promotion" | "fee" | "intervention" | "communication"
}

// ──────────────────────────────────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────────────────────────────────
const HEALTH_BY_PROJECT: Record<string, MarketHealth> = {
  global:   { health_score: 78, health_level: "healthy",  current_deals: 42, required_deals: 50,  liquidity: "medium", turnover_rate: 4.2, volatility_pct: 2.8, trend: "up"   },
  "1":      { project_id: "1", health_score: 87, health_level: "healthy",  current_deals: 18, required_deals: 15, liquidity: "high",   turnover_rate: 6.1, volatility_pct: 1.9, trend: "up"   },
  "2":      { project_id: "2", health_score: 64, health_level: "watch",    current_deals: 8,  required_deals: 12, liquidity: "medium", turnover_rate: 3.4, volatility_pct: 4.5, trend: "down" },
  "3":      { project_id: "3", health_score: 72, health_level: "healthy",  current_deals: 11, required_deals: 12, liquidity: "medium", turnover_rate: 4.8, volatility_pct: 2.2, trend: "flat" },
  "4":      { project_id: "4", health_score: 38, health_level: "critical", current_deals: 2,  required_deals: 10, liquidity: "low",    turnover_rate: 0.8, volatility_pct: 7.4, trend: "down" },
  "5":      { project_id: "5", health_score: 55, health_level: "watch",    current_deals: 5,  required_deals: 8,  liquidity: "low",    turnover_rate: 2.1, volatility_pct: 3.6, trend: "up"   },
  "6":      { project_id: "6", health_score: 81, health_level: "healthy",  current_deals: 14, required_deals: 12, liquidity: "high",   turnover_rate: 5.5, volatility_pct: 2.1, trend: "up"   },
}

export function getMarketHealthScore(projectId?: string): MarketHealth {
  const key = projectId || "global"
  return HEALTH_BY_PROJECT[key] || HEALTH_BY_PROJECT.global
}

// ──────────────────────────────────────────────────────────────────────────
// Recommendations engine
// ──────────────────────────────────────────────────────────────────────────
export function getRecommendations(projectId?: string): AdvisorRecommendation[] {
  const h = getMarketHealthScore(projectId)
  const recs: AdvisorRecommendation[] = []

  // Stagnation (low deals)
  if (h.current_deals < h.required_deals * 0.6) {
    recs.push(
      {
        id: "rec-stag-1",
        type: "stagnant",
        priority: "high",
        icon: "🚨",
        title: "السوق راكد — يحتاج تحفيز",
        body: `الصفقات الحالية ${h.current_deals} وهي أقل من المطلوب (${h.required_deals}). توصي اللجنة بإجراءات سريعة.`,
        estimated_impact: "تحريك +30-40% من الصفقات",
      },
      {
        id: "rec-stag-2",
        type: "stagnant",
        priority: "high",
        icon: "💡",
        title: "إطلاق مزاد جديد",
        body: "إطلاق مزاد على الحصص يجذب اهتماماً ويرفع السعر تنافسياً.",
        estimated_impact: "+20% صفقات خلال 48 ساعة",
      },
      {
        id: "rec-stag-3",
        type: "stagnant",
        priority: "medium",
        icon: "💡",
        title: "حملة ترويجية للسفراء",
        body: "تفعيل بونص مؤقّت للسفراء على الإحالات الجديدة.",
        estimated_impact: "+15-25 إحالة جديدة",
      },
      {
        id: "rec-stag-4",
        type: "stagnant",
        priority: "low",
        icon: "💡",
        title: "خصم على رسوم الإدراج لمدة 7 أيام",
        body: "تخفيض رسوم إنشاء الإعلانات من 1.5% → 0.5% مؤقتاً.",
        estimated_impact: "+40% إعلانات جديدة",
      },
    )
  }

  // Volatility (high std dev)
  if (h.volatility_pct >= 4.5) {
    recs.push(
      {
        id: "rec-vol-1",
        type: "volatility",
        priority: "high",
        icon: "⚠️",
        title: "تذبذب عالٍ — راقب",
        body: `التذبذب الحالي ${h.volatility_pct.toFixed(1)}% — أعلى من العتبة الآمنة (4%).`,
        estimated_impact: "مراقبة مستمرة + إعداد تدخّل",
      },
      {
        id: "rec-vol-2",
        type: "volatility",
        priority: "medium",
        icon: "💡",
        title: "تنبيه المستثمرين بالاستقرار",
        body: "إرسال إشعار بأن الإدارة تراقب الوضع وتدعم استقرار السعر.",
        estimated_impact: "تهدئة 60% من القلق",
      },
      {
        id: "rec-vol-3",
        type: "volatility",
        priority: "high",
        icon: "🛡️",
        title: "تجميد مؤقت إذا تجاوز 7%",
        body: "تجهيز إجراء تجميد تلقائي إذا تجاوز التذبذب 7% خلال ساعة.",
        estimated_impact: "حماية المستثمرين من خسائر مفاجئة",
      },
    )
  }

  // Liquidity
  if (h.liquidity === "low") {
    recs.push(
      {
        id: "rec-liq-1",
        type: "liquidity",
        priority: "high",
        icon: "💧",
        title: "سيولة منخفضة",
        body: "حجم التداول اليومي أقل من المطلوب لاستمرار الحركة الصحّية.",
        estimated_impact: "خطر ركود السوق",
      },
      {
        id: "rec-liq-2",
        type: "liquidity",
        priority: "high",
        icon: "💡",
        title: "تدخّل صندوق الاستقرار",
        body: "ضخّ سيولة تدريجياً عبر شراء حصص من السوق الثانوي.",
        estimated_impact: "+20-30% سيولة فورية",
      },
    )
  }

  // Healthy default
  if (recs.length === 0) {
    recs.push({
      id: "rec-healthy",
      type: "general",
      priority: "low",
      icon: "✅",
      title: "السوق بصحّة جيدة",
      body: `الصحّة العامّة ${h.health_score}/100. لا توصيات استثنائية حالياً.`,
      estimated_impact: "استمر في المراقبة الدورية",
    })
  }

  return recs
}

// ──────────────────────────────────────────────────────────────────────────
// Action plan
// ──────────────────────────────────────────────────────────────────────────
export function getActionPlan(projectId?: string): ActionPlanItem[] {
  const h = getMarketHealthScore(projectId)
  const items: ActionPlanItem[] = []

  if (h.current_deals < h.required_deals * 0.6) {
    items.push(
      { id: "ap-1", action: "إنشاء مزاد على الحصص الشاغرة",       priority: "high",   estimated_impact: "+20-30% صفقات",       estimated_cost: "5,000 وحدة رسوم", category: "auction"        },
      { id: "ap-2", action: "تفعيل بونص سفير 3% (مؤقت)",            priority: "medium", estimated_impact: "+15 إحالة/أسبوع",      estimated_cost: "تخفيض 2% أرباح",  category: "promotion"      },
      { id: "ap-3", action: "خصم رسوم الإعلان 50% لمدة 7 أيام",     priority: "medium", estimated_impact: "+40% إعلانات",         estimated_cost: "خسارة ~15M رسوم", category: "fee"            },
    )
  }

  if (h.volatility_pct >= 4.5) {
    items.push(
      { id: "ap-4", action: "إرسال إشعار اطمئنان للمستثمرين",        priority: "medium", estimated_impact: "تهدئة 60%",            estimated_cost: "0",                category: "communication"  },
      { id: "ap-5", action: "تجهيز تدخّل تلقائي عند تذبذب 7%+",      priority: "high",   estimated_impact: "حماية الأسعار",        estimated_cost: "إعدادات فقط",     category: "intervention"   },
    )
  }

  if (h.liquidity === "low") {
    items.push(
      { id: "ap-6", action: "ضخّ سيولة من صندوق الاستقرار",          priority: "high",   estimated_impact: "+20% سيولة",           estimated_cost: "حسب الكمية",      category: "intervention"   },
    )
  }

  if (items.length === 0) {
    items.push({ id: "ap-default", action: "متابعة المراقبة الروتينية", priority: "low", estimated_impact: "—", category: "intervention" })
  }

  return items
}

export const PRIORITY_LABELS: Record<RecommendationPriority, { label: string; color: "red" | "yellow" | "gray" }> = {
  high:   { label: "عاجلة",  color: "red"    },
  medium: { label: "متوسطة", color: "yellow" },
  low:    { label: "منخفضة", color: "gray"   },
}

export const HEALTH_LEVEL_LABELS: Record<MarketHealthLevel, { label: string; color: "green" | "yellow" | "red" }> = {
  healthy:  { label: "صحّي",     color: "green"  },
  watch:    { label: "تحت المراقبة", color: "yellow" },
  critical: { label: "حرِج",     color: "red"    },
}

export const LIQUIDITY_LABELS: Record<LiquidityLevel, { label: string; color: "green" | "yellow" | "red" }> = {
  high:   { label: "عالية",  color: "green"  },
  medium: { label: "متوسطة", color: "yellow" },
  low:    { label: "منخفضة", color: "red"    },
}
