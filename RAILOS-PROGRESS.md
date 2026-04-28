# RAILOS - ملف التقدم والاستمرارية

## 🎯 المشروع
- **الاسم:** Railos
- **النوع:** منصة تداول استثماري عراقية (PWA)
- **اللغة:** عربي RTL
- **المسار:** C:\Users\pc\OneDrive\Desktop\RailOS

## 🛠️ Tech Stack
- Next.js 16.2.4 + React 19 + TypeScript
- Tailwind CSS v4 + Turbopack
- Supabase (Postgres + Auth + Storage + Realtime)
- Radix UI + lucide-react@1.x + Recharts
- React Hook Form + Zod + Zustand + TanStack Query
- react-hot-toast + Tajawal font

## 🔐 Supabase
- **Project URL:** https://bnkljjiwbmuxmsrqegsa.supabase.co
- **Keys:** في .env.local (Publishable + Secret)

---

## 📊 التقدم

### ✅ المرحلة 1: الأساس (100%)
- Next.js + 339 حزمة + 42 مجلد
- 116 أيقونة + logo + manifest
- layout.tsx + globals.css + page.tsx
- lib/utils/cn.ts + lib/supabase/{client,server,middleware}.ts
- localhost:3000 شغال + Supabase متصل

### ✅ المرحلة 2: قاعدة البيانات (100% - مكتملة!)

**26 جدول · 17 enum · 9 functions · 22 trigger · 42 RLS policy · 65+ index**

#### ✅ 2-أ: المستخدمين (4 جداول)
ملف: supabase/01_users.sql (293 سطر)
- profiles, kyc_submissions, user_preferences, audit_log

#### ✅ 2-ب: المشاريع (5 جداول)
ملف: supabase/02_projects.sql (417 سطر)
- projects, project_wallets (3 محافظ تلقائياً 90/2/8), holdings, listings, project_updates

#### ✅ 2-ج: الصفقات (5 جداول)
ملف: supabase/03_deals.sql (346 سطر)
- deals, deal_messages, payment_proofs, disputes, ratings
- Functions: update_user_rating (تلقائي), increment_trades_on_completion

#### ✅ 2-د: السفير (4 جداول)
ملف: supabase/04_ambassadors.sql
- ambassadors, referral_links (كود فريد + شهر), referrals, ambassador_rewards
- Functions: generate_referral_code, sync_ambassador_status, increment_referral_signups

#### ✅ 2-هـ: وحدات الرسوم (4 جداول)
ملف: supabase/05_fee_units.sql
- fee_unit_balances, fee_unit_requests, fee_unit_transactions, quick_sell_subscriptions
- Functions: create_fee_balance_on_signup (1000 وحدة هدية), handle_fee_request_approval

#### ✅ 2-و: الإشعارات (4 جداول)
ملف: supabase/06_notifications.sql
- notifications (21 نوع), news, news_reactions (5 emoji), ads
- Functions: update_news_reactions_count, handle_news_publish

### ✅ المرحلة 3: Shared Components (مكتمل!)
- [x] 3-أ: GridBackground + Layout foundations (layout.tsx + globals.css)
- [x] 3-ب: Navigation — MobileHeader + DesktopHeader + BottomNav + /menu (12 shortcut)
- [x] 3-ج: PageHeader + Dashboard (user home) + Toast helpers
- [x] 3-د: Splash Screens (4 سلايدات + SVG Illustrations + Touch Swipe)
- [x] 3-هـ: Responsive Dashboard (Desktop grid / Mobile stack) + FeaturedSlider + AdsSlider
- [x] 3-و: Finalization (toast.ts + menu PageHeader + HomePage + تحديث التوثيق)

**المكونات المنتجة:**
- Layout: GridBackground, MobileHeader, DesktopHeader, BottomNav, PageHeader
- Common: FeaturedSlider, AdsSlider
- Splash: SplashSlider + SplashIllustrations (4 رسوم SVG)
- Utils: toast.ts (5 أنواع) + cn.ts
- Pages: /, /splash, /dashboard, /menu (12 اختصار)

### ⏸️ المرحلة 4: Authentication & KYC (التالية)
- [ ] 4-أ: صفحة /login (Email + Password)
- [ ] 4-ب: صفحة /register (Email + Password + اسم)
- [ ] 4-ج: Supabase Auth integration (signIn/signUp/signOut)
- [ ] 4-د: Middleware لحماية المسارات
- [ ] 4-هـ: صفحة /kyc (رفع هوية + صورة شخصية)
- [ ] 4-و: ربط KYC مع profiles table

### ⏸️ المراحل القادمة
- المرحلة 5: Dashboard + Market + Portfolio + Wallet
- المرحلة 6: Deals System + Chat
- المرحلة 7: Ambassador + Quick Sell
- المرحلة 8: Admin Panel
- المرحلة 9: التكامل والاختبار
- المرحلة 10: النشر

---

## 🎨 التصميم المعتمد

### الأسلوب
مستوحى من Unbody.com - Dark professional:
- خلفية #000 + Grid 80×80 + نقاط (r=1, #333)
- دوائر متدرجة + Radial Glow
- Text gradient (أبيض → رمادي)
- Corner markers L-shaped
- 0.5px borders, 10-12px radius

### CSS Variables
- bg: #000 / #0A0A0A / #141414
- text: #FFF / #A3A3A3 / #737373
- success: #4ADE80, warning: #FBBF24, danger: #F87171, info: #60A5FA

### ⚠️ ترتيب @import في globals.css
```css
@import url('https://fonts.googleapis.com/css2?family=Tajawal...');
@import "tailwindcss";
```

### Bottom Tab Bar
- آلية: capsule عائمة + sliding indicator + يختفي مع scroll
- تصميم: أسود شفاف + backdrop-blur
- 5 تابات: الرئيسية / السوق / الاستثمار / الصفقات / حسابي

### Splash Screen (4 سلايدات)
كل سلايد: corner markers + concentric circles + status badge + pagination + 3 KPI cards + central illustration (stroke 1.5px أبيض)

### Toast (5 أنواع)
success / warning / error / info / loading
خلفية #0a0a0a + backdrop-blur + 0.5px borders ملونة

---

## 📋 القرارات الـ 30 الأساسية

1. السوق: Primary + Secondary + Auctions
2. العملة: IQD فقط
3. KYC: موافقة يدوية
4. الدفع: خارجي (Zain Cash, Master Card, بنكي)
5. وحدات: 1 = 1 IQD
6. تحميل الوحدات: يدوي من الأدمن
7. الرسوم: البائع يدفع
8. Onboarding: جولة + 1000 وحدة مجاناً
9. المشاريع: الأدمن فقط ينشئها
10. المدة: تختلف حسب النوع
11. **3 محافظ:** Offering 90% / Ambassador 2% / Reserve 8%
12. الأسهم غير المباعة: ترجع للأدمن
13. التسعير الأولي: الأدمن
14. التسعير الثانوي: البائع (بحد أقصى = سعر السوق)
15. **تدفق الصفقة:** طلب → موافقة → دردشة → دفع → إثبات → "إطلاق الحصص" → مكتمل
16. النزاعات: أي طرف يفتح، أدمن يحل
17. السفير: KYC + موافقة أدمن
18. نسبة السفير: 0.5%-2% (الأدمن يحدد)
19. مدة الرابط: شهر (قابل للتجديد)
20. مكافأة السفير: على أول استثمار فقط
21. مصدر المكافأة: محفظة السفير في المشروع
22. المحالون يصيرون سفراء
23. Quick Sell ⚡: 25,000/شهر · 15% أقل · للمشتركين فقط
24. الدردشة: في غرف الصفقات فقط
25. الأسماء/الصور: حقيقية
26. المحتوى: الأدمن فقط ينشر
27. التقييمات: 1-5 نجوم + تعليق + quick tags
28. الإشعارات: In-app + Email + Push
29. التسجيل: Email الآن، Phone لاحقاً
30. الحسابات: مجانية، رسوم على المعاملات فقط

---

## 🏗️ هيكل المشروع
