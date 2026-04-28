/**
 * Healthcare program — cases + applications + insurance + donations.
 * Used by /healthcare/* pages + /admin?tab=healthcare_admin.
 */

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
export type DiseaseType = "cancer" | "heart" | "kidney" | "neurological" | "pediatric" | "transplant" | "other"
export type CaseStatus = "urgent" | "active" | "completed"
export type AppStatus = "pending" | "approved" | "rejected"
export type InsurancePlan = "basic" | "advanced" | "comprehensive"
export type InsuranceStatus = "active" | "paused" | "cancelled"

export interface HealthcareCase {
  id: string
  patient_display_name: string  // initials or first name only (privacy)
  patient_age: number
  city: string
  disease_type: DiseaseType
  diagnosis: string
  hospital: string
  total_required: number
  amount_collected: number
  donors_count: number
  status: CaseStatus
  is_anonymous: boolean
  created_at: string
  story?: string
  treatment_plan?: string
}

export interface HealthcareApplication {
  id: string
  user_id: string
  user_name: string
  status: AppStatus
  disease_type: DiseaseType
  diagnosis: string
  doctor_name: string
  hospital: string
  total_cost: number
  user_available: number
  requested_amount: number
  attachments: string[]
  submitted_at: string
  reviewed_at?: string
  rejection_reason?: string
}

export interface InsuranceSubscription {
  id: string
  user_id: string
  user_name?: string
  plan: InsurancePlan
  monthly_fee: number
  coverage_pct: number
  started_at: string
  next_billing: string
  status: InsuranceStatus
}

export interface HealthcareDonation {
  id: string
  donor_id: string
  donor_name: string
  case_id?: string  // undefined = general donation
  amount: number
  is_anonymous: boolean
  is_recurring: boolean
  created_at: string
}

export interface SuccessStory {
  id: string
  patient_initial: string
  disease: string
  story: string
  amount_raised: number
  date: string
}

export interface AwarenessArticle {
  id: string
  title: string
  excerpt: string
  category: string
  read_time_min: number
  published_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Mock cases (10)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_HEALTHCARE_CASES: HealthcareCase[] = [
  {
    id: "hc-1",
    patient_display_name: "أ. م.",
    patient_age: 6,
    city: "بغداد",
    disease_type: "cancer",
    diagnosis: "سرطان الدم الحادّ — بحاجة لجلسات كيماوي",
    hospital: "مستشفى الأطفال — بغداد",
    total_required: 18_000_000,
    amount_collected: 7_200_000,
    donors_count: 142,
    status: "urgent",
    is_anonymous: true,
    created_at: "2026-04-20",
    story: "طفل بعمر 6 سنوات يحتاج جلسات كيماوي عاجلة. الأسرة عاجزة عن تحمّل التكاليف.",
    treatment_plan: "8 جلسات كيماوي + متابعة طبية لمدة 6 أشهر.",
  },
  {
    id: "hc-2",
    patient_display_name: "ف. ج.",
    patient_age: 42,
    city: "البصرة",
    disease_type: "heart",
    diagnosis: "قصور حاد بالقلب — بحاجة لقسطرة + دعامة",
    hospital: "مركز القلب — البصرة",
    total_required: 12_500_000,
    amount_collected: 11_000_000,
    donors_count: 87,
    status: "urgent",
    is_anonymous: false,
    created_at: "2026-04-22",
    story: "أب لخمسة أطفال يحتاج عملية قسطرة عاجلة لإنقاذ حياته.",
    treatment_plan: "قسطرة قلبية + دعامة + متابعة لمدة 3 أشهر.",
  },
  {
    id: "hc-3",
    patient_display_name: "زهراء ت.",
    patient_age: 28,
    city: "النجف",
    disease_type: "kidney",
    diagnosis: "فشل كلوي مزمن — تحتاج زراعة كلية",
    hospital: "مستشفى زراعة الأعضاء — بغداد",
    total_required: 35_000_000,
    amount_collected: 12_500_000,
    donors_count: 63,
    status: "active",
    is_anonymous: false,
    created_at: "2026-04-15",
    story: "متبرّع متوافق متاح. تكلفة العملية + الأدوية الأولية.",
    treatment_plan: "عملية زراعة + أدوية مضادّة للرفض لمدة 12 شهر.",
  },
  {
    id: "hc-4",
    patient_display_name: "م. ع.",
    patient_age: 15,
    city: "الموصل",
    disease_type: "neurological",
    diagnosis: "ورم في الدماغ — يحتاج جراحة",
    hospital: "مستشفى ابن سينا التخصّصي",
    total_required: 22_000_000,
    amount_collected: 8_700_000,
    donors_count: 95,
    status: "active",
    is_anonymous: true,
    created_at: "2026-04-10",
    story: "مراهق بعمر 15 يحتاج جراحة دماغية معقّدة قبل تطوّر الورم.",
    treatment_plan: "جراحة + علاج إشعاعي + متابعة 12 شهر.",
  },
  {
    id: "hc-5",
    patient_display_name: "س. ك.",
    patient_age: 4,
    city: "كربلاء",
    disease_type: "pediatric",
    diagnosis: "مرض خلقي بالقلب — يحتاج جراحة قلب مفتوح",
    hospital: "مستشفى الأطفال التخصّصي — كربلاء",
    total_required: 16_500_000,
    amount_collected: 16_500_000,
    donors_count: 234,
    status: "completed",
    is_anonymous: true,
    created_at: "2026-02-15",
    story: "طفلة شُفيت تماماً بعد الجراحة — قصة نجاح.",
  },
  {
    id: "hc-6",
    patient_display_name: "ع. ج.",
    patient_age: 55,
    city: "أربيل",
    disease_type: "cancer",
    diagnosis: "سرطان الرئة — مرحلة 3",
    hospital: "مركز هيوا للسرطان",
    total_required: 28_000_000,
    amount_collected: 19_400_000,
    donors_count: 178,
    status: "active",
    is_anonymous: false,
    created_at: "2026-03-01",
    treatment_plan: "كيماوي + علاج موجّه + إشعاعي.",
  },
  {
    id: "hc-7",
    patient_display_name: "ن. ع.",
    patient_age: 8,
    city: "بغداد",
    disease_type: "transplant",
    diagnosis: "حاجة لزراعة قرنية — العين اليمنى",
    hospital: "مستشفى ابن الهيثم",
    total_required: 7_500_000,
    amount_collected: 3_100_000,
    donors_count: 41,
    status: "active",
    is_anonymous: true,
    created_at: "2026-04-05",
  },
  {
    id: "hc-8",
    patient_display_name: "خ. ر.",
    patient_age: 38,
    city: "السماوة",
    disease_type: "other",
    diagnosis: "حروق بدرجات متفاوتة — تحتاج جراحات تجميلية",
    hospital: "مستشفى الحروق — بغداد",
    total_required: 14_000_000,
    amount_collected: 5_800_000,
    donors_count: 67,
    status: "active",
    is_anonymous: false,
    created_at: "2026-04-08",
  },
  {
    id: "hc-9",
    patient_display_name: "ل. ت.",
    patient_age: 31,
    city: "ديالى",
    disease_type: "kidney",
    diagnosis: "غسيل كلوي — 3 جلسات أسبوعياً",
    hospital: "مستشفى بعقوبة العام",
    total_required: 9_000_000,
    amount_collected: 9_000_000,
    donors_count: 156,
    status: "completed",
    is_anonymous: false,
    created_at: "2026-01-20",
  },
  {
    id: "hc-10",
    patient_display_name: "ح. ج.",
    patient_age: 12,
    city: "الكوت",
    disease_type: "pediatric",
    diagnosis: "كسر مضاعَف بالساق — يحتاج جراحة + علاج طبيعي",
    hospital: "مستشفى الكوت العام",
    total_required: 4_500_000,
    amount_collected: 1_200_000,
    donors_count: 28,
    status: "urgent",
    is_anonymous: true,
    created_at: "2026-04-25",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Mock applications (5)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_HEALTHCARE_APPLICATIONS: HealthcareApplication[] = [
  {
    id: "ha-1",
    user_id: "abc123def456",
    user_name: "أحمد محمد",
    status: "pending",
    disease_type: "heart",
    diagnosis: "ذبحة صدرية — تحتاج فحوصات + قسطرة",
    doctor_name: "د. علي العبيدي",
    hospital: "مركز القلب — بغداد",
    total_cost: 8_000_000,
    user_available: 2_000_000,
    requested_amount: 6_000_000,
    attachments: ["medical_report.pdf", "prescription.pdf", "id_copy.jpg"],
    submitted_at: "2026-04-25",
  },
  {
    id: "ha-2",
    user_id: "u3",
    user_name: "محمد أحمد",
    status: "approved",
    disease_type: "cancer",
    diagnosis: "سرطان قولون مرحلة 2",
    doctor_name: "د. سارة كريم",
    hospital: "مركز الأورام",
    total_cost: 14_500_000,
    user_available: 3_000_000,
    requested_amount: 11_500_000,
    attachments: ["medical.pdf", "scan.jpg"],
    submitted_at: "2026-04-15",
    reviewed_at: "2026-04-18",
  },
  {
    id: "ha-3",
    user_id: "u5",
    user_name: "نور الدين",
    status: "rejected",
    disease_type: "other",
    diagnosis: "علاج تجميلي اختياري",
    doctor_name: "د. خالد",
    hospital: "عيادة خاصّة",
    total_cost: 2_000_000,
    user_available: 0,
    requested_amount: 2_000_000,
    attachments: [],
    submitted_at: "2026-04-10",
    reviewed_at: "2026-04-12",
    rejection_reason: "العلاجات التجميلية الاختيارية خارج نطاق التغطية.",
  },
  {
    id: "ha-4",
    user_id: "u7",
    user_name: "ياسمين كريم",
    status: "pending",
    disease_type: "neurological",
    diagnosis: "صداع نصفي مزمن — يحتاج فحص MRI متخصّص",
    doctor_name: "د. منى الحسني",
    hospital: "مستشفى ابن سينا",
    total_cost: 1_800_000,
    user_available: 500_000,
    requested_amount: 1_300_000,
    attachments: ["referral.pdf"],
    submitted_at: "2026-04-26",
  },
  {
    id: "ha-5",
    user_id: "u10",
    user_name: "هدى صبري",
    status: "approved",
    disease_type: "pediatric",
    diagnosis: "تأخّر نمو لطفلتها — تحتاج علاج طبيعي",
    doctor_name: "د. زينب",
    hospital: "مركز الطفل",
    total_cost: 3_500_000,
    user_available: 1_000_000,
    requested_amount: 2_500_000,
    attachments: ["pediatric.pdf", "lab.pdf"],
    submitted_at: "2026-04-08",
    reviewed_at: "2026-04-10",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Insurance subscriptions (5)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_INSURANCE_PLANS = [
  { plan: "basic" as const,         name: "أساسي",   monthly_fee: 25_000,  coverage_pct: 30, color: "blue" as const },
  { plan: "advanced" as const,      name: "متقدّم",  monthly_fee: 60_000,  coverage_pct: 60, color: "purple" as const },
  { plan: "comprehensive" as const, name: "شامل",    monthly_fee: 120_000, coverage_pct: 90, color: "green" as const },
]

export const MOCK_INSURANCE_SUBSCRIPTIONS: InsuranceSubscription[] = [
  { id: "is-1", user_id: "abc123def456", user_name: "أحمد محمد",  plan: "advanced",      monthly_fee: 60_000,  coverage_pct: 60, started_at: "2026-01-15", next_billing: "2026-05-15", status: "active" },
  { id: "is-2", user_id: "u2",            user_name: "علي حسن",     plan: "comprehensive", monthly_fee: 120_000, coverage_pct: 90, started_at: "2025-11-01", next_billing: "2026-05-01", status: "active" },
  { id: "is-3", user_id: "u3",            user_name: "محمد أحمد",  plan: "basic",         monthly_fee: 25_000,  coverage_pct: 30, started_at: "2026-02-20", next_billing: "2026-05-20", status: "active" },
  { id: "is-4", user_id: "u5",            user_name: "نور الدين",  plan: "advanced",      monthly_fee: 60_000,  coverage_pct: 60, started_at: "2026-03-10", next_billing: "2026-05-10", status: "paused" },
  { id: "is-5", user_id: "u9",            user_name: "هدى صبري",   plan: "basic",         monthly_fee: 25_000,  coverage_pct: 30, started_at: "2025-08-05", next_billing: "—",          status: "cancelled" },
]

// ──────────────────────────────────────────────────────────────────────────
// Donations (15)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_HEALTHCARE_DONATIONS: HealthcareDonation[] = [
  { id: "d1",  donor_id: "abc123def456", donor_name: "أحمد محمد",   case_id: "hc-1",  amount: 50_000,  is_anonymous: false, is_recurring: false, created_at: "2026-04-25 10:30" },
  { id: "d2",  donor_id: "u2",             donor_name: "علي حسن",      case_id: "hc-1",  amount: 100_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-25 09:15" },
  { id: "d3",  donor_id: "u3",             donor_name: "محمد أحمد",   case_id: "hc-2",  amount: 200_000, is_anonymous: true,  is_recurring: false, created_at: "2026-04-24 14:00" },
  { id: "d4",  donor_id: "u5",             donor_name: "نور الدين",   case_id: "hc-3",  amount: 500_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-23 16:30" },
  { id: "d5",  donor_id: "u7",             donor_name: "ياسمين",      amount: 25_000,  is_anonymous: false, is_recurring: true,  created_at: "2026-04-22 11:00" },
  { id: "d6",  donor_id: "u10",            donor_name: "هدى صبري",    case_id: "hc-4",  amount: 75_000,  is_anonymous: false, is_recurring: false, created_at: "2026-04-21 12:45" },
  { id: "d7",  donor_id: "u11",            donor_name: "ليلى ناصر",   amount: 150_000, is_anonymous: true,  is_recurring: false, created_at: "2026-04-20 10:00" },
  { id: "d8",  donor_id: "u15",            donor_name: "فاطمة",       case_id: "hc-2",  amount: 300_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-19 09:30" },
  { id: "d9",  donor_id: "abc123def456", donor_name: "أحمد محمد",   case_id: "hc-3",  amount: 100_000, is_anonymous: false, is_recurring: true,  created_at: "2026-04-18 13:20" },
  { id: "d10", donor_id: "u22",            donor_name: "زيد",          case_id: "hc-4",  amount: 50_000,  is_anonymous: true,  is_recurring: false, created_at: "2026-04-17 15:00" },
  { id: "d11", donor_id: "u23",            donor_name: "هديل",         amount: 200_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-16 10:30" },
  { id: "d12", donor_id: "u4",             donor_name: "سارة محمود", case_id: "hc-1",  amount: 100_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-15 14:15" },
  { id: "d13", donor_id: "u6",             donor_name: "زين",          case_id: "hc-6",  amount: 250_000, is_anonymous: false, is_recurring: false, created_at: "2026-04-14 11:45" },
  { id: "d14", donor_id: "u20",            donor_name: "عمر",          case_id: "hc-2",  amount: 80_000,  is_anonymous: true,  is_recurring: false, created_at: "2026-04-13 16:00" },
  { id: "d15", donor_id: "abc123def456", donor_name: "أحمد محمد",   amount: 50_000,  is_anonymous: false, is_recurring: true,  created_at: "2026-04-12 09:00" },
]

// ──────────────────────────────────────────────────────────────────────────
// Success stories + Awareness articles
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_SUCCESS_STORIES: SuccessStory[] = [
  { id: "ss-1", patient_initial: "س. ك.", disease: "مرض خلقي بالقلب",  story: "طفلة شُفيت تماماً بعد جراحة قلب مفتوح. تتمتّع الآن بحياة طبيعية.", amount_raised: 16_500_000, date: "2026-02-15" },
  { id: "ss-2", patient_initial: "ل. ت.", disease: "فشل كلوي",           story: "أكملت 18 شهراً من الغسيل بدعم البرنامج، وحصلت على متبرّع متوافق.", amount_raised: 9_000_000, date: "2026-01-20" },
  { id: "ss-3", patient_initial: "ك. ر.", disease: "سرطان غدّة درقية",  story: "بعد 12 جلسة علاج، النتائج إيجابية بنسبة 95%.",                       amount_raised: 13_200_000, date: "2025-12-10" },
]

export const MOCK_AWARENESS_ARTICLES: AwarenessArticle[] = [
  { id: "a1", title: "10 علامات مبكّرة لسرطان الثدي",       excerpt: "الكشف المبكّر يرفع نسبة الشفاء لـ 95%. تعرّف على العلامات...",  category: "سرطان",     read_time_min: 4, published_at: "2026-04-20" },
  { id: "a2", title: "كيف تقي قلبك من النوبات",                excerpt: "نصائح طبية بسيطة من أطباء القلب لحماية صحة قلبك...",                category: "قلب",        read_time_min: 5, published_at: "2026-04-18" },
  { id: "a3", title: "السكّري: الوقاية والعلاج",                  excerpt: "كيف تتعرّف على أعراض السكّري في مراحله الأولى وتمنع تطوّره؟",      category: "سكّري",      read_time_min: 6, published_at: "2026-04-15" },
  { id: "a4", title: "صحّة الأطفال في الصيف",                    excerpt: "احتياطات الصيف للأطفال + تغذية + ترطيب.",                              category: "أطفال",      read_time_min: 3, published_at: "2026-04-12" },
  { id: "a5", title: "الفحوصات الدورية: متى ولماذا؟",           excerpt: "دليل الفحوصات الدورية حسب العمر للنساء والرجال.",                     category: "وقاية",      read_time_min: 7, published_at: "2026-04-08" },
  { id: "a6", title: "الصحّة النفسية والإجهاد",                    excerpt: "كيف تتعامل مع ضغوط الحياة وتحافظ على صحّتك النفسية؟",            category: "نفسي",       read_time_min: 5, published_at: "2026-04-05" },
]

// ──────────────────────────────────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────────────────────────────────
export const DISEASE_LABELS: Record<DiseaseType, { label: string; icon: string }> = {
  cancer:       { label: "أورام / سرطان",   icon: "🎗️" },
  heart:        { label: "أمراض القلب",     icon: "❤️" },
  kidney:       { label: "أمراض الكلى",     icon: "💧" },
  neurological: { label: "أعصاب",             icon: "🧠" },
  pediatric:    { label: "أطفال",              icon: "👶" },
  transplant:   { label: "زراعة أعضاء",      icon: "🩺" },
  other:        { label: "أخرى",              icon: "🏥" },
}

export const CASE_STATUS_LABELS: Record<CaseStatus, { label: string; color: "red" | "yellow" | "green" }> = {
  urgent:    { label: "عاجلة",    color: "red"    },
  active:    { label: "نشطة",     color: "yellow" },
  completed: { label: "مُكتملة", color: "green"  },
}

export const APP_STATUS_LABELS: Record<AppStatus, { label: string; color: "yellow" | "green" | "red" }> = {
  pending:  { label: "قيد المراجعة", color: "yellow" },
  approved: { label: "مُوافَق",       color: "green"  },
  rejected: { label: "مرفوض",         color: "red"    },
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function getActiveCases(): HealthcareCase[] {
  return MOCK_HEALTHCARE_CASES.filter((c) => c.status !== "completed")
}

export function getUrgentCases(limit: number = 5): HealthcareCase[] {
  return MOCK_HEALTHCARE_CASES.filter((c) => c.status === "urgent").slice(0, limit)
}

export function getCaseById(id: string): HealthcareCase | undefined {
  return MOCK_HEALTHCARE_CASES.find((c) => c.id === id)
}

export function getCaseDonors(caseId: string): HealthcareDonation[] {
  return MOCK_HEALTHCARE_DONATIONS
    .filter((d) => d.case_id === caseId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export function getMyApplications(userId: string = "abc123def456"): HealthcareApplication[] {
  return MOCK_HEALTHCARE_APPLICATIONS.filter((a) => a.user_id === userId)
}

export function getMyInsurance(userId: string = "abc123def456"): InsuranceSubscription | undefined {
  return MOCK_INSURANCE_SUBSCRIPTIONS.find((s) => s.user_id === userId && s.status === "active")
}

export function getMyDonations(userId: string = "abc123def456"): HealthcareDonation[] {
  return MOCK_HEALTHCARE_DONATIONS.filter((d) => d.donor_id === userId)
}

export function submitHealthcareApplication(_userId: string, _data: Partial<HealthcareApplication>) {
  return { success: true, application_id: `ha-${Date.now()}`, status: "pending" as const }
}

export function makeDonation(_donorId: string, _data: { case_id?: string; amount: number; is_anonymous: boolean; is_recurring: boolean }) {
  return { success: true, donation_id: `d-${Date.now()}` }
}

export function subscribeInsurance(_userId: string, _plan: InsurancePlan) {
  return { success: true, subscription_id: `is-${Date.now()}` }
}

export function getHealthcareStats() {
  const cases = MOCK_HEALTHCARE_CASES
  const donations = MOCK_HEALTHCARE_DONATIONS
  return {
    total_donated: donations.reduce((s, d) => s + d.amount, 0),
    cases_completed: cases.filter((c) => c.status === "completed").length,
    cases_active: cases.filter((c) => c.status !== "completed").length,
    insurance_subscribers: MOCK_INSURANCE_SUBSCRIPTIONS.filter((s) => s.status === "active").length,
    donors_count: new Set(donations.map((d) => d.donor_id)).size,
  }
}
