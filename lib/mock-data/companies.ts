/**
 * Single source of truth for company mock data.
 *
 * Aliases:
 * - market                  → ALL_COMPANIES (cards-shape)
 * - dashboard               → NEW_COMPANIES_PREVIEW (first 3)
 * - company/[id]            → companiesById (Record), relatedProjectsByCompany
 */

import type { CompanyCardData } from "@/components/cards"
import type { Company } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// Canonical list
// ──────────────────────────────────────────────────────────────────────────
export const COMPANIES: Company[] = [
  {
    id: "c1",
    name: "شركة الحقول الذهبية",
    sector: "زراعة",
    city: "بغداد",
    joined_days_ago: 3,
    share_price: 100000,
    projects_count: 3,
    shareholders_count: 142,
    risk_level: "منخفض",
    is_verified: true,
    rating: 4.8,
    is_trending: false,
    is_new: true,
    description: "شركة رائدة في القطاع الزراعي العراقي منذ 2018. متخصصة في إنتاج التمور وزيوت الزيتون. تمتلك أكثر من 5 مزارع موزعة على محافظات العراق.",
    total_shares: 50000,
    available_shares: 12500,
    status: "active",
    founded_year: 2018,
    employees: 120,
    created_at: "2024-01-15",
  },
  {
    id: "c2",
    name: "عمار للإنشاءات",
    sector: "عقارات",
    city: "الكرادة",
    joined_days_ago: 5,
    share_price: 250000,
    projects_count: 5,
    shareholders_count: 387,
    risk_level: "متوسط",
    is_verified: true,
    rating: 4.5,
    is_trending: true,
    is_new: true,
    description: "شركة عقارية رائدة في تطوير المجمعات السكنية والتجارية في بغداد. لديها مشاريع متعددة في الكرادة والكرخ والكاظمية.",
    total_shares: 40000,
    available_shares: 22000,
    status: "active",
    founded_year: 2015,
    employees: 85,
    created_at: "2023-05-20",
  },
  {
    id: "c3",
    name: "صفا الذهبي",
    sector: "صناعة",
    city: "البصرة",
    joined_days_ago: 7,
    share_price: 120000,
    projects_count: 2,
    shareholders_count: 98,
    risk_level: "منخفض",
    is_verified: true,
    rating: 4.6,
    is_new: true,
  },
  {
    id: "c4",
    name: "نخيل العراق",
    sector: "زراعة",
    city: "البصرة",
    joined_days_ago: 30,
    share_price: 90000,
    projects_count: 4,
    shareholders_count: 256,
    risk_level: "منخفض",
    is_verified: true,
    rating: 4.9,
  },
  {
    id: "c5",
    name: "قمة الرشيد",
    sector: "تجارة",
    city: "بغداد",
    joined_days_ago: 45,
    share_price: 80000,
    projects_count: 6,
    shareholders_count: 512,
    risk_level: "متوسط",
    is_verified: true,
    rating: 4.4,
  },
  {
    id: "c6",
    name: "مجمع الكرخ التجاري",
    sector: "تجارة",
    city: "بغداد",
    joined_days_ago: 60,
    share_price: 175000,
    projects_count: 3,
    shareholders_count: 178,
    risk_level: "متوسط",
    is_verified: true,
    rating: 4.3,
    is_trending: true,
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Card-shaped projection
// ──────────────────────────────────────────────────────────────────────────
function toCardShape(c: Company): CompanyCardData {
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    city: c.city ?? "",
    joined_days_ago: c.joined_days_ago ?? 0,
    share_price: c.share_price,
    projects_count: c.projects_count ?? 0,
    shareholders_count: c.shareholders_count ?? 0,
    risk_level: c.risk_level,
    is_verified: c.is_verified ?? false,
    rating: c.rating ?? 0,
    is_trending: c.is_trending,
    is_new: c.is_new,
  }
}

/** Full /market companies list. */
export const ALL_COMPANIES: CompanyCardData[] = COMPANIES.map(toCardShape)

/** Dashboard "new companies" preview (first 3). */
export const NEW_COMPANIES_PREVIEW: CompanyCardData[] = ALL_COMPANIES.slice(0, 3)

/** Lookup used by /company/[id]. */
export const companiesById: Record<string, Company> = Object.fromEntries(
  COMPANIES.map((c) => [c.id, c]),
)

// ──────────────────────────────────────────────────────────────────────────
// Helpers used by /market/new (showcase page)
// ──────────────────────────────────────────────────────────────────────────

/** Companies flagged is_new — recently joined. */
export function getNewCompanies(): CompanyCardData[] {
  return ALL_COMPANIES.filter((c) => c.is_new)
}

// ──────────────────────────────────────────────────────────────────────────
// Related projects per company (for /company/[id])
// Lightweight Project rows (English risk_level — matches company/[id] usage)
// ──────────────────────────────────────────────────────────────────────────
type RelatedProject = {
  id: string
  name: string
  sector: string
  share_price: number
  total_shares: number
  available_shares: number
  risk_level: "low" | "medium" | "high"
}

export const relatedProjectsByCompany: Record<string, RelatedProject[]> = {
  c1: [
    { id: "1", name: "مزرعة الواحة", sector: "زراعة", share_price: 100000, total_shares: 10000, available_shares: 2500, risk_level: "low" },
    { id: "5", name: "نخيل العراق", sector: "زراعة", share_price: 90000, total_shares: 8000, available_shares: 5600, risk_level: "low" },
    { id: "6", name: "حقول الرشيد", sector: "زراعة", share_price: 85000, total_shares: 12000, available_shares: 9600, risk_level: "medium" },
  ],
  c2: [
    { id: "2", name: "برج بغداد", sector: "تجارة", share_price: 250000, total_shares: 8000, available_shares: 4400, risk_level: "medium" },
    { id: "3", name: "مجمع الكرخ", sector: "عقارات", share_price: 175000, total_shares: 12000, available_shares: 4560, risk_level: "low" },
  ],
}
