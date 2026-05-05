/**
 * Project wallets — auto-created when a project is published.
 * Used by /admin?tab=project_wallets.
 */

export type WalletStatus = "active" | "frozen" | "closed"

export type WalletTxType = "inflow" | "outflow"
export type WalletTxReason =
  | "share_sale"        // بيع حصة
  | "ambassador_reward" // مكافأة سفير
  | "platform_fee"      // رسم منصّة
  | "dividend"          // توزيع أرباح
  | "transfer_out"      // تحويل للإدارة
  | "manual_topup"      // شحن يدوي
  | "refund"            // استرداد

export interface ProjectWallet {
  id: string
  project_id: string
  project_name: string
  balance: number
  total_inflow: number
  total_outflow: number
  status: WalletStatus
  created_at: string
  frozen_at?: string
  frozen_reason?: string
}

export interface WalletTransaction {
  id: string
  wallet_id: string
  type: WalletTxType
  reason: WalletTxReason
  amount: number
  description: string
  related_user_id?: string
  related_user_name?: string
  created_at: string
}

// Production mode — empty arrays. Real wallets land in the DB via
// admin_create_project + admin_release_shares_to_market RPCs and are
// queried by ProjectWalletsPanel through getAllProjectWalletsAdmin().
export const MOCK_PROJECT_WALLETS: ProjectWallet[] = []
export const MOCK_WALLET_TRANSACTIONS: WalletTransaction[] = []

export const WALLET_STATUS_LABELS: Record<WalletStatus, { label: string; color: "green" | "yellow" | "red" }> = {
  active: { label: "نشطة",       color: "green"  },
  frozen: { label: "مُجمَّدة",   color: "yellow" },
  closed: { label: "مُغلقة",     color: "red"    },
}

export const WALLET_TX_REASON_LABELS: Record<WalletTxReason, { label: string; icon: string }> = {
  share_sale:        { label: "بيع حصة",        icon: "💰" },
  ambassador_reward: { label: "مكافأة سفير",    icon: "⭐" },
  platform_fee:      { label: "رسم منصّة",       icon: "🏛️" },
  dividend:          { label: "توزيع أرباح",     icon: "📊" },
  transfer_out:      { label: "تحويل للإدارة",   icon: "↗️" },
  manual_topup:      { label: "شحن يدوي",        icon: "✏️" },
  refund:            { label: "استرداد",          icon: "↩️" },
}

export function getWalletByProject(projectId: string): ProjectWallet | undefined {
  return MOCK_PROJECT_WALLETS.find((w) => w.project_id === projectId)
}

export function getWalletTransactions(walletId: string): WalletTransaction[] {
  return MOCK_WALLET_TRANSACTIONS
    .filter((t) => t.wallet_id === walletId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

/** Mock: create a wallet for a newly published project. */
export function createProjectWallet(projectId: string, projectName: string): ProjectWallet {
  return {
    id: `pw-${Date.now()}`,
    project_id: projectId,
    project_name: projectName,
    balance: 0,
    total_inflow: 0,
    total_outflow: 0,
    status: "active",
    created_at: new Date().toISOString().split("T")[0],
  }
}

export function getProjectWalletsStats() {
  const all = MOCK_PROJECT_WALLETS
  return {
    total: all.length,
    active: all.filter((w) => w.status === "active").length,
    frozen: all.filter((w) => w.status === "frozen").length,
    total_balance: all.reduce((s, w) => s + w.balance, 0),
    total_inflow: all.reduce((s, w) => s + w.total_inflow, 0),
    total_outflow: all.reduce((s, w) => s + w.total_outflow, 0),
  }
}
