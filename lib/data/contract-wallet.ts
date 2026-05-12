"use client"

/**
 * contract-wallet — Phase 13.71.
 *
 * Wraps `get_contract_wallet(id)` RPC which returns:
 *   • contract header (status, dates, end-fee)
 *   • wallet aggregates (members, invested IQD, shares, remaining)
 *   • source_breakdown (auction / quick_sale / direct_buy / exchange / ...)
 *   • activity timeline (newest 100)
 *
 * Consumed by `<ContractWalletSection />` inside the contract
 * detail page. Realtime updates flow through the existing
 * contract_activities + contract_members + partnership_contracts
 * subscriptions on /contracts/[id].
 */

import { createClient } from "@/lib/supabase/client"

export type ContractActivityType =
  | "contract_created"
  | "member_invited"
  | "member_accepted"
  | "member_declined"
  | "member_removed"
  | "contract_activated"
  | "contract_ended"
  | "contract_cancelled"
  | "investment_recorded"
  | "share_purchased"
  | "share_sold"
  | "distribution_paid"

export type ContractActivitySource =
  | "auction"
  | "quick_sale"
  | "direct_buy"
  | "exchange"
  | "deal"
  | "admin"
  | "manual"
  | "system"

export interface ContractActivity {
  id: string
  activity_type: ContractActivityType
  actor_user_id: string | null
  actor_name: string
  amount_iqd: number | null
  shares_count: number | null
  project_id: string | null
  source_type: ContractActivitySource | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ContractWalletHeader {
  id: string
  title: string
  status: string
  total_investment: number
  end_fee_pct: number
  created_at: string
  started_at: string | null
  ended_at: string | null
  cancelled_at: string | null
}

export interface ContractWalletAggregates {
  members_count: number
  invested_iqd: number
  shares_count: number
  planned_investment: number
  remaining_to_invest: number
}

export interface ContractSourceBreakdownEntry {
  count: number
  total_amount: number
  total_shares: number
}

export interface ContractWallet {
  success: boolean
  contract: ContractWalletHeader | null
  wallet: ContractWalletAggregates
  sources: Record<string, ContractSourceBreakdownEntry>
  activities: ContractActivity[]
  error?: string
}

const EMPTY_AGGREGATES: ContractWalletAggregates = {
  members_count: 0,
  invested_iqd: 0,
  shares_count: 0,
  planned_investment: 0,
  remaining_to_invest: 0,
}

export const EMPTY_CONTRACT_WALLET: ContractWallet = {
  success: false,
  contract: null,
  wallet: EMPTY_AGGREGATES,
  sources: {},
  activities: [],
}

export async function getContractWallet(contractId: string): Promise<ContractWallet> {
  if (!contractId) return EMPTY_CONTRACT_WALLET
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_contract_wallet", {
      p_contract_id: contractId,
    })
    if (error || data == null) {
      return { ...EMPTY_CONTRACT_WALLET, error: error?.message ?? "no_data" }
    }
    type Raw = {
      success?: boolean
      error?: string
      contract?: Partial<Record<keyof ContractWalletHeader, unknown>>
      wallet?: Partial<Record<keyof ContractWalletAggregates, unknown>>
      sources?: Record<string, Partial<ContractSourceBreakdownEntry>>
      activities?: Array<Partial<ContractActivity>>
    }
    const r = (data ?? {}) as Raw
    const num = (v: unknown, f = 0) => (v == null ? f : Number(v))
    const str = (v: unknown, f = ""): string => (v == null ? f : String(v))

    const contract: ContractWalletHeader | null = r.contract
      ? {
          id: str(r.contract.id),
          title: str(r.contract.title),
          status: str(r.contract.status),
          total_investment: num(r.contract.total_investment),
          end_fee_pct: num(r.contract.end_fee_pct),
          created_at: str(r.contract.created_at),
          started_at: r.contract.started_at as string | null ?? null,
          ended_at: r.contract.ended_at as string | null ?? null,
          cancelled_at: r.contract.cancelled_at as string | null ?? null,
        }
      : null

    const wallet: ContractWalletAggregates = r.wallet
      ? {
          members_count: num(r.wallet.members_count),
          invested_iqd: num(r.wallet.invested_iqd),
          shares_count: num(r.wallet.shares_count),
          planned_investment: num(r.wallet.planned_investment),
          remaining_to_invest: num(r.wallet.remaining_to_invest),
        }
      : EMPTY_AGGREGATES

    const sources: Record<string, ContractSourceBreakdownEntry> = {}
    if (r.sources && typeof r.sources === "object") {
      for (const [k, v] of Object.entries(r.sources)) {
        const e = v ?? {}
        sources[k] = {
          count: num(e.count),
          total_amount: num(e.total_amount),
          total_shares: num(e.total_shares),
        }
      }
    }

    const activities: ContractActivity[] = Array.isArray(r.activities)
      ? r.activities.map((a) => ({
          id: str(a.id),
          activity_type: (a.activity_type ?? "contract_created") as ContractActivityType,
          actor_user_id: (a.actor_user_id as string | null) ?? null,
          actor_name: str(a.actor_name, "—"),
          amount_iqd: a.amount_iqd == null ? null : num(a.amount_iqd),
          shares_count: a.shares_count == null ? null : num(a.shares_count),
          project_id: (a.project_id as string | null) ?? null,
          source_type: (a.source_type as ContractActivitySource | null) ?? null,
          metadata: (a.metadata as Record<string, unknown>) ?? {},
          created_at: str(a.created_at),
        }))
      : []

    return {
      success: !!r.success,
      contract,
      wallet,
      sources,
      activities,
      error: r.error,
    }
  } catch (err) {
    return {
      ...EMPTY_CONTRACT_WALLET,
      error: err instanceof Error ? err.message : "unknown",
    }
  }
}
