import type { MarketCheckResult, MarketPhase, MarketState } from "./types"

interface MetricsBundle {
  score: number
  participation: number
  quality: number
  balance: number
  uniqueUsers: number
  uniqueDays: number
  factor_a: number
  factor_b: number
}

/**
 * Market engine entry point.
 */
export class MarketEngine {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /** Public entry point for new deal processing. */
  async processNewDeal(
    dealId: string,
    projectId: string,
    buyerId: string,
    sellerId: string,
  ): Promise<MarketCheckResult> {
    const state = await this.fetchState(projectId)

    if (!state) {
      return this.noChangeResult(0, "active", "no_state")
    }

    if (state.is_frozen) {
      return this.noChangeResult(state.current_price, "frozen", "frozen")
    }

    const phase: MarketPhase = state.market_phase
    if (phase === "launch") {
      return this.processLaunchPhase(state, dealId, projectId, buyerId, sellerId)
    }
    if (phase === "active") {
      return this.processActivePhase(state, dealId, projectId, buyerId, sellerId)
    }
    return this.noChangeResult(state.current_price, phase, "skip")
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase handlers
  // ──────────────────────────────────────────────────────────────────────
  private async processLaunchPhase(
    state: MarketState,
    dealId: string,
    projectId: string,
    buyerId: string,
    sellerId: string,
  ): Promise<MarketCheckResult> {
    const buyerNew = await this.isNewUser(buyerId)
    const sellerNew = await this.isNewUser(sellerId)
    const isMixed = buyerNew !== sellerNew

    await this.recordDealCategory(dealId, isMixed ? "qualifying" : "low_weight", isMixed ? 1 : 0.25)

    if (!isMixed) {
      return this.noChangeResult(state.current_price, "launch", "not_qualified")
    }

    const sinceLast = await this.hoursSinceLastIncrease(projectId)
    if (sinceLast < 1) {
      return this.noChangeResult(state.current_price, "launch", "cooldown")
    }

    const conditions = this.getConditions("launch")
    const next = this.applyAllCaps(state, 1, "launch", { factor_a: 0, factor_b: 0 })
    if (!next.shouldIncrease) return next

    await this.applyPriceIncrease(projectId, next.newPrice, next.changePct, "launch", "qualified_deal")
    await this.incrementDealCount(projectId)

    const updated = state.total_deals_count + 1
    if (updated >= 100 || state.total_growth_pct + conditions.step >= 15) {
      await this.transitionToActivePhase(projectId)
    }

    return next
  }

  private async processActivePhase(
    state: MarketState,
    _dealId: string,
    projectId: string,
    _buyerId: string,
    _sellerId: string,
  ): Promise<MarketCheckResult> {
    const sinceLast = await this.hoursSinceLastIncrease(projectId)
    if (sinceLast < 72) {
      return this.noChangeResult(state.current_price, "active", "cooldown")
    }

    const metrics = await this.calculateMetrics(state, projectId)
    const conditions = this.getConditions("active", state.total_deals_count)

    if (metrics.score < conditions.min) {
      return this.noChangeResult(state.current_price, "active", "low_score")
    }

    const next = this.applyAllCaps(state, metrics.score, "active", metrics)
    if (!next.shouldIncrease) return next

    await this.applyPriceIncrease(projectId, next.newPrice, next.changePct, "active", "metrics_passed")
    await this.checkAndCreatePromise(projectId, next.changePct, state.current_price)

    return next
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internal calculations
  // ──────────────────────────────────────────────────────────────────────
  private async calculateMetrics(state: MarketState, projectId: string): Promise<MetricsBundle> {
    const window = await this.fetchActivityWindow(projectId, 72)

    const participation = window.dealsCount
    const quality = window.totalCount > 0 ? window.qualifyingCount / window.totalCount : 0
    const balance = window.buys + window.sells > 0
      ? Math.min(window.buys, window.sells) / Math.max(window.buys, window.sells)
      : 0
    const uniqueUsers = window.uniqueUsers
    const uniqueDays = window.uniqueDays

    const score = this.calculateActivityScore({
      participation,
      quality,
      balance,
      uniqueUsers,
      uniqueDays,
      base: state.total_deals_count,
    })

    return {
      score,
      participation,
      quality,
      balance,
      uniqueUsers,
      uniqueDays,
      factor_a: quality,
      factor_b: balance,
    }
  }

  private calculateActivityScore(input: {
    participation: number
    quality: number
    balance: number
    uniqueUsers: number
    uniqueDays: number
    base: number
  }): number {
    const w = { p: 0.30, q: 0.25, b: 0.20, u: 0.15, d: 0.10 }
    const base = Math.max(input.base, 1)

    const pNorm = Math.min(input.participation / Math.max(base * 0.05, 1), 1)
    const uNorm = Math.min(input.uniqueUsers / Math.max(base * 0.10, 1), 1)
    const dNorm = Math.min(input.uniqueDays / 7, 1)

    const raw =
      pNorm * w.p +
      input.quality * w.q +
      input.balance * w.b +
      uNorm * w.u +
      dNorm * w.d

    return Math.round(raw * 1000) / 1000
  }

  private applyAllCaps(
    state: MarketState,
    score: number,
    phase: MarketPhase,
    metrics?: { factor_a: number; factor_b: number },
  ): MarketCheckResult {
    const conditions = this.getConditions(phase, state.total_deals_count)

    if (score < conditions.min) {
      return this.noChangeResult(state.current_price, phase, "low_score")
    }

    const proposedStep = conditions.step
    const proposed = state.current_price * (1 + proposedStep / 100)

    if (state.monthly_growth_pct + proposedStep > 60) {
      return this.noChangeResult(state.current_price, phase, "monthly_cap")
    }
    if (state.yearly_growth_pct + proposedStep > 72) {
      return this.noChangeResult(state.current_price, phase, "yearly_cap")
    }

    const sectorCap = this.computeSectorCap(state)
    if (state.total_growth_pct + proposedStep > sectorCap) {
      return this.noChangeResult(state.current_price, phase, "sector_cap")
    }

    return {
      shouldIncrease: true,
      oldPrice: state.current_price,
      newPrice: Math.round(proposed),
      changePct: proposedStep,
      reason: "ok",
      phase,
      metrics: metrics
        ? { score, factor_a: metrics.factor_a, factor_b: metrics.factor_b }
        : { score },
    }
  }

  private getConditions(phase: MarketPhase, dealCount: number = 0): { min: number; step: number } {
    if (phase === "launch") return { min: 0.0, step: 0.5 }

    if (dealCount < 50)   return { min: 0.30, step: 1.5 }
    if (dealCount < 200)  return { min: 0.40, step: 1.2 }
    if (dealCount < 500)  return { min: 0.50, step: 1.0 }
    return { min: 0.60, step: 0.8 }
  }

  private computeSectorCap(_state: MarketState): number {
    return 100
  }

  // ──────────────────────────────────────────────────────────────────────
  // DB reads
  // ──────────────────────────────────────────────────────────────────────
  private async fetchState(projectId: string): Promise<MarketState | null> {
    if (!this.supabase) return null
    const { data } = await this.supabase
      .from("market_state")
      .select("*")
      .eq("project_id", projectId)
      .single()
    return (data as MarketState) ?? null
  }

  private async hoursSinceLastIncrease(projectId: string): Promise<number> {
    if (!this.supabase) return 999
    const { data } = await this.supabase
      .from("price_history")
      .select("recorded_at")
      .eq("project_id", projectId)
      .order("recorded_at", { ascending: false })
      .limit(1)
    if (!data || data.length === 0) return 999
    const last = new Date(data[0].recorded_at).getTime()
    return (Date.now() - last) / 3_600_000
  }

  private async isNewUser(userId: string): Promise<boolean> {
    if (!this.supabase) return false
    const { count } = await this.supabase
      .from("deal_qualifications")
      .select("deal_id", { count: "exact", head: true })
      .eq("user_id", userId)
    return (count ?? 0) === 0
  }

  private async fetchActivityWindow(projectId: string, hours: number): Promise<{
    dealsCount: number
    totalCount: number
    qualifyingCount: number
    buys: number
    sells: number
    uniqueUsers: number
    uniqueDays: number
  }> {
    if (!this.supabase) {
      return { dealsCount: 0, totalCount: 0, qualifyingCount: 0, buys: 0, sells: 0, uniqueUsers: 0, uniqueDays: 0 }
    }
    const since = new Date(Date.now() - hours * 3_600_000).toISOString()
    const { data } = await this.supabase
      .from("deals")
      .select("id, type, buyer_id, seller_id, created_at")
      .eq("project_id", projectId)
      .gte("created_at", since)
    const rows = (data as Array<{ id: string; type: string; buyer_id: string; seller_id: string; created_at: string }>) ?? []

    const ids = rows.map((r) => r.id)
    let qualifying = 0
    if (ids.length > 0) {
      const { data: q } = await this.supabase
        .from("deal_qualifications")
        .select("deal_id, category")
        .in("deal_id", ids)
        .eq("category", "qualifying")
      qualifying = (q ?? []).length
    }

    const buys = rows.filter((r) => r.type === "buy").length
    const sells = rows.filter((r) => r.type === "sell").length
    const users = new Set<string>()
    rows.forEach((r) => { users.add(r.buyer_id); users.add(r.seller_id) })
    const days = new Set(rows.map((r) => r.created_at.slice(0, 10)))

    return {
      dealsCount: rows.length,
      totalCount: rows.length,
      qualifyingCount: qualifying,
      buys,
      sells,
      uniqueUsers: users.size,
      uniqueDays: days.size,
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // DB writes
  // ──────────────────────────────────────────────────────────────────────
  private async applyPriceIncrease(
    projectId: string,
    newPrice: number,
    changePct: number,
    phase: MarketPhase,
    trigger: string,
  ): Promise<void> {
    if (!this.supabase) return
    const { data: cur } = await this.supabase
      .from("market_state")
      .select("current_price, total_growth_pct, monthly_growth_pct, yearly_growth_pct")
      .eq("project_id", projectId)
      .single()
    const oldPrice = cur?.current_price ?? newPrice

    await this.supabase
      .from("market_state")
      .update({
        current_price: newPrice,
        total_growth_pct: (cur?.total_growth_pct ?? 0) + changePct,
        monthly_growth_pct: (cur?.monthly_growth_pct ?? 0) + changePct,
        yearly_growth_pct: (cur?.yearly_growth_pct ?? 0) + changePct,
        last_change_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)

    await this.supabase.from("price_history").insert({
      project_id: projectId,
      old_price: oldPrice,
      new_price: newPrice,
      change_pct: changePct,
      phase,
      trigger,
    })
  }

  private async incrementDealCount(projectId: string): Promise<void> {
    if (!this.supabase) return
    const { data } = await this.supabase
      .from("market_state")
      .select("total_deals_count")
      .eq("project_id", projectId)
      .single()
    await this.supabase
      .from("market_state")
      .update({ total_deals_count: (data?.total_deals_count ?? 0) + 1 })
      .eq("project_id", projectId)
  }

  private async transitionToActivePhase(projectId: string): Promise<void> {
    if (!this.supabase) return
    await this.supabase
      .from("market_state")
      .update({ market_phase: "active" })
      .eq("project_id", projectId)
  }

  private async recordDealCategory(
    dealId: string,
    category: "qualifying" | "low_weight" | "excluded",
    weight: number,
  ): Promise<void> {
    if (!this.supabase) return
    await this.supabase.from("deal_qualifications").upsert({ deal_id: dealId, category, weight })
  }

  private async checkAndCreatePromise(
    projectId: string,
    changePct: number,
    currentPrice: number,
  ): Promise<void> {
    if (!this.supabase) return
    if (changePct < 1.0) return
    if (currentPrice < 100000) return

    await this.supabase.from("development_promises").insert({
      project_id: projectId,
      promise_text: "التزام بتطوير ملموس خلال 90 يوماً",
      promise_type: "milestone",
      status: "pending",
      due_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    })
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────
  private noChangeResult(currentPrice: number, phase: MarketPhase, reason: string): MarketCheckResult {
    return {
      shouldIncrease: false,
      oldPrice: currentPrice,
      newPrice: currentPrice,
      changePct: 0,
      reason,
      phase,
    }
  }
}
