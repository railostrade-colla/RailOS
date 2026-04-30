/**
 * Single source of truth for project mock data.
 *
 * Page-specific aliases preserve backward compatibility:
 * - dashboard/investment        → mockProjects (English risk_level)
 * - market                      → ALL_PROJECTS (cards-shape, Arabic risk_level)
 * - exchange / exchange/create  → MOCK_PROJECTS (minimal projection)
 * - project/[id]                → projectsById (Record<string, Project>)
 * - dashboard NEW_PROJECTS      → NEW_PROJECTS_PREVIEW (cards-shape)
 */

import type { ProjectCardData } from "@/components/cards"
import type { Project } from "./types"
import { RISK_EN_TO_AR } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Canonical list — superset of every shape used in the app.
// ──────────────────────────────────────────────────────────────────────────
export const PROJECTS: Project[] = [
  {
    id: "1",
    name: "مزرعة الواحة",
    sector: "زراعة",
    share_price: 100000,
    total_shares: 10000,
    available_shares: 2500,
    risk_level: "low",
    project_value: 1_000_000_000,
    description: "مزرعة زراعية متكاملة في كربلاء بإنتاج تمور عالية الجودة. تضم 200 دونم من النخيل المثمر مع نظام ري حديث.",
    created_at: "2025-06-15",
    return_min: 12,
    return_max: 18,
    distribution_type: "quarterly",
    profit_source: "بيع التمور والمنتجات المشتقة",
    seller_id: "seller_main",
    seller_name: "إدارة المنصة",
    company_id: "c1",
    company_name: "الحقول الذهبية",
    expected_return_min: 15,
    expected_return_max: 18,
    investors_count: 187,
    duration_months: 24,
    closes_in_days: 12,
    status: "open",
    is_new: true,
    // ─── Extended classification ───
    symbol: "WAH",
    entity_type: "project",
    build_status: "active",
    quality: "high",
    admin_status: "active",
    // ─── Extended financial ───
    shares_offered: 4000,
    reserved_shares: 0,
    listing_percent: 40,
    capital_needed: 400_000_000,
    capital_raised: 250_000_000,
    owner_percent: 60,
    offer_percent: 40,
    investment_type: "direct",
    // ─── Owner contact ───
    owner_name: "حسن العبيدي",
    owner_phone: "07701234567",
    owner_email: "hassan@waha-farm.iq",
    address: "كربلاء — حي الصحة — قرب طريق المطار",
  },
  {
    id: "2",
    name: "برج بغداد",
    sector: "تجارة",
    share_price: 250000,
    total_shares: 8000,
    available_shares: 4400,
    risk_level: "medium",
    project_value: 2_000_000_000,
    description: "برج تجاري في قلب الكرادة - 12 طابق + موقف سيارات + مطعم.",
    created_at: "2025-08-10",
    return_min: 10,
    return_max: 15,
    distribution_type: "annual",
    seller_id: "seller_main",
    seller_name: "إدارة المنصة",
    company_id: "c2",
    company_name: "عمار للإنشاءات",
    expected_return_min: 20,
    expected_return_max: 25,
    investors_count: 412,
    duration_months: 36,
    closes_in_days: 28,
    status: "open",
    is_trending: true,
    is_new: true,
    // ─── Extended classification ───
    symbol: "BGD",
    entity_type: "project",
    build_status: "active",
    quality: "high",
    admin_status: "active",
    profit_source: "إيجارات المحلات + ريع الفنادق",
    // ─── Extended financial ───
    shares_offered: 4400,
    reserved_shares: 0,
    listing_percent: 55,
    capital_needed: 1_100_000_000,
    capital_raised: 660_000_000,
    owner_percent: 45,
    offer_percent: 55,
    investment_type: "direct",
    // ─── Owner contact ───
    owner_name: "عمار الجبوري",
    owner_phone: "07811234567",
    owner_email: "info@ammar-construction.iq",
    address: "بغداد — الكرادة — شارع 62 — قرب جامع الرحمن",
  },
  {
    id: "3",
    name: "مجمع الكرخ",
    sector: "عقارات",
    share_price: 175000,
    total_shares: 12000,
    available_shares: 4560,
    risk_level: "low",
    project_value: 2_100_000_000,
    description: "مجمع سكني فاخر يضم 80 شقة بالقرب من جامعة بغداد.",
    created_at: "2025-04-20",
    return_min: 8,
    return_max: 12,
    distribution_type: "semi_annual",
    seller_id: "seller_main",
    seller_name: "إدارة المنصة",
    company_id: "c2",
    company_name: "عمار للإنشاءات",
    expected_return_min: 12,
    expected_return_max: 15,
    investors_count: 95,
    duration_months: 30,
    closes_in_days: 45,
    status: "open",
    is_new: true,
  },
  {
    id: "4",
    name: "صفا الذهبي",
    sector: "صناعة",
    share_price: 120000,
    total_shares: 9000,
    available_shares: 6300,
    risk_level: "medium",
    project_value: 1_080_000_000,
    description: "مصنع لإنتاج المنظفات والمواد الكيماوية.",
    created_at: "2025-10-05",
    return_min: 15,
    return_max: 22,
    distribution_type: "quarterly",
    seller_id: "seller_main",
    seller_name: "إدارة المنصة",
    company_id: "c3",
    company_name: "صفا الذهبي",
    expected_return_min: 14,
    expected_return_max: 16,
    investors_count: 234,
    duration_months: 18,
    closes_in_days: 8,
    status: "open",
  },
  {
    id: "5",
    name: "نخيل العراق",
    sector: "زراعة",
    share_price: 90000,
    total_shares: 15000,
    available_shares: 4500,
    risk_level: "low",
    project_value: 1_350_000_000,
    company_id: "c4",
    company_name: "نخيل العراق",
    expected_return_min: 13,
    expected_return_max: 17,
    investors_count: 478,
    duration_months: 36,
    closes_in_days: 21,
    status: "open",
  },
  {
    id: "6",
    name: "قمة الرشيد",
    sector: "تجارة",
    share_price: 80000,
    total_shares: 11000,
    available_shares: 7700,
    risk_level: "high",
    project_value: 880_000_000,
    company_id: "c5",
    company_name: "قمة الرشيد",
    expected_return_min: 16,
    expected_return_max: 20,
    investors_count: 312,
    duration_months: 24,
    closes_in_days: 15,
    status: "open",
    is_trending: true,
  },
]

// Auto-derive Arabic risk for callers that need it.
PROJECTS.forEach((p) => {
  p.risk_level_ar = RISK_EN_TO_AR[p.risk_level]
})

// ──────────────────────────────────────────────────────────────────────────
// Aliases — keep every legacy name pointing at the same canonical array.
// ──────────────────────────────────────────────────────────────────────────

/** Legacy alias used by /dashboard and /investment (English risk_level). */
export const mockProjects = PROJECTS

/** Minimal projection used by /exchange and /exchange/create. */
export const MOCK_PROJECTS = PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  sector: p.sector,
  share_price: p.share_price,
}))

/** Lookup map used by /project/[id]. */
export const projectsById: Record<string, Project> = Object.fromEntries(
  PROJECTS.map((p) => [p.id, p]),
)

// ──────────────────────────────────────────────────────────────────────────
// Card-shaped exports (matches ProjectCardData with Arabic risk_level).
// ──────────────────────────────────────────────────────────────────────────
function toCardShape(p: Project): ProjectCardData {
  return {
    id: p.id,
    name: p.name,
    company_id: p.company_id ?? "",
    company_name: p.company_name ?? "",
    sector: p.sector,
    share_price: p.share_price,
    expected_return_min: p.expected_return_min ?? 0,
    expected_return_max: p.expected_return_max ?? 0,
    total_shares: p.total_shares,
    available_shares: p.available_shares,
    investors_count: p.investors_count ?? 0,
    duration_months: p.duration_months ?? 0,
    risk_level: p.risk_level_ar ?? "متوسط",
    closes_in_days: p.closes_in_days ?? 0,
    status: p.status ?? "open",
    is_trending: p.is_trending,
    is_new: p.is_new,
  }
}

/** Full /market list — all 6 projects in card shape. */
export const ALL_PROJECTS: ProjectCardData[] = PROJECTS.map(toCardShape)

/** Dashboard "new projects" preview (first 3 cards). */
export const NEW_PROJECTS_PREVIEW: ProjectCardData[] = ALL_PROJECTS.slice(0, 3)

// ──────────────────────────────────────────────────────────────────────────
// Helpers used by /market/new (showcase page)
// ──────────────────────────────────────────────────────────────────────────

/** Projects flagged is_new — recently launched. */
export function getNewProjects(): ProjectCardData[] {
  return ALL_PROJECTS.filter((p) => p.is_new)
}

/** Projects flagged is_trending — most active right now. */
export function getTrendingProjects(): ProjectCardData[] {
  return ALL_PROJECTS.filter((p) => p.is_trending)
}

/** Projects whose subscription window closes within N days (default 15). */
export function getClosingSoonProjects(within = 15): ProjectCardData[] {
  return ALL_PROJECTS.filter((p) => (p.closes_in_days ?? 999) <= within)
}

