/**
 * Orphans care program — children + sponsorships + reports.
 * Used by /orphans/* pages + /admin?tab=orphans_admin.
 */

export type ChildGender = "male" | "female"
export type ChildSponsorshipStatus = "needs_sponsor" | "partial" | "fully_sponsored"
export type SponsorshipType = "monthly" | "annual" | "onetime"
export type SponsorshipStatus = "active" | "ended"
export type EducationLevel = "kindergarten" | "primary" | "intermediate" | "secondary" | "university"

export interface OrphanChild {
  id: string
  first_name: string  // first name only for privacy
  age: number
  gender: ChildGender
  city: string
  story: string
  needs_amount_monthly: number
  sponsored_amount: number
  sponsors_count: number
  status: ChildSponsorshipStatus
  blur_photo: boolean  // flag — actual UI handles blur
  photo_url?: string
  education_level: EducationLevel
  health_status: "good" | "monitoring" | "needs_care"
}

export interface Sponsorship {
  id: string
  sponsor_id: string
  sponsor_name: string
  child_id: string
  child_first_name: string
  type: SponsorshipType
  amount: number
  duration_months: number
  status: SponsorshipStatus
  started_at: string
  ends_at?: string
  is_anonymous: boolean
  receive_reports: boolean
}

export interface OrphanReport {
  id: string
  child_id: string
  child_first_name: string
  sponsor_id: string
  period: string  // "Q1 2026" / "March 2026"
  education_progress: string
  health_status: string
  highlights: string
  photos_count: number
  sent_at: string
}

export interface OrphanTestimonial {
  id: string
  sponsor_name: string
  text: string
  duration_months: number
  date: string
}

// ──────────────────────────────────────────────────────────────────────────
// Children (12)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_ORPHAN_CHILDREN: OrphanChild[] = [
  { id: "ch-1",  first_name: "أحمد",    age: 7,  gender: "male",   city: "بغداد",   story: "فقد والديه في حادث طريق. يعيش الآن مع جدّته. متفوّق دراسياً ويحبّ كرة القدم.",                                       needs_amount_monthly: 100_000, sponsored_amount: 0,        sponsors_count: 0,  status: "needs_sponsor", blur_photo: true,  education_level: "primary",      health_status: "good" },
  { id: "ch-2",  first_name: "زينب",   age: 5,  gender: "female", city: "البصرة",  story: "والدها متوفى ووالدتها مريضة. تحبّ الرسم. تحضر روضة في المركز الاجتماعي.",                                                       needs_amount_monthly: 80_000,  sponsored_amount: 80_000,   sponsors_count: 1,  status: "fully_sponsored", blur_photo: true, education_level: "kindergarten", health_status: "good" },
  { id: "ch-3",  first_name: "محمد",   age: 10, gender: "male",   city: "الموصل",  story: "فقد والده وأمّه. مع عمّه. ذكي جداً ويحلم بأن يصبح مهندساً.",                                                                              needs_amount_monthly: 120_000, sponsored_amount: 70_000,   sponsors_count: 2,  status: "partial",        blur_photo: false, education_level: "primary",      health_status: "good" },
  { id: "ch-4",  first_name: "فاطمة",  age: 12, gender: "female", city: "كربلاء",  story: "بعد فقد والدها، انتقلت مع والدتها للعيش مع جدّها. تتفوّق في الرياضيات والإنجليزية.",                                                  needs_amount_monthly: 150_000, sponsored_amount: 150_000,  sponsors_count: 1,  status: "fully_sponsored", blur_photo: true, education_level: "intermediate", health_status: "good" },
  { id: "ch-5",  first_name: "علي",    age: 8,  gender: "male",   city: "النجف",   story: "والده متوفى منذ 3 سنوات. والدته تعمل بأجر بسيط. يحتاج دعماً تعليمياً ومعيشياً.",                                                              needs_amount_monthly: 100_000, sponsored_amount: 35_000,   sponsors_count: 1,  status: "partial",        blur_photo: true,  education_level: "primary",      health_status: "good" },
  { id: "ch-6",  first_name: "هدى",   age: 14, gender: "female", city: "أربيل",   story: "يتيمة الأبوين، تعيش مع جدّتها. متفوّقة في المدرسة وتطمح للجامعة.",                                                                                  needs_amount_monthly: 180_000, sponsored_amount: 0,        sponsors_count: 0,  status: "needs_sponsor", blur_photo: false, education_level: "secondary",    health_status: "good" },
  { id: "ch-7",  first_name: "عمر",    age: 6,  gender: "male",   city: "بغداد",   story: "فقد والديه في حادث. يعيش مع خالته. طفل لطيف يحبّ القراءة.",                                                                                                  needs_amount_monthly: 90_000,  sponsored_amount: 90_000,   sponsors_count: 2,  status: "fully_sponsored", blur_photo: true, education_level: "primary",      health_status: "monitoring" },
  { id: "ch-8",  first_name: "ساره",   age: 9,  gender: "female", city: "ديالى",   story: "والدها استشهد في الحرب. والدتها رغم الصعوبات حريصة على تعليمها.",                                                                                       needs_amount_monthly: 110_000, sponsored_amount: 50_000,   sponsors_count: 1,  status: "partial",        blur_photo: true,  education_level: "primary",      health_status: "good" },
  { id: "ch-9",  first_name: "حسين",  age: 16, gender: "male",   city: "السماوة", story: "يتيم الأبوين. يدرس في الثانوية ويتفوّق في الفيزياء. هدفه دخول الجامعة.",                                                                                  needs_amount_monthly: 200_000, sponsored_amount: 0,        sponsors_count: 0,  status: "needs_sponsor", blur_photo: false, education_level: "secondary",    health_status: "good" },
  { id: "ch-10", first_name: "ميس",   age: 4,  gender: "female", city: "الكوت",   story: "صغيرة جداً، فقدت والديها بمرض. تعيش مع جدّتها وعمّها.",                                                                                                                 needs_amount_monthly: 70_000,  sponsored_amount: 70_000,   sponsors_count: 1,  status: "fully_sponsored", blur_photo: true, education_level: "kindergarten", health_status: "good" },
  { id: "ch-11", first_name: "ياسر",  age: 11, gender: "male",   city: "الفلوجة", story: "فقد والديه. لديه أخ أصغر. يحتاج دعم تعليمي ومعيشي للأسرة.",                                                                                                       needs_amount_monthly: 130_000, sponsored_amount: 40_000,   sponsors_count: 1,  status: "partial",        blur_photo: true,  education_level: "primary",      health_status: "needs_care" },
  { id: "ch-12", first_name: "ريم",    age: 18, gender: "female", city: "بغداد",   story: "في السنة الأولى من الجامعة (طبّ). يتيمة الأبوين وتسعى لتحقيق حلم والدها.",                                                                              needs_amount_monthly: 250_000, sponsored_amount: 100_000,  sponsors_count: 2,  status: "partial",        blur_photo: false, education_level: "university",   health_status: "good" },
]

// ──────────────────────────────────────────────────────────────────────────
// Sponsorships (7)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_SPONSORSHIPS: Sponsorship[] = [
  { id: "sp-1", sponsor_id: "abc123def456", sponsor_name: "أحمد محمد",  child_id: "ch-3",  child_first_name: "محمد", type: "monthly", amount: 70_000,  duration_months: 12, status: "active", started_at: "2026-02-01", is_anonymous: false, receive_reports: true  },
  { id: "sp-2", sponsor_id: "abc123def456", sponsor_name: "أحمد محمد",  child_id: "ch-12", child_first_name: "ريم",   type: "monthly", amount: 100_000, duration_months: 24, status: "active", started_at: "2026-01-10", is_anonymous: false, receive_reports: true  },
  { id: "sp-3", sponsor_id: "u2",            sponsor_name: "علي حسن",     child_id: "ch-2",  child_first_name: "زينب", type: "monthly", amount: 80_000,  duration_months: 12, status: "active", started_at: "2026-03-01", is_anonymous: true,  receive_reports: false },
  { id: "sp-4", sponsor_id: "u2",            sponsor_name: "علي حسن",     child_id: "ch-4",  child_first_name: "فاطمة", type: "annual",  amount: 1_800_000, duration_months: 12, status: "active", started_at: "2026-01-15", is_anonymous: false, receive_reports: true  },
  { id: "sp-5", sponsor_id: "u3",            sponsor_name: "محمد أحمد",  child_id: "ch-5",  child_first_name: "علي",   type: "monthly", amount: 35_000,  duration_months: 6,  status: "active", started_at: "2026-04-01", is_anonymous: false, receive_reports: true  },
  { id: "sp-6", sponsor_id: "u5",            sponsor_name: "نور الدين",  child_id: "ch-7",  child_first_name: "عمر",   type: "monthly", amount: 90_000,  duration_months: 12, status: "active", started_at: "2026-02-15", is_anonymous: true,  receive_reports: false },
  { id: "sp-7", sponsor_id: "u4",            sponsor_name: "سارة محمود",child_id: "ch-8",  child_first_name: "ساره", type: "onetime", amount: 50_000,  duration_months: 1,  status: "ended",  started_at: "2026-03-20", ends_at: "2026-04-20", is_anonymous: false, receive_reports: false },
]

// ──────────────────────────────────────────────────────────────────────────
// Reports (10)
// ──────────────────────────────────────────────────────────────────────────
export const MOCK_ORPHAN_REPORTS: OrphanReport[] = [
  { id: "r1",  child_id: "ch-3",  child_first_name: "محمد", sponsor_id: "abc123def456", period: "مارس 2026",   education_progress: "حاصل على معدّل 92% في الفصل الأول",       health_status: "صحّة ممتازة",                  highlights: "فاز بمسابقة كرة قدم مدرسية",                            photos_count: 3, sent_at: "2026-04-01" },
  { id: "r2",  child_id: "ch-12", child_first_name: "ريم",   sponsor_id: "abc123def456", period: "فبراير 2026", education_progress: "اجتازت اختبارات منتصف الفصل بتفوّق",     health_status: "بصحّة جيدة",                       highlights: "اختيرت ضمن فريق الجامعة الطبّي للتطوّع",                photos_count: 2, sent_at: "2026-03-05" },
  { id: "r3",  child_id: "ch-3",  child_first_name: "محمد", sponsor_id: "abc123def456", period: "فبراير 2026", education_progress: "تحسّن في مادتي الرياضيات والإنجليزية", health_status: "صحّة جيدة، فحص دوري نظيف",  highlights: "بدأ يحبّ القراءة ويستعير كتباً من المدرسة",            photos_count: 4, sent_at: "2026-03-01" },
  { id: "r4",  child_id: "ch-2",  child_first_name: "زينب", sponsor_id: "u2",            period: "مارس 2026",   education_progress: "تطوّر ملحوظ في النطق والمفردات",        health_status: "صحّة ممتازة",                  highlights: "رسوماتها معلّقة في صفّ الروضة",                                       photos_count: 5, sent_at: "2026-04-02" },
  { id: "r5",  child_id: "ch-4",  child_first_name: "فاطمة", sponsor_id: "u2",            period: "مارس 2026",   education_progress: "الأولى على الصف في الرياضيات",            health_status: "صحّة جيدة",                       highlights: "حضرت دورة قيادة للفتيات",                                                   photos_count: 3, sent_at: "2026-04-03" },
  { id: "r6",  child_id: "ch-5",  child_first_name: "علي",   sponsor_id: "u3",            period: "أبريل 2026",  education_progress: "بداية تحسّن في الواجبات",                       health_status: "صحّة جيدة",                       highlights: "بدأ نشاطاً رياضياً",                                                                   photos_count: 2, sent_at: "2026-04-25" },
  { id: "r7",  child_id: "ch-7",  child_first_name: "عمر",   sponsor_id: "u5",            period: "مارس 2026",   education_progress: "أوّل في صفّه — مكافأة من المدرسة",       health_status: "تحت متابعة لخفقان بسيط",  highlights: "حضر مخيّماً صيفياً تعليمياً",                                                          photos_count: 4, sent_at: "2026-04-04" },
  { id: "r8",  child_id: "ch-12", child_first_name: "ريم",   sponsor_id: "abc123def456", period: "يناير 2026",  education_progress: "اجتازت السنة التمهيدية بتفوّق",                health_status: "صحّة ممتازة",                  highlights: "حصلت على منحة جزئية للسنة الثانية",                                       photos_count: 1, sent_at: "2026-02-05" },
  { id: "r9",  child_id: "ch-2",  child_first_name: "زينب", sponsor_id: "u2",            period: "فبراير 2026", education_progress: "بدأت تتعلّم الحروف والأرقام",                health_status: "صحّة ممتازة",                  highlights: "أحبّت اللوحات التعليمية",                                                              photos_count: 6, sent_at: "2026-03-04" },
  { id: "r10", child_id: "ch-3",  child_first_name: "محمد", sponsor_id: "abc123def456", period: "يناير 2026",  education_progress: "تكيّف ممتاز مع الفصل الجديد",                health_status: "صحّة جيدة",                       highlights: "كوّن صداقات جديدة وبدأ يشارك بشكل أكبر",                                  photos_count: 3, sent_at: "2026-02-01" },
]

// ──────────────────────────────────────────────────────────────────────────
// Plans + Testimonials
// ──────────────────────────────────────────────────────────────────────────
export const SPONSORSHIP_PLANS = [
  { id: "basic",         name: "أساسي",  monthly: 50_000,  covers: ["مصروف يومي", "كتب مدرسية"],                                color: "blue" as const },
  { id: "advanced",      name: "متقدّم", monthly: 100_000, covers: ["مصروف", "كتب", "ملابس", "نقل"],                              color: "purple" as const },
  { id: "comprehensive", name: "شامل",   monthly: 200_000, covers: ["كلّ شيء", "تعليم خاص", "نشاطات", "صحّة كاملة"], color: "green" as const },
]

export const MOCK_TESTIMONIALS: OrphanTestimonial[] = [
  { id: "t1", sponsor_name: "علي ح.",  text: "كفالة فاطمة كانت من أجمل قراراتي. أرى تطوّرها كل تقرير وأشعر بالفخر.",        duration_months: 14, date: "2026-04-10" },
  { id: "t2", sponsor_name: "محمد أ.", text: "بدأت بمبلغ بسيط لعلي وزاد التزامي شيئاً فشيئاً. تجربة إنسانية تستحق.",                duration_months: 1,  date: "2026-04-15" },
  { id: "t3", sponsor_name: "نور د.",   text: "العلاقة مع عمر تطوّرت لما هو أكثر من مجرد كفالة — هو الآن جزء من عائلتنا.", duration_months: 26, date: "2026-04-05" },
]

// ──────────────────────────────────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────────────────────────────────
export const CHILD_STATUS_LABELS: Record<ChildSponsorshipStatus, { label: string; color: "red" | "yellow" | "green" }> = {
  needs_sponsor:    { label: "يحتاج كفالة",       color: "red"    },
  partial:          { label: "مكفول جزئياً",       color: "yellow" },
  fully_sponsored:  { label: "مكفول بالكامل",     color: "green"  },
}

export const SPONSORSHIP_TYPE_LABELS: Record<SponsorshipType, string> = {
  monthly:  "شهري",
  annual:   "سنوي",
  onetime:  "لمرة واحدة",
}

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  kindergarten: "روضة",
  primary:      "ابتدائي",
  intermediate: "متوسط",
  secondary:    "ثانوي",
  university:   "جامعي",
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function getAvailableChildren(): OrphanChild[] {
  return MOCK_ORPHAN_CHILDREN.filter((c) => c.status !== "fully_sponsored")
}

export function getChildById(id: string): OrphanChild | undefined {
  return MOCK_ORPHAN_CHILDREN.find((c) => c.id === id)
}

export function getMySponsorships(userId: string = "abc123def456"): Sponsorship[] {
  return MOCK_SPONSORSHIPS.filter((s) => s.sponsor_id === userId)
}

export function getSponsorshipsByChild(childId: string): Sponsorship[] {
  return MOCK_SPONSORSHIPS.filter((s) => s.child_id === childId)
}

export function getReportsByChild(childId: string): OrphanReport[] {
  return MOCK_ORPHAN_REPORTS
    .filter((r) => r.child_id === childId)
    .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
}

export function getMyReports(userId: string = "abc123def456"): OrphanReport[] {
  return MOCK_ORPHAN_REPORTS
    .filter((r) => r.sponsor_id === userId)
    .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
}

export function sponsorChild(_userId: string, _data: Partial<Sponsorship>) {
  return { success: true, sponsorship_id: `sp-${Date.now()}` }
}

export function donateOrphan(_userId: string, _amount: number, _isAnonymous: boolean) {
  return { success: true, donation_id: `od-${Date.now()}` }
}

export function getOrphansStats() {
  return {
    total_children: MOCK_ORPHAN_CHILDREN.length,
    sponsored: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "fully_sponsored").length,
    partial: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "partial").length,
    needs_sponsor: MOCK_ORPHAN_CHILDREN.filter((c) => c.status === "needs_sponsor").length,
    sponsors_count: new Set(MOCK_SPONSORSHIPS.map((s) => s.sponsor_id)).size,
    total_donated: MOCK_SPONSORSHIPS.filter((s) => s.status === "active").reduce((acc, s) => acc + s.amount, 0),
  }
}
