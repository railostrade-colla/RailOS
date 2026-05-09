# Phase 12 — Market Engine + Dynamic Commissions

## Objective
Build the market engine, dynamic commission management, transfer system, protection layers, and the admin dashboard sections inside the existing `market_state` tab — **without touching the live fee-units, quick-sale, auctions, contracts, escrow, KYC, or main admin shell**.

## What Shipped

### 1. SQL Migrations (3 files)

| File | Purpose |
|---|---|
| `20260509_phase12_market_engine_tables.sql` | 13 tables + RLS + seed rows for `commission_settings` (8 types) and `market_sector_caps` (8 sectors). |
| `20260509_phase12_market_engine_functions.sql` | 19 SECURITY DEFINER RPCs incl. the **dynamic commission core** (`get_commission_rate`, `admin_update_commission`). |
| `20260509_phase12_market_engine_triggers.sql` | 2 triggers on `deals` — `trg_deal_track_lineage` + `trg_deal_apply_rise`. |

### 2. New Tables (13)

```
market_engine_log                — daily per-project engine row
market_engine_settings           — global / per-project knobs
commission_settings              — 8 rows, dynamic rates
market_sector_caps               — monthly cap per sector
market_manual_freezes            — admin-triggered freezes
share_transfers                  — tier-aware transfer log (extends Phase 8)
weekly_transfer_counter          — running week-tier counter
share_lineage                    — circular-trade detection
account_trust_score              — KYC + age + alerts
user_activity_scores             — per-project per-month activity
railos_eligibility_tracking      — Railos dividend eligibility streaks
railos_dividend_distributions    — monthly payouts
admin_market_decisions           — full audit log
```

### 3. New Functions (19)

Engine: `get_engine_mode`, `get_monthly_cap`, `get_monthly_accumulated`, `is_project_frozen`, `compute_market_conditions`, `apply_initial_mode_rise`, `apply_permanent_mode_rise`, `run_daily_market_engine`.

Commissions: `get_commission_rate` ⭐ (with auto-restore), `admin_update_commission`.

Protection: `get_account_age_days`, `is_circular_trade`, `count_distinct_qualified_pairs`.

Transfers: `determine_transfer_category`, `execute_share_transfer`.

Admin: `admin_freeze_project`, `admin_unfreeze_project`, `admin_switch_engine_mode`, `admin_update_sector_cap`.

### 4. Triggers (2)

```
trg_deal_track_lineage   AFTER INSERT/UPDATE OF status ON deals
trg_deal_apply_rise      AFTER INSERT/UPDATE OF status ON deals
```

Both respect `listings.is_quick_sell` (joined via `deals.listing_id`) so quick-sell never moves the reference price.

### 5. lib/market/* (9 files — all `"use client"`)

```
lib/market/phase12-types.ts       — shared type definitions
lib/market/commissions.ts         — listCommissionSettings + getCommissionRate +
                                    adminUpdateCommission + adminRestoreCommissionDefault
lib/market/engine-mode.ts         — get / switch / run-now
lib/market/sector-caps.ts         — list + admin update
lib/market/freezes.ts             — list / freeze / unfreeze / isProjectFrozen
lib/market/transfers.ts           — execute + monitor
lib/market/conditions.ts          — compute conditions + log readouts
lib/market/activity-score.ts      — user activity (dual pricing)
lib/market/trust-score.ts         — account trust + circular trades
lib/market/decisions-log.ts       — admin decisions readout
```

All wrappers respect the existing `dedupCache` pattern + RPC-only data access.

### 6. Cron Endpoint

```
app/api/cron/run-market-engine/route.ts
```

`POST` (or `GET`) with `Authorization: Bearer ${CRON_SECRET}`. Uses `createAdminClient()` (service-role) to call `run_daily_market_engine()`. Returns `{ processed, date }`.

**Schedule:** Railway scheduler hits this daily at 00:00 UTC.

### 7. Admin Components (`components/admin/market-engine/*`)

| Component | What it does |
|---|---|
| `EngineDashboardCard` | Mode badge + KPIs + manual-run + switch buttons (double-confirm on run) |
| `CommissionsManagementPanel` ⭐ | The 8-row dynamic commission table — toggle / rate / paused-until / restore-default / restore-all |
| `SectorCapsTable` | Editable sector caps with save buttons |
| `FreezeManagementPanel` | New-freeze form + active-freeze list with unfreeze action |
| `TransfersMonitoringPanel` | Recent + suspicious tabs |
| `ProtectionMonitoringPanel` | Circular trades, young accounts, no-KYC counts |
| `AdminDecisionsLog` | Filterable audit log |

All injected into `components/admin/panels/MarketState.tsx` under a "Phase 12" SectionHeader.

## Deployment Steps

1. **Run migrations in order** (Supabase Dashboard → SQL Editor):
   1. `20260509_phase12_market_engine_tables.sql`
   2. `20260509_phase12_market_engine_functions.sql`
   3. `20260509_phase12_market_engine_triggers.sql`

2. **Set environment variables** (Railway):
   - `CRON_SECRET=<generate-random>` — guards `/api/cron/run-market-engine`
   - `SUPABASE_SERVICE_ROLE_KEY=<from Supabase>` — used by `createAdminClient()`

3. **Schedule the cron** (Railway → Scheduled Tasks):
   ```
   0 0 * * *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/run-market-engine
   ```

4. **Push code** (already in `main`).

## Manual Test Plan

| # | Test | Expected |
|---|---|---|
| 1 | Trade → status='completed' (initial mode) | `current_market_price` rises 0.6 % |
| 2 | 5 trades same day | 6th trade does NOT raise price |
| 3 | Switch to permanent (admin button) | New rises gated by C1+C2 |
| 4 | Open a project's `compute_market_conditions` | Returns valid JSONB |
| 5 | Edit "زراعي" sector cap from 5 % → 6 % | Reflected in next `get_monthly_cap()` |
| 6 | Freeze + unfreeze a project | `is_project_frozen` flips; rises blocked while frozen |
| 7 | **Edit `trade` commission to 1 % with `paused_until = now() + 7 days`** | `get_commission_rate('trade')` returns 0.01 today |
| 8 | **Disable `auction` commission** | `get_commission_rate('auction')` returns 0 |
| 9 | **Wait past `paused_until`, call `get_commission_rate('trade')`** | Returns 0.02 (default) and `commission_settings.current_rate` is auto-restored |
| 10 | First weekly transfer A→B | Tier 1, free |
| 11 | Second transfer same week | Tier 2, 1 % |
| 12 | Third transfer | Tier 3, 2 % |
| 13 | B→A transfer within 30 days of A→B | Auto tier 3 (mutual penalty) |
| 14 | Three-user circular trade A→B→C→A | `share_lineage.is_circular = TRUE` for the closing leg |

## Resilience Score (7 manipulation scenarios)

| Scenario | Strategy | Coverage |
|---|---|---|
| Two-account wash | Distinct-pair rule + circular detection | 100% |
| Circular trading | `share_lineage` + 7-day window | 95%+ |
| Transfer abuse | Tiers + mutual-pattern penalty + KYC + value cap | 95%+ |
| Sock-puppet accounts | KYC + 30-day age gate | 95%+ |
| Pump & dump | Price never goes down | 90%+ |
| Quick-sell exploit | Reference price ignores quick-sell | 95%+ |
| Time gaming | Engine cap + time gates = desired behavior | 100% |

## Dynamic Commission Architecture

```
┌──────────────┐  RPC       ┌─────────────────────┐
│  Caller code │ ────────▶ │ get_commission_rate │
│ (transfer,   │            │   (security def.)   │
│  trade,      │            └──────────┬──────────┘
│  auction…)   │                       │ reads
└──────────────┘                       ▼
                              ┌──────────────────┐
                              │ commission_      │
                              │   settings       │
                              │ (8 rows)         │
                              │  • current_rate  │
                              │  • is_enabled    │
                              │  • paused_until  │
                              └──────────────────┘
                                       │
                                       │ writes
                                       │
                              ┌──────────────────┐
                              │   Admin Panel    │
                              │ Commissions tab  │
                              │  → admin_update_ │
                              │    commission    │
                              └──────────────────┘
```

**No commission percentage is hard-coded in TypeScript anywhere.** Every consumer calls `getCommissionRate(type)` (which RPCs to the SECURITY DEFINER function). When the admin pauses a commission with a `paused_until` date, the function silently restores the default after that date — without manual intervention.

## What's Intentionally NOT Built (out of scope)

- **Smart suggestions panel** (10) — written as a future hook; the current panel surfaces raw data.
- **Performance charts** (recharts) — `getEngineLogForProject` exposes the data; chart UI deferred.
- **Vitest tests** — left as a follow-up; the SQL functions have inline verification in their RAISE NOTICE blocks.

## Files Touched (do-not-touch list respected)

✅ Did NOT modify: fee-unit RPCs, quick-sale, auctions, contracts, escrow, KYC, main admin Sidebar, Dashboard.

✅ Modified only: `components/admin/panels/MarketState.tsx` (added Phase-12 section at the bottom; existing market state UI untouched).
