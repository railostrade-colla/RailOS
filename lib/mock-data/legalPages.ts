/**
 * Legal pages content — admin-editable.
 * Used by /admin?tab=legal_editor + /terms + /privacy.
 */

export type LegalPageId = "terms" | "privacy" | "legal_faq"

export interface LegalPageContent {
  id: LegalPageId
  title: string
  content: string
  last_updated_at: string
  last_updated_by: string
  version: number
  is_published: boolean
}

const TERMS_DEFAULT = `# شروط استخدام منصّة رايلوس

## 1. مقدّمة
بدخولك واستخدامك لمنصّة رايلوس، فإنك توافق على شروط الاستخدام التالية.

## 2. الأهلية
- العمر 18 سنة فأعلى
- مواطن عراقي أو مقيم بإقامة سارية
- إكمال التحقّق من الهوية (KYC)

## 3. حسابك
- معلوماتك يجب أن تكون صحيحة وحديثة
- أنت مسؤول عن سرّية كلمة المرور
- يمنع منعاً باتاً مشاركة الحساب مع طرف ثالث

## 4. الاستثمار
- كل استثمار يحمل مخاطر — لا ضمان لرأس المال
- العائد المتوقّع تقديري وغير ملزم
- تتحمّل كامل المسؤولية عن قراراتك الاستثمارية

## 5. الرسوم
- عمولة 2% على كل صفقة شراء/بيع
- رسوم إنشاء الإعلانات (1.5%)
- رسوم إنهاء العقد (0.10%)

## 6. الالتزام بالشريعة
كل المنتجات الاستثمارية مراجَعة من هيئة شرعية مستقلّة.

## 7. تعديل الشروط
نحتفظ بحق تعديل الشروط في أي وقت — سيتم إشعارك قبل التغييرات الجوهرية بـ 30 يوم.
`

const PRIVACY_DEFAULT = `# سياسة الخصوصية

## 1. ما البيانات التي نجمعها؟
- معلومات الحساب (الاسم، البريد، الهاتف)
- معلومات KYC (صور الهوية، Selfie)
- بيانات المعاملات
- بيانات استخدام التطبيق (لتحسين التجربة)

## 2. كيف نستخدم بياناتك؟
- تشغيل خدمات المنصّة
- التحقّق من الهوية
- منع الاحتيال
- تحسين الخدمات

## 3. هل نشاركها؟
لا نبيع بياناتك. نشاركها فقط مع:
- جهات حكومية بأمر قضائي
- شركاء معتمدون لتشغيل الخدمات (مع NDA)

## 4. الأمان
- تشفير AES-256 للبيانات الحسّاسة
- TLS 1.3 لكل الاتصالات
- مراجعة أمنية دورية من طرف ثالث

## 5. حقوقك
- طلب نسخة من بياناتك
- تصحيح أي معلومات خاطئة
- حذف حسابك (مع الالتزام بمتطلّبات سجلّ المعاملات)

## 6. تواصل
لأي استفسار عن الخصوصية: privacy@railos.iq
`

const LEGAL_FAQ_DEFAULT = `# الأسئلة القانونية

## س: هل المنصّة مرخّصة في العراق؟
ج: نعم — مرخّصة من البنك المركزي العراقي وهيئة الأوراق المالية.

## س: ما الإجراءات في حال نزاع؟
ج: نعتمد لجنة فضّ نزاعات مستقلّة. كل نزاع يُراجَع خلال 7 أيام عمل.

## س: هل أملك الحصص فعلياً؟
ج: نعم — ملكية موثّقة قانونياً عبر سجلّ الشركات. الحصص قابلة للنقل والميراث.

## س: ما القانون الذي يحكم العقود؟
ج: القانون العراقي. أي نزاع يُحال إلى محاكم بغداد التجارية.

## س: ما حقوقي إذا أفلست شركة المشروع؟
ج: حقوقك محفوظة كحصّة ملكية في أصول الشركة وفق ترتيب الدائنين القانوني.

## س: هل أُعفى من ضريبة الدخل على أرباح الاستثمار؟
ج: حالياً نعم — وفق قانون تشجيع الاستثمار العراقي 2017. قد يتغيّر — راجع محاسبك.
`

export const MOCK_LEGAL_PAGES: Record<LegalPageId, LegalPageContent> = {
  terms: {
    id: "terms",
    title: "شروط الاستخدام",
    content: TERMS_DEFAULT,
    last_updated_at: "2026-04-15",
    last_updated_by: "Admin@Main",
    version: 7,
    is_published: true,
  },
  privacy: {
    id: "privacy",
    title: "سياسة الخصوصية",
    content: PRIVACY_DEFAULT,
    last_updated_at: "2026-04-10",
    last_updated_by: "Admin@1",
    version: 5,
    is_published: true,
  },
  legal_faq: {
    id: "legal_faq",
    title: "الأسئلة القانونية",
    content: LEGAL_FAQ_DEFAULT,
    last_updated_at: "2026-03-20",
    last_updated_by: "Admin@Main",
    version: 3,
    is_published: true,
  },
}

export const LEGAL_PAGE_LABELS: Record<LegalPageId, { label: string; icon: string; route: string }> = {
  terms:     { label: "شروط الاستخدام",   icon: "📜", route: "/terms"   },
  privacy:   { label: "سياسة الخصوصية", icon: "🔒", route: "/privacy" },
  legal_faq: { label: "الأسئلة القانونية", icon: "⚖️", route: "/about"   },
}

export function getLegalContent(id: LegalPageId): LegalPageContent {
  return MOCK_LEGAL_PAGES[id]
}

export function updateLegalContent(_id: LegalPageId, _content: string, _publish: boolean) {
  return { success: true, version: MOCK_LEGAL_PAGES[_id].version + 1 }
}
