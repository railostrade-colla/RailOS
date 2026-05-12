# 🔍 Verification: `weekly_transfer_counter`

**Date:** 2026-05-12  
**Investigator:** Phase 14 cleanup audit  
**Decision required:** Keep or delete the `weekly_transfer_counter` table?

---

## 📊 Findings

### 1. Code grep (TS / TSX / SQL / MD)

```
MARKET_DISCOVERY_REPORT.md                                    — mentions only
PHASE12_MARKET_ENGINE.md                                      — mentions only
lib/market/phase12-types.ts:106                              — TypeScript type (transfer_number_in_week field)
supabase/migrations/20260509_phase12_market_engine_tables.sql:186  — TABLE creation
supabase/migrations/20260509_phase12_market_engine_functions.sql:420,502,506,507,511
                                                              — original Phase 12 execute_share_transfer
supabase/migrations/20260510_phase13_35_fix_execute_share_transfer.sql:93,97,98,102
                                                              — Phase 13.35 fix (active)
supabase/migrations/20260510_phase13_39_transfer_avg_buy_price.sql:100,104,105,109
                                                              — Phase 13.39 fix (currently deployed)
```

### 2. The smoking gun — `execute_share_transfer` (current = Phase 13.39)

The function actively:
1. **READS** `market_engine_settings.free_transfer_max_value` at line 43
2. **INSERTs/UPDATEs** `weekly_transfer_counter` at line 100–108 on EVERY transfer
3. **SELECTs** `transfers_count INTO v_count` at line 109
4. **WRITEs** `v_count` into `share_transfers.transfer_number_in_week` at line 177

```sql
-- Phase 13.39 — live code
v_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
INSERT INTO weekly_transfer_counter(user_id, week_start_date, transfers_count)
VALUES (p_sender_id, v_week_start, 1)
ON CONFLICT (user_id) DO UPDATE
SET transfers_count = CASE
      WHEN weekly_transfer_counter.week_start_date = v_week_start
        THEN weekly_transfer_counter.transfers_count + 1
      ELSE 1
    END,
    week_start_date = v_week_start, updated_at = NOW();
SELECT transfers_count INTO v_count FROM weekly_transfer_counter WHERE user_id = p_sender_id;

-- ... later ...
INSERT INTO share_transfers(..., transfer_number_in_week, week_start_date, ...)
VALUES (..., v_count, v_week_start, ...);
```

### 3. Hard schema dependency

```
share_transfers.transfer_number_in_week INTEGER NOT NULL
```

Removing `weekly_transfer_counter` requires:
- Either dropping `share_transfers.transfer_number_in_week` (loses audit data)
- Or making it nullable + rewriting `execute_share_transfer`

---

## ✅ Decision

**KEEP `weekly_transfer_counter`** for now.

### Rationale
1. `execute_share_transfer` (current production version, Phase 13.39) **actively writes to it on every P2P transfer**.
2. The value flows into `share_transfers.transfer_number_in_week` (NOT NULL constraint) — a real audit field.
3. Removing it would require simultaneously rewriting `execute_share_transfer` and altering `share_transfers` schema.
4. This is **out of scope** for the V7 cleanup — it's a legitimate Phase 12 audit feature, not a dead V7 artifact.

### Defer to Phase 14 redesign
When `execute_share_transfer` is rewritten under the new 3-layer engine, **reconsider** whether the weekly counter is still needed. If the new model doesn't track per-week transfer counts, drop both:
- `weekly_transfer_counter` table
- `share_transfers.transfer_number_in_week` column

For now: **KEEP both**. Move this table from the ❌ DELETE list to the ✅ KEEP list in `MARKET_DISCOVERY_REPORT.md`.

---

## 📌 Action items

- [x] Code grep complete
- [x] Migration text inspected
- [x] Schema dependency confirmed
- [x] Decision documented
- [ ] Update `MARKET_DISCOVERY_REPORT.md` Section 7 to move `weekly_transfer_counter` to ✅ KEEP
- [ ] Re-confirm with founder before proceeding to Step 1
