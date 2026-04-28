/**
 * Contract mock data (group investment partnerships).
 *
 * Aliases:
 * - /contracts        → mockContracts
 * - /contracts/[id]   → mockContract
 */

import type { ContractListItem, ContractDetail } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// /contracts list
// ──────────────────────────────────────────────────────────────────────────
export const mockContracts: ContractListItem[] = [
  {
    id: "1",
    title: "عقد شراكة مزرعة الواحة",
    status: "active",
    creator_id: "me",
    total_investment: 5_000_000,
    created_at: "2026-04-15",
    partners: [
      { user: { name: "أحمد محمد", is_verified: true } },
      { user: { name: "علي حسن", is_verified: true } },
      { user: { name: "محمد أحمد", is_verified: false } },
    ],
  },
  {
    id: "2",
    title: "عقد استثمار برج بغداد",
    status: "pending",
    creator_id: "other",
    total_investment: 8_000_000,
    created_at: "2026-04-22",
    partners: [
      { user: { name: "سارة محمود", is_verified: true } },
      { user: { name: "زين العبيدي", is_verified: true } },
    ],
  },
  {
    id: "3",
    title: "عقد تسويق مجمع الكرخ",
    status: "ended",
    creator_id: "me",
    total_investment: 3_000_000,
    created_at: "2026-02-10",
    partners: [
      { user: { name: "نور الدين", is_verified: true } },
      { user: { name: "ياسمين كريم", is_verified: false } },
      { user: { name: "كريم علي", is_verified: true } },
      { user: { name: "هدى صبري", is_verified: false } },
    ],
  },
  {
    id: "4",
    title: "عقد ملغى",
    status: "cancelled",
    creator_id: "other",
    total_investment: 1_000_000,
    created_at: "2026-01-20",
    partners: [{ user: { name: "ضيف", is_verified: false } }],
  },
]

// ──────────────────────────────────────────────────────────────────────────
// /contracts/[id]
// ──────────────────────────────────────────────────────────────────────────
export const mockContract: ContractDetail = {
  id: "ct1",
  title: "عقد شراكة مزرعة الواحة",
  status: "active",
  creator: "أحمد محمد",
  total_investment: 5_000_000,
  created_at: "2026-04-15",
  description: "عقد استثمار جماعي في مزرعة الواحة بنسب محددة بين 4 شركاء.",
  members: [
    { user_id: "u1", name: "أحمد محمد", level: "advanced", share_percent: 30 },
    { user_id: "u2", name: "علي حسن", level: "pro", share_percent: 25 },
    { user_id: "u3", name: "محمد أحمد", level: "advanced", share_percent: 25 },
    { user_id: "u4", name: "سارة محمود", level: "basic", share_percent: 20 },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// Contract end / distribution helpers (used by /contracts/[id])
// ──────────────────────────────────────────────────────────────────────────

/** Platform fee deducted from creator's fee units when a contract ends. */
export const CONTRACT_END_FEE_PCT = 0.10

export interface ContractDistributionRow {
  member_id: string
  member_name: string
  percentage: number
  shares: number
  value: number
}

export interface ContractDistribution {
  contract_id: string
  total_shares: number
  total_value: number
  end_fee: number
  distribution: ContractDistributionRow[]
}

/**
 * Compute share + value distribution for a contract based on each member's
 * `share_percent`. Total shares are derived from total_investment using a
 * conventional share unit price (100,000 IQD).
 */
export function calculateContractDistribution(contractId: string): ContractDistribution | null {
  const contract = mockContract.id === contractId ? mockContract : null
  if (!contract) return null

  const totalValue = contract.total_investment
  const totalShares = Math.floor(totalValue / 100000)
  const endFee = Math.round(totalValue * (CONTRACT_END_FEE_PCT / 100))

  const distribution: ContractDistributionRow[] = contract.members.map((m) => {
    const pct = m.share_percent
    return {
      member_id: m.user_id,
      member_name: m.name,
      percentage: pct,
      shares: Math.floor(totalShares * (pct / 100)),
      value: Math.round(totalValue * (pct / 100)),
    }
  })

  return {
    contract_id: contractId,
    total_shares: totalShares,
    total_value: totalValue,
    end_fee: endFee,
    distribution,
  }
}

/** Mock end-contract action — updates state in-memory and returns summary. */
export function endContract(contractId: string): { success: boolean; contractId: string } {
  return { success: true, contractId }
}

// ──────────────────────────────────────────────────────────────────────────
// /portfolio — user's currently active contracts (3 members each)
// ──────────────────────────────────────────────────────────────────────────
import type { InvestorLevel } from "@/lib/utils/contractLimits"

export const USER_ACTIVE_CONTRACTS: Array<{
  id: string
  name: string
  members: Array<{ name: string; level: InvestorLevel }>
}> = [
  {
    id: "ct1",
    name: "شراكة المزرعة",
    members: [
      { name: "أنا", level: "basic" },
      { name: "علي", level: "basic" },
      { name: "محمد", level: "advanced" },
    ],
  },
]
