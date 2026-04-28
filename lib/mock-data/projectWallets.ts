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

export const MOCK_PROJECT_WALLETS: ProjectWallet[] = [
  { id: "pw-1", project_id: "1", project_name: "مزرعة الواحة",      balance: 142_500_000, total_inflow: 268_000_000, total_outflow: 125_500_000, status: "active",  created_at: "2025-06-15" },
  { id: "pw-2", project_id: "2", project_name: "برج بغداد",          balance: 380_000_000, total_inflow: 540_000_000, total_outflow: 160_000_000, status: "active",  created_at: "2025-08-10" },
  { id: "pw-3", project_id: "3", project_name: "مجمع الكرخ",         balance: 215_000_000, total_inflow: 340_000_000, total_outflow: 125_000_000, status: "active",  created_at: "2025-04-20" },
  { id: "pw-4", project_id: "4", project_name: "صفا الذهبي",         balance: 88_500_000,  total_inflow: 145_000_000, total_outflow: 56_500_000,  status: "frozen",  created_at: "2025-10-05", frozen_at: "2026-04-20", frozen_reason: "تحت مراجعة لجنة التطوير" },
  { id: "pw-5", project_id: "5", project_name: "نخيل العراق",        balance: 27_000_000,  total_inflow: 35_000_000,  total_outflow: 8_000_000,   status: "active",  created_at: "2026-04-01" },
  { id: "pw-6", project_id: "6", project_name: "تقنية بغداد",        balance: 64_300_000,  total_inflow: 72_000_000,  total_outflow: 7_700_000,   status: "active",  created_at: "2026-02-15" },
]

export const MOCK_WALLET_TRANSACTIONS: WalletTransaction[] = [
  { id: "wt-1",  wallet_id: "pw-1", type: "inflow",  reason: "share_sale",        amount: 4_750_000, description: "بيع 50 حصة",                related_user_id: "u1",  related_user_name: "أحمد محمد",   created_at: "2026-04-25 14:30" },
  { id: "wt-2",  wallet_id: "pw-1", type: "outflow", reason: "ambassador_reward", amount: 95_000,    description: "مكافأة سفير 2%",            related_user_id: "u2",  related_user_name: "علي حسن",      created_at: "2026-04-25 14:30" },
  { id: "wt-3",  wallet_id: "pw-1", type: "inflow",  reason: "share_sale",        amount: 2_400_000, description: "بيع 25 حصة",                related_user_id: "u3",  related_user_name: "محمد أحمد",   created_at: "2026-04-24 10:15" },
  { id: "wt-4",  wallet_id: "pw-1", type: "outflow", reason: "dividend",          amount: 8_500_000, description: "توزيع أرباح Q1 2026",     created_at: "2026-04-15 09:00" },
  { id: "wt-5",  wallet_id: "pw-2", type: "inflow",  reason: "share_sale",        amount: 12_250_000, description: "بيع 50 حصة",              related_user_id: "u4",  related_user_name: "سارة محمود",   created_at: "2026-04-25 13:00" },
  { id: "wt-6",  wallet_id: "pw-2", type: "outflow", reason: "platform_fee",      amount: 245_000,   description: "رسم 2%",                    created_at: "2026-04-25 13:00" },
  { id: "wt-7",  wallet_id: "pw-3", type: "inflow",  reason: "share_sale",        amount: 17_000_000, description: "بيع 100 حصة",             related_user_id: "u5",  related_user_name: "زين العبيدي", created_at: "2026-04-24 16:30" },
  { id: "wt-8",  wallet_id: "pw-3", type: "outflow", reason: "transfer_out",      amount: 45_000_000, description: "تحويل للإدارة العليا",     created_at: "2026-04-22 11:00" },
  { id: "wt-9",  wallet_id: "pw-4", type: "outflow", reason: "refund",            amount: 14_500_000, description: "استرداد للمستثمرين بعد التجميد", created_at: "2026-04-21 15:00" },
  { id: "wt-10", wallet_id: "pw-5", type: "inflow",  reason: "share_sale",        amount: 1_800_000, description: "بيع 20 حصة (طرح أوّل)",   related_user_id: "u6",  related_user_name: "نور الدين",    created_at: "2026-04-22 10:30" },
]

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
