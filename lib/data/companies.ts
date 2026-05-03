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

// ─── Phase 8.3 — admin RPCs ─────────────────────────────────

export interface CompanyRpcResult {
  success: boolean
  reason?: string
  error?: string
  company_id?: string
  project_count?: number
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<CompanyRpcResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      const code = error.code ?? ""
      const msg = error.message ?? ""
      if (
        code === "42883" ||
        code === "42P01" ||
        /function .* does not exist/i.test(msg) ||
        /relation .* does not exist/i.test(msg)
      ) {
        return { success: false, reason: "missing_table", error: msg }
      }
      if (code === "42501") return { success: false, reason: "rls", error: msg }
      return { success: false, reason: "unknown", error: msg }
    }
    const result = (data ?? {}) as {
      success?: boolean
      error?: string
      company_id?: string
      project_count?: number
    }
    if (!result.success) {
      return {
        success: false,
        reason: result.error ?? "unknown",
        project_count: result.project_count,
      }
    }
    return { success: true, company_id: result.company_id }
  } catch (err) {
    return {
      success: false,
      reason: "unknown",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function adminCreateCompany(input: {
  name: string
  sector: string
  city?: string
  description?: string
  logo_url?: string
  share_price?: number
  risk_level?: "low" | "medium" | "high"
  founded_year?: number
}): Promise<CompanyRpcResult> {
  return callRpc("admin_create_company", {
    p_name: input.name,
    p_sector: input.sector,
    p_city: input.city ?? null,
    p_description: input.description ?? null,
    p_logo_url: input.logo_url ?? null,
    p_share_price: input.share_price ?? 0,
    p_risk_level: input.risk_level ?? "medium",
    p_founded_year: input.founded_year ?? null,
  })
}

export async function adminUpdateCompany(input: {
  company_id: string
  name?: string
  sector?: string
  city?: string
  description?: string
  logo_url?: string
  share_price?: number
  risk_level?: "low" | "medium" | "high"
  is_verified?: boolean
  is_trending?: boolean
  founded_year?: number
}): Promise<CompanyRpcResult> {
  return callRpc("admin_update_company", {
    p_company_id: input.company_id,
    p_name: input.name ?? null,
    p_sector: input.sector ?? null,
    p_city: input.city ?? null,
    p_description: input.description ?? null,
    p_logo_url: input.logo_url ?? null,
    p_share_price: input.share_price ?? null,
    p_risk_level: input.risk_level ?? null,
    p_is_verified: input.is_verified ?? null,
    p_is_trending: input.is_trending ?? null,
    p_founded_year: input.founded_year ?? null,
  })
}

export async function adminDeleteCompany(
  companyId: string,
): Promise<CompanyRpcResult> {
  return callRpc("admin_delete_company", { p_company_id: companyId })
}
