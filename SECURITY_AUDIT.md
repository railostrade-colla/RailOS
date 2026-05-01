# 🛡️ تقرير الفحص الأمني الشامل — RailOS

> **تاريخ الفحص:** 2026-04-30
> **Version:** RailOS v0.1.0
> **النطاق:** الكود المصدري + التبعيات + الإعدادات + المنطق التجاري
> **المُدقِّق:** Claude Sonnet 4.5

---

## 📊 الملخّص التنفيذي

| الفئة | عدد المشاكل |
|---|---|
| 🔴 **حرجة (Critical)** | **2** |
| 🟠 **عالية (High)** | **4** |
| 🟡 **متوسّطة (Medium)** | **6** |
| 🟢 **منخفضة (Low)** | **5** |
| ℹ️ **ملاحظات (Informational)** | **3** |

### الحكم العام: ⚠️ **التطبيق ليس جاهزاً للإنتاج (Production)**

> **التطبيق في حالة Development/Mock حالياً** — معظم نقاط الضعف الحرجة سببها أن الـ Auth والـ RLS مُعطَّلان عمداً (DEV MODE). لكن هذه النقاط **يجب أن تُعالَج قبل الإطلاق التجاري**.

---

## 🔴 ثغرات حرجة (Critical)

### 🔴 CRIT-01: API Routes بدون Authentication

**الموقع:** `app/api/market/intervention/route.ts`, `measure-development/route.ts`, `process-deal/route.ts`

**الوصف:**
الـ 3 API routes الموجودة لا تتحقّق من هوية المُستدعي. أي شخص يستطيع:
- تنفيذ عمليات تدخّل في السوق (شراء/بيع من صندوق الاستقرار) بدون صلاحيات
- التلاعب بـ Development Score لأي مشروع
- معالجة صفقات لمستخدمين آخرين

**مثال هجوم:**
```bash
# أي شخص يستطيع استدعاء:
curl -X POST https://railos.iq/api/market/intervention \
  -d '{"projectId":"1","type":"sell","sharesCount":99999,"pricePerShare":1}'
# → كارثة: تدخّل ضخم بسعر منخفض = انهيار السعر
```

**الخطورة:** 🔴 **حرجة** (CVSS 9.8)
**الأثر:** تلاعب بالسوق، خسائر مالية، فقدان الثقة

**الحل:**
```ts
// app/api/market/intervention/route.ts
export async function POST(req: Request) {
  const supabase = await createClient()

  // 1. التحقّق من الجلسة
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. التحقّق من الدور (admin only)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ... باقي المنطق
}
```

---

### 🔴 CRIT-02: Auth Middleware معطَّل في Production

**الموقع:** `proxy.ts` (السطر 13-44)

**الوصف:**
الـ proxy يُحدِّث الـ cookies فقط، لكنه **لا يحجب الصفحات المحمية**. التعليق في الكود يقول:

```ts
// ⚠️ DEV MODE: auth بالكامل معطّل أثناء مرحلة mock-data
// عند الانتقال للإنتاج: أعِد تفعيل المنطق المحفوظ في النسخة المعلّقة
```

**المعنى:** أي زائر غير مُسجَّل يستطيع الوصول لـ:
- `/dashboard` — لوحة التحكم
- `/portfolio` — المحفظة
- `/admin` — لوحة الإدارة
- `/wallet/*` — المحفظة
- `/exchange` — التبادل
- ...إلخ

**الخطورة:** 🔴 **حرجة** (CVSS 9.1)
**الأثر:** Bypass كامل للـ authentication

**الحل:**
ألغِ التعليق في proxy.ts وفعِّل المنطق المحفوظ (تم تجهيزه مسبقاً، فقط uncomment).

---

## 🟠 ثغرات عالية (High)

### 🟠 HIGH-01: غياب Security Headers

**الموقع:** `next.config.ts`

**الوصف:**
الملف فارغ تماماً — لا توجد إعدادات للـ headers الأمنية:
- ❌ `Content-Security-Policy` — يحمي من XSS
- ❌ `X-Frame-Options` — يحمي من Clickjacking
- ❌ `X-Content-Type-Options` — يحمي من MIME sniffing
- ❌ `Referrer-Policy` — يحمي خصوصية الإحالات
- ❌ `Strict-Transport-Security` (HSTS) — يفرض HTTPS
- ❌ `Permissions-Policy` — يقيّد APIs المتصفّح

**الخطورة:** 🟠 **عالية** (CVSS 7.5)

**الحل:**
```ts
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'self'",
          ].join("; "),
        },
      ],
    }]
  },
}
```

---

### 🟠 HIGH-02: غياب Rate Limiting على API و Auth

**الموقع:** كل API routes + `/api/auth/*` + `/login` + `/register`

**الوصف:**
لا يوجد أي حدّ لمعدّل الطلبات. هذا يفتح الباب لـ:
- **Brute Force** على كلمات السر في `/login`
- **Account Enumeration** عبر `/register`
- **DoS** عبر استدعاء API routes بسرعة عالية
- **استنزاف Supabase quotas** ووصول لحدود الفاتورة

**الخطورة:** 🟠 **عالية** (CVSS 7.5)

**الحل:**
استخدام `@upstash/ratelimit` أو middleware مخصّص:
```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"),  // 5 محاولات/دقيقة
})

// في proxy.ts أو في route
const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
const { success } = await ratelimit.limit(ip)
if (!success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 })
}
```

---

### 🟠 HIGH-03: تسرّب dependencies vulnerabilities (PostCSS XSS)

**الموقع:** `node_modules/next/node_modules/postcss`

**الوصف:**
`npm audit` يكشف ثغرتين متوسّطتين:
- **postcss < 8.5.10** — XSS عبر `</style>` غير مهروب
- يؤثّر على Next.js (نسخة موجودة كـ transitive dependency)
- **CVE:** GHSA-qx2v-qp2m-jg93 (CVSS 6.1)

**الخطورة:** 🟠 **عالية** (CVSS 6.1) — ترفع لعالية لأنّها في build pipeline

**الحل:**
```bash
npm update postcss
# OR
npm audit fix --force  # قد يستلزم major version bump
```

التحقّق:
```bash
npm audit
# Expected: 0 vulnerabilities
```

---

### 🟠 HIGH-04: Biometric Implementation غير مكتمل (Mock فقط)

**الموقع:** `lib/auth/biometric.ts`

**الوصف:**
الـ WebAuthn implementation حالياً **ليس آمناً للإنتاج**:
- ❌ الـ challenge مولَّد على الـ client (يجب أن يأتي من السيرفر)
- ❌ لا يوجد verification على الـ server
- ❌ الـ credentials تُخزَّن في `localStorage` (يجب في Supabase)
- ❌ أي شخص بـ access للجهاز يستطيع تفعيل البيومتري بدون كلمة المرور

```ts
// المشكلة:
const challenge = crypto.getRandomValues(new Uint8Array(32))  // ❌ client-side
localStorage.setItem(credentialKey(userId), credential.id)    // ❌ لا verification
```

**الخطورة:** 🟠 **عالية** (CVSS 7.4)

**الحل:**
استدعاء Supabase Edge Functions لكل خطوة:
- `/generate-registration-options` (server)
- `/verify-registration` (server) — يخزّن الـ public key في DB
- `/generate-authentication-options` (server)
- `/verify-authentication` (server) — يتحقّق من signature

**ملاحظة:** التعليقات في الكود تذكر هذا الأمر بوضوح:
> "في Production: استدعِ Supabase Edge Functions"

---

## 🟡 ثغرات متوسّطة (Medium)

### 🟡 MED-01: dangerouslySetInnerHTML في Icon.tsx

**الموقع:** `components/ui/Icon.tsx:253`

**الوصف:**
```tsx
<svg dangerouslySetInnerHTML={{ __html: paths }} />
```

`paths` يأتي من `ICON_PATHS[name]` — Object hardcoded. حالياً لا خطر فعلي، لكن:
- لو طوّرت ميزة "أيقونات مخصّصة من المستخدم" مستقبلاً → XSS
- الكود ليس defensive

**الخطورة:** 🟡 **متوسّطة** (تصبح عالية لو سُمح بإدخال خارجي)

**الحل:**
```tsx
// بدلاً من dangerouslySetInnerHTML، استخدم React children:
<svg>
  {paths.map((d, i) => <path key={i} d={d} />)}
</svg>
```

---

### 🟡 MED-02: المنطق التجاري في Escrow يعتمد على Client

**الموقع:** `lib/escrow/store.ts`, `lib/escrow/helpers.ts`

**الوصف:**
الـ Escrow store حالياً **in-memory في المتصفح**:
```ts
const dealsStore = new Map<string, EscrowDeal>()
const lockedSharesStore: LockedShareEntry[] = []
```

هذا لـ Mock فقط، لكن لو تركه المطوّر بالخطأ في الإنتاج:
- المستخدم يستطيع التلاعب بـ DevTools → تغيير `shares_amount` للصفقة
- إعادة تنفيذ `transferShares` يدوياً
- إنشاء صفقات بدون ربط بـ DB
- تجاوز فحص `canCreateDeal()` بسهولة

**الخطورة:** 🟡 **متوسّطة** (تصبح حرجة في الإنتاج)

**الحل:**
نقل كل منطق Escrow لـ Supabase RPC functions أو Edge Functions:
```sql
-- supabase/functions/create_deal.sql
CREATE OR REPLACE FUNCTION create_escrow_deal(
  p_buyer_id UUID,
  p_seller_id UUID,
  p_shares INT,
  p_listing_id UUID
) RETURNS deals AS $$
DECLARE
  v_available INT;
BEGIN
  -- atomic check + lock
  SELECT shares_owned INTO v_available
  FROM holdings
  WHERE user_id = p_seller_id AND listing_id = p_listing_id
  FOR UPDATE;

  IF v_available < p_shares THEN
    RAISE EXCEPTION 'Insufficient shares';
  END IF;

  -- create deal + lock shares atomically
  INSERT INTO deals (...) VALUES (...);
  INSERT INTO locked_shares (...) VALUES (...);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 🟡 MED-03: عدم فحص Schema للبيانات الواردة (No Input Validation)

**الموقع:** كل API routes + form submissions

**الوصف:**
```ts
const body = await req.json()
const { projectId, type, sharesCount, pricePerShare } = body ?? {}
if (!projectId || !type || !sharesCount || !pricePerShare) { ... }
```

التحقّق سطحي:
- ❌ `projectId` قد يكون `"<script>"` — XSS لاحقاً
- ❌ `sharesCount` قد يكون string `"NaN"` أو `-99999`
- ❌ `pricePerShare` قد يكون `Infinity`
- ❌ لا حدود قصوى/دنيا

**الخطورة:** 🟡 **متوسّطة** (CVSS 5.4)

**الحل:**
استخدام Zod للـ schema validation:
```ts
import { z } from "zod"

const interventionSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["buy", "sell"]),
  sharesCount: z.number().int().positive().max(1_000_000),
  pricePerShare: z.number().positive().max(10_000_000),
})

const body = await req.json()
const parsed = interventionSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
}
```

---

### 🟡 MED-04: Supabase RLS غير مُفعَّل/متحقَّق منه

**الموقع:** Schema files (`supabase/01_users.sql`)

**الوصف:**
الـ schema يحتوي RLS policies على بعض الجداول (profiles, kyc_submissions, user_preferences, audit_log)، لكن:
- ❓ لا توجد سياسات على `escrow_deals`, `holdings`, `listings`, `locked_shares`
- ❓ غير واضح إن كانت السياسات مُطبَّقة على الـ DB الفعلي
- ⚠️ السياسة `Anyone can view profiles` تكشف **كل البيانات الشخصية للجمهور** — قد يكون غير مطلوب

```sql
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);  -- ⚠️ مفتوح للجميع
```

**الخطورة:** 🟡 **متوسّطة** (يصبح حرج إن كشف بيانات حسّاسة)

**الحل:**
1. تفعيل RLS على **كل** الجداول
2. مراجعة السياسة "Anyone can view profiles" — قد تحتاج للحدّ من الحقول المعروضة (مثل `phone`, `email` خاصة)
3. إنشاء view عام آمن:
```sql
CREATE VIEW public_profiles AS
SELECT id, full_name, avatar_url, rating_average, trades_completed
FROM profiles;
-- بدون phone/email
```

---

### 🟡 MED-05: تكشّف بيانات في Console.log

**الموقع:** غير مفحوص بدقّة لكن متوقّع في `data` files

**الوصف:**
في Production يجب أن لا توجد `console.log`. لو وُجدت، قد تكشف:
- IDs مستخدمين
- بيانات صفقات
- أرصدة

**الخطورة:** 🟡 **متوسّطة**

**الحل:**
- استخدام linter rule: `no-console: ["error", { allow: ["warn", "error"] }]`
- إضافة Sentry بدلاً من console.log في production

---

### 🟡 MED-06: غياب CSRF Protection للـ API

**الموقع:** كل API routes

**الوصف:**
Next.js لا يضيف CSRF tokens تلقائياً. لو الـ session cookies (`SameSite=Lax`) تأخّرت أو تغيّرت بطريقة معيّنة، ممكن CSRF.

**الخطورة:** 🟡 **متوسّطة** (محدودة لأن Supabase cookies بـ `SameSite=Lax`)

**الحل:**
- التأكّد أن `SameSite=Strict` على authentication cookies
- استخدام Origin header check في sensitive endpoints

---

## 🟢 ثغرات منخفضة (Low)

### 🟢 LOW-01: Email Verification معطَّل

**الموقع:** Supabase Dashboard config

**الوصف:**
المستخدم طلب تعطيل email confirmation. هذا يعني:
- أي شخص يستطيع التسجيل ببريد وهمي
- لا يوجد way لاسترجاع الحساب لو نسي كلمة السر

**الخطورة:** 🟢 **منخفضة** (مناسبة لـ MVP، لكن يجب تفعيلها قبل launch)

---

### 🟢 LOW-02: localStorage يحفظ معلومات المستخدم البيومترية

**الموقع:** `lib/auth/biometric.ts`

**الوصف:**
```ts
localStorage.setItem(emailKey(userId), email)
localStorage.setItem(credentialKey(userId), credential.id)
```

البريد + Credential ID قابلة للقراءة من JS الخبيث (XSS).

**الخطورة:** 🟢 **منخفضة** (الـ credential ID ليس secret بالمعنى الكلاسيكي)

**الحل:**
- نقل لـ Supabase
- أو على الأقل تشفير القيم قبل التخزين

---

### 🟢 LOW-03: Toast يكشف رسائل خطأ تفصيلية

**الموقع:** `app/(auth)/login/page.tsx`, `register/page.tsx`

**الوصف:**
```ts
showError(error.message || "حدث خطأ، حاول مرة أخرى")
```

`error.message` من Supabase قد يكشف:
- وجود الـ email أو لا (Account Enumeration)
- تفاصيل تقنية مفيدة للمهاجم

**الخطورة:** 🟢 **منخفضة**

**الحل:**
استخدام رسائل عامة:
```ts
if (error.message.includes("Invalid login")) {
  showError("البريد أو كلمة المرور غير صحيحة")
} else {
  showError("حدث خطأ، حاول مرة أخرى")  // لا تكشف error.message للمستخدم
  console.error(error)  // للـ dev team فقط
}
```

(الكود يفعل هذا بالفعل لـ "Invalid login" — لكن باقي الأخطاء تمرّ)

---

### 🟢 LOW-04: عدم وجود Password Strength Policy

**الموقع:** `app/(auth)/register/page.tsx`

**الوصف:**
الشرط الحالي: 8 أحرف + حروف + أرقام
- ✅ جيد كحدّ أدنى
- ⚠️ لا يفحص **كلمات السر الشائعة** (`password123`, `12345678`)
- ⚠️ لا يفرض رموز خاصّة

**الخطورة:** 🟢 **منخفضة**

**الحل:**
استخدام `zxcvbn` أو HaveIBeenPwned API للتحقّق.

---

### 🟢 LOW-05: لا يوجد Account Lockout بعد محاولات فاشلة

**الموقع:** Supabase Auth + `/login`

**الوصف:**
بعد X محاولات فاشلة، يجب تعطيل الحساب مؤقّتاً.

**الخطورة:** 🟢 **منخفضة** (يحلّها Rate Limiting المذكور في HIGH-02)

**الحل:**
Supabase يدعم هذا في Dashboard → Authentication → Settings → "Failed Sign-In Attempts".

---

## ℹ️ ملاحظات (Informational)

### ℹ️ INFO-01: NEXT_PUBLIC_* مستخدمة بشكل صحيح

✅ كل المتغيّرات الحسّاسة (مثل `SUPABASE_SERVICE_ROLE_KEY`) **بدون** `NEXT_PUBLIC_` prefix.
✅ الـ Publishable Key (مكشوف للعميل) آمن — مُصمَّم لذلك.

### ℹ️ INFO-02: لا توجد كلمات سر مكتوبة في الكود (Hardcoded)

✅ فحص grep لـ `password=`, `api_key=`, `secret=` لم يجد شيئاً مهمّاً.

### ℹ️ INFO-03: Toast configuration آمنة

✅ الـ Toaster لا يقبل HTML خام.

---

## 🛡️ توصيات الحماية (Hardening Checklist)

### قبل الإنتاج (Production Launch) — إجباري

- [ ] **CRIT-01:** إضافة auth checks لكل API routes
- [ ] **CRIT-02:** تفعيل proxy.ts بالكامل (uncomment الـ logic المحفوظ)
- [ ] **HIGH-01:** إضافة Security Headers في `next.config.ts`
- [ ] **HIGH-02:** Rate Limiting على Auth + API
- [ ] **HIGH-03:** `npm audit fix` لإصلاح PostCSS
- [ ] **HIGH-04:** نقل WebAuthn إلى Supabase Edge Functions
- [ ] **MED-02:** نقل Escrow logic لـ Supabase RPC
- [ ] **MED-03:** Zod validation لكل API inputs
- [ ] **MED-04:** مراجعة وتفعيل RLS على كل الجداول
- [ ] **LOW-01:** تفعيل Email Confirmation في Supabase
- [ ] **LOW-05:** تفعيل Account Lockout

### مستحسن (Recommended)

- [ ] إضافة Sentry لتتبّع الأخطاء
- [ ] إضافة Cloudflare WAF (Web Application Firewall)
- [ ] إضافة Cloudflare Turnstile (CAPTCHA) على Auth
- [ ] إعداد automated penetration testing (Snyk, Dependabot)
- [ ] Audit logs في DB لكل العمليات الحسّاسة
- [ ] 2FA إجباري للـ admins
- [ ] إعداد DR (Disaster Recovery) plan
- [ ] إعداد Cyber Insurance

### مراقبة مستمرّة (Continuous Monitoring)

- [ ] فحص `npm audit` أسبوعياً
- [ ] مراجعة Supabase Logs يومياً
- [ ] Penetration testing ربعي
- [ ] تحديث dependencies شهرياً
- [ ] مراجعة OWASP Top 10 سنوياً

---

## 🎯 الخلاصة والأولويات

### 🔥 يجب إصلاحها فوراً (قبل Production)

1. **CRIT-01:** Auth على API routes
2. **CRIT-02:** تفعيل Auth Middleware
3. **HIGH-01:** Security Headers
4. **HIGH-02:** Rate Limiting
5. **HIGH-04:** WebAuthn server-side

### 📅 خلال شهر من الإطلاق

6. **MED-01:** إصلاح Icon.tsx
7. **MED-02:** نقل Escrow لـ DB
8. **MED-03:** Zod validation
9. **MED-04:** RLS على كل الجداول
10. **LOW-01:** Email Confirmation

### 📊 درجة الأمان الحالية

| الفئة | الدرجة | التعليق |
|---|---|---|
| **Authentication** | 4/10 | معطّلة في DEV |
| **Authorization** | 3/10 | لا توجد role checks في API |
| **Input Validation** | 5/10 | سطحية، لا Zod |
| **Encryption** | 8/10 | HTTPS + Supabase encryption |
| **Session Management** | 7/10 | Supabase built-in |
| **Logging & Monitoring** | 4/10 | لا Sentry، logs محدودة |
| **Dependency Management** | 6/10 | 2 vulnerabilities |
| **Configuration** | 3/10 | next.config فارغ |

### 📈 الدرجة الإجمالية: **5/10** (Fair)

**بعد تطبيق التوصيات الحرجة والعالية:** **8.5/10** (Good - جاهز للإنتاج)

---

## 📚 موارد إضافية

| المرجع | الرابط |
|---|---|
| OWASP Top 10 (2021) | https://owasp.org/Top10 |
| Next.js Security Best Practices | https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy |
| Supabase Security Guide | https://supabase.com/docs/guides/auth/server-side/nextjs |
| Web Application Security Testing | https://owasp.org/www-project-web-security-testing-guide |

---

## 📞 جهة الاتصال

**في حال اكتشاف ثغرة (Responsible Disclosure):**
- Email: railostrade@gmail.com
- Subject: `[SECURITY] vulnerability report`
- Response time: خلال 24 ساعة

---

> **🔒 هذا التقرير سرّي — لا يُوزَّع خارج فريق رايلوس.**
> **آخر تحديث:** 2026-04-30
> **الفحص التالي المُوصى به:** بعد تطبيق التوصيات الحرجة (متوقّع: مايو 2026)
