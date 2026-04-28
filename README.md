# Railos — منصة الاستثمار العراقية

> منصة استثمارية رقمية عراقية: شراء وبيع حصص في مشاريع موثّقة عبر قطاعات متعدّدة.
>
> **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase · Recharts

---

## 🌟 نظرة عامة

**Railos** هو تطبيق ويب (PWA-ready) يربط المستثمرين العراقيين بفرص استثمارية موثّقة في الزراعة والعقارات والصناعة والتجارة. الهدف: تمكين الاستثمار الجزئي بحدّ أدنى منخفض، وتوفير سيولة فورية عبر سوق ثانوية للحصص.

### المزايا الرئيسية
- 🏠 **لوحة قيادة شخصية** مع ملخص محفظة + sparkline + تنبيهات
- 📊 **تحليلات استثمار شاملة** (أداء تاريخي / توزيع قطاعات / KPIs / حاسبة أرباح)
- 🛒 **سوق متكامل** للمشاريع والشركات مع فلاتر ذكية + tabs (أخبار/مشاريع/شركات/عروض)
- 💱 **تبادل P2P** للحصص بين المستثمرين + بيع سريع Premium
- 🏛️ **مجلس السوق** — نظام تصويت + انتخابات + شفافية كاملة
- 🤝 **عقود جماعية** مع توزيع تلقائي + رسوم 0.10%
- 💎 **محفظة وحدات الرسوم** مع سجل العمليات
- ⚖️ **مزادات تفاعلية** مع countdown + تقديم عروض حية
- ❤️ **متابعة المشاريع والشركات** مع unfollow سريع
- 🎬 **Splash screen + Google OAuth** + PWA install prompt
- 🎯 **نظام مستويات** (basic / advanced / pro) مع حدود متدرّجة
- 💰 **توزيعات أرباح** ربعية + Stability Fund تلقائي
- 🆘 **دعم شامل** (FAQ + tickets + chat + WhatsApp)
- 📱 **RTL Arabic** كامل + Tajawal font + PWA installable

---

## 🛠️ التقنيات المستخدمة

| الطبقة | التقنية | الإصدار |
|---|---|---|
| Framework | Next.js (App Router + Turbopack) | 16.2.4 |
| UI Runtime | React | 19.2.4 |
| اللغة | TypeScript (strict) | ^5 |
| Styling | Tailwind CSS 4 | ^4 |
| Authentication | Supabase Auth | 2.104.1 |
| Charts | Recharts | 3.8.1 |
| Icons | Lucide React | ^1.11 |
| Toasts | react-hot-toast | ^2.6 |
| Class Utility | clsx + tailwind-merge | latest |

> 🪶 **Bundle clean**: 10 dependencies فقط بعد cleanup (كانت 27).

---

## 🚀 التشغيل المحلي

### المتطلبات
- Node.js 20+
- npm أو pnpm
- Windows / macOS / Linux

### الخطوات

```bash
# 1. استنساخ المشروع
cd RailOS

# 2. تثبيت الحزم
npm install

# 3. إعداد متغيّرات البيئة (للـ Supabase)
cp .env.example .env.local
# عدّل القيم في .env.local

# 4. تشغيل dev server
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000).

### الأوامر المتاحة

| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل dev server (Turbopack) |
| `npm run build` | بناء production |
| `npm run start` | تشغيل production server |
| `npm run lint` | فحص ESLint |
| `npx tsc --noEmit` | فحص TypeScript بدون بناء |

---

## 📁 بنية المشروع

```
RailOS/
├── app/                         # Next.js App Router
│   ├── (app)/                   # الصفحات الرئيسية (بعد تسجيل الدخول)
│   │   ├── dashboard/           # الرئيسية — 7 sections
│   │   ├── market/              # السوق + market/new
│   │   ├── portfolio/           # المحفظة الكاملة
│   │   ├── investment/          # لوحة تحليلات (6 sections)
│   │   ├── exchange/            # تبادل P2P + create
│   │   ├── wallet/              # send + receive + fee-units
│   │   ├── contracts/           # عقود جماعية + create + [id]
│   │   ├── auctions/            # المزادات + auctions/[id] (تفاصيل + تقديم عروض)
│   │   ├── council/             # مجلس السوق (about/members/proposals/[id]/elections)
│   │   ├── following/           # متابعتي (مشاريع + شركات)
│   │   ├── community/           # المجتمع + chat
│   │   ├── orders/              # تاريخ الصفقات
│   │   ├── notifications/       # الإشعارات
│   │   ├── profile/             # الملف الشخصي + Premium
│   │   ├── profile-setup/       # إعداد بعد التسجيل
│   │   ├── settings/            # الإعدادات (5 tabs)
│   │   ├── support/             # الدعم + FAQ
│   │   ├── news/                # الأخبار
│   │   ├── kyc/                 # التوثيق
│   │   ├── ambassador/          # برنامج السفير
│   │   ├── reset-password/      # تغيير كلمة المرور
│   │   ├── project/[id]/        # تفاصيل مشروع
│   │   ├── company/[id]/        # تفاصيل شركة
│   │   ├── deal-chat/[id]/      # محادثة صفقة
│   │   ├── about / terms / privacy / app-guide / investment-guide
│   ├── (auth)/                  # login + register + forgot-password
│   ├── admin/                   # لوحة الإدارة (11 panel + 5 advanced)
│   ├── admin-login/
│   └── splash/
│
├── components/
│   ├── ui/                      # Primitives — 8 مكوّنات (Card/SectionHeader/StatCard/Modal/Skeleton/EmptyState/Badge/Tabs)
│   ├── cards/                   # CompanyCard + ProjectCard
│   ├── layout/                  # AppLayout/Header/Footer/PageHeader/BottomNav/GridBackground
│   ├── common/                  # AdsSlider
│   ├── admin/                   # 16 admin panels
│   ├── deals/                   # CreateDealModal + DealRequestModal
│   ├── contracts/               # ContractLimitCard
│   └── splash/
│
├── lib/
│   ├── mock-data/               # 21 ملف بيانات وهمية مركزية + helpers
│   │   ├── projects, companies, holdings, users, profile
│   │   ├── contracts, trades, notifications, auctions, ads
│   │   ├── listings, ambassador, support, deal, news
│   │   ├── market, feeUnits, following, council  (Phase 5+8)
│   │   └── index.ts (barrel)
│   ├── market/                  # محرّك السوق السرّي (server-only)
│   │   ├── engine, development, stability, types
│   │   └── index.ts (import "server-only")
│   ├── supabase/                # client + server + auth-helpers
│   ├── realtime/                # RealtimeProvider (WIP — mock حالياً)
│   ├── admin/                   # admin types + mock-data
│   └── utils/                   # cn + toast + version + contractLimits
│
├── public/                      # assets ثابتة (logo + svg)
├── proxy.ts                     # Next 16 middleware (auth — معطّل dev mode)
├── globals.css                  # Tailwind 4 + CSS overrides للكروت الصلبة
└── tsconfig.json                # strict mode
```

### إحصائيات المشروع

| المقياس | القيمة |
|---|---|
| **Pages** | 54 صفحة |
| **Components** | 44 (+ 8 UI primitives) |
| **mock-data files** | 21 |
| **API routes** | 3 (`/api/market/*`) |
| **DB migrations** | 1 (Market engine — 7 tables) |
| **Lines of TS/TSX** | ~30,200 |
| **TypeScript errors** | 0 ✅ |
| **All routes HTTP 200** | 54/54 ✅ |

---

## 🎨 نظام التصميم

### الألوان

| Token | Tailwind | الاستخدام |
|---|---|---|
| Success | `green-400` (#4ADE80) | إيجابي، ربح، مكتمل |
| Warning | `yellow-400` (#FBBF24) | تنبيه، انتظار |
| Danger | `red-400` (#F87171) | خطر، خسارة، حذف |
| Info | `blue-400` (#60A5FA) | معلومة |
| Premium | `purple-400` (#C084FC) | ميزة مدفوعة |
| Special | `orange-400` (#FB923C) | تمييز |

### Border Radius
- chips/badges: `rounded-full`
- buttons: `rounded-lg`
- cards: `rounded-2xl`
- inputs: `rounded-xl`

### UI Primitives

استخدم من `@/components/ui` بدلاً من inline styling:

```tsx
import { Card, SectionHeader, StatCard, Modal, Skeleton, EmptyState, Badge, Tabs } from "@/components/ui"
```

كل primitive له variants + sizes موحّدة. راجع `PHASE4_REPORT.md` للتفاصيل.

---

## 🔐 الأمان

- **Authentication**: Supabase Auth (email/password) — `lib/supabase/auth-helpers.ts`
- **Session middleware**: `proxy.ts` (معطّل في dev mode للتطوير السريع)
- **CSP headers**: مدمجة في Next.js 16 default
- **Password rules**: 8+ chars + upper/lower/digit/symbol (مطبّق في `/reset-password`)

---

## 📊 Mock Data Strategy

كل البيانات الوهمية مركّزة في `lib/mock-data/` — **مصدر واحد للحقيقة**:

```tsx
import { PROJECTS, mockProjects, CURRENT_USER, getPortfolioSummary } from "@/lib/mock-data"
```

عند ربط Supabase (Phase 7)، يُستبدل كل helper بـ async query من DB، والصفحات لا تتأثر.

---

## 📜 المراحل المنجزة

| المرحلة | الموضوع | تقرير |
|---|---|---|
| 0 | توحيد Mock Data + حذف المكرّرات | `REFACTOR_REPORT.md` |
| 1 | إصلاح Dead Routes الحرجة | `PHASE1_REPORT.md` |
| 2 | تطوير Dashboard | `PHASE2_REPORT.md` |
| 2.5 | تنظيف Dashboard وإعادة الترتيب | `PHASE2_5_REPORT.md` |
| 3 | إعادة بناء Investment Analytics | `PHASE3_REPORT.md` |
| 4 | UI Primitives احترافية | `PHASE4_REPORT.md` |
| 5 | 4 صفحات أساسية (`/news`, `/profile`, `/support`, `/settings`) | `PHASE5_REPORT.md` |
| 5-A | محرّك السوق السرّي + 3 لوحات أدمن | `PHASE5A_REPORT.md` |
| 5-B | تكميل المنطق + ربط الواجهات + إشعارات السوق | `PHASE5B_REPORT.md` |
| 6 | Audit + تنظيف + Beta launch prep | `PHASE6_REPORT.md` |
| 8-A | Splash + PWA + 6 إصلاحات | `PHASE8A_REPORT.md` |
| 8-B | تفاصيل المزاد + إنهاء العقد + المتابعة | `PHASE8B_REPORT.md` |
| 8-C | مجلس السوق الكامل (6 صفحات + التصويت + الانتخابات) | `PHASE8C_REPORT.md` |
| 8-Audit | فحص شامل + تنظيف + توثيق | `PHASE8_AUDIT_REPORT.md` |

---

## 🚧 خطّة Beta Launch

### Phase 7 (القادمة): ربط Supabase
- [ ] إنشاء schema (users, projects, holdings, deals, contracts, notifications, ...)
- [ ] استبدال mock helpers بـ Supabase queries
- [ ] تفعيل `proxy.ts` للجلسات الحقيقية
- [ ] Realtime subscriptions (deals + notifications)

### Phase 8: Production Hardening
- [ ] Tests (Jest + React Testing Library + Playwright)
- [ ] Lighthouse CI (≥ 90 على كل الـ metrics)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Bundle size analysis + lazy loading
- [ ] Sentry/PostHog للـ error tracking + analytics

### Phase 9: PWA + Deployment
- [x] PWA manifest + meta tags ✅ (Phase 8-A)
- [x] Install prompt (Add to Home Screen) ✅ (Phase 8-A)
- [ ] Service worker (offline mode)
- [ ] Push notifications (Web Push API + VAPID keys مُعدّة في .env)
- [ ] Deploy على Vercel + custom domain

---

## 📞 التواصل

- **البريد:** railostrade@gmail.com
- **الهاتف:** +964 772 172 6518
- **WhatsApp:** نفس الرقم
- **ساعات العمل:** 9 ص – 6 م

---

## 📄 الترخيص

Private — All rights reserved © 2026 Railos.
