# 🎨 RailOS — Brand Identity & Design System

> **مصدر مرجعي شامل** للتصاميم الإعلانية، الإعلانات على Social Media، والمحتوى التسويقي.
> كل القيم في هذا الملف **مُستخرَجة مباشرة من الكود** (`app/globals.css`, `components/ui/*`, `app/page.tsx`, `app/(app)/about/page.tsx`).
>
> **Last Updated:** 2026-04-30
> **Version:** RailOS v0.1.0 (Next.js 16 + React 19 + Tailwind v4)

---

## 📌 IDENTITY OVERVIEW

| الحقل | القيمة |
|---|---|
| **Brand Name (AR)** | رايلوس |
| **Brand Name (EN)** | RaiLOS |
| **Tagline** | منصة تنظيم الفرص الاستثمارية |
| **Vision** | نبني مستقبل الاستثمار في العراق |
| **Market** | العراق + المنطقة |
| **Industry** | FinTech / Investment Platform |
| **Direction** | RTL (عربي أساسي + دعم إنجليزي) |
| **Theme** | Dark-first (وضع داكن دائم) |

---

## 🎨 COLOR PALETTE

### Primary (Background & Surface)

| Variable | HEX | الاستخدام |
|---|---|---|
| `--bg-base` | `#000000` | الخلفية الأساسية للصفحة |
| `--bg-surface` | `#0A0A0A` | Sticky headers، Bottom nav، Modals |
| `--bg-card` | `#141414` | Cards الثانوية، Dropdowns |
| `--bg-hover` | `#1F1F1F` | Hover states |
| `--bg-elevated` | `#2a2a2a` | Elevated panels |

**ملاحظة هامة:** الكروت تستخدم `bg-white/[0.05]` لكن CSS يحوّلها لـ `#0f0f0f` صلب (لتجنّب تأثير GridBackground عليها).

### Text Colors

| Variable | HEX | الاستخدام |
|---|---|---|
| `--text-primary` | `#FFFFFF` | العناوين، الأرقام البارزة |
| `--text-body` | `#E5E5E5` | نصوص الـ body الافتراضية |
| `--text-secondary` | `#A3A3A3` | الأوصاف، الـ labels |
| `--text-muted` | `#737373` | النصوص المساعدة |
| `--text-dim` | `#525252` | نصوص باهتة جداً |

### Borders

| Variable | HEX | الاستخدام |
|---|---|---|
| `--border` | `#1a1a1a` | Default borders للكروت |
| `--border-md` | `#2a2a2a` | Borders أوضح |
| `--border-strong` | `#404040` | Borders قوية |

### Accent Colors (Functional)

| Color | HEX | معنى | استخدام |
|---|---|---|---|
| 🟢 **Success** | `#4ADE80` (green-400) | إيجابي، ربح، نجاح | الأرقام الموجبة، حالة Active، KYC موثق |
| 🟡 **Warning** | `#FBBF24` (yellow-400) | تنبيه، تحذير، تأخير | Alerts، Pending state، إعلانات تنتهي |
| 🔴 **Danger** | `#F87171` (red-400) | خطر، خسارة، رفض | الأرقام السالبة، Errors، Rejections |
| 🔵 **Info** | `#60A5FA` (blue-400) | معلومات، روابط، أساسي | CTAs ثانوية، Links، البريد الإلكتروني |
| 🟣 **Premium** | `#C084FC` (purple-400) | مميّز، Pro، حصري | Pro level، الميزات المتقدّمة، Featured |
| 🟠 **Special** | `#FB923C` (orange-400) | عروض، خاص، عاجل | Quick-sell، Cancellation، Special offers |

### Color Usage Pattern (Cards)

| Variant | Pattern | مثال |
|---|---|---|
| **Default** | `bg-white/[0.05] border-white/[0.08]` | Cards عادية |
| **Soft Tint** | `bg-{color}-400/[0.06] border-{color}-400/[0.20]` | Cards ملوّنة لمحتوى مميَّز |
| **Highlighted** | `bg-{color}-400/[0.06] border-{color}-400/[0.25]` | Cards بارزة مع emphasis |
| **Gradient** | `bg-gradient-to-br from-{color}-400/[0.06] to-transparent` | Hero banners |
| **Strong** | `bg-{color}-500 text-white` | CTAs ملوّنة، Status pills |

### Gradients

```css
/* Logo + Brand Name (header on landing) */
background: linear-gradient(180deg, #ffffff 0%, #6a6a6a 100%);
-webkit-background-clip: text;

/* Glow text helper class */
.glow-text { background: linear-gradient(180deg, #ffffff, #6a6a6a); }

/* Card gradients (per color) — direction: bottom-right */
bg-gradient-to-br from-{color}-400/[0.06] to-transparent

/* Avatars */
bg-gradient-to-br from-neutral-700 to-neutral-900

/* Toast (react-hot-toast) */
background: #0a0a0a; border: 0.5px solid #1a1a1a;
```

---

## ✍️ TYPOGRAPHY

### Font Families

| Font | الاستخدام | المصدر |
|---|---|---|
| **Tajawal** (300/400/500/700) | الأساسي العربي + الإنجليزي | Google Fonts (مُحمَّل في `globals.css`) |
| **system-ui / SF Pro / -apple-system** | Fallback | OS native |
| **monospace** | الأرقام، أكواد، إصدارات، IDs | `font-mono` Tailwind |

```css
font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Weights المستخدمة

| Weight | Class | Use |
|---|---|---|
| 300 Light | `font-light` | نادر — captions خفيفة |
| 400 Regular | `font-normal` | نصوص body عادية |
| 500 Medium | `font-medium` | روابط، أزرار ثانوية |
| 700 Bold | `font-bold` | عناوين، أزرار رئيسية، الأرقام |
| 800 ExtraBold | `font-extrabold` | الأرقام الكبيرة جداً (hero stats) |

### Sizes (Tailwind v4 + px)

| Class | Size | الاستخدام |
|---|---|---|
| `text-[8px]` | 8px | Badge xs |
| `text-[9px]` | 9px | Badge sm، Notification dot text |
| `text-[10px]` | 10px | Captions صغيرة، metadata، dates |
| `text-[11px]` | 11px | Caption، Labels، رسوم متناهية الصغر |
| `text-xs` | 12px | Body صغير، تفاصيل ثانوية |
| `text-sm` | 14px | Body افتراضي، أزرار |
| `text-base` | 16px | عناوين Cards، نصوص بارزة |
| `text-lg` | 18px | عناوين Modals، Section titles |
| `text-xl` | 20px | Page Header titles |
| `text-2xl` | 24px | Hero numbers، Section headers |
| `text-3xl` | 30px | Stats كبيرة |
| `text-4xl` | 36px | Brand name (landing) |
| `text-5xl` | 48px | Hero (lg breakpoint) |

### Special

```tsx
// الأرقام دائماً monospace — مهم جداً للترتيب البصري
<span className="font-mono">{value.toLocaleString("en-US")}</span>

// Letter spacing للعناوين
<h1 className="text-4xl font-bold tracking-tight">رايلوس</h1>

// Brand name uppercase mono (English)
<div className="font-mono uppercase tracking-wider">RAILOS</div>

// Line height للنصوص
<p className="leading-relaxed">...</p>      // line-height: 1.625
<p className="leading-tight">...</p>        // line-height: 1.25 (للأرقام الكبيرة)
<p className="leading-none">...</p>         // line-height: 1 (للأرقام البارزة)
```

---

## 📐 LAYOUT & SPACING

### Border Radius

| Class | Value | الاستخدام |
|---|---|---|
| `rounded-md` | 6px | Pills صغيرة |
| `rounded-lg` | 8px | Inputs، Inner sections |
| `rounded-xl` | 12px | الأزرار الرئيسية، Inputs كبيرة، Tabs |
| `rounded-2xl` | 16px | **Cards الأساسية** (الأكثر استخداماً) |
| `rounded-3xl` | 24px | Logo containers، Hero cards |
| `rounded-full` | 9999px | Badges، Avatars، Status pills، Back button |
| `rounded-[40px]` | 40px | BottomNav (capsule float) |
| `rounded-[28px]` | 28px | BottomNav active indicator |

### Spacing (gap / mb / py / px)

| Token | Value | استخدام |
|---|---|---|
| `gap-1` / `mb-1` | 4px | بين عناصر صغيرة جداً (icons + text) |
| `gap-1.5` / `mb-1.5` | 6px | تباعد متناهي الصغر |
| `gap-2` / `mb-2` | 8px | عناصر داخلية |
| `gap-2.5` / `mb-2.5` | 10px | بين رموز ونصوص |
| `gap-3` / `mb-3` | 12px | بين Sections داخلية |
| `gap-4` / `mb-4` | 16px | بين Cards منفصلة |
| `gap-5` / `mb-5` | 20px | تباعد متوسط |
| `gap-6` / `mb-6` | 24px | بين Section كبيرة وصغيرة |
| `gap-7` / `mb-7` | 28px | **Section spacing الأساسي** |
| `mb-8` | 32px | بين Sections كبيرة (Hero → Content) |
| `mb-10` / `mt-10` | 40px | فواصل كبيرة |

### Container Widths

| Class | Use |
|---|---|
| `max-w-sm` (24rem) | صفحات Auth + Landing |
| `max-w-md` (28rem) | Modals صغيرة، single-column dialogs |
| `max-w-2xl` (42rem) | صفحات نموذجية ذات عمود واحد |
| `max-w-3xl` (48rem) | Settings، Profile، Insurance |
| `max-w-4xl` (56rem) | About، Contracts |
| `max-w-5xl` (64rem) | Admin form panels |
| `max-w-screen-2xl` | Footer + Admin Dashboards |

### Padding Patterns

```tsx
// Page container
className="px-4 lg:px-8 py-8 lg:py-12"

// Card padding (sm/md/lg)
sm: p-3        // 12px
md: p-4        // 16px (default للـ Cards الصغيرة)
lg: p-5        // 20px (default للـ Cards الرئيسية)

// Buttons
primary:   px-4 py-2.5 (أو py-3.5 للـ CTAs الكبيرة)
secondary: px-3 py-2 (أو px-2.5 py-1 للـ pills)

// Sections
text-section: mb-3 إلى mb-7
inner-card:   p-3 إلى p-4
hero-card:    p-5 إلى p-6
```

---

## 🧩 COMPONENT STYLES

### 1. Card (الأساسي)

```tsx
// Default
<div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl backdrop-blur p-5 transition-colors">

// مع hover (clickable)
<div className="... cursor-pointer hover:bg-white/[0.06]">

// Gradient (Hero/Banner)
<div className="bg-gradient-to-br from-purple-400/[0.06] to-transparent border border-purple-400/20 rounded-2xl p-5">

// Highlighted (ملوّن أوضح)
<div className="bg-blue-400/[0.06] border border-blue-400/25 rounded-2xl p-5">
```

### 2. Buttons

```tsx
// Primary (الأقوى) — أبيض على أسود
<button className="bg-neutral-100 text-black hover:bg-neutral-200 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">

// Primary CTA (Hero) — أكبر
<button className="bg-neutral-100 text-black hover:bg-neutral-200 py-3.5 rounded-xl font-bold text-sm">

// Secondary — أبيض شفاف على أسود
<button className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-white py-3.5 rounded-xl font-bold text-sm">

// Colored CTA (success / danger / info)
<button className="bg-{color}-500 text-white hover:bg-{color}-600 py-3 rounded-xl font-bold">

// Soft button (subtle)
<button className="bg-{color}-500/[0.15] border border-{color}-500/30 text-{color}-400 hover:bg-{color}-500/[0.20] py-3 rounded-xl font-bold">

// Pill / Badge button
<button className="bg-{color}-400/[0.08] border border-{color}-400/30 text-{color}-400 px-3 py-2 rounded-full text-[11px] font-bold">

// Circular Back button
<button className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center">
  <ArrowRight className="w-4 h-4 text-neutral-300" strokeWidth={1.5} />
</button>
```

### 3. Badge

```tsx
// Soft (الأكثر استخداماً)
<span className="bg-{color}-400/[0.12] border border-{color}-400/30 text-{color}-400 rounded-full text-[9px] px-2 py-0.5 font-bold">جديد</span>

// Solid
<span className="bg-{color}-500 text-white rounded-full text-[9px] px-2 py-0.5 font-bold">VIP</span>

// Outline
<span className="bg-transparent border border-{color}-400/40 text-{color}-400 rounded-full text-[9px] px-2 py-0.5 font-bold">Pro</span>
```

### 4. Input

```tsx
<input
  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/20 transition-colors"
/>

// مع icon prefix (RTL)
<Mail className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
<input className="... pr-10 pl-4" />
```

### 5. Modal

```tsx
// Overlay
<div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4">

  // Sheet (موبايل) / Card (ديسكتوب)
  <div className="bg-[#0a0a0a] border-t border-white/[0.1] sm:border sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
    ...
  </div>
</div>
```

### 6. Tabs

```tsx
// تبويبات خفيفة (size sm)
<Tabs
  tabs={[
    { id: "news", label: "الأخبار" },
    { id: "projects", label: "المشاريع" },
  ]}
  size="sm"
/>
```

### 7. Toast (react-hot-toast config)

```ts
{
  position: "top-center",
  style: {
    background: '#0a0a0a',
    color: '#fff',
    border: '0.5px solid #1a1a1a',
    borderRadius: '10px',
    fontSize: '13px',
  }
}
```

---

## ✨ VISUAL EFFECTS

### Glassmorphism

```tsx
// Cards الأساسية
className="backdrop-blur"

// Headers (sticky) + Modals
className="bg-[rgba(0,0,0,0.85)] backdrop-blur-xl"
className="bg-[rgba(15,15,15,0.92)] backdrop-blur-2xl"  // BottomNav
```

### Grid Background (هوية بصرية أساسية)

```svg
<!-- خطوط 80×80 + نقاط عند التقاطعات -->
<pattern width="80" height="80">
  <path d="M 80 0 L 0 0 0 80" stroke="#1a1a1a" strokeWidth="0.5" />
  <circle cx="0" cy="0" r="1" fill="#333" />
</pattern>

<!-- Concentric circles + Radial glow في الوسط (اختياري) -->
<circle r="220" stroke="#1a1a1a" />
<circle r="170" stroke="#222" />
<circle r="120" stroke="#2a2a2a" />
<circle r="75"  stroke="#333" />

<!-- L-shaped corner markers (اختياري) -->
opacity-50 stroke="white" strokeWidth="1"
```

### Glows & Shadows

```tsx
// Notification dot glow
shadow-[0_0_4px_rgba(248,113,113,0.6)]   // red dot

// Status indicator pulse
className="bg-green-400 animate-pulse"     // النظام يعمل
shadow-[0_0_6px_rgba(74,222,158,0.6)]     // green pulse

// Card shadow
shadow-2xl       // بطاقات الـ Hero
shadow-inner     // BottomNav active indicator

// Toast / Modal
border: 0.5px solid rgba(255,255,255,0.06)
```

### Transitions

```tsx
transition-colors    // الأكثر استخداماً (بطاقات + أزرار)
duration-200         // سريع (Active state)
duration-300         // متوسط (Modal slide-in)
ease-out             // BottomNav indicator + fade-in
```

### Animations (Custom CSS)

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes bounceIn {
  0%   { opacity: 0; transform: scale(0.7); }
  70%  { opacity: 1; transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* استخدام */
animate-[fadeIn_0.8s_ease-out]
animate-[bounceIn_1s_ease-out]
animate-pulse        /* Tailwind built-in */
animate-spin         /* Loaders */
```

---

## 🎯 ICONS

### Library: `lucide-react@1.x`

```ts
import { Shield, FileText, Lock, Mail, Phone } from "lucide-react"
```

### Style Guide

```tsx
// Stroke width
strokeWidth={1.5}   // افتراضي (لأيقونات UI الخفيفة)
strokeWidth={2}     // أيقونات عادية
strokeWidth={2.5}   // CTAs البارزة

// Sizes
className="w-2.5 h-2.5"   // 10px — Inline في badges
className="w-3 h-3"        // 12px — Captions، Inline في pills
className="w-3.5 h-3.5"    // 14px — Inline في buttons صغيرة
className="w-4 h-4"        // 16px — UI افتراضي
className="w-5 h-5"        // 20px — Hero في cards
className="w-6 h-6"        // 24px — Modal close، Hero
className="w-8 h-8"        // 32px — Logos، Avatars
className="w-10 h-10"      // 40px — Hero في Banners

// Container للأيقونة
<div className="w-10 h-10 rounded-xl bg-{color}-400/[0.15] border border-{color}-400/30 flex items-center justify-center">
  <Icon className="w-5 h-5 text-{color}-400" strokeWidth={1.5} />
</div>
```

### الأيقونات الأكثر استخداماً (top 25)

| Icon | الاستخدام |
|---|---|
| `Home` | BottomNav الرئيسية |
| `TrendingUp` | السوق، Cards المشاريع، Stats الإيجابية |
| `BarChart3` | الاستثمار، Analytics |
| `Users` | المجتمع، الأيتام، الأعضاء |
| `User` | حسابي، Profile |
| `Shield` | KYC، الأمان، Trust badges |
| `Lock` | الخصوصية، Escrow، التشفير |
| `FileText` | شروط، عقود، مستندات |
| `Mail` | البريد، التواصل |
| `Phone` | الهاتف، التواصل |
| `Bell` | الإشعارات |
| `Grid3x3` | القائمة الرئيسية |
| `HelpCircle` | الدعم الفني |
| `BookOpen` | الأدلّة |
| `Briefcase` | الاستثمار، الأعمال |
| `Coins` | وحدات الرسوم، العملة |
| `Heart` | المتابعة، الصدقات |
| `Star` | السفير، التقييمات، Featured |
| `Zap` | البيع السريع، Quick actions |
| `Building2` | الشركات، المجلس، المباني |
| `Settings` | الإعدادات |
| `Newspaper` | الأخبار |
| `Fingerprint` | تسجيل الدخول البيومتري |
| `ChevronLeft / ArrowRight` | الرجوع، التنقّل |
| `Check / CheckCircle2` | التأكيد، النجاح |

---

## 📝 BRAND VOICE & MESSAGING

### Tagline الرسمي

> **رايلوس — منصة تنظيم الفرص الاستثمارية**

### Hero Headlines (المُستخرجة من الكود)

| الموقع | النص |
|---|---|
| Landing | `رايلوس` (مع gradient أبيض → رمادي) |
| About Hero | `نبني مستقبل الاستثمار في العراق` |
| Mission | `منصة تقنية متخصصة في تنظيم وإدارة الفرص الاستثمارية، تربط المستثمرين بالشركات وأصحاب المشاريع الواعدة في العراق والمنطقة` |
| Vision | `نؤمن أن الوصول للفرص الاستثمارية يجب أن يكون متاحاً للجميع — شفافاً، آمناً، وسهلاً` |

### Core Values (الأربعة الأساسية)

| القيمة | الوصف | اللون |
|---|---|---|
| 🔒 **الأمان** | حماية أموالك وبياناتك بأعلى معايير الأمان | Blue |
| 🌐 **الشفافية** | معلومات واضحة وصادقة لكل عملية وصفقة | Green |
| 🤝 **الثقة** | بناء علاقات استثمارية قائمة على الثقة المتبادلة | Purple |
| 🚀 **الابتكار** | تقنية حديثة لتجربة استثمارية لا مثيل لها | Yellow |

### Trust Badges (المعروضة في Footer)

- ✅ **KYC موثق** (Green)
- 🔒 **مشفّر** (Blue)
- 🟢 **النظام يعمل** (Green pulse)

### Call-to-Actions الأساسية

| CTA | الموقع |
|---|---|
| `تسجيل الدخول` | Landing primary |
| `إنشاء حساب` | Landing secondary |
| `متابعة باستخدام Google` | OAuth |
| `فتح الصفقة + تعليق` | Exchange (Escrow) |
| `تأكيد الدفع` | Deal flow (Buyer) |
| `تحرير الحصص للمشتري` | Deal flow (Seller) |
| `اشترك في {plan}` | Insurance |
| `ابدأ الكفالة` | Orphans |
| `فتح تذكرة دعم` | Support |

### Notification Tone (استخدام الإيموجي)

```
🤝 صفقة جديدة على إعلانك
🔒 تم تعليق حصصك
💳 المشتري أكّد الدفع
✅ تم تحرير الحصص لك
🚫 البائع طلب إلغاء
⚖️ تم فتح نزاع
🎉 اكتملت الصفقة بنجاح
⏰ انتهى وقت الصفقة
```

---

## 📊 KEY METRICS DISPLAYED

من صفحة About + الواجهات (مُستخرَجة من الكود):

| الرقم | الوصف |
|---|---|
| **+500** | مستثمر مسجل |
| **+50** | مشروع نشط |
| **+2م** | حجم التداول (IQD) |
| **98%** | رضا المستخدمين |
| **+12K** | مستخدم (واجهات أخرى) |
| **18.4%** | متوسط العائد |
| **+47** | مشروع نشط |

### Project Returns (نطاق العوائد المتوقّعة)

```
8% — 22% سنوياً (حسب نوع المشروع والمخاطر)
```

### Insurance Tiers (من Healthcare)

| الخطّة | القسط الشهري | الحدّ السنوي |
|---|---|---|
| 🔵 أساسي | 3,000 د.ع | 1 مليون د.ع |
| 🟣 متقدّم | 6,000 د.ع | 3 مليون د.ع |
| 🟢 محترف | 12,000 د.ع | 9 مليون د.ع |

---

## 🏷️ LOGO USAGE

### Files

| File | Path | Format |
|---|---|---|
| Logo (primary) | `/public/logo.png` | PNG |
| Icon (PWA + favicon) | `/public/icon.png` | PNG |

### Logo Sizes في التطبيق

| السياق | Size | Container |
|---|---|---|
| Landing | 128×128 lg:160×160 | `rounded-3xl` |
| Mobile Header | 36×36 | `rounded-lg` |
| Footer | 40×40 | `rounded-xl` |
| About hero | 40×40 | `rounded-xl` |

### Container Pattern

```tsx
<div className="rounded-{xl|3xl} overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black">
  <Image src="/logo.png" alt="رايلوس" width={N} height={N} />
</div>
```

### Clear Space Rules

- **Minimum padding:** نصف عرض اللوغو حول الشعار
- **خلفية:** سوداء فقط (`bg-black`) أو شفافة على dark surface
- **لا** يُوضع على ألوان ساطعة أو خلفيات صورة
- **لا** يُمدَّد أو يُقلَب — احتفظ بالنسب 1:1

---

## 🎬 USE CASES (مقاسات الإعلانات)

### Social Media Content

| المنصة | المقاس | استخدام |
|---|---|---|
| **Instagram Feed** | 1080×1080 (1:1) | Posts، إعلانات منتظمة |
| **Instagram Story / Reels** | 1080×1920 (9:16) | Stories، Reels |
| **TikTok** | 1080×1920 (9:16) | فيديوهات قصيرة |
| **Facebook Feed** | 1200×630 (1.91:1) | Link posts |
| **Twitter/X Card** | 1600×900 (16:9) | Tweet cards |
| **YouTube Thumbnail** | 1280×720 (16:9) | Video covers |
| **YouTube Banner** | 2560×1440 | Channel art |
| **LinkedIn Post** | 1200×627 | شركات + B2B |

### Print + Other

| النوع | المقاس |
|---|---|
| Banner ads (web) | 728×90، 300×250، 160×600 |
| Outdoor banner | 1080×1920 vertical / 1920×1080 horizontal |
| Email header | 600×200 |
| Print A4 | 2480×3508 px @ 300 dpi |

---

## 🤖 AI GENERATION PROMPTS

### Prompt 1 — Hero Banner (DALL-E / Midjourney)

```
A premium fintech app interface for Iraqi investment platform "رايلوس" (RaiLOS),
showing a dark navy-black gradient background (#000000 to #0A0A0A) with a subtle
80px grid pattern in #1a1a1a, concentric circles glow effect in center,
modern Arabic typography (Tajawal font), glowing accent colors:
green #4ADE80 for positive numbers, blue #60A5FA for info elements,
glassmorphism cards with white/[0.05] backdrop-blur, rounded-2xl corners (16px),
white-to-gray gradient text for the brand name, clean minimal investment dashboard
showing project cards, returns percentages, KYC trust badges,
ultra-clean, modern, professional, trustworthy, dark mode UI design.
8K, hyperrealistic, mockup ready, RTL Arabic interface.
--ar 16:9 --v 6 --style raw
```

### Prompt 2 — Story Ad (Vertical 9:16)

```
Vertical mobile ad for Iraqi investment app "رايلوس" — 1080x1920 portrait,
dark theme (#000000 base, #0F0F0F cards), Tajawal Arabic font,
Hero text top: "نبني مستقبل الاستثمار في العراق" in white-gradient,
Center: phone mockup showing investment dashboard with green +18.4% return,
yellow alert pill "تنبيهات تحتاج انتباهك", purple Pro badge,
Bottom CTA button: "ابدأ الآن" in white on black,
Subtle grid background pattern, glow effects, glassmorphism cards,
RTL Arabic layout, premium fintech aesthetic, Iraqi investment platform vibe.
Clean, minimal, trust-building, dark luxury.
--ar 9:16 --v 6 --style raw --q 2
```

### Prompt 3 — Square Post (1:1) — Feature Highlight

```
Square Instagram post 1080x1080 for RaiLOS investment platform feature reveal:
"نظام Escrow — حماية كاملة للحصص",
Centered icon: golden lock 🔒 in glowing yellow circle,
Background: deep black (#000) with subtle dot grid (#333 dots, 80px spacing),
Two side-by-side cards showing flow: "تعليق الحصص" → "تحرير عند الإكمال",
Color accents: yellow #FBBF24 for security, green #4ADE80 for completion,
Bottom right: small RaiLOS logo (3-cube icon + Arabic text),
Tajawal bold Arabic typography, RTL layout,
Modern fintech infographic style, dark luxury palette,
Shareable, scroll-stopping, premium feel.
--ar 1:1 --v 6 --quality 2
```

### Prompt 4 — Landscape Banner (16:9)

```
Wide cinematic banner 1920x1080 for RaiLOS Iraqi investment app launch,
Dark futuristic background: pure black with grid pattern + concentric glow circles,
Left side: large 3D phone mockup with the app showing returns chart 8%-22%,
Right side: Arabic headline "استثمر في العراق بأمان" Tajawal ExtraBold,
Below: 4 trust pills horizontally: "KYC موثق", "Escrow", "حماية كاملة", "محلي",
Subtle blue (#60A5FA) and green (#4ADE80) accent glows in corners,
Tagline bottom: "منصة تنظيم الفرص الاستثمارية" in light gray,
Premium, trustworthy, modern, 8K rendering, professional fintech advertising.
--ar 16:9 --v 6 --style raw --quality 2
```

### Prompt 5 — Product Showcase (for Sora / Runway video)

```
Cinematic 10-second product video for "رايلوس" Iraqi investment app:
Open with black screen + white text fade-in "رايلوس" (Tajawal Bold),
Camera dolly forward through floating UI cards (glassmorphism, dark theme),
Each card shows: project image, +18.4% green return badge, trust shield icon,
Smooth glowing trails follow card transitions (yellow + green hex colors),
Background: deep black (#000) with animated 80px grid pattern moving slowly,
Concentric circles pulse in center as ambient backdrop,
End: full-screen logo (3-cube icon) bouncing in (scale 0.7 → 1.05 → 1.0),
Text reveal: "ابدأ الاستثمار اليوم" with arrow CTA,
Style: Apple keynote meets premium banking ad, ultra-minimal, RTL Arabic,
24fps, dark cinematic LUT, subtle particle FX.
```

### Prompt 6 — Print Ad / Magazine Spread

```
Full-page A4 magazine ad (2480x3508 @300dpi) for RaiLOS investment platform,
Top 60%: bold visual — hand holding modern smartphone showing dashboard,
Phone screen: investment portfolio with green +24% gain, project cards,
escrow lock icon glowing yellow, Tajawal Arabic UI throughout,
Background gradient: charcoal black at top fading to deeper black bottom,
Subtle white dot grid pattern (80px spacing, very low opacity),
Bottom 40%: "نبني مستقبل الاستثمار في العراق" headline in white-gradient,
Below: 3 USPs in pills: "🔒 KYC موثق", "💰 عوائد 8-22%", "🇮🇶 محلي 100%",
Footer: RaiLOS logo + Arabic text + "railostrade@gmail.com" + phone "07721726518",
Clean, premium, editorial design, dark luxury fintech aesthetic,
Tajawal font family throughout, RTL composition.
```

### Prompt Engineering Tips for RaiLOS

```
✅ DO use these keywords:
- "dark luxury fintech", "Iraqi investment platform"
- "Tajawal Arabic typography", "RTL layout"
- "glassmorphism", "subtle grid pattern", "80px spacing"
- "white/[0.05] cards", "rounded-2xl", "backdrop-blur"
- "premium, trustworthy, minimal"
- Specific HEX values: #000000, #4ADE80, #FBBF24, #60A5FA

❌ AVOID:
- bright/colorful backgrounds (always dark)
- Latin-only typography (always Arabic primary)
- cartoon/playful style (always professional)
- light mode (always dark)
- saturated colors (use muted accents)
```

---

## 🎁 ASSETS CHECKLIST (للمصممين)

### Color tokens (ready-to-use)

```css
:root {
  /* Primary */
  --bg: #000000;
  --surface: #0A0A0A;
  --card: #0F0F0F;

  /* Text */
  --text: #FFFFFF;
  --text-muted: #A3A3A3;

  /* Accents */
  --green: #4ADE80;
  --yellow: #FBBF24;
  --red: #F87171;
  --blue: #60A5FA;
  --purple: #C084FC;
  --orange: #FB923C;

  /* Borders */
  --border: rgba(255,255,255,0.08);
}
```

### Typography snippet

```css
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');

body {
  font-family: 'Tajawal', sans-serif;
  font-size: 14px;
  background: #000;
  color: #E5E5E5;
  direction: rtl;
}

h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.02em; }
h2 { font-size: 24px; font-weight: 700; }
.mono { font-family: 'SF Mono', Menlo, monospace; }
```

### Reusable Card pattern

```html
<div style="
  background: rgba(255,255,255,0.05);
  border: 0.5px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(8px);
">
  Card content
</div>
```

---

## 📞 BRAND CONTACT

| نوع | القيمة |
|---|---|
| **Email** | railostrade@gmail.com |
| **Phone** | 07721726518 (+9647721726518) |
| **Working Hours** | 8 ص - 10 م |
| **Domain (TBD)** | railos.iq / railos.app |

---

## 📚 FILES REFERENCED (مصادر هذا الـ Document)

```
✅ app/globals.css                       (CSS variables + overrides)
✅ app/layout.tsx                        (Toast config + metadata)
✅ app/page.tsx                          (Landing hero)
✅ app/(app)/about/page.tsx              (Brand voice + stats + values)
✅ app/(app)/dashboard/page.tsx          (Footer reference + alerts pattern)
✅ components/ui/Card.tsx                (Card variants × colors)
✅ components/ui/Badge.tsx               (Badge variants × sizes)
✅ components/layout/Footer.tsx          (Trust badges + CTAs)
✅ components/layout/GridBackground.tsx  (Pattern + corners)
✅ components/layout/MobileHeader.tsx    (Logo placement)
✅ lib/utils/version.ts                  (Brand name + tagline)
✅ public/logo.png + public/icon.png     (Logo files)
```

---

> **استخدام هذا الملف:**
> أرسله مع أي طلب تصميم، أو افتح أي قسم منه ونسخ القيم مباشرةً للتطبيق في:
> Figma، Photoshop، Illustrator، Midjourney، DALL-E، Canva، Sketch.
>
> **🤝 جميع القيم مُتزامنة مع الكود الفعلي للمشروع.**
> أيّ تعديل في الكود → حدِّث هذا الملف ليبقى مصدر الحقيقة.
