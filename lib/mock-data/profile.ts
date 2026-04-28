/**
 * Single source of truth for the current user's profile data.
 *
 * Aliases:
 * - profile           → mockProfile (full)
 * - contracts/create  → mockProfileLite (id, name, reputation_score, level)
 * - kyc               → mockProfileKYC ({ kyc_status })
 * - wallet/send       → CURRENT_USER_* constants
 *
 * NOTE: Each page already has its own subset projection. We expose the
 * canonical CURRENT_USER and convenience aliases that match each page's
 * existing shape exactly.
 */

import type { CurrentUserProfile } from "./types"
import type { InvestorLevel } from "@/lib/utils/contractLimits"

// ──────────────────────────────────────────────────────────────────────────
// Canonical current user (superset)
// ──────────────────────────────────────────────────────────────────────────
export const CURRENT_USER: CurrentUserProfile = {
  id: "abc123def456",
  name: "أحمد محمد",
  phone: "+964 770 1234567",
  email: "ahmed.m@example.com",
  governorate: "بغداد",
  age: 28,
  is_verified: true,
  level: "advanced",
  kyc_status: "verified",
  trust_score: 75,
  total_trades: 12,
  success_rate: 95,
  reputation_score: 85,
  // Ambassador defaults — change these manually to test all 4 states:
  // false / "pending" / "approved" / "rejected" / "suspended"
  is_ambassador: false,
  ambassador_status: null,
  ambassador_application: null,
}

// ──────────────────────────────────────────────────────────────────────────
// Page-specific projections (same field shapes the existing pages used)
// ──────────────────────────────────────────────────────────────────────────

/** /profile page expects this exact shape. */
export const mockProfile = {
  id: CURRENT_USER.id,
  name: CURRENT_USER.name,
  phone: CURRENT_USER.phone!,
  governorate: CURRENT_USER.governorate!,
  age: CURRENT_USER.age!,
  is_verified: CURRENT_USER.is_verified,
  level: CURRENT_USER.level as "basic" | "advanced" | "pro",
  kyc_status: CURRENT_USER.kyc_status as "pending" | "verified" | "rejected" | null,
  trust_score: CURRENT_USER.trust_score!,
  total_trades: CURRENT_USER.total_trades!,
  success_rate: CURRENT_USER.success_rate!,
}

/** /contracts/create profile (lite — no phone/age/kyc, but has reputation). */
export const mockProfileLite: {
  id: string
  name: string
  reputation_score: number
  level: InvestorLevel
} = {
  id: "me",
  name: CURRENT_USER.name,
  reputation_score: CURRENT_USER.reputation_score!,
  level: CURRENT_USER.level,
}

/** /kyc page profile (kyc_status only). */
export const mockProfileKYC: { kyc_status: "pending" | "verified" | "rejected" | null } = {
  kyc_status: null,
}

// ──────────────────────────────────────────────────────────────────────────
// Wallet / portfolio constants (numbers — not user-shape)
// ──────────────────────────────────────────────────────────────────────────
export const CURRENT_USER_ID_WALLET = "me"
export const CURRENT_USER_LEVEL: InvestorLevel = "basic"
export const CURRENT_USER_USED_THIS_MONTH = 3_500_000
export const CURRENT_FEE_BALANCE = 850
export const FEE_BALANCE_CONTRACTS = 85000
