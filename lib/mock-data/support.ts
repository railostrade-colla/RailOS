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
  // ─── عام ──────────────────────────────────────────────────
  { id: "f1", category: "عام", question: "ما هي منصة رايلوس؟", answer: "رايلوس هي منصة استثمارية رقمية عراقية تتيح لك شراء وبيع حصص استثمارية في مشاريع موثّقة في قطاعات متعدّدة (زراعة، عقارات، صناعة، تجارة) مع شفافية كاملة وعمولات منخفضة.", helpful_count: 142 },
  { id: "f2", category: "عام", question: "هل المنصة آمنة؟", answer: "نعم. نستخدم تشفيراً متقدّماً (TLS 1.3 + AES-256) لحماية بياناتك. كل المعاملات موثّقة، والمشاريع تخضع لتدقيق دوري قبل عرضها.", helpful_count: 98 },
  { id: "f3", category: "عام", question: "كيف أتواصل مع الدعم؟", answer: "يمكنك التواصل عبر: WhatsApp (+964 770 1234567)، Email (railostrade@gmail.com)، أو إرسال طلب دعم مباشرة من هذه الصفحة.", helpful_count: 67 },
  { id: "f3a", category: "عام", question: "هل المنصة مرخّصة في العراق؟", answer: "نعم، رايلوس مسجّلة كشركة استثمار رقمي عراقية وتعمل وفق أنظمة الاستثمار المحلية. كل المشاريع المعروضة مرخّصة من الجهات المختصّة.", helpful_count: 88 },
  { id: "f3b", category: "عام", question: "هل أحتاج جنسية عراقية للاستثمار؟", answer: "لا، المنصة مفتوحة للمستثمرين من داخل وخارج العراق. تحتاج فقط هوية رسمية صالحة (هوية وطنية أو جواز سفر) لإكمال التوثيق.", helpful_count: 54 },
  { id: "f3c", category: "عام", question: "ما الفرق بين رايلوس والبورصة التقليدية؟", answer: "رايلوس متخصّصة بالاستثمار في مشاريع حقيقية مدرّة للدخل (مزارع، عقارات، تقنية). البورصة تتعامل مع أسهم شركات مساهمة. رايلوس أكثر شفافية وعوائد أعلى لكنها أقل سيولة فورية.", helpful_count: 47 },

  // ─── الاستثمار ─────────────────────────────────────────────
  { id: "f4", category: "الاستثمار", question: "كيف أبدأ الاستثمار؟", answer: "للبدء بسهولة:\n1️⃣ أكمل التوثيق KYC من /kyc\n2️⃣ افتح صفحة السوق /market\n3️⃣ تصفّح المشاريع وقارن بينها\n4️⃣ اختر مشروعاً يناسب أهدافك\n5️⃣ اضغط 'استثمر الآن' وحدّد عدد الحصص\nلا حد أدنى — تستطيع البدء بحصة واحدة.", helpful_count: 215 },
  { id: "f5", category: "الاستثمار", question: "ما الحد الأدنى للاستثمار؟", answer: "لا يوجد حد أدنى — يمكنك شراء حصة واحدة فقط. سعر الحصة يتراوح بين 80,000 - 250,000 د.ع حسب المشروع.", helpful_count: 178 },
  { id: "f6", category: "الاستثمار", question: "كيف يتم حساب الأرباح؟", answer: "الأرباح تُحسب بناءً على:\n• حصّتك (عدد الحصص × ربح الحصة)\n• فترة المشروع (شهر/ربع/سنة)\n• أداء المشروع الفعلي\n\nمثلاً: مشروع يوزّع 5% ربعياً، وأنت تملك 100 حصة بسعر 100,000 = استثمار 10M = ربح ربعي 500K د.ع تقريباً.\n\nيمكنك متابعة كل التوزيعات في /investment.", helpful_count: 198 },
  { id: "f6a", category: "الاستثمار", question: "متى أستلم أرباحي؟", answer: "حسب نوع المشروع:\n• شهري — كل 30 يوم\n• ربع سنوي — كل 3 أشهر\n• نصف سنوي — كل 6 أشهر\n• سنوي — مرة في السنة\n\nتُحوَّل تلقائياً لمحفظتك ويظهر إشعار بالاستلام.", helpful_count: 156 },
  { id: "f7", category: "الاستثمار", question: "هل يمكنني بيع حصصي قبل انتهاء المشروع؟", answer: "نعم، عبر:\n• السوق الثانوي /exchange — تنشر إعلان بيع وتنتظر مشترٍ\n• Quick Sell — بيع فوري بخصم 15%\n\nلا حدود زمنية — تستطيع البيع في أي وقت.", helpful_count: 134 },
  { id: "f7a", category: "الاستثمار", question: "ما الفرق بين السوق الأولي والثانوي؟", answer: "السوق الأولي (/market): شراء حصص جديدة مباشرة من المشاريع.\nالسوق الثانوي (/exchange): بيع وشراء حصص بين المستثمرين أنفسهم — قد تجد فيه أسعار أفضل أو حصص نادرة.", helpful_count: 78 },
  { id: "f7b", category: "الاستثمار", question: "ما هي 'القطاعات' وأيها أفضل؟", answer: "نقدّم 6 قطاعات:\n🌾 زراعة — استقرار + توزيعات منتظمة\n🏢 عقارات — نمو طويل + إيجارات\n🏭 صناعة — نمو متوسط + تقلّبات\n🏪 تجارة — سيولة سريعة\n💻 تقنية — نمو عالي + مخاطر أعلى\n🏥 طبية — مستقر طويل المدى\n\nنوّع استثماراتك بين قطاعات لتقليل المخاطر.", helpful_count: 92 },
  { id: "f7c", category: "الاستثمار", question: "ماذا لو خسر المشروع؟", answer: "في حالة فشل المشروع، تخضع كل الأصول للتصفية وتُوزَّع العوائد بنسبة الحصص. هذا نادر — كل المشاريع تخضع لتدقيق صارم قبل القبول. كذلك يُنصح بالتنويع لتقليل أثر أي خسارة محتملة.", helpful_count: 65 },

  // ─── المحفظة ───────────────────────────────────────────────
  { id: "f8", category: "المحفظة", question: "كيف أرى محفظتي؟", answer: "اذهب إلى /portfolio لرؤية:\n• كل حصصك + قيمتها الحالية\n• إجمالي الأرباح/الخسائر\n• سجل المعاملات الكامل\n• الحدود الشهرية المتبقّية\n• تحويل الحصص بين الحسابات", helpful_count: 89 },
  { id: "f9", category: "المحفظة", question: "ما هي 'الحدود الشهرية'؟", answer: "كل مستوى مستثمر له حد شهري للبيع/الشراء:\n• أساسي → 10M د.ع/شهر\n• متقدم → 50M د.ع/شهر\n• محترف → 250M د.ع/شهر\n\nالانضمام لعقد جماعي يزيد الحد بنسبة 25%.", helpful_count: 102 },
  { id: "f10", category: "المحفظة", question: "كيف أرفع مستواي؟", answer: "الترقية تلقائية حسب أدائك:\n• للمتقدم: 100 صفقة ناجحة + KYC مكتمل + معدل نجاح 95%+\n• للمحترف: 500 صفقة + 98% نجاح\n• للنخبة: 2000 صفقة + 99% نجاح\n\nتقدّمك يظهر في /profile/level.", helpful_count: 87 },
  { id: "f10a", category: "المحفظة", question: "هل يمكن تحويل حصص لشخص آخر؟", answer: "نعم، عبر زر التحويل في صفحة المحفظة. اختر المستلم (يجب أن يكون موثّقاً KYC) وعدد الحصص. التحويل مجاني ولا يحتسب من الحدود الشهرية.", helpful_count: 71 },
  { id: "f10b", category: "المحفظة", question: "ما الفرق بين الحصص المتاحة والمجمدة؟", answer: "الحصص المتاحة: يمكنك بيعها أو تحويلها فوراً.\nالحصص المجمدة: مرتبطة بصفقة جارية أو إعلان نشط — تُفك تلقائياً عند إكمال أو إلغاء الصفقة.", helpful_count: 64 },

  // ─── العقود ────────────────────────────────────────────────
  { id: "f11", category: "العقود", question: "ما هي العقود الجماعية؟", answer: "العقد الجماعي = شراكة استثمارية بين 2-7 مستثمرين. مجموع حدودهم الشهرية يُضرب في 1.25 (مكافأة 25%) كحد شهري جماعي. مفيد للاستثمارات الكبيرة التي تتجاوز حدّك الفردي.", helpful_count: 76 },
  { id: "f11a", category: "العقود", question: "كيف أنشئ عقداً جماعياً؟", answer: "1) ادخل /contracts/create\n2) أضف الشركاء بأسمائهم وعنوان البريد\n3) حدّد نسبة كل شريك\n4) راجع الشروط واضغط نشر\n5) ينتظر العقد موافقة كل الشركاء قبل التفعيل", helpful_count: 58 },
  { id: "f12", category: "العقود", question: "هل يمكنني الانسحاب من عقد؟", answer: "• قبل تفعيل العقد: نعم، بدون أي رسوم\n• بعد التفعيل: يحتاج موافقة جميع الشركاء + رسم انسحاب 2%", helpful_count: 54 },
  { id: "f12a", category: "العقود", question: "كيف توزَّع الأرباح في عقد جماعي؟", answer: "حسب نسبة كل شريك المحدّدة في العقد. النظام يحوّل النسب تلقائياً عند كل توزيع — لا حاجة لتدخّل يدوي.", helpful_count: 49 },

  // ─── التوثيق ───────────────────────────────────────────────
  { id: "f13", category: "التوثيق", question: "ما هو KYC؟", answer: "KYC = Know Your Customer (اعرف عميلك). عملية التحقّق من هويتك (هوية + سيلفي) لضمان أمان المنصة وفتح كل الميزات. تأخذ 24-48 ساعة عادةً.", helpful_count: 203 },
  { id: "f14", category: "التوثيق", question: "ماذا أحتاج للتوثيق؟", answer: "تحتاج فقط:\n1) صورة هوية أحوال مدنية أو جواز سفر (واضحة من الجهتين)\n2) سيلفي بيدك تحمل الهوية\n\nكل شيء تلقائي عبر التطبيق من /kyc.", helpful_count: 167 },
  { id: "f14a", category: "التوثيق", question: "كم يستغرق التوثيق؟", answer: "عادةً 24-48 ساعة عمل. في الأوقات المزدحمة قد يصل 72 ساعة. ستصلك إشعار فور الموافقة أو الرفض مع السبب.", helpful_count: 113 },
  { id: "f14b", category: "التوثيق", question: "لماذا رُفض طلب التوثيق؟", answer: "أسباب الرفض الشائعة:\n• صورة الهوية غير واضحة (انعكاس/ظل)\n• الاسم في الهوية لا يطابق الاسم المسجّل\n• الـSelfie غير واضحة\n• تجاوز عدد المحاولات (3 مرات)\n\nيمكنك إعادة التقديم بعد 24 ساعة من /kyc.", helpful_count: 95 },
  { id: "f14c", category: "التوثيق", question: "هل يمكن استخدام المنصة بدون توثيق؟", answer: "يمكنك التصفّح والاستعراض، لكن:\n❌ لا يمكنك الاستثمار\n❌ لا يمكنك بيع/شراء\n❌ لا يمكنك إنشاء عقود\n\nالتوثيق إجباري لأي عملية مالية.", helpful_count: 76 },

  // ─── الرسوم ────────────────────────────────────────────────
  { id: "f15", category: "الرسوم", question: "ما هي العمولات على المنصة؟", answer: "عمولات ثابتة وشفّافة:\n• 2% على كل صفقة بيع/شراء — يدفعها المشتري\n• 0.25% على إعلانات الإدراج المكرّرة (الأول مجاني)\n• 5,000 وحدة لإعلان Quick Sell\n• 2,500 وحدة لإنشاء مزاد\n\nلا توجد رسوم خفية — كل العمولات تُعرض قبل التأكيد.", helpful_count: 189 },
  { id: "f15a", category: "الرسوم", question: "كيف تُحتسب نسبة العمولة 2%؟", answer: "العمولة = 2% × قيمة الصفقة الإجمالية\n\nمثال: شراء 50 حصة بسعر 100,000 = 5M د.ع\nالعمولة = 5M × 2% = 100,000 د.ع\nالإجمالي للدفع = 5,100,000 د.ع\n\nالنسبة موحّدة — لا تختلف حسب المستوى أو نوع المشروع.", helpful_count: 142 },
  { id: "f15b", category: "الرسوم", question: "هل توجد رسوم على إيداع الأرباح؟", answer: "لا، استلام الأرباح مجاني تماماً. تذهب التوزيعات مباشرة لمحفظتك بدون أي خصم من المنصة.", helpful_count: 88 },
  { id: "f16", category: "الرسوم", question: "ما هي 'وحدات الرسوم'؟", answer: "وحدات تستخدم لدفع رسوم الإعلانات والميزات الخاصة:\n• 1,500 وحدة → إدراج إعلان مكرّر\n• 2,500 وحدة → إنشاء مزاد\n• 5,000 وحدة → إعلان Quick Sell\n\nتُشحن من الإدارة عبر طلب من صفحة المحفظة.", helpful_count: 92 },
  { id: "f16a", category: "الرسوم", question: "كيف أحصل على وحدات رسوم؟", answer: "1) ادخل /portfolio → تبويب 'وحدات الرسوم'\n2) اضغط 'طلب شحن'\n3) حدّد العدد والمبلغ\n4) ادفع للحساب البنكي المعروض\n5) ارفع إيصال الدفع — تُضاف خلال 6 ساعات.", helpful_count: 67 },

  // ─── الأمان ────────────────────────────────────────────────
  { id: "f17", category: "الأمان", question: "كيف أحمي حسابي؟", answer: "أفضل ممارسات الأمان:\n1) كلمة مرور قوية (8+ أحرف + رموز + أرقام)\n2) لا تشاركها مع أي شخص — لا حتى الدعم\n3) فعّل المصادقة الثنائية (2FA) من /settings\n4) سجّل خروج من الأجهزة العامة\n5) راجع سجل تسجيل الدخول دورياً", helpful_count: 156 },
  { id: "f17a", category: "الأمان", question: "هل بياناتي محمية؟", answer: "نعم — حماية متعدّدة الطبقات:\n🔒 تشفير TLS 1.3 لكل اتصال\n🔒 تشفير AES-256 للبيانات المخزّنة\n🔒 صلاحيات صارمة (Row-Level Security)\n🔒 نسخ احتياطي يومي\n🔒 مراقبة نشاط مشبوه على مدار الساعة", helpful_count: 113 },
  { id: "f18", category: "الأمان", question: "ماذا لو نسيت كلمة المرور؟", answer: "1) اضغط 'نسيت كلمة المرور' في صفحة تسجيل الدخول\n2) أدخل بريدك الإلكتروني\n3) سنرسل رابط إعادة تعيين خلال دقائق\n4) افتح الرابط واختر كلمة مرور جديدة\n\nالرابط صالح لمدة ساعة واحدة فقط.", helpful_count: 98 },
  { id: "f18a", category: "الأمان", question: "هل يستطيع أحد سرقة حصصي؟", answer: "لا — كل عملية تتطلّب تأكيد من حسابك المصادق عليه. حتى الإدارة لا تستطيع تحويل حصصك بدون موافقتك. إذا لاحظت أي نشاط مشبوه أبلغ الدعم فوراً.", helpful_count: 78 },
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
