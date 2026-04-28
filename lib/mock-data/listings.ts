/**
 * /exchange — P2P listings (sell + buy) and previous-ad cache.
 */

import type { Listing } from "./types"

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "l1", type: "sell", project_id: "1", project_name: "مزرعة الواحة",
    user_id: "u1", user_name: "علي حسن", reputation_score: 92, total_trades: 47, success_rate: 95,
    price: 98500, shares: 50, min_amount: 100000,
    payment_methods: ["زين كاش (Zain Cash)", "مصرف الرافدين", "آسيا حوالة (AsiaHawala)"],
    created_at: "2026-04-26T11:30:00",
  },
  {
    id: "l2", type: "sell", project_id: "1", project_name: "مزرعة الواحة",
    user_id: "u2", user_name: "محمد أحمد", reputation_score: 78, total_trades: 23, success_rate: 87,
    price: 99000, shares: 30, min_amount: 50000,
    payment_methods: ["شركة كي (Qi Card)", "زين كاش (Zain Cash)"],
    created_at: "2026-04-26T10:15:00",
  },
  {
    id: "l3", type: "sell", project_id: "2", project_name: "برج بغداد",
    user_id: "u3", user_name: "سارة محمود", reputation_score: 88, total_trades: 35, success_rate: 91,
    price: 245000, shares: 10, min_amount: 250000,
    payment_methods: ["مصرف الرافدين", "مصرف الرشيد"],
    created_at: "2026-04-26T09:00:00",
  },
  {
    id: "l4", type: "sell", project_id: "3", project_name: "مجمع الكرخ",
    user_id: "u4", user_name: "نور الدين", reputation_score: 95, total_trades: 89, success_rate: 98,
    price: 173000, shares: 25, min_amount: 175000,
    payment_methods: ["شركة كي (Qi Card)", "مصرف الرافدين", "زين كاش (Zain Cash)"],
    created_at: "2026-04-26T07:45:00",
  },
  {
    id: "l5", type: "buy", project_id: "1", project_name: "مزرعة الواحة",
    user_id: "u5", user_name: "زين العبيدي", reputation_score: 82, total_trades: 19, success_rate: 89,
    price: 102000, shares: 15, min_amount: 0,
    payment_methods: ["زين كاش (Zain Cash)"],
    created_at: "2026-04-26T08:30:00",
  },
  {
    id: "l6", type: "buy", project_id: "2", project_name: "برج بغداد",
    user_id: "u6", user_name: "ياسمين كريم", reputation_score: 76, total_trades: 12, success_rate: 83,
    price: 252000, shares: 5, min_amount: 0,
    payment_methods: ["مصرف الرافدين"],
    created_at: "2026-04-25T22:00:00",
  },
]

/** /exchange/create — previous ads from same user (for repeat-fee detection). */
export const MOCK_PREVIOUS_ADS: Array<{ project_id: string; shares: number }> = [
  { project_id: "1", shares: 50 },
]
