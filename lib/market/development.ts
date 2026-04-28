import type { DevelopmentMeasurement, InterventionStatus } from "./types"

interface RawMeasurements {
  a: number
  b: number
  c: number
  d: number
  e: number
}

/**
 * Development index calculator.
 */
export class DevelopmentIndex {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /** Compute current score for a project. */
  async calculateForProject(projectId: string): Promise<DevelopmentMeasurement | null> {
    const fetched = await this.fetchLatestRaw(projectId)
    if (!fetched) return null
    const score = this.computeScore(fetched.raw, fetched.committeeRating)
    const ratio = await this.computeRatio(projectId, score)
    const status = this.determineStatus(ratio)
    return {
      id: "computed-" + projectId,
      project_id: projectId,
      measured_at: new Date().toISOString(),
      development_score: score,
      price_to_development_ratio: ratio,
      intervention_status: status,
    }
  }

  /** Persist a new measurement; trigger intervention if needed. */
  async recordMeasurement(
    projectId: string,
    raw: RawMeasurements,
    committeeRating: number,
  ): Promise<DevelopmentMeasurement> {
    const score = this.computeScore(raw, committeeRating)
    const ratio = await this.computeRatio(projectId, score)
    const status = this.determineStatus(ratio)
    const row: DevelopmentMeasurement = {
      id: "m-" + Date.now(),
      project_id: projectId,
      measured_at: new Date().toISOString(),
      development_score: score,
      price_to_development_ratio: ratio,
      intervention_status: status,
      measurements: raw,
      committee_rating: committeeRating,
    }
    if (this.supabase) {
      await this.supabase.from("development_index").insert({
        project_id: projectId,
        development_score: score,
        price_to_development_ratio: ratio,
        intervention_status: status,
        raw_a: raw.a,
        raw_b: raw.b,
        raw_c: raw.c,
        raw_d: raw.d,
        raw_e: raw.e,
        committee_rating: committeeRating,
      })
    }
    if (status !== "none") {
      await this.triggerIntervention(projectId, status)
    }
    return row
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internal calculations
  // ──────────────────────────────────────────────────────────────────────
  private computeScore(raw: RawMeasurements, committeeRating: number): number {
    const w = this.getWeights()
    const weighted =
      raw.a * w.a +
      raw.b * w.b +
      raw.c * w.c +
      raw.d * w.d +
      raw.e * w.e
    const blended = weighted * 0.7 + committeeRating * 0.3
    return Math.round(blended * 100) / 100
  }

  private getWeights(): { a: number; b: number; c: number; d: number; e: number } {
    return { a: 0.40, b: 0.25, c: 0.20, d: 0.10, e: 0.05 }
  }

  private async computeRatio(projectId: string, score: number): Promise<number> {
    const baseline = await this.fetchBaseline(projectId)
    if (!baseline || score === 0) return 1.0
    return Math.round((baseline / score) * 100) / 100
  }

  private determineStatus(ratio: number): InterventionStatus {
    if (ratio < 1.10) return "none"
    if (ratio < 1.25) return "watch"
    if (ratio < 1.40) return "buy_intervention"
    return "freeze"
  }

  // ──────────────────────────────────────────────────────────────────────
  // Triggers
  // ──────────────────────────────────────────────────────────────────────
  private async triggerIntervention(projectId: string, status: InterventionStatus): Promise<void> {
    if (!this.supabase) return

    if (status === "freeze") {
      await this.supabase
        .from("market_state")
        .update({
          is_frozen: true,
          frozen_reason: "تحت مراجعة لجنة التطوير",
          market_phase: "committee_review",
        })
        .eq("project_id", projectId)
    }

    await this.supabase.from("notifications").insert({
      type: "market_review",
      title: status === "freeze" ? "مشروع تحت المراجعة" : "تنبيه سوق",
      body: "هذا المشروع يحتاج اهتماماً من الإدارة",
      payload: { project_id: projectId, status },
    })
  }

  // ──────────────────────────────────────────────────────────────────────
  // DB reads
  // ──────────────────────────────────────────────────────────────────────
  private async fetchLatestRaw(
    projectId: string,
  ): Promise<{ raw: RawMeasurements; committeeRating: number } | null> {
    if (!this.supabase) return null
    const { data } = await this.supabase
      .from("development_index")
      .select("raw_a, raw_b, raw_c, raw_d, raw_e, committee_rating")
      .eq("project_id", projectId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .single()
    if (!data) return null
    return {
      raw: { a: data.raw_a, b: data.raw_b, c: data.raw_c, d: data.raw_d, e: data.raw_e },
      committeeRating: data.committee_rating,
    }
  }

  private async fetchBaseline(projectId: string): Promise<number> {
    if (!this.supabase) return 100
    const { data } = await this.supabase
      .from("market_state")
      .select("total_growth_pct")
      .eq("project_id", projectId)
      .single()
    return Math.max((data?.total_growth_pct ?? 0) + 100, 100)
  }
}
