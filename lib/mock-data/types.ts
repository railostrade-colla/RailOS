/**
 * Unified mock-data types for RailOS.
 *
 * Strategy:
 * - Required fields = the intersection of what every page needs
 * - Optional fields = anything used by some pages but not all
 * - Existing scattered types (ProjectCardData, CompanyCardData, InvestorLevel)
 *   are re-exported here so consumers have ONE import path.
 */

import type { CompanyCardData, ProjectCardData } from "@/components/cards"
import type { InvestorLevel, ContractMember } from "@/lib/utils/contractLimits"

// Re-export so callers can `import { InvestorLevel } from "@/lib/mock-data"`
export type { CompanyCardData, ProjectCardData, InvestorLevel, ContractMember }

// ──────────────────────────────────────────────────────────────────────────
// Risk levels — both English (legacy: dashboard, investment, project, company)
// and Arabic (new: market, cards). Pages may use either.
// ──────────────────────────────────────────────────────────────────────────
export type RiskLevelEn = "low" | "medium" | "high"
export type RiskLevelAr = "منخفض" | "متوسط" | "مرتفع"

export const RISK_EN_TO_AR: Record<RiskLevelEn, RiskLevelAr> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
}

export const RISK_AR_TO_EN: Record<RiskLevelAr, RiskLevelEn> = {
  منخفض: "low",
  متوسط: "medium",
  مرتفع: "high",
}

// ──────────────────────────────────────────────────────────────────────────
// Project — superset of everything dashboard / market / investment / exchange use
// ──────────────────────────────────────────────────────────────────────────
// Extended classification for projects/companies (admin form + display)
// ──────────────────────────────────────────────────────────────────────────
export type ProjectEntityType = "company" | "project" | "individual" | "partnership"
export type ProjectBuildStatus = "planning" | "active" | "completed"
export type ProjectQuality = "low" | "medium" | "high"
export type ProjectAdminStatus = "pending" | "active" | "paused" | "rejected" | "closed"
export type ProjectInvestmentType = "direct" | "auction"
export type ProjectDistributionType = "monthly" | "quarterly" | "semi_annual" | "annual"

export interface ProjectDocument {
  name: string
  url: string
}

export interface Project {
  // Core (required everywhere)
  id: string
  name: string
  sector: string
  share_price: number
  total_shares: number
  available_shares: number
  /** English form — used by dashboard / investment / project / company helpers */
  risk_level: RiskLevelEn

  // ─── Admin form: classification ───
  symbol?: string                     // الرمز (مثل: RMD)
  entity_type?: ProjectEntityType     // company / project / individual / partnership
  build_status?: ProjectBuildStatus   // planning / active / completed
  quality?: ProjectQuality            // low / medium / high
  admin_status?: ProjectAdminStatus   // pending / active / paused / rejected / closed

  // ─── Admin form: financial ───
  project_value?: number              // قيمة المشروع الكلية
  shares_offered?: number             // الحصص المطروحة
  reserved_shares?: number            // الحصص المحجوزة
  listing_percent?: number            // نسبة الطرح
  capital_needed?: number             // رأس المال المطلوب
  capital_raised?: number             // رأس المال المحقق
  owner_percent?: number              // نسبة المالك
  offer_percent?: number              // نسبة المطروح للأرشفة
  revenue?: number                    // الإيرادات (للمنجز فقط)
  investment_type?: ProjectInvestmentType  // direct / auction

  // ─── Admin form: returns ───
  description?: string
  created_at?: string
  return_min?: number
  return_max?: number
  distribution_type?: ProjectDistributionType
  profit_source?: string

  // ─── Admin form: owner ───
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  address?: string                    // العنوان التفصيلي
  seller_id?: string
  seller_name?: string

  // ─── Admin form: media + documents ───
  logo?: string
  cover_image?: string
  project_images?: string[]
  company_images?: string[]
  documents?: ProjectDocument[]

  // ─── Card-display extras (market / cards) ───
  company_id?: string
  company_name?: string
  expected_return_min?: number
  expected_return_max?: number
  investors_count?: number
  duration_months?: number
  closes_in_days?: number
  status?: "open" | "closing_soon" | "closed"
  is_trending?: boolean
  is_new?: boolean
  /** Arabic form — used by market / cards. Auto-derived in projects.ts. */
  risk_level_ar?: RiskLevelAr
}

// ──────────────────────────────────────────────────────────────────────────
// Company — superset (dashboard NEW_COMPANIES_PREVIEW + market ALL_COMPANIES + company/[id])
// ──────────────────────────────────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  sector: string
  share_price: number
  /** Arabic form (matches CompanyCardData) */
  risk_level: RiskLevelAr

  // Card-display extras
  city?: string
  joined_days_ago?: number
  projects_count?: number
  shareholders_count?: number
  is_verified?: boolean
  rating?: number
  is_trending?: boolean
  is_new?: boolean

  // Detailed (company/[id])
  description?: string
  total_shares?: number
  available_shares?: number
  status?: string
  founded_year?: number
  employees?: number
  created_at?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Holding — what the user owns (portfolio / wallet/send / exchange/create / quick-sell)
// ──────────────────────────────────────────────────────────────────────────
export interface Holding {
  id: string
  project_id: string
  /**
   * Embedded project snapshot. Different pages use different sub-shapes:
   * - portfolio:        { name, sector, share_price, total_shares, available_shares }
   * - wallet/send:      { id, name, sector, share_price }
   * - exchange/create:  { id, name, sector, share_price }
   * - quick-sell:       { id, name, sector, share_price }
   */
  project: {
    id?: string
    name: string
    sector: string
    share_price: number
    total_shares?: number
    available_shares?: number
  }
  shares_owned: number
  /** Owner user id — defaults to "me" when missing. */
  user_id?: string
  /** Avg purchase price per share (for cost-basis & P/L calc). */
  buy_price?: number
  /** Current market value in IQD (= shares_owned × current share_price). */
  current_value?: number
}

// ──────────────────────────────────────────────────────────────────────────
// User / profile / community / wallet/send recipient lookup
// ──────────────────────────────────────────────────────────────────────────
export interface UserPublic {
  id: string
  name: string
  verified?: boolean
  is_verified?: boolean
  level?: InvestorLevel
  reputation_score?: number
  total_trades?: number
  success_rate?: number
  trust_score?: number
}

export interface CurrentUserProfile {
  id: string
  name: string
  phone?: string
  email?: string
  governorate?: string
  age?: number
  is_verified: boolean
  level: InvestorLevel
  kyc_status?: "pending" | "verified" | "rejected" | null
  trust_score?: number
  total_trades?: number
  success_rate?: number
  reputation_score?: number

  // Ambassador application state — see lib/mock-data/ambassadors.ts helpers
  is_ambassador?: boolean
  ambassador_status?: "pending" | "approved" | "rejected" | "suspended" | null
  ambassador_application?: AmbassadorApplicationData | null
}

export interface AmbassadorApplicationData {
  reason: string
  experience: string
  social_links: { platform: string; url: string }[]
  follower_range: "<1k" | "1k-10k" | "10k-100k" | ">100k"
  expected_referrals: "1-5" | "5-20" | "20-50" | ">50"
  submitted_at: string
  rejection_reason?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Trade / order
// ──────────────────────────────────────────────────────────────────────────
export type TradeStatus = "confirmed" | "in_progress" | "cancelled" | "pending"
export type DirectBuyStatus = "approved" | "pending" | "postponed" | "rejected"

export interface Trade {
  id: string
  project: { name: string }
  shares?: number
  price?: number
  status: TradeStatus
  created_at: string
  buyer_id?: string
  seller_id?: string
  seller?: { name: string }
  buyer?: { name: string }
}

export interface DirectBuy {
  id: string
  project_id: string
  project_name: string
  shares: number
  price_per_share: number
  status: DirectBuyStatus
  created_at: string
  payment_due_at?: string
  admin_note?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string
  title: string
  body: string
  read_status: boolean
  created_at: string
  link: string
}

// ──────────────────────────────────────────────────────────────────────────
// Auctions
// ──────────────────────────────────────────────────────────────────────────
export interface Auction {
  id: string
  title: string
  project: { name: string }
  shares: number
  opening_price: number
  current_price: number
  ends_at: string
  bids_count: number
}

// ──────────────────────────────────────────────────────────────────────────
// Ads (dashboard banner slider)
// ──────────────────────────────────────────────────────────────────────────
export interface Ad {
  id: string
  title: string
  subtitle?: string
  description: string
  icon: string
  action_label: string
  link_type: "internal" | "external"
  link_url: string
  /** Display variant — controls slider height. */
  type?: "text" | "image" | "promo"
}

// ──────────────────────────────────────────────────────────────────────────
// Listings (P2P exchange)
// ──────────────────────────────────────────────────────────────────────────
export interface Listing {
  id: string
  type: "sell" | "buy"
  project_id: string
  project_name: string
  user_id: string
  user_name: string
  reputation_score: number
  total_trades: number
  success_rate: number
  price: number
  shares: number
  min_amount: number
  payment_methods: string[]
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Wallet log
// ──────────────────────────────────────────────────────────────────────────
export type WalletOpType = "deal_buy" | "deal_sell" | "shares_sent" | "shares_received"

export interface WalletLogEntry {
  id: string
  op_type: WalletOpType
  amount: number
  project_name: string
  created_at: string
}

export interface FeeRequest {
  id: string
  amount_requested: number
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export type FeeLedgerType = "addition" | "subtraction"
export type FeeLedgerReason =
  | "admin_topup"
  | "listing_fee"
  | "auction_fee"
  | "direct_buy_fee"
  | "quick_sell_fee"

export interface FeeLedgerEntry {
  id: string
  type: FeeLedgerType
  amount: number
  reason: FeeLedgerReason | string
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Contracts (group investment partnerships)
// ──────────────────────────────────────────────────────────────────────────
export type ContractStatus = "pending" | "active" | "ended" | "cancelled"

export interface ContractListItem {
  id: string
  title: string
  status: ContractStatus
  creator_id: string
  total_investment: number
  created_at: string
  partners: Array<{ user: { name: string; is_verified: boolean } }>
}

export interface ContractDetail {
  id: string
  title: string
  status: "active" | "pending" | "ended"
  creator: string
  total_investment: number
  created_at: string
  description?: string
  members: Array<{
    user_id: string
    name: string
    level: InvestorLevel
    share_percent: number
  }>
}

// ──────────────────────────────────────────────────────────────────────────
// Community
// ──────────────────────────────────────────────────────────────────────────
export interface CommunityUser {
  id: string
  name: string
  level: "basic" | "advanced" | "pro"
  total_trades: number
  success_rate: number
  trust_score: number
  is_verified: boolean
}

export interface CommunityChat {
  id: string
  other: { id: string; name: string }
  last_message: string
  time: string
  unread: number
}

// ──────────────────────────────────────────────────────────────────────────
// Ambassador
// ──────────────────────────────────────────────────────────────────────────
export type AmbassadorStatus = "none" | "pending" | "approved" | "rejected" | "suspended"

export interface AmbassadorMarketer {
  status: AmbassadorStatus
  referral_code: string
  referral_link: string
  total_clicks: number
  total_signups: number
  total_investors: number
  total_rewards_shares: number
  created_at: string
  rejection_reason: string
}

export interface AmbassadorReferral {
  id: string
  name: string
  kyc_status: "verified" | "pending" | null
  status: "click" | "registered" | "invested"
  reward_given: boolean
  created_at: string
}

export interface AmbassadorReward {
  id: string
  shares: number
  project_name: string
  status: "approved" | "pending"
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Recent recipients / senders (wallet send/receive)
// ──────────────────────────────────────────────────────────────────────────
export interface RecentRecipient {
  id: string
  name: string
  verified: boolean
  last_sent: string
}

export interface RecentSender {
  name: string
  shares: number
  project: string
  date: string
  verified: boolean
}

// ──────────────────────────────────────────────────────────────────────────
// Deal (deal-chat/[id])
// ──────────────────────────────────────────────────────────────────────────
export interface DealMock {
  id: string
  project_name: string
  shares: number
  price_per_share: number
  total: number
  buyer: { id: string; name: string }
  seller: { id: string; name: string }
  expires_at: string
  status: string
}

// ──────────────────────────────────────────────────────────────────────────
// Support
// ──────────────────────────────────────────────────────────────────────────
export type SupportPriority = "low" | "medium" | "high"

export interface SupportMessage {
  id: string
  subject: string
  message: string
  type: string
  priority: SupportPriority
  status: "new" | "in_progress" | "replied"
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────
export const PAYMENT_METHODS_FULL = [
  "شركة كي (Qi Card)", "زين كاش (Zain Cash)", "آسيا حوالة (AsiaHawala)",
  "مصرف الرافدين", "مصرف الرشيد", "مصرف بغداد",
  "المصرف العراقي للتجارة (TBI)", "محفظة الرافدين (FastPay)",
  "مصرف بوابة العراق (FIB)", "شركة سويج (Switch)",
  "مصرف التنمية الدولي (IDB)", "مصرف عبر الخليج",
  "شركة العرب (APS)", "شركة نيو (Neo)", "شركة أموال (Amwal)",
] as const

/** First 12 entries — used by /exchange listing display */
export const PAYMENT_METHODS_PUBLIC = PAYMENT_METHODS_FULL.slice(0, 12)

export const SECTORS_LIST = ["الكل", "زراعة", "عقارات", "صناعة", "تجارة", "تقنية"] as const
export const RISK_LEVELS_AR = ["الكل", "منخفض", "متوسط", "مرتفع"] as const
