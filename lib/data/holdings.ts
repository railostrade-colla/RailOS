import { createClient } from "@/lib/supabase/client"
import type { Holding } from "@/lib/mock-data/types"

export async function getMyHoldings(userId: string): Promise<Holding[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("holdings")
      .select("*, projects(id, name, project_type, share_price, total_shares)")
      .eq("user_id", userId)
      .order("first_acquired_at", { ascending: false })
    if (error || !data) return []
    return data.map((h: any) => ({
      id: h.id,
      project_id: h.project_id,
      shares_owned: Number(h.shares ?? 0),
      buy_price: Number(h.average_buy_price ?? 0),
      project: {
        id: h.projects?.id,
        name: h.projects?.name ?? "—",
        sector: h.projects?.project_type ?? "—",
        share_price: Number(h.projects?.share_price ?? 0),
        total_shares: Number(h.projects?.total_shares ?? 0),
      },
      user_id: h.user_id,
    }))
  } catch {
    return []
  }
}

export async function getHoldingsByProject(projectId: string): Promise<Holding[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("holdings")
      .select("*")
      .eq("project_id", projectId)
    if (error || !data) return []
    return data as unknown as Holding[]
  } catch {
    return []
  }
}
