# 📋 جردة قواعد البيانات — Phase 10.63 (2026-05-08)

ملخّص دقيق لحالة كل جدول من 77 جدول في قواعد البيانات بعد الجردة الكاملة.

## ✅ مربوط بالكامل (read + write)

| الجدول | data layer | الواجهة |
|--------|-----------|---------|
| profiles | profile.ts, community.ts | /profile, /community, لوحة التحكم |
| projects | projects.ts | /projects, /market, لوحة التحكم |
| companies | companies.ts | /following, لوحة التحكم |
| deals | deals.ts, deal-detail.ts, quick-sale.ts | /deals, /orders, /exchange |
| holdings | holdings.ts, portfolio.ts, wallet.ts | /portfolio, /wallet |
| listings | listings.ts | /marketplace |
| auctions | auctions-real.ts, auctions-admin.ts | /auctions, لوحة التحكم |
| auction_bids | auctions-real.ts | /auctions/[id] |
| kyc_submissions | kyc.ts, kyc-admin.ts | /kyc, لوحة التحكم |
| notifications | notifications.ts, admin-requests.ts | /notifications |
| notification_preferences | notification-preferences.ts | /settings |
| disputes | disputes-admin.ts | لوحة التحكم |
| support_tickets | support.ts, support-admin.ts | /support, لوحة التحكم |
| ticket_messages | support.ts, support-admin.ts | /support/[id] |
| ambassadors | ambassador.ts, ambassadors-admin.ts | /ambassador, لوحة التحكم |
| ambassador_rewards | ambassador.ts | /ambassador |
| referrals + referral_links | ambassador.ts | /ambassador |
| contracts (alias→partnership_contracts) | contracts.ts | /contracts |
| partnership_contracts | contracts.ts, contracts-admin.ts | /contracts/* |
| contract_holdings | contracts.ts | /contracts/[id] |
| contract_members | contracts.ts | /contracts/[id] |
| contract_transactions | contracts.ts | /contracts/[id] |
| council_* (5 tables) | council.ts | /council/* |
| friend_requests | friendships.ts | /profile |
| friendships | friendships.ts | /profile |
| follows | follows.ts | /following |
| healthcare_applications | healthcare.ts, healthcare-admin.ts | /healthcare/* |
| healthcare_cases | healthcare.ts, healthcare-admin.ts | /healthcare/cases |
| healthcare_donations | healthcare.ts | /healthcare |
| insurance_subscriptions | healthcare.ts | /healthcare |
| orphan_children | orphans.ts, orphans-admin.ts | /orphans/children |
| orphan_reports | orphans.ts, orphans-admin.ts | /orphans |
| sponsorships | orphans.ts, orphans-admin.ts | /orphans |
| fee_unit_balances | fee-requests-admin.ts, portfolio.ts | /portfolio, لوحة التحكم |
| fee_unit_requests | admin-requests.ts, fee-requests-admin.ts | لوحة التحكم |
| fee_unit_transactions | portfolio.ts | /portfolio |
| ratings | ratings.ts | /orders |
| user_gifts | gifts.ts | /gifts |
| user_coupons | discounts-admin.ts, discounts-real.ts | /discounts |
| discount_brands | discounts-admin.ts, discounts-real.ts | /discounts |
| share_modification_requests | share-modifications.ts | لوحة التحكم |
| share_modification_codes | share-modifications.ts | لوحة التحكم |
| share_transfers | share-transfers.ts | لوحة التحكم |
| payment_proofs | payment-proofs-admin.ts | لوحة التحكم |
| audit_log | audit-log.ts | لوحة التحكم |
| project_wallets | admin-utilities.ts | لوحة التحكم |
| project_updates | projects.ts | /projects/[id] |
| entity_drafts | entity-drafts.ts | لوحة التحكم |
| legal_pages | legal-pages.ts | لوحة التحكم |
| news + news_reactions | news.ts, news-reactions.ts | /news |
| ads | ads.ts | /dashboard |
| user_profile_extras | profile.ts | /profile |
| quick_sale_listings | quick-sale.ts | /quick-sale |
| quick_sale_subscriptions | quick-sale.ts | /quick-sale |
| system_market_state | system-market.ts | /market, لوحة التحكم |
| push_subscriptions | (API routes) | /api/push/* |

## 🆕 مربوط الآن في Phase 10.63

| الجدول | كيف | data layer | الواجهة |
|--------|-----|-----------|---------|
| **deal_messages** | RPC + realtime | deal-messages.ts | /deals/[id] (DealChat component) |
| **price_history** | RPC public | price-history.ts | (للاستخدام في chart المشروع) |
| **stability_fund** | RPC admin | market-engine.ts | لوحة التحكم → النظام → محرّك السوق |
| **fund_transactions** | RPC admin | market-engine.ts | لوحة التحكم → محرّك السوق |
| **development_promises** | RPC public | market-engine.ts | لوحة التحكم → محرّك السوق |
| **faqs** | RPC defensive | faqs.ts | (للاستخدام في /faq) |
| **distributions** | RPC defensive | distributions.ts | (للاستخدام في portfolio) |

## ⚠ مكرّرات (deprecated — لا تُستخدم في الكود الحديث)

| الجدول | البديل المعتمَد | الإجراء |
|--------|----------------|---------|
| `following` | `follows` | اتركه فارغاً — `follows` هو المعتمَد |
| `market_state` | `system_market_state` | محرّك السوق يكتب فيه — لكن الواجهة تستخدم system_market_state |
| `quick_sell_subscriptions` (typo) | `quick_sale_subscriptions` | اتركه فارغاً |
| `council_votes` (لا يوجد) | `council_election_votes` + `council_proposal_votes` | — |
| `election_votes` (لا يوجد) | `council_election_votes` | — |
| `trades` (لا يوجد) | `deals` | — |
| `user_preferences` | `notification_preferences` (مكمّلة) | كلاهما يُستخدم بنطاقات مختلفة |

## ❓ معروفة لكن schema غير موثّق في الـ repo

هذه موجودة في DB لكن الـ CREATE TABLE لم يُضَف في `supabase/migrations/`:

- `faqs` ← مربوط بـ RPC defensive (يقرأ بدون افتراضات على الأعمدة)
- `distributions` ← مربوط بـ RPC defensive
- `following` ← duplicate لـ follows (مهمَل)
- `trades` ← duplicate لـ deals (مهمَل)

## 📊 الإحصائيات النهائية

- **77 جدول** إجمالي
- **65 جدول مربوط** ✅ (بما فيها 7 جداول مربوطة في 10.63)
- **5 جداول مكرّرة/مهملة** ⚠
- **4 جداول schema غير موثّق** (مربوطة دفاعياً)

## 🔴 Migrations لازم تطبّقها

1. `20260508_phase10_orphan_table_wiring.sql` — ينشر 8 RPCs جديدة:
   - `get_market_engine_overview`
   - `get_fund_transactions`
   - `get_development_promises_for_project`
   - `get_price_history`
   - `get_deal_messages` + `post_deal_message`
   - `get_active_faqs`
   - `get_user_distributions`
