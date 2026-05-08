# RailOS — Discovery Report

> **Generated:** 2026-05-08
> **Scope:** Read-only exploration of `C:\Users\pc\OneDrive\المستندات\GitHub\RailOS`.
> **Purpose:** A factual snapshot of the codebase as it is *today* — used as the foundation for the next development prompt. No code was modified during this scan.

---

## القسم 1: معلومات المشروع الأساسية

### 1.1 `package.json`

| Field | Value |
|---|---|
| Name | `railos` |
| Version | `0.1.0` |
| Privacy | `private: true` |

#### Runtime dependencies (12)

| Package | Version | Role |
|---|---|---|
| `next` | `16.2.4` | Framework (App Router) |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `@supabase/supabase-js` | `^2.105.1` | DB client |
| `@supabase/ssr` | `^0.10.2` | SSR + cookie session helper |
| `@sentry/nextjs` | `^10.51.0` | Error monitoring |
| `@simplewebauthn/browser` | `^13.3.0` | Passkeys (browser-side only — *imported but no implementation found yet*) |
| `clsx` + `tailwind-merge` | `^2.1.1` / `^3.5.0` | Conditional classNames (`cn()` helper) |
| `lucide-react` | `^1.11.0` | Icons |
| `react-hot-toast` | `^2.6.0` | Toast notifications |
| `recharts` | `^3.8.1` | Charts (sparkline + area; the new candlestick chart in `/investment` is a hand-rolled SVG, not recharts) |
| `resend` | `^6.12.2` | Transactional email |
| `web-push` | `^3.6.7` | VAPID push notifications |
| `server-only` | `^0.0.1` | Marker package for server-only modules |

#### Dev dependencies

`@tailwindcss/postcss@^4`, `tailwindcss@^4`, `typescript@^5`, `eslint@^9`, `eslint-config-next@16.2.4`, `@types/node@^20`, `@types/react@^19`, `@types/react-dom@^19`, `@types/web-push@^3.6.4`.

#### Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "types:db": "supabase gen types typescript --linked --schema public > types/database.ts",
  "types:db:remote": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > types/database.ts"
}
```

> No `test`, `format`, `prepare`, or `postinstall` scripts. No Husky / lint-staged.

---

### 1.2 `tsconfig.json`

| Setting | Value |
|---|---|
| `strict` | `true` |
| `target` | `ES2017` |
| `module` | `esnext` |
| `moduleResolution` | `bundler` |
| `noEmit` | `true` |
| `skipLibCheck` | `true` |
| `isolatedModules` | `true` |
| Path aliases | `@/*` → root |

---

### 1.3 `next.config.ts`

- Wrapped with `withSentryConfig()` (auto source-map upload when `SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT` are set, React component annotation enabled, logger disabled in prod).
- `experimental.optimizePackageImports`: tree-shakes `lucide-react`, `recharts`, `@supabase/supabase-js`.
- Static asset cache: 30-day `max-age` on `.svg/.jpg/.png/.webp/.gif/.ico/.woff2`.
- `trailingSlash: false`.
- No `images.remotePatterns` configured (any `<Image>` external host would need adding).
- No `i18n` block — Arabic is hardcoded, not a translation layer.

---

### 1.4 Environment variables (from `.env.example`)

Public (`NEXT_PUBLIC_…`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=         # or PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Railos
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_SENTRY_DSN=
```

Server-only:

```
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM=Railos <onboarding@resend.dev>
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:railostrade@gmail.com
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

> Generate VAPID keys once with `npx web-push generate-vapid-keys`.

---

## القسم 2: هيكل المجلدات

### 2.1 Root (depth 1)

```
RailOS/
├── app/                    # Next.js App Router (no pages/ dir)
├── components/             # 18 sub-folders, feature-organised
├── contexts/               # React contexts
├── docs/                   # Phase docs + audit reports
├── hooks/                  # 3 custom hooks
├── lib/                    # 12 sub-folders (data, utils, supabase, …)
├── public/                 # Static assets + manifest.json
├── supabase/               # SQL: 6 root files + 108 migrations + scripts
├── types/                  # Auto-generated DB types
├── instrumentation*.ts     # Sentry boot
├── proxy.ts                # Next.js 16 middleware (renamed from middleware.ts)
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── package.json
└── (~26 *.md phase reports + audits at root)
```

### 2.2 Routing model

- **App Router only.** No `pages/` directory exists.
- Route groups in use:
  - `(app)/`  — authenticated user shell (wrapped by `AppLayout`)
  - `(auth)/` — public auth flows (`/login`, `/register`, `/forgot-password`)
  - `admin/`  — admin dashboard (separate `AdminLayout`)
  - `admin-login/`, `splash/`, `r/`, `api/` — public/utility routes at root level

### 2.3 `components/` (feature-based)

```
components/
├── PWAInstallPrompt.tsx
├── admin/        25+ admin-panel components (UsersListPanel, AdminTopBar, …)
├── ambassador/   ApplicationForm, status displays
├── cards/        CompanyCard, ProjectCard
├── common/       AdsSlider
├── contracts/
├── deals/        CreateDealModal, DealRequestModal, deal-chat UI
├── exchange/     QuantityModal
├── invoices/     InvoiceCard, QR
├── layout/       AppLayout, DesktopHeader, MobileHeader, BottomNav, Footer, OfflineBanner, GridBackground, PageHeader, AuthLayout
├── notifications/  NotificationBell, NotificationItem, PushPermissionPrompt
├── payment/      PaymentInstructionsBlock
├── portfolio/    ShareTransferModal
├── quick-sale/   CreateListingModal, QuickSaleListingCard
├── splash/
├── ui/           Badge, Card, Modal, Skeleton, Tabs, IntegerInput, Icon, EmptyState, …
└── wallet/       AccountSwitcher
```

98 of 102 components carry `"use client"` — **client components are the norm**.

### 2.4 `lib/` (data + infrastructure)

```
lib/
├── admin/        Entity-form drafts, mock data, types
├── auth/         biometric (passkeys placeholder), check-admin, route-config
├── data/         40+ files — the primary data layer (cache.ts, projects.ts, deals.ts, listings.ts, portfolio.ts, notifications.ts, admin-utilities.ts, money.ts indirectly via utils, …)
├── email/        Resend wrapper
├── escrow/       In-memory mock store + helpers + types
├── market/       Pricing engine helpers
├── mock-data/    Demo fixtures (most pages now use real DB; mocks survive as fallbacks)
├── push/         VAPID register / subscribe helpers
├── realtime/     5+ hooks: useRealtimeListings, useRealtimeMyDeals, useRealtimeDeal, RealtimeProvider, useRealtimeAuctions
├── storage/      Supabase Storage helpers
├── supabase/     client.ts (browser), server.ts (SSR), admin.ts (service-role), auth-helpers.ts, middleware.ts
└── utils/        cn, contractLimits, finance, money, symbol-generator, toast, version
```

### 2.5 `hooks/`

| Hook | Purpose |
|---|---|
| `useNotifications(limit)` | Live notifications + unread count, postgres_changes subscription, audio chime, SWR cache hydration |
| `useOnlineStatus()` | `navigator.onLine` wrapper, `withOfflineGuard` |
| `usePushNotifications()` | Web Push subscription state machine |

### 2.6 `types/`

| File | Content |
|---|---|
| `types/database.ts` | Auto-generated Supabase schema types (every table Row/Insert/Update + every enum) — produced by `npm run types:db` |
| `types/index.ts` | Empty placeholder |

### 2.7 `contexts/`

| Context | Purpose |
|---|---|
| `ActiveAccountContext` | Tracks current active wallet (`personal` vs `contract`); persisted to localStorage |

(Realtime state lives in `lib/realtime/RealtimeProvider.tsx`, not in `contexts/`.)

---

## القسم 3: قاعدة البيانات (Supabase)

### 3.1 SQL files inventory

#### Root files (`supabase/*.sql`)

| File | Role |
|---|---|
| `01_users.sql` | profiles, KYC submissions, notification_preferences seed, audit_log, auth-trigger to auto-create profile rows |
| `02_projects.sql` | projects, project_wallets (offering / ambassador / reserve), holdings, listings, project_updates |
| `03_deals.sql` | deals, deal_messages, payment_proofs, disputes, deal_ratings, trade-counter trigger |
| `04_ambassadors.sql` | ambassadors, referral_links, referrals, ambassador_commissions, sign-up tracking |
| `05_fee_units.sql` | fee_unit_balances, fee_unit_requests, fee_unit_transactions, quick-sale subscription monthly |
| `06_notifications.sql` | notifications, notification_preferences, push_subscriptions, helpers |
| `seed-essentials.sql` | Seed data |

#### Migrations (`supabase/migrations/` — 108 files, chronological)

The migration history grew organically from `2025-04-25` and is grouped roughly into these phases:

| Phase | Date span | Theme |
|---|---|---|
| `10-levels-system.sql`, `20250425_market_engine.sql` | early 2025 | Investor-level enum, market engine state |
| `20260502_*` | early notifications + KYC + dispute triggers | Push subscriptions, notifications realtime, deal/dispute/KYC triggers, internal-only flag, helper functions |
| `20260503_*` | admin RLS + Phase-5 / Phase-6 schemas | admin policies on every table, ambassadors RLS, audit_log RLS, news/ads/legal admin drafts, **Phase 6**: auctions, contracts, council, discounts, friendships, healthcare-orphans, partnerships, quick-sale schemas |
| `20260504_*` | escrow + buy-listings + portfolio + price history | Phase 10 deal_lifecycle, buy_listings + buy_listing_escrow, level_history, hardening, portfolio_analytics, portfolio_history, wipe_seed_data |
| `20260505_*` | admin queue + project creation v3/v4 | admin_queue_rpcs, admin_create_project (multiple versions converging on the brand-cols variant), admin_create_project_fix |
| `20260506_*` | admin notifications + admin listings | Notification triggers for admin queue, admin listings RPC |
| `20260507_*` | admin create-project full-form + dashboard overview | Full Phase-10 admin form (logo, cover, returns, branding), dashboard overview RPCs |
| `20260508_phase10_*` | dynamic market price + share requests + precision fixes | Dynamic `current_market_price` trigger on completed deals, direct-buy fix, share-requests visibility, **precision_fix** (ROUND vs FLOOR), orphan-table wiring |
| `20260508_phase11_*` | admin permissions + share-modification removal + dynamic market | Phase 11.00 admin-permissions RPC, drop share_modification_requests, payment_method enum fix, auction settle, **dynamic_market_price** trigger, **holdings_project_metadata** (logo + cover + status surface), **admin_user_total_invested** (live SUM from holdings) |
| `20260509–14_*` | admin user management + KYC review + share-purchase + direct-buy + holdings RPC + dashboard overview v2 | `get_user_full_details`, `kyc_review` RPCs, share_purchase_requests + direct_buy_requests tables, `admin_confirm_with_share_transfer`, `get_my_holdings_full` RPC (Phase 10.71), admin topbar order RPCs, dashboard_overview v2 |

#### Scripts (`supabase/scripts/`)

| File | Purpose |
|---|---|
| `WIPE_ALL_KEEP_ADMIN.sql` | Destructive — TRUNCATE all transactional data + DELETE non-admin users from `auth.users`. Idempotent safety pin (refuses if no admins exist). |
| `VERIFY_PHASE_10_85_TO_90.sql` | Verification queries (untracked in git) |

### 3.2 Tables — confirmed presence

> Pulled from migration scans + the auto-generated `types/database.ts` + the snapshot files at root (`supabase_schema.json`, `supabase_schema_v2.json`, `supabase_schema_readable.txt`).

#### Users / identity

- `profiles` (~30 columns including `role`, `level`, `kyc_status`, `total_invested`, `trades_completed`, `is_ambassador`, `is_banned`, `is_active`, `last_seen_at`, `rating_average`, `rating_count`, `referred_by`, …)
- `kyc_submissions` (status, document_type, city, …)
- `user_profile_extras`
- `notification_preferences`
- `push_subscriptions`
- `level_history`
- `auth.users` (Supabase managed)

#### Projects / companies

- `projects` (live snapshot in `supabase_schema_readable.txt` shows 26 cols originally; later migrations add `logo_url`, `cover_url`, `cover_image_url`, `symbol`, `current_market_price`, returns columns. Phase 11.26 / 11.28 added `ALTER TABLE … IF NOT EXISTS` defensively for older DBs.)
- `companies`
- `project_wallets` (3 rows per project: `wallet_type` enum = `offering | ambassador | reserve`, with `total_shares`, `available_shares`, `reserved_shares`, `sold_shares`)
- `project_updates`
- `entity_drafts` (admin staging area)

#### Holdings / shares / trading

- `holdings` (per-user share inventory: `shares`, `frozen_shares`, `average_buy_price`, `total_invested`, `last_acquired_at`)
- `listings` (sell + buy types, `status`, `shares_offered`, `shares_sold`, `price_per_share`, `is_quick_sell`)
- `share_purchase_requests` (Phase 10 — direct-buy queue)
- `direct_buy_requests` (Phase 10.99d)
- `share_transfers` (Phase 8 — peer-to-peer transfers with 2 % fee)
- `share_codes`, `share_modifications`, `share_modification_codes` *(legacy, scheduled for drop in Phase 11.01 — verify that drop landed)*

#### Deals / disputes

- `deals` (status enum: `pending_seller_approval | accepted | payment_submitted | completed | cancelled | rejected | disputed | expired | pending_payment`)
- `deal_messages`
- `disputes` / `deal_disputes`
- `deal_ratings`
- `payment_proofs`
- `notification_locks` (Phase 9 admin coordination)

#### Auctions

- `auctions`, `auction_bids`

#### Contracts (group investment vehicles)

- `contracts`, `partnership_contracts`
- `contract_members`, `contract_holdings`, `contract_transactions`

#### Council (governance)

- `council_members`, `council_elections`, `council_candidates`, `council_election_votes`
- `council_proposals`, `council_proposal_votes`, `council_votes`

#### Money / fees

- `fee_unit_balances`, `fee_unit_requests`, `fee_unit_transactions`
- `invoices`
- `quick_sale_listings`, `quick_sale_subscriptions` (25 000 IQD/month)
- `payment_proofs`

#### Notifications / audit

- `notifications` (with `link_url` convention: `/admin%` = admin-targeted, anything else = user-targeted)
- `audit_log`

#### Ambassador / referral

- `ambassadors`, `ambassador_referrals`, `ambassador_commissions`
- `referrals`, `referral_links`

#### KYC

- `kyc_submissions`

#### Healthcare

- `healthcare_cases`, `healthcare_applications`, `healthcare_donations`, `insurance_subscriptions`

#### Orphans

- `orphan_children`, `orphan_sponsorships`, `sponsorships`, `orphan_donations`, `orphan_reports`

#### Discounts / coupons

- `discounts`, `discount_brands`, `discount_redemptions`, `user_coupons`

#### Support

- `support_tickets`, `ticket_messages`, `support_messages`

#### Social

- `friendships`, `friend_requests`, `follows`

#### Market engine

- `market_state` (per-project current price snapshot)
- `system_market_state`
- `price_history`
- `development_index`

#### Content

- `news`, `news_views`, `news_reactions`
- `ads`, `ad_clicks`
- `legal_pages`

#### Gifts

- `user_gifts`

### 3.3 Notable RPCs (SECURITY DEFINER unless noted)

| Function | Purpose | Migration |
|---|---|---|
| `is_admin()` | Helper used by every admin RPC + RLS policy | `20260503_is_admin_helper.sql` |
| `get_my_admin_permissions()` | Returns granular permission list (`manage_users`, `manage_kyc`, …) | Phase 11.00 |
| `get_all_users_for_admin(p_limit)` | Admin users-list RPC; **patched in Phase 11.33** to compute `total_invested` and `trades_completed` live from `holdings` + `deals` instead of stale `profiles.*` columns |
| `get_user_full_details(p_user_id)` | Admin user-detail modal; same Phase 11.33 live-aggregation patch |
| `get_my_holdings_full()` | Phase 10.71 / Phase 11.26 — bundles holdings + project metadata (logo, cover, current_market_price, available_shares, status, funded_pct, buy/sell aggregates) for `/portfolio` |
| `admin_create_project(...)` | Multi-arg project creator with full form payload + offering/ambassador/reserve wallet split (uses `Math.round` after Phase 10.91 precision fix) |
| `admin_update_project(...)` | Update everything except total_shares / share_price / pcts |
| `place_deal_from_listing` | Buy-side deal creation (escrow lock) |
| `accept_buy_listing` | Sell-side counterpart |
| `create_listing` | Insert into `listings` |
| `link_referral_by_code` | Attach a sign-up to an ambassador's referral_links row |
| `admin_lock_notification` / `admin_unlock_notification` / `admin_process_notification` | Multi-admin coordination on the queue |
| `admin_grant_admin` / `admin_set_admin_permissions` / `admin_revoke_admin` | Super-admin role management |
| `mark_all_notifications_read` | Bulk read |
| `get_unread_count(p_user_id)` | Bell badge |
| `get_admin_notification_counts` | Topbar per-icon counts |
| `get_admin_notification_items(p_limit)` | Topbar dropdown items |
| `admin_confirm_with_share_transfer` | Direct-buy admin confirmation that also moves shares |
| `kyc_approve` / `kyc_reject` | KYC review |
| `admin_ban_user` / `admin_unban_user` / `admin_set_ambassador` | User management |
| `admin_topbar_orders_*` | Phase 10 admin topbar feed |
| `dashboard_overview_v2` | Admin dashboard summary |

> Approximate count: **60+ RPC functions** spread across the migrations.

### 3.4 Triggers

Approximately 30+ triggers, including (named for the file they live in):

- Auto-create `profiles` row on `auth.users` insert.
- Maintain `profiles.trades_completed` / `total_invested` *(noted as out-of-sync in Phase 11.33 — replaced with live aggregation in the RPC)*.
- Update `projects.current_market_price` on `deals.status='completed'` (Phase 11.12).
- Notification-fanout triggers on dispute open / fee request / KYC submission (Phase 2 + Phase 10.06).
- Audit-log writers.

### 3.5 Enums / custom types (sample)

`user_role` (`user | ambassador | admin | super_admin`), `kyc_status` (`pending | approved | rejected | not_submitted`), `deal_status` (9 values incl. `pending_payment`), `wallet_type` (`offering | ambassador | reserve`), `project_status` (`draft | active | coming_soon | sold_out | completed`), `payment_method` (`zain_cash | master_card | asia_hawala | bank_transfer | ki_card | other`), `subscription_status`, `dispute_status`, `news_type` (`announcement | feature | tip | update | promo | alert`), `ad_placement`, `notification_priority` (`low | normal | high | urgent`), and more.

### 3.6 Schema snapshot files (root)

| File | Content | Notes |
|---|---|---|
| `supabase_schema.json` | Older OpenAPI export | Lacks `logo_url`, `cover_url` |
| `supabase_schema_v2.json` | Newer OpenAPI export | Includes `logo_url`. Best reference for *what's actually deployed*. |
| `supabase_schema_readable.txt` | Human-readable summary | 26-column projects shape (pre-branding migration) — likely outdated but useful for the base structure |
| `supabase_schema_parsed.json` | Parsed/cleaned variant | |

> Phase 11.28 explicitly accommodated DBs whose `projects` table still lacks brand columns, so the truth on a given environment depends on whether the brand migrations have been applied.

---

## القسم 4: المصادقة والصلاحيات

### 4.1 Auth providers

| Provider | Status | Where |
|---|---|---|
| Email + password | ✅ Active | `lib/supabase/auth-helpers.ts → signUpWithEmail / signInWithEmail` |
| Google OAuth | ✅ Active | `signInWithGoogle(refCode?, redirectPath?)`; sets `ref_code` cookie (SameSite=Lax, 5-min TTL); forces `prompt=select_account`; callback at `/api/auth/callback` |
| Magic link | ⚪ Plumbed via Supabase but no UI surface |
| Passkeys (WebAuthn) | 🟡 `@simplewebauthn/browser` is installed and `lib/auth/biometric.ts` exists, but no full sign-in flow wired |
| MFA / TOTP | ❌ Not implemented |
| Admin login | Separate route `/admin-login` — verifies role post-login before redirecting |

### 4.2 Middleware (Next.js 16: `proxy.ts`)

Order:

1. `supabase.auth.getUser()` to refresh the JWT on every request.
2. Logged-in user on auth pages → `/dashboard`.
3. Anonymous on a `PROTECTED` route → `/login?redirect=<path>`.
4. Anonymous on `/admin/*` → `/admin-login`.
5. Status gates: `is_banned` → `/?status=banned`, `is_active=false` → `/?status=suspended`.
6. Admin route + role not in (`admin`, `super_admin`) → `/`.

Matcher excludes `/api/*`, `/_next/*`, `/favicon.ico`, `/sw-push.js`, `/manifest.json`, and static assets.

### 4.3 Roles + permissions

- Single column `profiles.role` (no separate `roles` / `user_roles` table).
- Enum: `user | ambassador | admin | super_admin`.
- `super_admin` bypasses permission checks (`["*"]` wildcard).
- Granular admin permissions added in **Phase 11.00**: stored on the profile (or a related table) and read via `get_my_admin_permissions()`. Permissions: `manage_users`, `manage_projects`, `manage_companies`, `manage_orders`, `manage_kyc`, `manage_market`, `manage_payments`, `manage_fees`, `manage_content`, `manage_admins`, `view_audit`, `view_dashboard`.
- TypeScript helper: `lib/auth/check-admin.ts` (`checkAdminRole`, `requireAdmin`).
- Route gating list: `lib/auth/route-config.ts` — `PROTECTED`, `ADMIN_ONLY`, `AUTH_PAGES`, `PUBLIC`.

### 4.4 RLS

Every table that holds per-user data has RLS enabled and a policy stack. Notable patterns:

- `Anyone can view active listings`, `Sellers can update own listings` (`02_projects.sql`).
- `Anyone can view published projects USING (status != 'draft' OR created_by = auth.uid())` plus the **Phase 11.26 defensive policy** *"Users can view projects they own shares in"* so portfolio holdings always resolve.
- Every admin write goes through SECURITY DEFINER RPCs (RLS bypass).
- Notifications carry an admin/user split via `link_url LIKE '/admin%'`.

---

## القسم 5: الصفحات والمسارات

> 83 `page.tsx` files. Public group `(auth)` has 3 pages; the rest are authenticated.

### 5.1 Public

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Landing — Google OAuth + email/password CTAs |
| `/splash` | `app/splash/page.tsx` | Animated intro |
| `/admin-login` | `app/admin-login/page.tsx` | Admin sign-in (separate from `/login`) |
| `/login` | `app/(auth)/login/page.tsx` | User sign-in (Suspense) |
| `/register` | `app/(auth)/register/page.tsx` | Email + Google, accepts `?ref=` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Reset request |
| `/r/[code]` | `app/r/[code]/page.tsx` | Referral redirect handler |

### 5.2 Authenticated user shell `(app)/`

Every page imports `AppLayout`. Highlights:

| Route | File | Role |
|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Investor home — greeting, portfolio summary, ads slider, trending/closing/new projects, news feed |
| `/portfolio` | `app/(app)/portfolio/page.tsx` | Tabs: holdings / stats / history / fee-units. Account switcher. Realtime refresh on holdings + fee balance + deals. |
| `/market` | `app/(app)/market/page.tsx` | Tabs: news / projects / companies / offers. Filters: sector, risk, sort. URL-persisted. |
| `/market/new` | …/market/new/page.tsx | Create market listing |
| `/exchange` | `app/(app)/exchange/page.tsx` | P2P listings + "سجلي" log tab (Phase 11.30) + own-listing badge |
| `/exchange/create` | …/exchange/create/page.tsx | Create listing form (uses `IntegerInput`, `iqd()` everywhere) |
| `/investment` | `app/(app)/investment/page.tsx` | Binance-style trading dashboard (Phase 11.36) — custom SVG candle chart, MA overlays, order book, buy/sell form |
| `/auctions` | …/auctions/page.tsx | Auction browser |
| `/auctions/[id]` | …/auctions/[id]/page.tsx | Bid modal + countdown |
| `/deals` | …/deals/page.tsx | Tabs: active / cancellation / disputed / completed / cancelled |
| `/deals/[id]` | …/deals/[id]/page.tsx | Deal detail with payment-proof upload + dispute |
| `/deal-chat/[id]` | …/deal-chat/[id]/page.tsx | Realtime chat |
| `/contracts`, `/contracts/[id]`, `/contracts/create` | … | Group-investment contracts |
| `/council`, `/council/about`, `/council/members`, `/council/elections`, `/council/proposals`, `/council/proposals/[id]` | … | Governance |
| `/wallet`, `/wallet/send`, `/wallet/receive` | … | Fee-unit balance + share transfers |
| `/profile`, `/profile/level`, `/profile-setup` | … | KYC, level info, onboarding |
| `/kyc` | … | Document upload |
| `/levels`, `/quick-sale`, `/quick-sell`, `/orders`, `/invoices`, `/invoices/[id]`, `/discounts`, `/discounts/[id]`, `/discounts/my-coupons`, `/gifts`, `/community`, `/following`, `/ambassador`, `/news`, `/notifications`, `/settings`, `/settings/notifications`, `/support`, `/about`, `/menu`, `/app-guide`, `/investment-guide`, `/terms`, `/privacy`, `/reset-password` | … | Standard surfaces |
| `/healthcare/*` (8 pages) | … | Donations, insurance, applications |
| `/orphans/*` (7 pages) | … | Sponsorship, child profiles, donations |
| `/company/[id]`, `/project/[id]` | … | Detail pages |

### 5.3 Admin

| Route | File | Role |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Tabbed hub (`?tab=`) hosting 40+ panels: dashboard, monitor, alerts, log, projects, market, market_state, market_settings_advanced, shares, fee_units_admin, deal_fees_admin, users, kyc, admin_users, council_admin, disputes, fees, fee_units_requests, payment_proofs, invoices, content_mgmt, legal_editor, broadcaster, audit_log, healthcare_admin, orphans_admin, discounts_admin, ambassadors_admin, contracts_admin, auctions_admin, support_inbox, system, market_health, level_settings, user_stats, create_project, create_company, project_wallets, gifts_admin, requests_hub, … |
| `/admin/market` | … | Standalone market monitor |
| `/admin/promises` | … | Governance promises |
| `/admin/stability-fund` | … | Reserve management |

### 5.4 Layouts

| Layout | Role |
|---|---|
| `app/layout.tsx` | Root: `<html lang="ar" dir="rtl">`, RealtimeProvider, DealRequestModal, PWAInstallPrompt, react-hot-toast Toaster, PWA metadata, Tajawal font |
| `app/(app)/layout.tsx` | `"use client"` — wraps children with `ActiveAccountProvider` |
| `app/admin/layout.tsx` | AdminSidebar (toggle 60/220 px) + AdminTopBar + AdminDiagnosticBanner; calls `usePreloadAppData()` (Phase 11.31) for cache warm-up |

> No middleware-level auth guard *inside* layouts — protection is centralized in `proxy.ts`.

### 5.5 API routes (`app/api/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/callback` | GET | OAuth code exchange → session, profile gate (`/profile-setup` if missing phone/full_name), referral attachment |
| `/api/health` | GET | Health probe (DB + auth + build metadata) |
| `/api/market/intervention` | POST | Admin RPC trigger |
| `/api/market/measure-development` | POST | Engine job |
| `/api/market/process-deal` | POST | Async deal lifecycle |
| `/api/push/subscribe` | POST | Save VAPID subscription |
| `/api/push/send` | POST | Send to one subscription |
| `/api/push/webhook` | POST | Fan-out from Supabase webhook |

> No `app/api/*` server actions (`"use server"`). All mutating logic is RPC-driven from the client via the helpers in `lib/data/*`.

---

## القسم 6: المكونات والأنماط البرمجية

### 6.1 Components — pattern samples

Three representative files (full inventory was scanned; only excerpts shown):

#### Data display — `components/cards/CompanyCard.tsx` (first 60 LOC)

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Check, ChevronLeft, Star, TrendingUp } from "lucide-react"
import { showSuccess } from "@/lib/utils/toast"
import { cn } from "@/lib/utils/cn"

const sectorIcon = (s: string) =>
  s?.includes("زراع") ? "🌾" : s?.includes("تجار") ? "🏪" : /* … */

export interface CompanyCardData {
  id: string; name: string; sector: string; city: string; …
  share_price: number; risk_level: "منخفض" | "متوسط" | "مرتفع"; …
}

export function CompanyCard({ company, variant = "full" }: …) {
  const router = useRouter()
  const [following, setFollowing] = useState(false)
  /* … */
}
```

Hardcoded Arabic, sector-emoji helper, local state, `cn()` for conditional classes, toasts via `showSuccess` (no boundary).

#### Form — `components/ambassador/ApplicationForm.tsx`

Manual `useState` per field, manual length / required checks, calls a data-layer function (`submitAmbassadorApplication`). **No `react-hook-form`, `zod`, or `yup`** — confirmed across the entire codebase (no imports of those packages found anywhere).

#### Supabase usage — `hooks/useNotifications.ts`

```tsx
import { createClient } from "@/lib/supabase/client"
import { readPersistedSync } from "@/lib/data/cache"

export function useNotifications(limit = 20) {
  const [notifications, setNotifications] = useState(
    () => readPersistedSync<DBNotification[]>(`notif:list:${limit}`) ?? [],
  )
  /* SWR-style: cache hydrate synchronously, then refresh in useEffect */

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`notifications:${user.id}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications",
            filter: `user_id=eq.${user.id}` },
          (payload) => { /* play chime + refresh */ })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])
}
```

### 6.2 Code patterns observed

| Concern | Implementation |
|---|---|
| **Server vs Client** | 98 / 102 components are client. Server logic = a handful of layout files + API routes + RPCs. |
| **Data fetching** | Custom `dedupCache` (memory + localStorage, default 30 s TTL) in `lib/data/cache.ts`. Pages hydrate synchronously via `readPersistedSync(key)`, then call the cached fetcher in `useEffect` — true SWR. **Phase 11.31** added a global `usePreloadAppData()` hook that warms 12+ keys in parallel on shell mount, refreshes every 60 s, and re-runs on `visibilitychange`. **No SWR / React Query / Apollo / urql.** |
| **State management** | React Context for cross-cutting state: `ActiveAccountContext` (active wallet) + `RealtimeProvider` (deal modals). Local `useState` everywhere else. **No Zustand, Redux, Jotai, MobX.** |
| **Error handling** | Universal try/catch with safe fallbacks (`return []` / `return null` / `return false`). Toast notifications via `react-hot-toast` (`lib/utils/toast.ts` exposes `showSuccess`, `showError`, `showWarning`, `showInfo`, `showLoading`). **No `<ErrorBoundary>` wrappers**, but Sentry catches uncaught errors via `instrumentation.ts`. |
| **Loading states** | `components/ui/Skeleton.tsx` — `<Skeleton variant="text\|circular\|rectangular" />`, `<SkeletonCard />`, `<SkeletonStat />`. Pattern: initialize state from cache, show skeletons only when *loading && cachedData.length === 0*. |
| **Form validation** | Manual; no library. Each form encodes its own rules. |
| **Number safety** | **Phase 11.25–11.27** introduced `lib/utils/money.ts` (`iqd()`, `parseIqdInput()`, `clampIqdInputToMax()`) plus `components/ui/IntegerInput.tsx` — type=text + `inputMode="numeric"`, blocks ArrowUp/Down, blurs on wheel, sanitizes Arabic-Indic digits. Used everywhere money is entered (exchange/create, share-transfer, auctions, contracts/create, fee-request, quick-sale, deals, investment). |
| **Realtime** | `lib/realtime/` — 5+ hooks: `useRealtimeListings`, `useRealtimeMyDeals`, `useRealtimeDeal(id)`, `useRealtimeNotifications`, `RealtimeProvider`. All use `supabase.channel(...).on("postgres_changes", …).subscribe()` with `removeChannel` cleanup on unmount. |

### 6.3 Internationalization

- **No i18n library** (no `next-intl`, no `next-i18next`, no JSON locale files).
- UI strings hardcoded in Arabic.
- RTL via `<html lang="ar" dir="rtl">` in `app/layout.tsx`; `dir="ltr"` is applied locally on numeric inputs only.
- Numbers are formatted with `Number.prototype.toLocaleString("en-US")` (Western Arabic numerals everywhere).

### 6.4 Theming

- Dark theme only — no light-mode toggle (a "تبديل الوضع" menu item exists in the admin profile dropdown but currently shows a `showSuccess` placeholder).
- Tokens defined in `app/globals.css` as CSS variables: `--bg-base/surface/card/hover/elevated`, `--text-primary/body/secondary/muted/dim`, `--border/border-md/border-strong`, `--success/warning/danger/info`, `--nav-bg/nav-pill`.
- Font: **Tajawal** (300/400/500/700) loaded from Google Fonts. Fallback `-apple-system, BlinkMacSystemFont, sans-serif`.
- Tailwind v4 via `@tailwindcss/postcss`. **No `tailwind.config.js`** — customisations live as CSS variables + utility class compositions.
- Custom utilities in CSS: `.glow-text`, `.safe-bottom`, `.safe-top`, custom scrollbar.

---

## القسم 7: API و Routing

Already covered in §5.5. Additional notes:

- **Webhooks:** `/api/push/webhook` is invoked by Supabase webhooks (DB row-change notifications fanned out as web-push). Supabase webhooks are configured in dashboard, not in code.
- **Server Actions:** 0 (no `"use server"` directive found anywhere).
- **Edge runtime:** `proxy.ts` (middleware) runs on Edge (covered by `sentry.edge.config.ts` at 5 % trace sample).
- **Resend email:** Confirmed import in `lib/email/`; usage points are admin announcements and password-reset triggers — but the full call sites were not enumerated.

---

## القسم 8: التشغيل والنشر

### 8.1 Scripts

`dev`, `build`, `start`, `lint` — standard Next.js. Two type-gen scripts (`types:db`, `types:db:remote`).

### 8.2 CI / CD

| Asset | Status |
|---|---|
| `.github/workflows/` | ❌ Absent |
| `vercel.json` / `netlify.toml` / `railway.json` / `fly.toml` / `Dockerfile` | ❌ None at root |
| Deployment platform | Inferred **Railway** (the OAuth callback goes to `railos-production.up.railway.app` per recent screenshots; the OAuth callback supports `X-Forwarded-*` for reverse proxies) |

### 8.3 Linting / formatting

- ESLint 9 flat config (`eslint.config.mjs`) extending `eslint-config-next/core-web-vitals` and `…/typescript`.
- **No Prettier config.** No Husky, no lint-staged, no commit hooks.

### 8.4 Tests

❌ **None.** No `*.test.*`, no `*.spec.*`, no `vitest`, no `jest`, no `playwright`, no `cypress`.

### 8.5 Monitoring

- Sentry server: 10 % trace sample, PII off.
- Sentry edge: 5 % trace sample, no replays / no profiling.
- `instrumentation.ts` dispatches based on `NEXT_RUNTIME`.
- Hooks `onRequestError` for 500 capture.

### 8.6 PWA

- `public/manifest.json` — Arabic / RTL, standalone display, two icon sizes.
- `PWAInstallPrompt.tsx` component.
- Service worker referenced as `/sw-push.js` in middleware exclusions but **not yet in `public/`**.
- Push: VAPID-based (`web-push@3.6.7`) + 3 API routes wired.

---

## القسم الإضافي

### A. ملاحظات تقنية مهمة

1. **Migration drift between environments.** 108 migrations grew organically over two months. Several add columns "defensively" (`ADD COLUMN IF NOT EXISTS`) because earlier deployments missed them. The `supabase_schema_readable.txt` shows the *original* schema — actual production DBs may or may not have the brand columns / Phase-11 patches. **Phase 11.26 + Phase 11.33 explicitly hand-rolled idempotent guards to cope with this.** Recommend a periodic snapshot/diff against staging and prod.
2. **`profiles.total_invested` and `profiles.trades_completed` are denormalized but no trigger keeps them in sync.** Phase 11.33 worked around this in the admin RPCs by computing live aggregates; the *page-level* code that still reads `profiles.total_invested` directly will display 0 / "—" unless those RPCs are deployed.
3. **Schema/UI desync risk with the notifications table.** Per-icon admin badges count rows in source tables (`kyc_submissions`, `fee_unit_requests`, `support_tickets`) while their dropdowns used to render filtered slices of `notifications`. Phase 11.34 fixed this for the topbar; verify any new admin surfaces follow the same pattern.
4. **Mock-data fallbacks are still everywhere** in `lib/mock-data/` and many pages still import `MOCK_*` constants for first-paint placeholders. As real-data integration matured, several were removed (e.g. `MOCK_HOLDINGS_EXCHANGE` in Phase 11.23) but the pattern persists. There is no single boolean flag controlling the fallback — each page decides individually.
5. **`@simplewebauthn/browser` is installed but unused in any flow.** Either remove or finish wiring passkeys.
6. **No service worker file** in `public/` even though `proxy.ts` excludes `/sw-push.js` and the manifest references PWA install.
7. **Dark-mode toggle is a stub.** Profile dropdown advertises "تبديل الوضع" but it just emits a toast.
8. **Recharts is installed and used in dashboard sparklines, but the new `/investment` page rolled its own SVG candlestick chart.** Two charting approaches now live in the codebase.
9. **`escrow/store.ts` is an in-memory `Map` mock** still co-existing with the real `deals` table flow. The exchange page distinguishes by "is the listing ID a UUID" — DB-backed ↔ mock — but new code should phase the mock out.
10. **Money safety is now centralized.** `lib/utils/money.ts` + `components/ui/IntegerInput.tsx` (Phase 11.25–11.27) — every IQD value flows through `iqd()` at the data-layer boundary and every input is `IntegerInput`. Confirmed widely adopted.
11. **No formal `error.tsx`/`not-found.tsx` per route.** A `global-error.tsx` exists at root; per-segment error boundaries are missing.
12. **No tests at all** — significant risk for a financial platform.
13. **Phase reports at root (`PHASE*_REPORT.md`)** are a great audit trail but don't replace tests.

### B. أسئلة للمستخدم (يحتاج توضيح قبل البدء)

1. **هل يجب اعتبار الـ DB الحالية (Railway production) هي مصدر الحقيقة، أم نعيد إنشاء schema نظيف من الـ migrations؟** بعض migrations ضمن `IF NOT EXISTS` تعالج الفروقات — لكن قبل أي ميزة كبيرة يجب التأكد.
2. **passkeys (WebAuthn):** نُكملها أم نحذفها؟ المكتبة موجودة لكن لا flow.
3. **light mode:** نُكمله أم نحذف الزر؟
4. **Service Worker / PWA push:** هل نضيف `/public/sw-push.js` ونفعّل التثبيت كـ PWA كامل؟
5. **Charting library قياسي:** هل نوحّد على recharts أم نُبقي SVG اليدوي للـ candles؟ (الأفضل: SVG اليدوي للأسواق الاحترافية، recharts للملخصات.)
6. **Tests:** أي إطار يفضّل المستخدم؟ Vitest + Testing Library؟ Playwright لـ e2e؟
7. **Deployment Pipeline:** هل المطلوب CI على GitHub Actions، أم Railway auto-deploy على push للـ main يكفي؟
8. **`profiles.total_invested` / `trades_completed`:** هل نضيف triggers لمزامنتها أم نحذف الأعمدة الـ denormalized نهائياً ونعتمد على الـ RPCs المُحدَّثة؟
9. **Mock data:** هل المطلوب إزالتها بالكامل من الكود، أم تبقى كـ fallback لـ "لا يوجد بيانات" حتى يصل first-paint سريعاً؟
10. **Sentry:** هل DSN production جاهز؟ هل يتم تتبّع release versions؟
11. **i18n:** هل التطبيق سيبقى عربي فقط، أم سيُضاف الإنجليزي لاحقاً؟ (لا library الآن.)
12. **Server Actions vs RPC client wrappers:** هل المطلوب الانتقال إلى Server Actions في Next 16؟ الكل الآن client-side.

### C. توصيات أولية

**قبل إضافة منطق جديد:**

1. **Snapshot الـ DB schema الفعلي** على Railway (`pg_dump --schema-only`) ومقارنته مع `types/database.ts` — توحّد الحقيقة قبل أي تطوير.
2. **شغّل الـ migrations المعلّقة:** `Phase 11.26` (holdings_project_metadata) و`Phase 11.33` (admin_user_total_invested) — واضح أنها لم تُطبَّق على بيئة الإنتاج بعد بناءً على الـ commit messages.
3. **اختر إستراتيجية واحدة للـ denormalized columns** (`profiles.total_invested` ...): إما triggers تُحدّث تلقائياً، أو حذف الأعمدة والاعتماد على `get_*` RPCs.
4. **أضف `error.tsx` لكل segment رئيسي** (`(app)/error.tsx`, `admin/error.tsx`) لمنع شاشة بيضاء عند فشل client component.

**ميزات موجودة يمكن البناء عليها:**

5. الـ `dedupCache` + `usePreloadAppData()` — قاعدة قوية لأي صفحة جديدة. كل ما تحتاجه: مفتاح cache + fetcher.
6. `IntegerInput` + `iqd()` — جاهزان لأي input مالي إضافي.
7. `RealtimeProvider` + 5 hooks — أي ميزة realtime جديدة (مزادات live، عقود) ستجد القالب جاهزاً.
8. `lib/auth/route-config.ts` + `proxy.ts` — لإضافة route محمي يكفي إضافة المسار للقائمة المناسبة.

**مكتبات قد نحتاجها:**

9. **`zod`** — لـ runtime validation على input forms + RPC payloads (يحلّ مشكلة "manual validation" المنتشرة).
10. **`vitest` + `@testing-library/react`** — وحدة اختبار خفيفة بنفس Vite ecosystem.
11. **`playwright`** — لاختبار e2e على flows حرجة (auth، deal، listing).
12. **`@types/web-push`** موجود لكن **`workbox-webpack-plugin`** أو يدوية لـ service worker لو نُكمل PWA.
13. **`pino`** أو `winston` للـ structured logging على API routes (الآن الكل `console.log`).

**إعادة هيكلة مقترحة (اختياري، لا حاجة عاجلة):**

14. توحيد `lib/escrow/store.ts` (mock) مع DB flow — حذف الـ mock نهائياً.
15. نقل بعض `useEffect`-based fetches إلى Server Components حيث يمكن (تخفيف bundle الـ client).
16. تجميع admin RPCs المتفرّقة في ملف واحد `lib/data/admin.ts` (الآن مقسّمة عبر `admin-utilities.ts`, `admin-requests.ts`, `disputes-admin.ts`, `fee-requests-admin.ts`...).

---

**Report End — generated by read-only discovery scan, 2026-05-08.**
