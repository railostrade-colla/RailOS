# Database Webhook — Push التلقائي للإشعارات الجديدة

> هذا الدليل لتكوين Supabase Database Webhook الذي يستدعي
> `/api/push/webhook` تلقائياً عند كل INSERT في جدول `notifications`،
> ليتحوّل النظام بأكمله من إشعارات داخلية فقط (Bell icon) إلى نظام كامل
> يصل لجهاز المستخدم حتى لو التطبيق مغلق.

## المتطلبات

- ✅ المرحلة 1 — جدول `notifications` + Bell + Dropdown مكتملة
- ✅ المرحلة 2 — Triggers لإنشاء إشعارات تلقائياً مكتملة
- ✅ المرحلة 2.5 — `app/api/push/webhook/route.ts` موجود (هذا الكود)
- ✅ migration `20260502_phase25_internal_only_flag.sql` مُنفّذ على Supabase
- ✅ VAPID keys مُكوَّنة على Railway

---

## الخطوة 1 — توليد Webhook Secret

في PowerShell:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

أو في Node.js / Terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

ستحصل على نص طويل عشوائي (~44–64 حرف). انسخه — هذا هو `SUPABASE_WEBHOOK_SECRET`.

⚠️ هذا السرّ مشترك بين Supabase (المرسِل) و Railway (المستقبل). لا تشاركه مع أي طرف ثالث.

---

## الخطوة 2 — أضف السرّ على Railway

1. افتح [railway.app](https://railway.app) → مشروع RailOS
2. اختر الـ service → تبويب **Variables**
3. **+ New Variable**
4. الاسم: `SUPABASE_WEBHOOK_SECRET`
5. القيمة: السرّ الذي ولّدتَه
6. **Add** → سيُعيد Railway النشر تلقائياً

> لو حذفتَ هذا المتغيّر، الـ webhook يقبل أي طلب (أقلّ أماناً، لكن يعمل).

---

## الخطوة 3 — أنشئ الـ Webhook في Supabase

1. افتح [supabase.com](https://supabase.com) → مشروع RailOS
2. القائمة الجانبية → **Database** → **Webhooks**
3. **+ Create a new hook**
4. املأ النموذج:

| الحقل | القيمة |
|------|--------|
| Name | `push_on_new_notification` |
| Table | `notifications` |
| Events | ✅ Insert (فقط — لا تختر Update/Delete) |
| Type | HTTP Request |
| Method | POST |
| URL | `https://railos-production.up.railway.app/api/push/webhook` |
| HTTP Headers | `Content-Type: application/json` |
| | `Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>` |
| Timeout | 5000 ms (الافتراضي عادة كافٍ) |

5. **Confirm** → سيُحفظ ويبدأ بالعمل فوراً

---

## الخطوة 4 — اختبار سريع

في **Supabase SQL Editor**، استبدل `<USER_UUID>` بـ id مستخدم لديه `push_subscription` نشط:

```sql
INSERT INTO notifications (
  user_id,
  notification_type,
  title,
  message,
  priority,
  is_read,
  sent_via_email,
  sent_via_push,
  is_internal_only
) VALUES (
  '<USER_UUID>',
  'system_announcement',
  '🧪 اختبار Webhook',
  'إذا وصلك هذا خارج التطبيق، النظام يعمل!',
  'high',
  FALSE,
  FALSE,
  FALSE,
  FALSE
);
```

**النتيجة المتوقّعة**:
- ⚡ خلال ثوانٍ، يصل إشعار Push على الجهاز (حتى لو Chrome مغلق)
- 🔔 يظهر فوراً في Bell icon (real-time)
- ✅ سجلّ ناجح في Supabase Dashboard → Database → Webhooks → اضغط على الـ hook → **Recent Deliveries**

---

## الخطوة 5 — اختبار شامل (اختياري)

شغّل أحد triggers المرحلة 2:

```sql
-- اختبار KYC (الأسهل)
UPDATE kyc_submissions
SET status = 'approved'
WHERE id = (
  SELECT id FROM kyc_submissions
  WHERE status = 'pending'
  ORDER BY submitted_at DESC
  LIMIT 1
);
```

سلسلة الأحداث:
1. UPDATE → trigger `trg_notify_kyc_status` يُطلق
2. trigger يستدعي `create_user_notification()` → INSERT في `notifications`
3. Database Webhook يلتقط INSERT → يستدعي `/api/push/webhook`
4. Webhook يفحص prefs + يجلب subscriptions + يُرسل عبر VAPID
5. الجهاز يستلم Push → يضغط المستخدم → يفتح `/profile`

---

## استكشاف الأخطاء

### الـ Push لا يصل
1. **Supabase Dashboard → Database → Webhooks → Recent Deliveries**
   تحقّق من حالة آخر طلب (200 = نجح، 4xx/5xx = فشل)
2. **Railway Dashboard → Logs**
   ابحث عن `[push]` أو `webhook` لرؤية تفاصيل الخطأ
3. **Browser DevTools → Application → Service Workers**
   تأكّد أن `sw-push.js` نشط ومسجَّل
4. **Supabase → Table Editor → `push_subscriptions`**
   تأكّد أن الصف خاصّ المستخدم `is_active = TRUE`

### خطأ 401 Unauthorized
- السرّ في Railway مختلف عن السرّ في Webhook
- تأكّد من **مطابقتهما تماماً** (لا مسافات إضافية، نفس حالة الأحرف)

### خطأ 500 — VAPID keys are not configured
- على Railway تأكّد من وجود الثلاثة:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (مثل `mailto:railostrade@gmail.com`)

### الإشعار يصل مرّتين
- نادر جداً، يحدث فقط لو استدعيتَ `/api/push/send` يدوياً + أُطلق الـ webhook
- الـ webhook يستخدم `record.sent_via_push` كـ idempotency marker لتجنّب هذا
- إذا حدث، تأكّد أن الـ trigger في المرحلة 2 لا يستدعي Push يدوياً (الكود الحالي لا يفعل)

### `skipped: quiet_hours`
- المستخدم عنده `quiet_hours_enabled = TRUE` والوقت الحالي ضمن النطاق
- urgent priority يتجاوز هذا — استخدم `priority = 'urgent'` للاختبار

---

## كيفية إيقاف Push لإشعار محدّد (داخلي فقط)

أحياناً تريد إشعاراً يظهر في Bell فقط دون إزعاج خارجي. مثلاً: تنبيهات
سعر السوق المتكرّرة.

```sql
INSERT INTO notifications (
  user_id, notification_type, title, message, priority,
  is_internal_only  -- ← الـ flag
) VALUES (
  '<USER_UUID>',
  'system_announcement',
  'تحديث طفيف',
  'هذا لن يصل خارج التطبيق',
  'low',
  TRUE  -- skip Push
);
```

الـ webhook سيتلقّى الـ INSERT ويتخطّى فوراً مع `reason: "internal_only"`.

---

## ملخّص الـ Endpoints

| Endpoint | متى يُستدعى | بواسطة |
|----------|-------------|--------|
| `POST /api/push/subscribe` | تسجيل اشتراك جهاز | المتصفّح (`subscribeToPush()`) |
| `POST /api/push/send` | إرسال يدوي | كود التطبيق / أدمن |
| `POST /api/push/webhook` | تلقائي على INSERT | Supabase Database Webhook |

كل الثلاثة منفصلة وتعمل بشكل مستقل.
