/**
 * /support — FAQs, tickets, and user support messages.
 */

import type { SupportMessage } from "./types"

// ──────────────────────────────────────────────────────────────────────────
// User's previous support messages (legacy — used by old support page)
// ──────────────────────────────────────────────────────────────────────────
export const mockMessages: SupportMessage[] = [
  {
    id: "1",
    subject: "مشكلة في تأكيد صفقة #1247",
    message: "الصفقة عالقة منذ ساعتين ولا يمكنني تأكيدها",
    type: "صفقة معلقة",
    priority: "high",
    status: "replied",
    created_at: "2026-04-25",
  },
  {
    id: "2",
    subject: "استفسار عن الترقية",
    message: "متى يتم ترقيتي للمستوى المتقدم؟",
    type: "استفسار عام",
    priority: "low",
    status: "new",
    created_at: "2026-04-23",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// FAQ system
// ──────────────────────────────────────────────────────────────────────────
export const FAQ_CATEGORIES = [
  "عام", "الاستثمار", "المحفظة", "العقود", "التوثيق", "الرسوم", "الأمان",
] as const
export type FAQCategory = (typeof FAQ_CATEGORIES)[number]

export interface FAQ {
  id: string
  category: FAQCategory
  question: string
  answer: string
  helpful_count?: number
}

export const FAQS: FAQ[] = [
  // عام
  { id: "f1", category: "عام", question: "ما هي منصة رايلوس؟", answer: "رايلوس هي منصة استثمارية رقمية عراقية تتيح لك شراء وبيع حصص استثمارية في مشاريع موثّقة في قطاعات متعدّدة (زراعة، عقارات، صناعة، تجارة) مع شفافية كاملة وعمولات منخفضة.", helpful_count: 142 },
  { id: "f2", category: "عام", question: "هل المنصة آمنة؟", answer: "نعم. نستخدم تشفيراً متقدّماً (TLS 1.3 + AES-256) لحماية بياناتك. كل المعاملات موثّقة، والمشاريع تخضع لتدقيق دوري قبل عرضها.", helpful_count: 98 },
  { id: "f3", category: "عام", question: "كيف أتواصل مع الدعم؟", answer: "يمكنك التواصل عبر: WhatsApp (+964 770 1234567)، Email (railostrade@gmail.com)، أو إرسال طلب دعم مباشرة من هذه الصفحة.", helpful_count: 67 },

  // الاستثمار
  { id: "f4", category: "الاستثمار", question: "كيف أبدأ الاستثمار؟", answer: "للبدء: 1) أكمل التوثيق KYC، 2) ادخل /market لاستعراض المشاريع، 3) اختر مشروعاً يناسبك، 4) اضغط 'استثمر الآن' وحدّد عدد الحصص. لا حد أدنى للاستثمار.", helpful_count: 215 },
  { id: "f5", category: "الاستثمار", question: "ما الحد الأدنى للاستثمار؟", answer: "لا يوجد حد أدنى — يمكنك شراء حصة واحدة فقط. سعر الحصة يتراوح بين 80,000 - 250,000 د.ع حسب المشروع.", helpful_count: 178 },
  { id: "f6", category: "الاستثمار", question: "متى أستلم أرباحي؟", answer: "حسب نوع المشروع: ربحي (كل 3 أشهر) / نصف سنوي / سنوي. تُحوَّل الأرباح تلقائياً لمحفظتك ويظهر إشعار بالاستلام.", helpful_count: 156 },
  { id: "f7", category: "الاستثمار", question: "هل يمكنني بيع حصصي قبل انتهاء المشروع؟", answer: "نعم. يمكنك بيعها عبر السوق الثانوية (/exchange) لمستثمرين آخرين، أو استخدام Quick Sell للبيع الفوري بخصم.", helpful_count: 134 },

  // المحفظة
  { id: "f8", category: "المحفظة", question: "كيف أرى محفظتي؟", answer: "اذهب إلى /portfolio لرؤية: كل حصصك + قيمتها الحالية + أرباحك + سجل المعاملات + الحدود الشهرية.", helpful_count: 89 },
  { id: "f9", category: "المحفظة", question: "ما هي 'الحدود الشهرية'؟", answer: "كل مستوى مستثمر له حد شهري للبيع/الشراء: أساسي (10M د.ع) / متقدم (50M) / محترف (250M). الانضمام لعقد جماعي يزيد الحد بنسبة 25%.", helpful_count: 102 },
  { id: "f10", category: "المحفظة", question: "كيف أرفع مستواي؟", answer: "الترقية تلقائية: للمتقدم تحتاج 100 صفقة ناجحة + KYC مكتمل + معدل نجاح 95%+. للمحترف 500 صفقة + 98% نجاح.", helpful_count: 87 },

  // العقود
  { id: "f11", category: "العقود", question: "ما هي العقود الجماعية؟", answer: "العقد الجماعي = شراكة مع 2-7 مستثمرين. مجموعها يضرب في 1.25 (مكافأة) كحد شهري جماعي. مفيد للاستثمارات الكبيرة.", helpful_count: 76 },
  { id: "f12", category: "العقود", question: "هل يمكنني الانسحاب من عقد؟", answer: "قبل تفعيل العقد: نعم، بدون رسوم. بعد التفعيل: يحتاج موافقة الشركاء + رسم انسحاب 2%.", helpful_count: 54 },

  // التوثيق
  { id: "f13", category: "التوثيق", question: "ما هو KYC؟", answer: "KYC = Know Your Customer. عملية التحقّق من هويتك (هوية + سيلفي) لضمان أمان المنصة وفتح كل الميزات. تأخذ 24-48 ساعة.", helpful_count: 203 },
  { id: "f14", category: "التوثيق", question: "ماذا أحتاج للتوثيق؟", answer: "1) صورة هوية أحوال مدنية أو جواز سفر (واضحة من الجهتين)، 2) سيلفي بيدك تحمل الهوية. كل شي تلقائي عبر التطبيق.", helpful_count: 167 },

  // الرسوم
  { id: "f15", category: "الرسوم", question: "ما هي العمولة؟", answer: "عمولة ثابتة 2% على كل صفقة بيع/شراء (شرعية، غير قابلة للتفاوض). لا توجد رسوم خفية.", helpful_count: 189 },
  { id: "f16", category: "الرسوم", question: "ما هي 'وحدات الرسوم'؟", answer: "وحدات تستخدم لدفع رسوم الإعلانات (إدراج 1500 / مزاد 2500 / quick-sell 5000). تُشحن من الإدارة.", helpful_count: 92 },

  // الأمان
  { id: "f17", category: "الأمان", question: "كيف أحمي حسابي؟", answer: "1) كلمة مرور قوية (8+ أحرف + رموز)، 2) لا تشاركها مع أحد، 3) فعّل المصادقة الثنائية إذا متاحة، 4) سجّل خروج من الأجهزة العامة.", helpful_count: 156 },
  { id: "f18", category: "الأمان", question: "ماذا لو نسيت كلمة المرور؟", answer: "اضغط 'نسيت كلمة المرور' في صفحة تسجيل الدخول. سنرسل رابط إعادة تعيين على بريدك خلال دقائق.", helpful_count: 98 },
]

/** Get all FAQs in a specific category. */
export function getFAQsByCategory(category: FAQCategory): FAQ[] {
  return FAQS.filter((f) => f.category === category)
}

/** Search FAQs by question text or answer. */
export function searchFAQs(query: string): FAQ[] {
  if (!query.trim()) return FAQS
  const q = query.toLowerCase().trim()
  return FAQS.filter(
    (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Support tickets
// ──────────────────────────────────────────────────────────────────────────
export type TicketStatus = "open" | "answered" | "closed"
export type TicketPriority = "low" | "medium" | "high"

export interface SupportTicket {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  last_update: string
}

export const USER_TICKETS: SupportTicket[] = [
  {
    id: "t1",
    subject: "استفسار عن صفقة معلّقة",
    status: "answered",
    priority: "medium",
    created_at: "2026-04-20",
    last_update: "2026-04-22",
  },
  {
    id: "t2",
    subject: "تأخّر التوزيع الربعي",
    status: "open",
    priority: "high",
    created_at: "2026-04-18",
    last_update: "2026-04-19",
  },
  {
    id: "t3",
    subject: "اقتراح: إضافة مشاريع طبية",
    status: "closed",
    priority: "low",
    created_at: "2026-03-15",
    last_update: "2026-03-25",
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Admin-side: full ticket schema (with body, replies, assignee, category)
// Used by /admin?tab=support_inbox
// ──────────────────────────────────────────────────────────────────────────
export type AdminTicketCategory = "technical" | "billing" | "kyc" | "complaint" | "feature_request" | "other"
export type AdminTicketStatus = "new" | "in_progress" | "replied" | "closed"
export type AdminTicketPriority = "low" | "medium" | "high"

export interface AdminTicketReply {
  id: string
  sender_type: "user" | "admin"
  sender_name: string
  sender_role?: string
  body: string
  attachments?: string[]
  created_at: string
}

export interface AdminSupportTicket {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_level: "basic" | "advanced" | "pro"
  user_kyc_status: "verified" | "pending" | "rejected" | "not_submitted"
  subject: string
  body: string
  category: AdminTicketCategory
  priority: AdminTicketPriority
  status: AdminTicketStatus
  assigned_to?: string
  assigned_to_name?: string
  replies: AdminTicketReply[]
  created_at: string
  updated_at: string
  closed_at?: string
  closed_reason?: string
}

export const ADMIN_SUPPORT_TICKETS: AdminSupportTicket[] = [
  {
    id: "TKT-001",
    user_id: "u1",
    user_name: "أحمد محمد",
    user_email: "ahmed.m@example.com",
    user_level: "advanced",
    user_kyc_status: "verified",
    subject: "مشكلة في تأكيد صفقة #1247",
    body: "السلام عليكم،\n\nقمت بدفع المبلغ كاملاً قبل ساعتين عبر زين كاش، ورفعت الإيصال، لكن الصفقة لا تزال معلّقة. الرجاء المساعدة بأسرع وقت.",
    category: "billing",
    priority: "high",
    status: "new",
    replies: [],
    created_at: "2026-04-25 14:00",
    updated_at: "2026-04-25 14:00",
  },
  {
    id: "TKT-002",
    user_id: "u2",
    user_name: "علي حسن",
    user_email: "ali.h@example.com",
    user_level: "pro",
    user_kyc_status: "verified",
    subject: "استفسار عن الترقية للمستوى المتقدّم",
    body: "كم صفقة أحتاج لأرقّى؟ وما الشروط بالضبط؟",
    category: "other",
    priority: "low",
    status: "replied",
    assigned_to: "a2",
    assigned_to_name: "Admin@1",
    replies: [
      {
        id: "rep-1",
        sender_type: "admin",
        sender_name: "Admin@1",
        sender_role: "admin",
        body: "أهلاً علي،\n\nللترقية إلى المستوى المتقدّم تحتاج:\n- 100 صفقة ناجحة\n- KYC مكتمل ✅ (لديك)\n- معدّل نجاح 95%+\n\nيمكنك متابعة تقدّمك في صفحة الملف الشخصي.",
        created_at: "2026-04-24 11:00",
      },
    ],
    created_at: "2026-04-24 10:30",
    updated_at: "2026-04-24 11:00",
  },
  {
    id: "TKT-003",
    user_id: "u3",
    user_name: "محمد أحمد",
    user_email: "mohammed.a@example.com",
    user_level: "advanced",
    user_kyc_status: "verified",
    subject: "مشكلة في تحميل صور KYC",
    body: "حاولت رفع صور الهوية 3 مرات والصور لا ترفع. الإنترنت قوي والصور حجمها أقل من 2MB.",
    category: "technical",
    priority: "medium",
    status: "in_progress",
    assigned_to: "a3",
    assigned_to_name: "Admin@2",
    replies: [
      {
        id: "rep-2",
        sender_type: "admin",
        sender_name: "Admin@2",
        sender_role: "moderator",
        body: "تم تصعيد المشكلة للفريق التقني. سنعود إليك خلال ساعة.",
        created_at: "2026-04-23 17:00",
      },
    ],
    created_at: "2026-04-23 16:45",
    updated_at: "2026-04-23 17:00",
  },
  {
    id: "TKT-004",
    user_id: "u4",
    user_name: "سارة محمود",
    user_email: "sara.m@example.com",
    user_level: "basic",
    user_kyc_status: "pending",
    subject: "اقتراح ميزة جديدة: المفضّلة",
    body: "أتمنى إضافة ميزة المفضّلة للمشاريع لمتابعتها بسهولة.",
    category: "feature_request",
    priority: "low",
    status: "new",
    replies: [],
    created_at: "2026-04-25 09:00",
    updated_at: "2026-04-25 09:00",
  },
  {
    id: "TKT-005",
    user_id: "u5",
    user_name: "نور الدين",
    user_email: "noureldin@example.com",
    user_level: "pro",
    user_kyc_status: "verified",
    subject: "تأخّر التوزيع الربعي لمشروع برج بغداد",
    body: "تأخّر التوزيع 14 يوماً عن الموعد المحدّد. هذا غير مقبول لمستثمر بهذا الحجم.",
    category: "complaint",
    priority: "high",
    status: "in_progress",
    assigned_to: "a1",
    assigned_to_name: "Admin@Main",
    replies: [
      {
        id: "rep-3",
        sender_type: "admin",
        sender_name: "Admin@Main",
        sender_role: "founder",
        body: "نعتذر عن التأخير. تم الاجتماع مع شركة المشروع وستتم تحويل التوزيعات خلال 48 ساعة + تعويض مالي رمزي.",
        created_at: "2026-04-22 14:00",
      },
      {
        id: "rep-4",
        sender_type: "user",
        sender_name: "نور الدين",
        body: "شكراً للمتابعة، سأنتظر التحويل وأبلغ عن الاستلام.",
        created_at: "2026-04-22 14:30",
      },
    ],
    created_at: "2026-04-20 09:00",
    updated_at: "2026-04-22 14:30",
  },
  {
    id: "TKT-006",
    user_id: "u7",
    user_name: "ياسمين كريم",
    user_email: "yasmin.k@example.com",
    user_level: "basic",
    user_kyc_status: "pending",
    subject: "متى يتم توثيق حسابي؟",
    body: "قدّمت طلب KYC قبل 5 أيام ولم أحصل على رد بعد.",
    category: "kyc",
    priority: "medium",
    status: "new",
    replies: [],
    created_at: "2026-04-25 13:00",
    updated_at: "2026-04-25 13:00",
  },
  {
    id: "TKT-007",
    user_id: "u8",
    user_name: "كريم علي",
    user_email: "kareem.a@example.com",
    user_level: "basic",
    user_kyc_status: "rejected",
    subject: "لماذا رُفض حسابي؟",
    body: "رُفض طلب KYC الخاص بي. أرغب بمعرفة السبب الدقيق وكيفية إعادة التقديم.",
    category: "kyc",
    priority: "medium",
    status: "in_progress",
    assigned_to: "a3",
    assigned_to_name: "Admin@2",
    replies: [
      {
        id: "rep-5",
        sender_type: "admin",
        sender_name: "Admin@2",
        sender_role: "moderator",
        body: "صورة الـ Selfie كانت غير واضحة. يمكنك إعادة الرفع من صفحة /kyc بإضاءة كافية.",
        created_at: "2026-04-23 16:30",
      },
    ],
    created_at: "2026-04-23 14:00",
    updated_at: "2026-04-23 16:30",
  },
  {
    id: "TKT-008",
    user_id: "u10",
    user_name: "هدى صبري",
    user_email: "huda.s@example.com",
    user_level: "basic",
    user_kyc_status: "pending",
    subject: "كيف أبدأ الاستثمار؟",
    body: "أنا جديدة على المنصة وأرغب بمعرفة كيف أشتري أول حصة.",
    category: "other",
    priority: "low",
    status: "replied",
    assigned_to: "a3",
    assigned_to_name: "Admin@2",
    replies: [
      {
        id: "rep-6",
        sender_type: "admin",
        sender_name: "Admin@2",
        sender_role: "moderator",
        body: "أهلاً بك في رايلوس! 🎉\n\n1. أكملي التوثيق KYC أولاً\n2. ادخلي /market\n3. اختاري مشروعاً\n4. اضغطي 'استثمر الآن'\n\nيمكنك مراجعة دليل التطبيق /app-guide.",
        created_at: "2026-04-22 13:00",
      },
    ],
    created_at: "2026-04-22 12:00",
    updated_at: "2026-04-22 13:00",
  },
  {
    id: "TKT-009",
    user_id: "u15",
    user_name: "فاطمة الجبوري",
    user_email: "fatima.j@example.com",
    user_level: "basic",
    user_kyc_status: "verified",
    subject: "مشكلة عرض الأرقام في التطبيق",
    body: "بعض الأرقام تظهر بالعربية وبعضها باللاتينية. هل يمكن توحيدها؟",
    category: "technical",
    priority: "low",
    status: "closed",
    assigned_to: "a3",
    assigned_to_name: "Admin@2",
    replies: [
      {
        id: "rep-7",
        sender_type: "admin",
        sender_name: "Admin@2",
        sender_role: "moderator",
        body: "تم إصلاح هذه المشكلة في التحديث الأخير. كل الأرقام الآن بالخط اللاتيني.",
        created_at: "2026-04-19 10:00",
      },
    ],
    created_at: "2026-04-15 14:00",
    updated_at: "2026-04-19 10:00",
    closed_at: "2026-04-20 11:00",
    closed_reason: "تم الحل + تأكيد المستخدم",
  },
  {
    id: "TKT-010",
    user_id: "u16",
    user_name: "مصطفى الكاظمي",
    user_email: "mustafa.k@example.com",
    user_level: "advanced",
    user_kyc_status: "verified",
    subject: "هل يمكن إضافة مشاريع طبية؟",
    body: "أرغب بالاستثمار في القطاع الطبي. متى ستُضاف هذه المشاريع؟",
    category: "feature_request",
    priority: "low",
    status: "closed",
    assigned_to: "a1",
    assigned_to_name: "Admin@Main",
    replies: [
      {
        id: "rep-8",
        sender_type: "admin",
        sender_name: "Admin@Main",
        sender_role: "founder",
        body: "نعمل حالياً على شراكة مع 3 مستشفيات. المتوقّع إطلاق أول مشروع طبي خلال الربع الثالث 2026.",
        created_at: "2026-03-20 11:00",
      },
    ],
    created_at: "2026-03-15 10:00",
    updated_at: "2026-03-20 11:00",
    closed_at: "2026-03-25 09:00",
    closed_reason: "تمت الإجابة + لا يوجد رد إضافي",
  },
  {
    id: "TKT-011",
    user_id: "u22",
    user_name: "زيد الحلبوسي",
    user_email: "zaid.h@example.com",
    user_level: "advanced",
    user_kyc_status: "verified",
    subject: "اعتراض على إيقاف حسابي كسفير",
    body: "تم إيقاف حسابي كسفير دون سبب واضح. أطلب مراجعة عاجلة.",
    category: "complaint",
    priority: "high",
    status: "new",
    replies: [],
    created_at: "2026-04-25 11:00",
    updated_at: "2026-04-25 11:00",
  },
  {
    id: "TKT-012",
    user_id: "u23",
    user_name: "هديل الزيدي",
    user_email: "hadeel.z@example.com",
    user_level: "pro",
    user_kyc_status: "verified",
    subject: "طلب تقرير شهري للسفراء",
    body: "هل يمكن إضافة تقرير شهري مفصّل للأداء كسفير؟",
    category: "feature_request",
    priority: "low",
    status: "in_progress",
    assigned_to: "a2",
    assigned_to_name: "Admin@1",
    replies: [
      {
        id: "rep-9",
        sender_type: "admin",
        sender_name: "Admin@1",
        sender_role: "admin",
        body: "اقتراح ممتاز! تم تصعيده للفريق التقني للنظر في الـ roadmap.",
        created_at: "2026-04-24 15:00",
      },
    ],
    created_at: "2026-04-24 12:00",
    updated_at: "2026-04-24 15:00",
  },
]

export const ADMIN_TICKET_CATEGORY_LABELS: Record<AdminTicketCategory, { label: string; icon: string }> = {
  technical: { label: "تقني", icon: "🛠️" },
  billing: { label: "مالي", icon: "💰" },
  kyc: { label: "توثيق", icon: "🛡️" },
  complaint: { label: "شكوى", icon: "⚠️" },
  feature_request: { label: "اقتراح", icon: "💡" },
  other: { label: "أخرى", icon: "💬" },
}

export const ADMIN_TICKET_STATUS_LABELS: Record<AdminTicketStatus, { label: string; color: "red" | "yellow" | "blue" | "gray" }> = {
  new: { label: "جديدة", color: "red" },
  in_progress: { label: "قيد المعالجة", color: "yellow" },
  replied: { label: "تم الرد", color: "blue" },
  closed: { label: "مُغلقة", color: "gray" },
}

export const ADMIN_TICKET_PRIORITY_LABELS: Record<AdminTicketPriority, { label: string; color: "red" | "yellow" | "gray" }> = {
  high: { label: "عاجل", color: "red" },
  medium: { label: "متوسط", color: "yellow" },
  low: { label: "منخفض", color: "gray" },
}

export const REPLY_TEMPLATES: { label: string; body: string }[] = [
  { label: "ترحيب + إقرار", body: "شكراً لتواصلك مع فريق الدعم.\nتم استلام طلبك وسنعمل على الرد خلال 24 ساعة." },
  { label: "تحت المعالجة", body: "سيتم النظر في طلبك خلال 24 ساعة. شكراً لصبرك." },
  { label: "إغلاق + شكر", body: "تم حل المشكلة. إذا واجهت أي صعوبة جديدة، لا تتردّد بفتح تذكرة جديدة." },
  { label: "طلب معلومات", body: "نحتاج معلومات إضافية لمساعدتك:\n- ما الخطوات التي اتّبعتها؟\n- هل ظهرت رسالة خطأ؟\n- ما المتصفّح/الجهاز المُستخدم؟" },
]

export function getAdminTicketsStats() {
  const all = ADMIN_SUPPORT_TICKETS
  return {
    new_count: all.filter((t) => t.status === "new").length,
    in_progress: all.filter((t) => t.status === "in_progress").length,
    replied: all.filter((t) => t.status === "replied").length,
    closed: all.filter((t) => t.status === "closed").length,
    total: all.length,
  }
}

export const ADMIN_LIST = [
  { id: "a1", name: "Admin@Main" },
  { id: "a2", name: "Admin@1" },
  { id: "a3", name: "Admin@2" },
] as const
