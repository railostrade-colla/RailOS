import { createClient } from "@/lib/supabase/client"
import type { Company } from "@/lib/mock-data/types"

type DBCompany = {
  id: string
  name: string
  sector: string
  city?: string
  description?: string
  logo_url?: string
  share_price?: number
  projects_count?: number
  shareholders_count?: number
  risk_level?: string
  is_verified?: boolean
  is_trending?: boolean
  is_new?: boolean
  rating?: number
  joined_days_ago?: number
  created_at?: string
}

function dbToCompany(row: DBCompany): Company {
  const riskMap: Record<string, "منخفض" | "متوسط" | "مرتفع"> = {
    low: "منخفض",
    medium: "متوسط",
    high: "مرتفع",
  }
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    city: row.city,
    share_price: Number(row.share_price ?? 0),
    risk_level: riskMap[row.risk_level ?? ""] ?? "متوسط",
    projects_count: row.projects_count,
    shareholders_count: row.shareholders_count,
    is_verified: row.is_verified,
    is_trending: row.is_trending,
    is_new: row.is_new,
    rating: row.rating,
    joined_days_ago: row.joined_days_ago,
    description: row.description,
    created_at: row.created_at,
  }
}

export async function getAllCompanies(): Promise<Company[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !data) return []
    return data.map(dbToCompany)
  } catch {
    return []
  }
}

export async function getCompanyById(id: string): Promise<Company | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return dbToCompany(data)
  } catch {
    return null
  }
}

export async function getNewCompanies(limit = 6): Promise<Company[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    return (data ?? []).map(dbToCompany)
  } catch {
    return []
  }
}
