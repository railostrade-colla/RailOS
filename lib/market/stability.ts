import type { FundBalance, FundTransaction } from "./types"

/**
 * Stability fund operations.
 */
export class StabilityFund {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /** Record commission inflow from a deal. */
  async recordCommissionInflow(amount: number, dealId: string): Promise<void> {
    if (!this.supabase) return
    await this.supabase.from("fund_transactions").insert({
      type: "commission_inflow",
      amount,
      notes: dealId,
    })
    await this.adjustBalance(amount, "in")
  }

  /** Execute a buy intervention. */
  async executeBuyIntervention(
    projectId: string,
    sharesCount: number,
    pricePerShare: number,
  ): Promise<void> {
    const total = sharesCount * pricePerShare
    if (!this.supabase) return

    const balance = await this.getBalance()
    if (balance.available_balance < total) {
      throw new Error("insufficient")
    }

    await this.supabase.from("fund_transactions").insert({
      type: "buy_intervention",
      amount: total,
      project_id: projectId,
      shares_count: sharesCount,
      price_per_share: pricePerShare,
    })
    await this.adjustBalance(total, "out")
    await this.reserveShares(projectId, sharesCount, pricePerShare)
  }

  /** Execute a sell release of fund-owned shares. */
  async executeSellRelease(
    projectId: string,
    sharesCount: number,
    pricePerShare: number,
  ): Promise<void> {
    const total = sharesCount * pricePerShare
    if (!this.supabase) return

    const reserved = await this.getReservedFor(projectId)
    if (reserved < sharesCount) {
      throw new Error("insufficient_reserve")
    }

    const avgCost = await this.getAvgCost(projectId)
    const profit = (pricePerShare - avgCost) * sharesCount

    await this.supabase.from("fund_transactions").insert({
      type: "sell_release",
      amount: total,
      project_id: projectId,
      shares_count: sharesCount,
      price_per_share: pricePerShare,
    })
    await this.adjustBalance(total, "in")
    await this.releaseShares(projectId, sharesCount)
    if (profit > 0) await this.recordProfit(profit)
  }

  /** Get current fund balance. */
  async getBalance(): Promise<FundBalance> {
    if (!this.supabase) {
      return {
        total_balance: 0,
        available_balance: 0,
        reserved_balance: 0,
        total_inflow: 0,
        total_interventions: 0,
        total_profit: 0,
      }
    }
    const { data } = await this.supabase.from("stability_fund").select("*").eq("id", 1).single()
    return data as FundBalance
  }

  /** Get the most recent transactions. */
  async getRecentTransactions(limit: number = 20): Promise<FundTransaction[]> {
    if (!this.supabase) return []
    const { data } = await this.supabase
      .from("fund_transactions")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(limit)
    return (data as FundTransaction[]) ?? []
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────────────────
  private async adjustBalance(amount: number, direction: "in" | "out"): Promise<void> {
    if (!this.supabase) return
    const sign = direction === "in" ? 1 : -1
    await this.supabase.rpc("apply_fund_delta", { delta: amount * sign })
  }

  private async reserveShares(projectId: string, count: number, price: number): Promise<void> {
    if (!this.supabase) return
    const total = count * price
    await this.supabase
      .from("stability_fund")
      .update({ reserved_balance: total })
      .eq("id", 1)

    await this.supabase.from("fund_holdings").upsert({
      project_id: projectId,
      shares_count: count,
      avg_cost: price,
    })
  }

  private async releaseShares(projectId: string, count: number): Promise<void> {
    if (!this.supabase) return
    const { data } = await this.supabase
      .from("fund_holdings")
      .select("shares_count")
      .eq("project_id", projectId)
      .single()
    const remaining = Math.max((data?.shares_count ?? 0) - count, 0)
    await this.supabase
      .from("fund_holdings")
      .update({ shares_count: remaining })
      .eq("project_id", projectId)
  }

  private async getReservedFor(projectId: string): Promise<number> {
    if (!this.supabase) return 0
    const { data } = await this.supabase
      .from("fund_holdings")
      .select("shares_count")
      .eq("project_id", projectId)
      .single()
    return data?.shares_count ?? 0
  }

  private async getAvgCost(projectId: string): Promise<number> {
    if (!this.supabase) return 0
    const { data } = await this.supabase
      .from("fund_holdings")
      .select("avg_cost")
      .eq("project_id", projectId)
      .single()
    return data?.avg_cost ?? 0
  }

  private async recordProfit(amount: number): Promise<void> {
    if (!this.supabase) return
    const { data } = await this.supabase
      .from("stability_fund")
      .select("total_profit")
      .eq("id", 1)
      .single()
    await this.supabase
      .from("stability_fund")
      .update({ total_profit: (data?.total_profit ?? 0) + amount })
      .eq("id", 1)
  }
}
