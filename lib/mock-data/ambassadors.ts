/**
 * Ambassadors — admin-side review queue + rewards ledger.
 * Used by /admin?tab=ambassadors_admin.
 *
 * NOTE: User-side ambassador data lives in `./ambassador.ts` (singular).
 * This file is the admin/governance perspective (richer schema).
 */

export type AmbassadorAppStatus = "pending" | "approved" | "rejected" | "suspended"
export type AmbassadorLevel = "basic" | "advanced" | "pro"

export interface AmbassadorSocialLink {
  platform: "twitter" | "instagram" | "facebook" | "telegram" | "tiktok" | "linkedin" | "other"
  url: string
}

export interface AmbassadorAdmin {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_avatar?: string
  user_level: AmbassadorLevel
  application_status: AmbassadorAppStatus
  is_active: boolean
  application_reason: string
  experience: string
  social_media_links: AmbassadorSocialLink[]
  total_referrals: number
  total_signups: number
  total_first_trades: number
  total_rewards_earned: number
  applied_at: string
  approved_at?: string
  approved_by?: string
  suspended_at?: string
  suspension_reason?: string
  rejection_reason?: string
}

export type AmbassadorRewardType = "referral_signup" | "referral_first_trade" | "milestone"
export type AmbassadorRewardStatus = "pending" | "paid"

export interface AmbassadorRewardAdmin {
  id: string
  ambassador_id: string
  ambassador_name: string
  type: AmbassadorRewardType
  amount: number
  related_user_id?: string
  related_user_name?: string
  status: AmbassadorRewardStatus
  awarded_at: string
  paid_at?: string
}

export const MOCK_AMBASSADORS_ADMIN: AmbassadorAdmin[] = [
  {
    id: "amb-1",
    user_id: "u2",
    user_name: "علي حسن",
    user_email: "ali.h@example.com",
    user_level: "pro",
    application_status: "approved",
    is_active: true,
    application_reason: "لدي شبكة واسعة من المستثمرين المهتمين بالعراق وأرغب بدعم منصة وطنية شفّافة.",
    experience: "5 سنوات في تسويق العقارات + قناة YouTube بـ 12K مشترك.",
    social_media_links: [
      { platform: "twitter", url: "https://twitter.com/alihasan_iq" },
      { platform: "instagram", url: "https://instagram.com/alihasan.iq" },
    ],
    total_referrals: 47,
    total_signups: 32,
    total_first_trades: 18,
    total_rewards_earned: 124,
    applied_at: "2026-02-10",
    approved_at: "2026-02-12",
    approved_by: "Admin@Main",
  },
  {
    id: "amb-2",
    user_id: "u5",
    user_name: "نور الدين",
    user_email: "noureldin@example.com",
    user_level: "pro",
    application_status: "approved",
    is_active: true,
    application_reason: "أعمل مستشاراً مالياً لـ 200+ عميل وأرى رايلوس فرصة حقيقية للسوق العراقي.",
    experience: "10 سنوات استشارات مالية + شهادة CFA.",
    social_media_links: [
      { platform: "linkedin", url: "https://linkedin.com/in/noureldin" },
      { platform: "telegram", url: "https://t.me/noureldin_finance" },
    ],
    total_referrals: 38,
    total_signups: 25,
    total_first_trades: 15,
    total_rewards_earned: 96,
    applied_at: "2026-01-20",
    approved_at: "2026-01-22",
    approved_by: "Admin@1",
  },
  {
    id: "amb-3",
    user_id: "u3",
    user_name: "محمد أحمد",
    user_email: "mohammed.a@example.com",
    user_level: "advanced",
    application_status: "approved",
    is_active: true,
    application_reason: "بدأت ك مستثمر هاوٍ، الآن لدي خبرة كافية لتعريف الآخرين.",
    experience: "تجربة شخصية 18 شهر + بودكاست 'استثمار العراق'.",
    social_media_links: [
      { platform: "instagram", url: "https://instagram.com/mohammed.investor" },
    ],
    total_referrals: 14,
    total_signups: 9,
    total_first_trades: 4,
    total_rewards_earned: 28,
    applied_at: "2026-03-05",
    approved_at: "2026-03-07",
    approved_by: "Admin@Main",
  },
  {
    id: "amb-4",
    user_id: "u8",
    user_name: "كريم علي",
    user_email: "kareem.a@example.com",
    user_level: "advanced",
    application_status: "pending",
    is_active: false,
    application_reason: "صانع محتوى مالي بـ 5K متابع، أرغب بالانضمام كسفير لتوسيع نشاطي.",
    experience: "سنتان في صناعة المحتوى المالي على Tiktok + Instagram.",
    social_media_links: [
      { platform: "tiktok", url: "https://tiktok.com/@kareem.finance" },
      { platform: "instagram", url: "https://instagram.com/kareem.fin" },
    ],
    total_referrals: 0,
    total_signups: 0,
    total_first_trades: 0,
    total_rewards_earned: 0,
    applied_at: "2026-04-22",
  },
  {
    id: "amb-5",
    user_id: "u15",
    user_name: "فاطمة الجبوري",
    user_email: "fatima.j@example.com",
    user_level: "basic",
    application_status: "pending",
    is_active: false,
    application_reason: "طالبة جامعية متخصصة في الاقتصاد، أرغب بالتسويق للمنصة بين زملائي.",
    experience: "حملات تسويقية صغيرة في الجامعة + مدوّنة شخصية.",
    social_media_links: [
      { platform: "twitter", url: "https://twitter.com/fatima_econ" },
    ],
    total_referrals: 0,
    total_signups: 0,
    total_first_trades: 0,
    total_rewards_earned: 0,
    applied_at: "2026-04-24",
  },
  {
    id: "amb-6",
    user_id: "u20",
    user_name: "عمر الزهيري",
    user_email: "omar.z@example.com",
    user_level: "advanced",
    application_status: "pending",
    is_active: false,
    application_reason: "مدوّن مالي + محلل سوق، أرى رايلوس منصة مبتكرة وسأكون سفيراً جيداً.",
    experience: "3 سنوات تحليل مالي + 8K متابع على Twitter.",
    social_media_links: [
      { platform: "twitter", url: "https://twitter.com/omar_market_iq" },
      { platform: "telegram", url: "https://t.me/omar_market" },
    ],
    total_referrals: 0,
    total_signups: 0,
    total_first_trades: 0,
    total_rewards_earned: 0,
    applied_at: "2026-04-25",
  },
  {
    id: "amb-7",
    user_id: "u9",
    user_name: "حساب احتيالي",
    user_email: "fake@spam.com",
    user_level: "basic",
    application_status: "rejected",
    is_active: false,
    application_reason: "أنا الأفضل، صدقني.",
    experience: "بدون خبرة.",
    social_media_links: [],
    total_referrals: 0,
    total_signups: 0,
    total_first_trades: 0,
    total_rewards_earned: 0,
    applied_at: "2026-04-15",
    rejection_reason: "بيانات غير حقيقية + لا توجد روابط تواصل اجتماعي مفعّلة.",
  },
  {
    id: "amb-8",
    user_id: "u11",
    user_name: "ليلى ناصر",
    user_email: "layla.n@example.com",
    user_level: "advanced",
    application_status: "rejected",
    is_active: false,
    application_reason: "لدي قناة YouTube صغيرة.",
    experience: "بدأت قبل 3 شهور فقط.",
    social_media_links: [
      { platform: "other", url: "https://youtube.com/@layla" },
    ],
    total_referrals: 0,
    total_signups: 0,
    total_first_trades: 0,
    total_rewards_earned: 0,
    applied_at: "2026-04-10",
    rejection_reason: "الخبرة غير كافية — يُرجى إعادة التقديم بعد 6 شهور وتطوير القناة.",
  },
  {
    id: "amb-9",
    user_id: "u22",
    user_name: "زيد الحلبوسي",
    user_email: "zaid.h@example.com",
    user_level: "advanced",
    application_status: "suspended",
    is_active: false,
    application_reason: "خبرة 4 سنوات في إدارة مجتمعات Discord المالية.",
    experience: "Discord 8K عضو + Twitter 4K متابع.",
    social_media_links: [
      { platform: "twitter", url: "https://twitter.com/zaid_iq_invest" },
    ],
    total_referrals: 12,
    total_signups: 7,
    total_first_trades: 3,
    total_rewards_earned: 18,
    applied_at: "2026-02-20",
    approved_at: "2026-02-22",
    approved_by: "Admin@Main",
    suspended_at: "2026-04-18",
    suspension_reason: "شكاوى من إحالات مزيّفة — تحت التحقيق.",
  },
  {
    id: "amb-10",
    user_id: "u23",
    user_name: "هديل الزيدي",
    user_email: "hadeel.z@example.com",
    user_level: "pro",
    application_status: "approved",
    is_active: true,
    application_reason: "محرّرة سابقة في وكالة أنباء اقتصادية، شغوفة بنشر الوعي المالي للنساء.",
    experience: "8 سنوات تحرير + كتاب 'الاستثمار للمبتدئات'.",
    social_media_links: [
      { platform: "instagram", url: "https://instagram.com/hadeel.invest" },
      { platform: "facebook", url: "https://facebook.com/hadeel.iq" },
    ],
    total_referrals: 22,
    total_signups: 17,
    total_first_trades: 11,
    total_rewards_earned: 64,
    applied_at: "2026-03-12",
    approved_at: "2026-03-14",
    approved_by: "Admin@1",
  },
]

export const MOCK_AMBASSADOR_REWARDS_ADMIN: AmbassadorRewardAdmin[] = [
  { id: "rwa-1",  ambassador_id: "amb-1",  ambassador_name: "علي حسن",       type: "referral_signup",      amount: 5,  related_user_id: "u_n1", related_user_name: "محمد العامري", status: "paid",    awarded_at: "2026-04-22", paid_at: "2026-04-23" },
  { id: "rwa-2",  ambassador_id: "amb-1",  ambassador_name: "علي حسن",       type: "referral_first_trade", amount: 15, related_user_id: "u_n1", related_user_name: "محمد العامري", status: "paid",    awarded_at: "2026-04-23", paid_at: "2026-04-24" },
  { id: "rwa-3",  ambassador_id: "amb-1",  ambassador_name: "علي حسن",       type: "milestone",            amount: 50,                                                       status: "pending", awarded_at: "2026-04-25" },
  { id: "rwa-4",  ambassador_id: "amb-2",  ambassador_name: "نور الدين",     type: "referral_signup",      amount: 5,  related_user_id: "u_n2", related_user_name: "ضحى السامرائي",  status: "paid",    awarded_at: "2026-04-20", paid_at: "2026-04-21" },
  { id: "rwa-5",  ambassador_id: "amb-2",  ambassador_name: "نور الدين",     type: "referral_first_trade", amount: 15, related_user_id: "u_n2", related_user_name: "ضحى السامرائي",  status: "paid",    awarded_at: "2026-04-22", paid_at: "2026-04-23" },
  { id: "rwa-6",  ambassador_id: "amb-2",  ambassador_name: "نور الدين",     type: "referral_signup",      amount: 5,  related_user_id: "u_n3", related_user_name: "حسن البصري",   status: "pending", awarded_at: "2026-04-24" },
  { id: "rwa-7",  ambassador_id: "amb-3",  ambassador_name: "محمد أحمد",     type: "referral_signup",      amount: 5,  related_user_id: "u_n4", related_user_name: "علي العمري",   status: "paid",    awarded_at: "2026-04-15", paid_at: "2026-04-16" },
  { id: "rwa-8",  ambassador_id: "amb-3",  ambassador_name: "محمد أحمد",     type: "referral_signup",      amount: 5,  related_user_id: "u_n5", related_user_name: "زينب الكاظمي",  status: "pending", awarded_at: "2026-04-25" },
  { id: "rwa-9",  ambassador_id: "amb-9",  ambassador_name: "زيد الحلبوسي",  type: "referral_signup",      amount: 5,  related_user_id: "u_n6", related_user_name: "ضيف",           status: "pending", awarded_at: "2026-04-17" },
  { id: "rwa-10", ambassador_id: "amb-10", ambassador_name: "هديل الزيدي",   type: "referral_signup",      amount: 5,  related_user_id: "u_n7", related_user_name: "ميس الرحال",   status: "paid",    awarded_at: "2026-04-19", paid_at: "2026-04-20" },
  { id: "rwa-11", ambassador_id: "amb-10", ambassador_name: "هديل الزيدي",   type: "referral_first_trade", amount: 15, related_user_id: "u_n7", related_user_name: "ميس الرحال",   status: "paid",    awarded_at: "2026-04-21", paid_at: "2026-04-22" },
  { id: "rwa-12", ambassador_id: "amb-10", ambassador_name: "هديل الزيدي",   type: "milestone",            amount: 30,                                                       status: "paid",    awarded_at: "2026-04-15", paid_at: "2026-04-16" },
  { id: "rwa-13", ambassador_id: "amb-2",  ambassador_name: "نور الدين",     type: "milestone",            amount: 30,                                                       status: "paid",    awarded_at: "2026-04-10", paid_at: "2026-04-11" },
  { id: "rwa-14", ambassador_id: "amb-1",  ambassador_name: "علي حسن",       type: "referral_signup",      amount: 5,  related_user_id: "u_n8", related_user_name: "صالح الجنابي", status: "paid",    awarded_at: "2026-04-08", paid_at: "2026-04-09" },
  { id: "rwa-15", ambassador_id: "amb-3",  ambassador_name: "محمد أحمد",     type: "referral_first_trade", amount: 15, related_user_id: "u_n4", related_user_name: "علي العمري",   status: "paid",    awarded_at: "2026-04-17", paid_at: "2026-04-18" },
  { id: "rwa-16", ambassador_id: "amb-1",  ambassador_name: "علي حسن",       type: "referral_first_trade", amount: 15, related_user_id: "u_n8", related_user_name: "صالح الجنابي", status: "paid",    awarded_at: "2026-04-10", paid_at: "2026-04-11" },
]

export const AMBASSADOR_STATUS_LABELS: Record<AmbassadorAppStatus, { label: string; color: "yellow" | "green" | "red" | "orange" }> = {
  pending: { label: "بانتظار المراجعة", color: "yellow" },
  approved: { label: "مفعّل", color: "green" },
  rejected: { label: "مرفوض", color: "red" },
  suspended: { label: "مُوقَف مؤقّتاً", color: "orange" },
}

export const REWARD_TYPE_LABELS: Record<AmbassadorRewardType, { label: string; icon: string }> = {
  referral_signup: { label: "تسجيل إحالة", icon: "🎯" },
  referral_first_trade: { label: "أول صفقة لمُحال", icon: "💰" },
  milestone: { label: "إنجاز / مكافأة شهرية", icon: "🏆" },
}

export const REWARD_STATUS_LABELS: Record<AmbassadorRewardStatus, { label: string; color: "yellow" | "green" }> = {
  pending: { label: "معلّق", color: "yellow" },
  paid: { label: "مدفوع", color: "green" },
}

export const SOCIAL_PLATFORM_ICONS: Record<AmbassadorSocialLink["platform"], string> = {
  twitter: "🐦",
  instagram: "📸",
  facebook: "📘",
  telegram: "✈️",
  tiktok: "🎵",
  linkedin: "💼",
  other: "🔗",
}

export function getAmbassadorsAdminStats() {
  const all = MOCK_AMBASSADORS_ADMIN
  return {
    pending: all.filter((a) => a.application_status === "pending").length,
    active: all.filter((a) => a.application_status === "approved" && a.is_active).length,
    suspended: all.filter((a) => a.application_status === "suspended").length,
    rejected: all.filter((a) => a.application_status === "rejected").length,
    total: all.length,
    total_referrals: all.reduce((s, a) => s + a.total_referrals, 0),
    total_rewards: all.reduce((s, a) => s + a.total_rewards_earned, 0),
  }
}

export function getRewardsStats() {
  const all = MOCK_AMBASSADOR_REWARDS_ADMIN
  return {
    paid: all.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0),
    pending: all.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0),
    total: all.reduce((s, r) => s + r.amount, 0),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// User-side helpers — drive the /ambassador page state machine
// ──────────────────────────────────────────────────────────────────────────
import type { AmbassadorApplicationData } from "./types"
import { CURRENT_USER } from "./profile"

export type CurrentAmbassadorStatus = "none" | "pending" | "approved" | "rejected" | "suspended"

export interface CurrentUserAmbassadorState {
  is_ambassador: boolean
  status: CurrentAmbassadorStatus
  application: AmbassadorApplicationData | null
}

/**
 * Return the current user's ambassador state. Used by /ambassador page.
 * Reads from CURRENT_USER (canonical profile) — manually toggle the fields
 * in `lib/mock-data/profile.ts` to test all 4 states.
 */
export function getCurrentUserAmbassadorStatus(_userId: string = "me"): CurrentUserAmbassadorState {
  const status: CurrentAmbassadorStatus = CURRENT_USER.ambassador_status ?? "none"
  return {
    is_ambassador: CURRENT_USER.is_ambassador ?? false,
    status,
    application: CURRENT_USER.ambassador_application ?? null,
  }
}

export interface SubmitApplicationInput {
  reason: string
  experience: string
  social_links: { platform: string; url: string }[]
  follower_range: AmbassadorApplicationData["follower_range"]
  expected_referrals: AmbassadorApplicationData["expected_referrals"]
}

/**
 * Mock: submit an ambassador application. In production would POST to Supabase.
 * Returns success + application_id + estimated review time.
 */
export function submitAmbassadorApplication(_userId: string, _data: SubmitApplicationInput) {
  return {
    success: true,
    application_id: `app-${Date.now()}`,
    status: "pending" as const,
    estimated_review_days: 5,
  }
}

/** Mock: cancel a pending application. */
export function cancelAmbassadorApplication(_userId: string) {
  return { success: true }
}

/** Helper: estimate the review progress 0..1 based on how many days passed. */
export function estimateReviewProgress(submittedAt: string, totalDays: number = 5): number {
  const submitted = new Date(submittedAt).getTime()
  if (Number.isNaN(submitted)) return 0
  const elapsed = (Date.now() - submitted) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(1, elapsed / totalDays))
}
