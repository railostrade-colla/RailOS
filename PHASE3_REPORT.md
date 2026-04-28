# 📊 PHASE 3 REPORT — إعادة بناء `/investment` كلوحة تحليلات شاملة

> **التاريخ:** 2026-04-26
> **النوع:** إعادة بناء كاملة للصفحة + helpers جديدة
> **الهدف:** صفحة "مشروع واحد" → لوحة تحليلات بـ 6 أقسام احترافية
> **الالتزام:** كل البيانات من `@/lib/mock-data` — لا تكرار

---

## 1. helpers الجديدة في `lib/mock-data/`

### 📁 `lib/mock-data/holdings.ts`

أُضيف helper كامل + 4 interfaces:

```ts
export interface PerformanceRow extends Holding {
  cost: number
  profit: number
  profitPercent: number
}

export interface SectorSlice { name: string; value: number; percent: number }
export interface HistoricalPoint { month: string; value: number }
export interface InvestmentAnalytics {
  totalValue, totalCost, totalProfit, totalProfitPercent,
  holdingsCount, sectorsCount, avgReturnPerYear, avgHoldingMonths,
  performance, bestPerformers, worstPerformers,
  sectorDistribution, historicalData
}

export function getInvestmentAnalytics(userId = "me"): InvestmentAnalytics
```

**الوظيفة:**
- يحسب `totalValue` و `totalCost` و `totalProfit` و `totalProfitPercent` من HOLDINGS
- يولّد `performance[]` لكل holding مع cost/profit/profitPercent محسوبة
- يرتّب `bestPerformers` (top 3) و `worstPerformers` (bottom 3)
- يجمع `sectorDistribution` كـ `{ name, value, percent }[]`
- يولّد `historicalData` 12 شهر بـ sin-wave noise (deterministic)

### 📁 `lib/mock-data/trades.ts`

أُضيف type + array + 2 helpers:

```ts
export type DistributionType = "ربح ربعي" | "ربح سنوي" | "توزيع نهائي"

export interface Distribution {
  id, date, project_name, sector, amount, type
}

export const DISTRIBUTIONS: Distribution[]   // 5 entries
export function getDistributionsByUser(userId = "me"): Distribution[]
export function getTotalDistributions(userId = "me"): number
```

**5 توزيعات mock:**
| التاريخ | المشروع | المبلغ | النوع |
|---|---|---:|---|
| 2026-04-15 | مزرعة الواحة | 450,000 | ربح ربعي |
| 2026-03-20 | برج بغداد | 850,000 | ربح ربعي |
| 2026-02-10 | نخيل العراق | 320,000 | ربح ربعي |
| 2026-01-05 | مزرعة الواحة | 380,000 | ربح ربعي |
| 2025-12-15 | برج بغداد | 720,000 | ربح ربعي |
| **المجموع** | — | **2,720,000 د.ع** | — |

> ✅ `trades.ts` كان مُصدَّراً سلفاً من `index.ts` — لم تُلمَس البنية الحالية.

---

## 2. الأقسام الـ 6 الجديدة

| # | القسم | الوصف | البيانات |
|---:|---|---|---|
| **1** | 🏆 HERO — ملخص المحفظة | الرقم الكبير (5xl font-mono) + شارة التغيّر اليومي + 4 stats grid (ربح/عدد/قطاعات/عائد) | `getInvestmentAnalytics()` |
| **2** | 📈 الأداء التاريخي | AreaChart `recharts` بـ gradient أخضر/أحمر + 4 buttons فلاتر (1ش/3ش/6ش/سنة) + 3 mini stats (أعلى/أدنى/نمو) | `analytics.historicalData` |
| **3** | 🥧 توزيع القطاعات + 📊 KPIs | عمودان متجاوران: PieChart (innerRadius 50, outerRadius 80, ألوان حسب القطاع) + 5 KPI rows | `analytics.sectorDistribution` + KPIs |
| **4** | 📊 كل استثماراتي | جدول كامل مع Search + Sort dropdown (4 خيارات) — responsive (cards mobile / row desktop) | `analytics.performance` (filtered + sorted) |
| **5** | 🏅 أفضل/أسوأ أداء | عمودان: 🏆 Top 3 (green theme) + 📉 Bottom 3 (orange/red theme) | `analytics.bestPerformers` + `worstPerformers` |
| **6** | 💰 التوزيعات + 🧮 الحاسبة | عمودان: Timeline بـ 5 توزيعات (green dots + line) + Calculator بـ 3 periods (6ش/سنة/3س) | `getDistributionsByUser()` + computed |

---

## 3. عدد السطور قبل/بعد

| الملف | قبل | بعد | الفرق |
|---|---:|---:|---:|
| `app/(app)/investment/page.tsx` | **474** | **769** | **+295** ↑ |
| `lib/mock-data/holdings.ts` | 157 | **257** | +100 (analytics types + helper) |
| `lib/mock-data/trades.ts` | 80 | **142** | +62 (Distribution type + 5 entries + 2 helpers) |
| **مجموع المُضاف** | — | — | **+457 سطر** |

> 🎯 الزيادة في dashboard مبرّرة: 6 أقسام تحليلية + 2 sub-components (`PerformanceRowItem`, `PerformerCard`) + 4 charts.

---

## 4. Charts المستخدمة (recharts)

| القسم | Chart | الإعدادات |
|---|---|---|
| § 2 الأداء التاريخي | `AreaChart` + `Area` | gradient أخضر/أحمر، height=h-64، tooltip مخصّص |
| § 3 توزيع القطاعات | `PieChart` + `Pie` + `Cell` | donut (innerRadius=50, outerRadius=80)، 6 ألوان حسب القطاع |

### Cell colors per sector
```ts
const SECTOR_COLORS = {
  "زراعة": "#4ADE80",  // green
  "عقارات": "#60A5FA", // blue
  "صناعة": "#FB923C",  // orange
  "تجارة": "#FBBF24",  // yellow
  "تقنية": "#C084FC",  // purple
  "طب": "#F87171",     // red
  "أخرى": "#737373",
}
```

---

## 5. التفاعلية + Empty States

| الميزة | الحالة |
|---|---|
| Search في الجدول | ✅ يفلتر حسب اسم المشروع/القطاع |
| Sort dropdown | ✅ 4 خيارات (الأحدث / أعلى ربح / أعلى قيمة / حسب القطاع) |
| Range filter للـ chart | ✅ 4 buttons يقطع `historicalData.slice(-months)` |
| Tooltip تفاعلي على Charts | ✅ على hover يعرض القيمة الفعلية |
| Empty state للجدول | ✅ "لا توجد نتائج" (search) أو "لا توجد استثمارات بعد" + زر "اكتشف الفرص" |
| Calculator (3 periods) | ✅ يحسب expectedReturn/futureValue/totalGrowth ديناميكياً |
| Disclaimer أصفر | ✅ "تقديرات تقريبية بناءً على الأداء التاريخي" |
| Click على row | ✅ يفتح `/project/[id]` |

### Calculator formula
```ts
expectedReturn = totalValue × (avgReturnPerYear/100) × (months/12)
expectedFutureValue = totalValue + expectedReturn
totalGrowth = (expectedReturn / totalValue) × 100
```

---

## 6. حالة TypeScript

```
$ npx tsc --noEmit
EXIT CODE: 0
ERRORS OUTSIDE .next/: 0
```

✅ **0 أخطاء** بعد إضافة 457 سطراً.

---

## 7. حالة Runtime

| الفئة | عدد | النتيجة |
|---|:---:|:---:|
| `/investment` (المُعدَّلة) | 1 | **HTTP 200** ✅ |
| Regression — كل الصفحات الأخرى | 24 | **24/24 HTTP 200** ✅ |
| سيرفر log — أخطاء | — | **0 أخطاء** ✅ |

✅ **Zero regression** — كل الصفحات الأخرى لا تزال تعمل.

---

## 8. المشاكل التي واجهتها + الحلول

### 🐛 Issue 1: تضارب imports — `fmtLimit` ليس في mock-data
- **المشكلة:** البرومبت ذكر `fmtLimit` كـ import من `@/lib/mock-data` لكنه فعلياً موجود في `@/lib/utils/contractLimits`.
- **الحل:** استوردته من المسار الصحيح `import { fmtLimit } from "@/lib/utils/contractLimits"` — لا تكرار، لا حاجة لإعادة export.

### 🐛 Issue 2: Sort dropdown يحتاج `useState` خارجي للإغلاق
- **المشكلة:** عند النقر خارج dropdown، يجب إغلاقه. لكن click outside handler غير مُنفَّذ.
- **القرار:** اخترتُ النمط البسيط — النقر على أحد الخيارات يغلق فوراً (`setShowSort(false)`). للقادم يمكن إضافة `useEffect` مع `mousedown` listener على document.

### 🐛 Issue 3: PieChart inside-padding مع text لـ RTL
- **المشكلة:** PieChart من recharts لا يدعم RTL native. العنوان والـ legend يجب أن يكونوا خارج الـ chart.
- **الحل:** تركت الـ PieChart بدون labels داخلية + أضفت Legend مخصّص يدوي تحت الـ chart بـ list من السطور (دائرة لون + اسم + نسبة).

### 🐛 Issue 4: Recharts Tooltip formatter type
- **المشكلة:** نفس مشكلة Phase 2.5 — `formatter` يستقبل `ValueType | undefined`.
- **الحل:** `formatter={(value) => [...]}` بدون type annotation + `Number(value)` cast داخلياً.

### ⚠️ Issue 5: Calculator periods — التحويل من `id` إلى `months`
- **المشكلة:** الـ buttons الـ 3 (6ش/سنة/3س) تحتاج معرفة كم شهر يمثّلون.
- **الحل:** `CALC_PERIODS` const مع `months` لكل واحد + `find` للحصول على الشهور.

---

## 9. توصيات للمرحلة التالية

### 🔴 أولوية عالية — توسيع `lib/mock-data` لقطع متشابهة
1. **`getMarketAnalytics()` لـ `/market`**: نفس بنية `getInvestmentAnalytics` لكن للسوق ككل (أكثر القطاعات نشاطاً، Gainers/Losers اليومية)
2. **`getDealHistory()` لـ `/orders`**: timeline موحّد للصفقات يستخدم نفس الـ visual style كـ Distributions Timeline
3. **اشتراك Realtime على Distributions**: عند توزيع جديد (Supabase channel) → push notification + تحديث Hero stats

### 🟡 استخراج primitives مشتركة
4. **`<KPIRow>` primitive**: المُكرَّر في § 3 (5 rows). يستحق `components/ui/KPIRow.tsx` — props: icon, label, value, color
5. **`<PerformerCard>` primitive**: مستخدم 6 مرات (3 best + 3 worst). نقله إلى `components/portfolio/PerformerCard.tsx` للاستخدام في `/portfolio` أيضاً
6. **`<MetricCard>` primitive**: 4 metric cards في HERO. نقله إلى `components/common/MetricCard.tsx`
7. **`<InvestmentChart>` primitive**: الـ AreaChart بـ range filter. نقله إلى `components/common/InvestmentChart.tsx` لاستخدامه في `/portfolio` و `/dashboard`

### 🟢 ميزات جديدة مقترحة
8. **Skeleton loaders للـ Charts**: حالياً empty state عند `length === 0` فقط. يجب skeleton أثناء تحميل Supabase الفعلي
9. **Empty states محسّنة**: عند 0 holdings، عرض onboarding ودود ("ابدأ رحلتك الاستثمارية" + steps + CTA)
10. **Real-time updates**: Hero stats + chart يجب يتحدّثوا live عند تغيّر `current_value` لأي holding (WebSocket)
11. **Drill-down في PieChart**: نقر على slice يفتح modal مع تفاصيل القطاع + قائمة الـ holdings فيه
12. **Export CSV**: زر "تصدير الجدول" في § 4 — يُنزّل أداء كل الـ holdings
13. **Compare periods**: في § 2 إضافة "قارن مع" (الفترة السابقة) — overlay chart
14. **Risk indicator**: شارة بجانب كل holding في § 4 تُظهر `risk_level` بألوان

### 🟢 على dashboard لاحقاً
15. **استخدم Hero metric cards من `/investment`**: بدلاً من Hero الحالي البسيط، يمكن استخدام نفس النمط مع `getInvestmentAnalytics` لعرض مقاييس أكثر
16. **استخدم نفس chart logic**: `historicalData` يمكن استخدامه في dashboard's HERO sparkline بدلاً من الـ inline mock

---

## 📊 الملخص النهائي

| المقياس | القيمة |
|---|---|
| الصفحة المُعاد بناؤها | `app/(app)/investment/page.tsx` |
| الأقسام الجديدة | **6** |
| Helpers جديدة في mock-data | **3** (getInvestmentAnalytics + getDistributionsByUser + getTotalDistributions) |
| Types/Interfaces جديدة | **5** (PerformanceRow, SectorSlice, HistoricalPoint, InvestmentAnalytics, Distribution + DistributionType) |
| Sub-components | **2** (PerformanceRowItem, PerformerCard) |
| Charts من recharts | **2** (AreaChart + PieChart) |
| الأسطر المُضافة (إجمالي) | **+457** |
| السطور قبل / بعد للصفحة | **474 → 769** (+62%) |
| TypeScript errors | **0** ✅ |
| HTTP 200 — `/investment` | ✅ |
| Regression — 24 صفحة | **24/24 HTTP 200** ✅ |
| Mock data inline في الصفحة | **0** (كل البيانات من `@/lib/mock-data`) ✅ |

> 🎉 **المرحلة 3 مكتملة** — `/investment` صار لوحة تحليلات احترافية بـ 6 أقسام + 4 charts.
> كل العمليات الحسابية (cost, profit, sector distribution, historical) معزولة في `getInvestmentAnalytics()` — قابل لإعادة الاستخدام في `/portfolio` لاحقاً.
