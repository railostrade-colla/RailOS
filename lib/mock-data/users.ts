/**
 * Single source of truth for user / community / recipient lookup data.
 *
 * Aliases:
 * - wallet/send       → MOCK_USERS_DB (Record<id, {id,name,verified}>) + RECENT_RECIPIENTS
 * - wallet/receive    → RECENT_SENDERS
 * - contracts/create  → mockUsersDB (with reputation + level)
 * - community         → mockUsers + mockChats
 */

import type {
  CommunityChat,
  CommunityUser,
  RecentRecipient,
  RecentSender,
  UserPublic,
} from "./types"
import type { InvestorLevel } from "@/lib/utils/contractLimits"

// ──────────────────────────────────────────────────────────────────────────
// Master canonical user list — every other shape projects from this.
// Notes:
//  - id format `u_xxxx_xxxx` is for wallet recipient lookup (formatted RX-…).
//  - id format `u1, u2, …` is the legacy community/contracts shape.
// ──────────────────────────────────────────────────────────────────────────
export interface MasterUser extends UserPublic {
  recipient_id?: string  // u_xxxx_xxxx form (wallet send)
  last_sent?: string     // for wallet/send recent recipients
}

export const USERS: MasterUser[] = [
  {
    id: "u1", name: "علي حسن",
    recipient_id: "u_a8f9_3c2b",
    verified: true, is_verified: true,
    level: "pro", reputation_score: 92,
    total_trades: 47, success_rate: 95, trust_score: 88,
    last_sent: "منذ يومين",
  },
  {
    id: "u2", name: "محمد أحمد",
    recipient_id: "u_b1c4_5d7e",
    verified: true, is_verified: true,
    level: "advanced", reputation_score: 78,
    total_trades: 28, success_rate: 87, trust_score: 75,
    last_sent: "منذ أسبوع",
  },
  {
    id: "u3", name: "سارة محمود",
    recipient_id: "u_c3d6_9f8a",
    verified: false, is_verified: false,
    level: "basic", reputation_score: 50,
    total_trades: 8, success_rate: 75, trust_score: 60,
    last_sent: "منذ شهر",
  },
  {
    id: "u4", name: "زين العبيدي",
    recipient_id: "u_d4e7_1a2b",
    verified: true, is_verified: true,
    level: "advanced", reputation_score: 80,
    total_trades: 22, success_rate: 90, trust_score: 78,
  },
  {
    id: "u5", name: "نور الدين",
    verified: true, is_verified: true,
    level: "pro", reputation_score: 95,
    total_trades: 56, success_rate: 95, trust_score: 92,
  },
  {
    id: "u6", name: "ياسمين كريم",
    verified: false, is_verified: false,
    level: "basic", reputation_score: 50,
    total_trades: 5, success_rate: 80, trust_score: 55,
  },
  {
    id: "u7", name: "كريم علي",
    verified: true, is_verified: true,
    level: "basic", reputation_score: 60,
  },
  {
    id: "u8", name: "هدى صبري",
    verified: false, is_verified: false,
    level: "basic", reputation_score: 45,
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Wallet/Send aliases
// ──────────────────────────────────────────────────────────────────────────

/** Record keyed by `u_xxxx_xxxx` recipient id. */
export const MOCK_USERS_DB: Record<string, { id: string; name: string; verified: boolean }> =
  Object.fromEntries(
    USERS
      .filter((u) => u.recipient_id)
      .map((u) => [u.recipient_id!, { id: u.recipient_id!, name: u.name, verified: u.verified ?? false }]),
  )

/** Recent transfer recipients shown when no user is verified yet. */
export const RECENT_RECIPIENTS: RecentRecipient[] = USERS
  .filter((u) => u.recipient_id && u.last_sent)
  .map((u) => ({
    id: u.recipient_id!,
    name: u.name,
    verified: u.verified ?? false,
    last_sent: u.last_sent!,
  }))

// ──────────────────────────────────────────────────────────────────────────
// Wallet/Receive — recent senders (different shape, separate snapshot)
// ──────────────────────────────────────────────────────────────────────────
export const RECENT_SENDERS: RecentSender[] = [
  { name: "علي حسن", shares: 50, project: "مزرعة الواحة", date: "منذ يومين", verified: true },
  { name: "سارة محمود", shares: 25, project: "برج بغداد", date: "منذ أسبوع", verified: true },
  { name: "محمد أحمد", shares: 100, project: "نخيل العراق", date: "منذ شهر", verified: false },
]

// ──────────────────────────────────────────────────────────────────────────
// Contracts/create — searchable users with reputation + level (8 entries)
// ──────────────────────────────────────────────────────────────────────────
export const mockUsersDB: Array<{
  id: string
  name: string
  reputation_score: number
  is_verified: boolean
  level: InvestorLevel
}> = USERS.map((u) => ({
  id: u.id,
  name: u.name,
  reputation_score: u.reputation_score ?? 50,
  is_verified: u.is_verified ?? false,
  level: u.level ?? "basic",
}))

// ──────────────────────────────────────────────────────────────────────────
// Community
// ──────────────────────────────────────────────────────────────────────────
export const mockUsers: CommunityUser[] = USERS.slice(0, 6).map((u) => ({
  id: u.id,
  name: u.name,
  level: (u.level ?? "basic") as "basic" | "advanced" | "pro",
  total_trades: u.total_trades ?? 0,
  success_rate: u.success_rate ?? 0,
  trust_score: u.trust_score ?? 0,
  is_verified: u.is_verified ?? false,
}))

export const mockChats: CommunityChat[] = [
  { id: "1", other: { id: "1", name: "علي حسن" }, last_message: "اتفقنا على السعر، نكمل الصفقة؟", time: "منذ 5 دقائق", unread: 2 },
  { id: "2", other: { id: "2", name: "محمد أحمد" }, last_message: "شكراً على الصفقة! تقييم 5 نجوم", time: "منذ ساعة", unread: 0 },
  { id: "3", other: { id: "5", name: "نور الدين" }, last_message: "مرحبا، عندك حصص متاحة للبيع؟", time: "أمس", unread: 0 },
]
