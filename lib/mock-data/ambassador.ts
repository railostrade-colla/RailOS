/**
 * /ambassador — referral program data.
 */

import type {
  AmbassadorMarketer,
  AmbassadorReferral,
  AmbassadorReward,
} from "./types"

/** Current user (re-shaped subset for ambassador page). */
export const ambassadorUser: { id: string; name: string; phone: string; kyc_status: string } = {
  id: "me",
  name: "أحمد محمد",
  phone: "+9647701234567",
  kyc_status: "verified",
}

export const ambassadorMarketer: AmbassadorMarketer = {
  status: "approved",
  referral_code: "AHMED2026",
  referral_link: "https://railos.app/r/AHMED2026",
  total_clicks: 47,
  total_signups: 12,
  total_investors: 5,
  total_rewards_shares: 18,
  created_at: "2026-04-15",
  rejection_reason: "",
}

export const ambassadorReferrals: AmbassadorReferral[] = [
  { id: "r1", name: "علي حسن", kyc_status: "verified", status: "invested", reward_given: true, created_at: "2026-04-20" },
  { id: "r2", name: "محمد أحمد", kyc_status: "verified", status: "invested", reward_given: false, created_at: "2026-04-22" },
  { id: "r3", name: "سارة محمود", kyc_status: "pending", status: "registered", reward_given: false, created_at: "2026-04-24" },
  { id: "r4", name: "زائر مجهول", kyc_status: null, status: "click", reward_given: false, created_at: "2026-04-25" },
]

export const ambassadorRewards: AmbassadorReward[] = [
  { id: "rw1", shares: 5, project_name: "مزرعة الواحة", status: "approved", created_at: "2026-04-20" },
  { id: "rw2", shares: 8, project_name: "برج بغداد", status: "approved", created_at: "2026-04-22" },
  { id: "rw3", shares: 5, project_name: "مجمع الكرخ", status: "pending", created_at: "2026-04-25" },
]

// Aliases for legacy variable names used inside ambassador/page.tsx
export const mockUser = ambassadorUser
export const mockMarketer = ambassadorMarketer
export const mockReferrals = ambassadorReferrals
export const mockRewards = ambassadorRewards
