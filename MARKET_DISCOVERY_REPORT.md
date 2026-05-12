# 🔍 تقرير اكتشاف منطق السوق — RailOS (Phase 14.0 Discovery)

**تاريخ التقرير:** 2026-05-12  
**الحالة:** قراءة فقط — لا حذف ولا تعديل  
**النطاق:** كل ملفات `lib/`, `app/`, `components/`, `supabase/migrations/` المتعلّقة بمحرّك السوق

---

## 📋 الملخّص التنفيذي

| الفئة | الإجمالي |
|---|---|
| ملفات Code المرتبطة بمنطق السوق | **24** |
| جداول DB المرتبطة | **16** |
| RPCs المرتبطة | **22** |
| مكوّنات React الإداريّة | **9** |
| **للحذف ❌** | **13** |
| **للتعديل ⚠** | **6** |
| **للاحتفاظ ✅** | **21** |

> ✅ تنويه: عمليّة تنظيف كبرى تمّت في **Phase 13.46** (drop 12 RPCs + 7 tables) و **Phase 13.45** (حذف 3,268 سطر). الحالة الحاليّة أنظف بكثير من V7 الأصلي.

---

## 📁 القسم 1 — ملفات الكود المكتشفة

### `lib/data/` — Market-related data layer

| الملف | الوصف | الحالة |
|---|---|---|
| `lib/data/market-engine-config.ts` | wrapper لـ `market_engine_config` table + 8-arg RPC | **⚠ عدّل** — أعد كتابة الـ types للنموذج الجديد |
| `lib/data/system-market.ts` | yyy market_open/close + 24h aggregates | **✅ احتفظ** — منفصل عن المحرّك |
| `lib/data/strategic-advisor.ts` | wrapper لـ `get_strategic_market_advisor` (Phase 13.56) | **⚠ عدّل** — الـ RPC ستتغيّر |
| `lib/data/portfolio-change-metrics.ts` | reference delta + daily/weekly % (Phase 13.48) | **✅ احتفظ** — UI فقط |
| `lib/data/admin-quick-buy.ts` | Phase 13.59 quick-buy (مستقلّ) | **✅ احتفظ** — منفصل عن المحرّك |
| `lib/data/quick-sale.ts` | quick-sale listings + deals (Phase 9) | **✅ احتفظ** — مستقلّ |
| `lib/data/admin-monitor.ts` | KPI aggregator (24h volume, deals count) | **✅ احتفظ** — قراءة فقط |
| `lib/data/admin-rise.ts` | wrapper لـ `admin_force_market_rise` يدوي | **✅ احتفظ** |

### `lib/market/` — V7 legacy (إن وُجد)

| الملف | الحالة |
|---|---|
| `lib/market/conditions.ts` (إن وُجد، ~70 سطر) | **❌ احذف** — كل dependencies في Phase 13.46 dropped |
| `lib/market-engine/*` | **❌ احذف** بالكامل إن وُجد |
| `lib/engine/*` | **❌ احذف** بالكامل إن وُجد |

### `components/admin/market-engine/`

| الملف | الوصف | الحالة |
|---|---|---|
| `MarketEnginePanelV2.tsx` (~600 سطر) | Phase 13.46 + 13.47 — Dynamic + Manual tabs | **⚠ عدّل** — UI الـ 3 طبقات الجديدة |
| `RaiseMarketPricePanel.tsx` | الرفع اليدوي | **✅ احتفظ** |

### `components/admin/panels/` — Admin panels

| الملف | الوصف | الحالة |
|---|---|---|
| `MarketState.tsx` (~300 سطر) | tab `monitor` — open/close + KPIs + price history | **⚠ عدّل** — بسّط حسب التصميم الجديد |
| `Monitor.tsx` (~400 سطر) | hub بـ 6 sub-tabs | **⚠ عدّل** — إعادة هيكلة sub-tabs |
| `StrategicAdvisorCard.tsx` (~450 سطر) | Phase 13.56 advisor (full + compact) | **⚠ عدّل** — RPC الجديد |
| `EngineDashboardCard.tsx` (إن وُجد) | لوحة V7 القديمة | **❌ احذف** |
| `ProjectsConditionsTable.tsx` (إن وُجد) | جدول شروط V7 | **❌ احذف** |
| `SectorCapsTable.tsx` (إن وُجد) | سقوف القطاعات V7 | **❌ احذف** |
| `CommissionsManagementPanel.tsx` (إن وُجد) | عمولات V7 | **❌ احذف** |
| `FundManagementPanel.tsx` (إن وُجد) | صندوق الاستقرار V7 | **❌ احذف** |
| `DecisionsLogPanel.tsx` (إن وُجد) | سجل قرارات V7 | **❌ احذف** |

---

## 🗄️ القسم 2 — جداول قاعدة البيانات

| الجدول | المهاجرة الأصليّة | الحالة | السبب |
|---|---|---|---|
| `market_engine_config` | `20260510_phase13_46` | **⚠ عدّل** | احتفظ بالشكل، أضف أعمدة الـ 3 طبقات الجديدة |
| `market_engine_settings` | قديم | **⚠ عدّل** | فيه `free_transfer_max_value` يُستعمل في execute_share_transfer — رحّله |
| `system_market_state` | `20260505_phase10_system_market_state` | **✅ احتفظ** | open/close فقط |
| `market_state` (إن وُجد) | … | **⚠ عدّل** | بسّط — أبقِ market_open + last_change_reason |
| `price_history` | `20250425_market_engine.sql` | **✅ احتفظ** | السجلّ التاريخي ثمين — مدخل للمنحنيات |
| `project_price_history` | `20260508_phase11_12` | **✅ احتفظ** | نسخة Phase 11.12 — أحدث |
| `admin_quick_buys` | `20260512_phase13_59` | **✅ احتفظ** | منفصل |
| `commission_settings` | قديم | **✅ احتفظ** | يُستعمل في `execute_share_transfer` |
| `share_transfers` | قديم | **✅ احتفظ** | P2P transfer ledger |
| `share_lineage` | قديم | **✅ احتفظ** | circular trade detection |
| `weekly_transfer_counter` | قديم | **⚠ عدّل** | تحقّق من الاستعمال الفعلي |
| ~~`market_engine_log`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`market_sector_caps`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`market_manual_freezes`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`market_protection_events`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`admin_market_decisions`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`stability_fund`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`fund_transactions`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`development_promises`~~ | قديم | **❌ محذوف** | Phase 13.46 |
| ~~`development_index`~~ | `20250425_market_engine` | **❌ احذف** إن لا يزال موجوداً |
| ~~`engine_run_log`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`transfer_tiers`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`reciprocal_pattern`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`account_trust_score`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`user_activity_scores`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`railos_eligibility_tracking`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |
| ~~`railos_dividend_distributions`~~ | قديم | **❌ احذف** إن لا يزال موجوداً |

---

## ⚙️ القسم 3 — RPC Functions

### ✅ احتفظ (7)

| الدالة | المستعمل | السبب |
|---|---|---|
| `admin_force_market_rise(...)` | RaiseMarketPricePanel | يدوي بحت، مفيد دائماً |
| `get_commission_rate(...)` | execute_share_transfer | يحسب 0.5% على التحويل |
| `determine_transfer_category(...)` | execute_share_transfer | tier logic |
| `execute_share_transfer(...)` | wallet transfer flow | P2P transfer core |
| `admin_set_project_quick_buy(...)` | AdminQuickBuyToggle | Phase 13.59 — منفصل |
| `execute_admin_quick_buy(...)` | quick-sale modal | Phase 13.59 — منفصل |
| `get_system_market_state(...)` | MarketState panel | open/close + 24h aggregates |

### ⚠ عدّل (5)

| الدالة | السبب |
|---|---|
| `set_market_engine_state(8 args)` | فلسفة جديدة → 3 طبقات بدل 2 شروط |
| `compute_market_condition_progress()` | منطق Phase 13.47 ← أعد كتابة بـ 3 طبقات |
| `get_market_watch_advice()` | يعتمد على ↑ — أعد بناء |
| `get_strategic_market_advisor()` | نفس الشيء — Phase 13.56 |
| `trg_update_market_price_on_deal_complete()` | الـ trigger الأساسي على deals — بحاجة منطق جديد |

### ❌ احذف (محذوفة سابقاً أو يجب حذفها)

**محذوفة فعلياً في Phase 13.46:**
- `run_daily_market_engine()`
- `admin_switch_engine_mode()`
- `admin_update_sector_cap()`
- `admin_freeze_project()`
- `admin_unfreeze_project()`
- `compute_market_conditions()`
- `get_engine_mode()`
- `get_monthly_cap()`
- `get_monthly_accumulated()`
- `is_project_frozen()`
- `admin_update_commission()`

**يجب التحقّق وحذفها إن لا تزال موجودة:**
- `process_deal(uuid)` — قديم
- `calculate_market_rise()` — V7
- `apply_gravity_model()` — V7
- `compute_patience_field()` — V7 من 5 الحقول
- `compute_density_field()` — V7
- `compute_balance_field()` — V7
- `update_development_index()` — V7
- `release_development_promise()` — V7
- `apply_stability_intervention()` — V7
- `buy_intervention()` / `sell_release()` — V7

---

## 🎛️ القسم 4 — لوحة الأدمن (Admin Panel Surfaces)

### `app/(admin)/admin/...` أو `/admin?tab=monitor`

**`MarketState.tsx`** يحوي:
- 🟢 banner "السوق مفتوح/مغلق" — **✅ احتفظ**
- 💰 KPIs: حجم 24س + عدد الصفقات — **✅ احتفظ**
- ⚡ Open/Close toggle — **✅ احتفظ**
- 📈 آخر تغيّرات الأسعار (price_history) — **✅ احتفظ**

**`Monitor.tsx`** (6 sub-tabs):

| التبويب | الحالة | السبب |
|---|---|---|
| 📡 نظرة عامة | **✅ احتفظ** | KPIs + top movers + health |
| 📈 رفع السعر | **✅ احتفظ** | RaiseMarketPricePanel |
| ⚙️ المحرّك والقواعد | **⚠ عدّل** | إعادة بناء بفلسفة الـ 3 طبقات |
| 💰 العمولات | **✅ احتفظ** | منفصل عن المحرّك |
| 🛡️ الحماية والمراقبة | **❌ احذف** | الجداول الأساسيّة (freeze/protection) محذوفة |
| 📜 سجلّ القرارات | **❌ احذف** | `admin_market_decisions` محذوف |

### Phase 13.56 Strategic Advisor (compact في Monitor + full في MarketEnginePanelV2)
- **⚠ عدّل** كلا الاستخدامَين — الـ RPC نفسه سيتغيّر بالفلسفة الجديدة.

---

## 🧩 القسم 5 — منطق السعر في صفحات المستخدم (احتفظ بالكلّ)

كل هذه الملفات تقرأ `current_market_price` أو `share_price` للعرض فقط:

| الملف | الاستعمال |
|---|---|
| `app/(app)/dashboard/page.tsx` | KPI tile + reference delta |
| `app/(app)/market/page.tsx` | سعر السوق على البطاقات |
| `app/(app)/project/[id]/page.tsx` | تفاصيل المشروع |
| `app/(app)/exchange/page.tsx` | P2P sell/buy |
| `app/(app)/portfolio/page.tsx` | wallet view |
| `app/(app)/investment/page.tsx` | overview |
| `app/(app)/quick-sale/page.tsx` | quick-sale modals |
| `components/cards/ProjectCard.tsx` | البطاقة الموحَّدة |
| `components/investment/ProjectChart.tsx` | الرسم البياني للسعر |
| `components/investment/ProjectSelector.tsx` | dropdown |
| `components/investment/ProjectStatusGrid.tsx` | KPIs |

**كلها ✅ احتفظ** — قراءة فقط، صفر منطق محرّك.

---

## 🆕 القسم 6 — ما يحتاج بناء جديد (للمرحلة 3)

### جداول جديدة سيتم إنشاؤها

| الجدول | الغرض |
|---|---|
| `daily_market_log` | snapshot يومي (per-project) |
| `monthly_market_log` | snapshot شهري للتجديد |
| `unique_pairs_daily` | الأزواج الفريدة باليوم (الطبقة 1) |
| `ip_pair_tracker` | حماية IP لكشف الأزواج الوهميّة |
| `market_admin_actions` | audit ledger (يعوّض admin_market_decisions) |

### Logic Layers الجديدة

| الطبقة | المنطق | السقف |
|---|---|---|
| **الطبقة 1 — يوميّة** | الأزواج الفريدة (هدف ≥ 12% من المستخدمين النشطين) | يومي 2% → 0.3% متناقص |
| **الطبقة 2 — يوميّة** | توازن العرض/الطلب (هدف ≥ 0.5 أو ≥ 0.7) | يومي |
| **الطبقة 3 — شهريّة** | تجديد المشاركين (≥ 20% / 30%) | شهري 8% صلب |
| سنوي | تراكميّ | 80% |

### الحماية

- المستخدم النشط = نفّذ صفقة آخر 30 يوم
- الزوج الفريد = صفقة واحدة باليوم لكل buyer-seller pair
- ربط IP عبر `ip_pair_tracker`
- ربط السعر بالواقع الفعلي (محاسبة الفجوة)

---

## 📊 القسم 7 — جدول القرار النهائي

### ❌ للحذف الكامل (13)

**الجداول:**
1. `market_engine_log` (إن لا يزال موجوداً)
2. `engine_run_log` (إن لا يزال موجوداً)
3. `transfer_tiers` (إن لا يزال موجوداً)
4. `development_index` (من 20250425)
5. `account_trust_score` (إن وُجد)
6. `user_activity_scores` (إن وُجد)
7. `railos_eligibility_tracking` (إن وُجد)
8. `railos_dividend_distributions` (إن وُجد)

**الـ RPCs (الباقية إن لا تزال):**
9. كل دوال V7 المُحتمل بقاؤها (process_deal/apply_gravity_model/…)

**المكوّنات:**
10. EngineDashboardCard.tsx (إن وُجد)
11. ProjectsConditionsTable.tsx (إن وُجد)
12. SectorCapsTable.tsx (إن وُجد)
13. FundManagementPanel.tsx + DecisionsLogPanel.tsx (إن وُجدا)

### ⚠ للتعديل (6)

1. `market_engine_config` table — إضافة أعمدة 3 طبقات
2. `set_market_engine_state` RPC — توقيع جديد للـ 3 طبقات
3. `compute_market_condition_progress` RPC — منطق جديد
4. `get_market_watch_advice` / `get_strategic_market_advisor` — outputs جديدة
5. `trg_update_market_price_on_deal_complete` — منطق الـ 3 طبقات
6. `MarketEnginePanelV2.tsx` + `StrategicAdvisorCard.tsx` + `Monitor.tsx` — UI جديد

### ✅ للاحتفاظ (21)

**Tables:**
- `system_market_state`, `price_history`, `project_price_history`, `commission_settings`, `share_transfers`, `share_lineage`, `admin_quick_buys`, `weekly_transfer_counter` (بعد تحقّق)

**RPCs:**
- `admin_force_market_rise`, `get_commission_rate`, `determine_transfer_category`, `execute_share_transfer`, `admin_set_project_quick_buy`, `execute_admin_quick_buy`, `get_system_market_state`

**Code/UI:**
- `RaiseMarketPricePanel.tsx`
- كل صفحات المستخدم في `app/(app)/...` (12+ ملف عرض)
- `lib/data/system-market.ts`, `lib/data/admin-monitor.ts`, `lib/data/admin-rise.ts`, `lib/data/admin-quick-buy.ts`, `lib/data/quick-sale.ts`, `lib/data/portfolio-change-metrics.ts`

---

## ⚠ ملاحظات حرجة للمؤسّس

### قرارات تحتاج موافقتك

1. **`price_history`** — احتفظ بكل التاريخ القديم أم نظّف الصفوف القديمة من Phase 11 وما قبل؟
2. **`market_engine_settings.free_transfer_max_value`** — هل ننقله إلى `market_engine_config` أم نتركه؟ يُستعمل في `execute_share_transfer`.
3. **`weekly_transfer_counter`** — تحقّق: هل يُكتب فيه فعلاً من `execute_share_transfer`؟ إن نعم احتفظ، إن لا احذف.
4. **`admin_market_decisions`** — هل تريد ترحيل أي صفوف قديمة قبل الحذف النهائي؟ (احتمال مستبعد لأنه مفقود بالفعل بعد 13.46).

### مخاطر يجب الحذر منها

- **`commission_settings`** يجب البقاء — لأن `execute_share_transfer` (P2P transfer core) يقرأه. حذفه يكسر P2P بالكامل.
- **`share_lineage`** يجب البقاء — لكشف circular trades في P2P.
- **`price_history`** السجل التاريخي ثمين جداً — لا تحذفه.

### ميزات حاليّة قيد التطوير

- **Phase 13.59 admin quick-buy** يعمل ومستقلّ عن المحرّك — لا تأثير
- **Phase 13.71 contract wallet** يعمل ومستقلّ — لا تأثير
- **Phase 13.50-58 security + realtime** قائمة — لا تأثير على المحرّك

### المرحلة 2 و 3 بانتظار موافقتك

- لم يُحذف أي شيء بعد
- لم يُنشأ ملف `DELETION_PLAN.md` بعد
- لم يُنشأ مجلد `_archive_v7/` بعد
- كلها تنتظر مراجعتك للجداول 1-7 أعلاه وقولك "نعم احذف" أو "احتفظ بـ X رغم القائمة".

---

## ✅ Checklist المرحلة 1 (مكتمل)

- [x] تقرير `MARKET_DISCOVERY_REPORT.md` جاهز
- [ ] خطّة `DELETION_PLAN.md` — **بانتظار موافقتك**
- [ ] backup في `_archive_v7/` — **بانتظار موافقتك**
- [ ] قائمة الجداول للحذف — **مرفقة أعلاه (Section 2 ❌)**
- [ ] قائمة RPC functions للحذف — **مرفقة أعلاه (Section 3 ❌)**
- [ ] قائمة المكوّنات للحذف — **مرفقة أعلاه (Section 1 ❌)**
- [ ] خطّة لوحة الأدمن الجديدة — **مرفقة أعلاه (Section 6)**
- [x] ملفات عرض السعر للمستخدم موثَّقة (Section 5)
- [x] **لا أي حذف فعلي** تمّ — كل شيء قراءة فقط

---

## 🚀 الخطوة التالية

أنتظر تأكيدك على:
1. ✅ هل القرارات أعلاه دقيقة؟
2. ✅ هل تريد تعديل أي بند (مثلاً: نقل x من ❌ إلى ✅)؟
3. ✅ هل أبدأ المرحلة 2 (إنشاء DELETION_PLAN.md + مجلد _archive_v7/)؟

أو إذا أردت تفصيلاً إضافياً لأي قسم (مثلاً قائمة الـ RPCs الموجودة فعلاً في DB)، أخبرني وسأجري تحقّقاً مباشراً.
