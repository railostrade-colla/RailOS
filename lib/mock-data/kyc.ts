/**
 * KYC submissions — admin-side review queue.
 * Used by /admin?tab=kyc.
 */

export type KycDocumentType = "national_id" | "passport" | "residency"
export type KycStatus = "pending" | "verified" | "rejected" | "needs_resubmission"

export interface KycSubmission {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_avatar?: string
  document_type: KycDocumentType
  status: KycStatus
  front_url: string
  back_url: string
  selfie_url: string
  rejection_reason?: string
  resubmission_field?: "front" | "back" | "selfie"
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  city?: string
  birth_date?: string
}

const placeholder = (text: string) =>
  `https://placehold.co/600x400/0a0a0a/ffffff?text=${encodeURIComponent(text)}`

export const MOCK_KYC_SUBMISSIONS: KycSubmission[] = [
  {
    id: "kyc-1",
    user_id: "u4",
    user_name: "سارة محمود",
    user_email: "sara.m@example.com",
    document_type: "national_id",
    status: "pending",
    front_url: placeholder("ID-FRONT-1"),
    back_url: placeholder("ID-BACK-1"),
    selfie_url: placeholder("SELFIE-1"),
    submitted_at: "2026-04-25 11:30",
    city: "بغداد",
    birth_date: "1995-03-12",
  },
  {
    id: "kyc-2",
    user_id: "u7",
    user_name: "ياسمين كريم",
    user_email: "yasmin.k@example.com",
    document_type: "passport",
    status: "pending",
    front_url: placeholder("PASS-FRONT-2"),
    back_url: placeholder("PASS-BACK-2"),
    selfie_url: placeholder("SELFIE-2"),
    submitted_at: "2026-04-25 09:15",
    city: "البصرة",
    birth_date: "1992-07-22",
  },
  {
    id: "kyc-3",
    user_id: "u10",
    user_name: "هدى صبري",
    user_email: "huda.s@example.com",
    document_type: "national_id",
    status: "pending",
    front_url: placeholder("ID-FRONT-3"),
    back_url: placeholder("ID-BACK-3"),
    selfie_url: placeholder("SELFIE-3"),
    submitted_at: "2026-04-24 18:45",
    city: "بغداد",
    birth_date: "1988-11-03",
  },
  {
    id: "kyc-4",
    user_id: "u11",
    user_name: "كريم علي",
    user_email: "kareem.a@example.com",
    document_type: "national_id",
    status: "needs_resubmission",
    front_url: placeholder("ID-FRONT-4"),
    back_url: placeholder("ID-BACK-4"),
    selfie_url: placeholder("SELFIE-BLURRY"),
    resubmission_field: "selfie",
    rejection_reason: "صورة Selfie غير واضحة — يرجى إعادة الرفع بإضاءة كافية",
    submitted_at: "2026-04-23 14:20",
    reviewed_at: "2026-04-23 16:00",
    reviewed_by: "Admin@1",
    city: "النجف",
    birth_date: "1990-01-15",
  },
  {
    id: "kyc-5",
    user_id: "u12",
    user_name: "ليلى ناصر",
    user_email: "layla.n@example.com",
    document_type: "residency",
    status: "verified",
    front_url: placeholder("RES-FRONT-5"),
    back_url: placeholder("RES-BACK-5"),
    selfie_url: placeholder("SELFIE-5"),
    submitted_at: "2026-04-22 10:00",
    reviewed_at: "2026-04-22 12:30",
    reviewed_by: "Admin@Main",
    city: "أربيل",
    birth_date: "1985-05-20",
  },
  {
    id: "kyc-6",
    user_id: "u13",
    user_name: "ضيف الله سعيد",
    user_email: "dhayfallah.s@example.com",
    document_type: "national_id",
    status: "verified",
    front_url: placeholder("ID-FRONT-6"),
    back_url: placeholder("ID-BACK-6"),
    selfie_url: placeholder("SELFIE-6"),
    submitted_at: "2026-04-21 16:00",
    reviewed_at: "2026-04-21 18:15",
    reviewed_by: "Admin@1",
    city: "كربلاء",
    birth_date: "1991-09-08",
  },
  {
    id: "kyc-7",
    user_id: "u14",
    user_name: "حسن العبيدي",
    user_email: "hassan.o@example.com",
    document_type: "passport",
    status: "rejected",
    front_url: placeholder("PASS-EXPIRED"),
    back_url: placeholder("PASS-BACK-7"),
    selfie_url: placeholder("SELFIE-7"),
    rejection_reason: "جواز السفر منتهي الصلاحية — يرجى تقديم وثيقة سارية",
    submitted_at: "2026-04-20 09:30",
    reviewed_at: "2026-04-20 11:00",
    reviewed_by: "Admin@2",
    city: "بغداد",
    birth_date: "1987-02-28",
  },
  {
    id: "kyc-8",
    user_id: "u15",
    user_name: "فاطمة الجبوري",
    user_email: "fatima.j@example.com",
    document_type: "national_id",
    status: "verified",
    front_url: placeholder("ID-FRONT-8"),
    back_url: placeholder("ID-BACK-8"),
    selfie_url: placeholder("SELFIE-8"),
    submitted_at: "2026-04-19 13:45",
    reviewed_at: "2026-04-19 15:20",
    reviewed_by: "Admin@Main",
    city: "ديالى",
    birth_date: "1993-12-11",
  },
  {
    id: "kyc-9",
    user_id: "u16",
    user_name: "مصطفى الكاظمي",
    user_email: "mustafa.k@example.com",
    document_type: "national_id",
    status: "pending",
    front_url: placeholder("ID-FRONT-9"),
    back_url: placeholder("ID-BACK-9"),
    selfie_url: placeholder("SELFIE-9"),
    submitted_at: "2026-04-25 14:50",
    city: "بغداد",
    birth_date: "1989-06-17",
  },
  {
    id: "kyc-10",
    user_id: "u17",
    user_name: "زهراء التميمي",
    user_email: "zahraa.t@example.com",
    document_type: "passport",
    status: "needs_resubmission",
    front_url: placeholder("PASS-FRONT-10"),
    back_url: placeholder("PASS-DARK"),
    selfie_url: placeholder("SELFIE-10"),
    resubmission_field: "back",
    rejection_reason: "صورة الجهة الخلفية مظلمة — يرجى إعادة الرفع",
    submitted_at: "2026-04-22 08:00",
    reviewed_at: "2026-04-22 10:30",
    reviewed_by: "Admin@1",
    city: "كربلاء",
    birth_date: "1994-04-25",
  },
]

export const KYC_DOC_TYPE_LABELS: Record<KycDocumentType, string> = {
  national_id: "هوية وطنية",
  passport: "جواز سفر",
  residency: "إقامة",
}

export const KYC_STATUS_LABELS: Record<KycStatus, { label: string; color: "yellow" | "green" | "red" | "orange" }> = {
  pending: { label: "معلّق", color: "yellow" },
  verified: { label: "موثّق", color: "green" },
  rejected: { label: "مرفوض", color: "red" },
  needs_resubmission: { label: "إعادة رفع", color: "orange" },
}

export function getKycStats() {
  const all = MOCK_KYC_SUBMISSIONS
  const today = "2026-04-25"
  return {
    pending: all.filter((k) => k.status === "pending").length,
    verified: all.filter((k) => k.status === "verified").length,
    rejected: all.filter((k) => k.status === "rejected").length,
    resubmission: all.filter((k) => k.status === "needs_resubmission").length,
    today_count: all.filter((k) => k.submitted_at.startsWith(today)).length,
    total: all.length,
  }
}
