-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 1: Backup snapshot BEFORE the consolidation
-- Date: 2026-05-14
-- Idempotent. Single transaction.
--
-- Captures a point-in-time copy of every table the consolidation
-- migration touches (or might touch). Lives in its own schema
-- `engine_backup_20260514` so it doesn't pollute `public` and is
-- trivially droppable later:
--     DROP SCHEMA engine_backup_20260514 CASCADE;
--
-- WHY this approach: we cannot rely on the Supabase automated daily
-- backup for the precise instant before Step 2 — and there is no
-- pg_dump from the SQL editor. A schema-copy IS the in-database
-- snapshot. It survives anything Step 2 does in `public`.
--
-- Run this ONCE in Supabase SQL Editor and confirm row counts before
-- proceeding to Step 2.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Backup schema ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS engine_backup_20260514;

COMMENT ON SCHEMA engine_backup_20260514 IS
  'Phase 14.08.2 pre-consolidation snapshot. Drop with: '
  'DROP SCHEMA engine_backup_20260514 CASCADE; after 30 days clean.';

-- Wipe any earlier attempt (idempotent re-run).
DROP TABLE IF EXISTS engine_backup_20260514.market_engine_config        CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.market_engine_log           CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.market_engine_settings      CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.engine_daily_runs           CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.market_settings             CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.market_settings_audit       CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.price_history_last_90d      CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.projects_price_snapshot     CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.market_state_snapshot       CASCADE;
DROP TABLE IF EXISTS engine_backup_20260514.admin_decisions_log         CASCADE;

-- ─── 2. OLD-engine tables being archived in Step 2 ───────────────
-- Full copies — these will be moved out of `public` next step.
CREATE TABLE engine_backup_20260514.market_engine_config AS
  TABLE public.market_engine_config;

CREATE TABLE engine_backup_20260514.market_engine_log AS
  TABLE public.market_engine_log;

CREATE TABLE engine_backup_20260514.market_engine_settings AS
  TABLE public.market_engine_settings;

-- ─── 3. NEW-engine state we MUST NOT lose ────────────────────────
-- Full copies — these stay in `public`, but we snapshot anyway in
-- case anything goes sideways during Step 2.
CREATE TABLE engine_backup_20260514.engine_daily_runs AS
  TABLE public.engine_daily_runs;

CREATE TABLE engine_backup_20260514.market_settings AS
  TABLE public.market_settings;

CREATE TABLE engine_backup_20260514.market_settings_audit AS
  TABLE public.market_settings_audit;

-- ─── 4. price_history — full table is too large; keep 90 days ────
CREATE TABLE engine_backup_20260514.price_history_last_90d AS
  SELECT * FROM public.price_history
   WHERE created_at >= NOW() - INTERVAL '90 days';

-- ─── 5. Per-project price snapshot (the most critical data) ──────
-- Anything Step 2 does, we can restore each project's current price
-- from this row-per-project table.
CREATE TABLE engine_backup_20260514.projects_price_snapshot AS
  SELECT
    id,
    name,
    project_type,
    share_price,
    current_market_price,
    offering_suspended,
    NOW() AS snapshot_at
  FROM public.projects;

-- ─── 6. market_state (legacy but STILL READ by portfolio RPCs) ───
-- Phase 14.08.2 is NOT archiving market_state — it's still actively
-- read by my_holdings_full_rpc, holdings_project_metadata,
-- portfolio_history. Migrating those readers is Phase 14.09 work.
-- We snapshot it anyway since it's adjacent to the consolidation.
CREATE TABLE engine_backup_20260514.market_state_snapshot AS
  TABLE public.market_state;

-- ─── 7. admin_decisions_log (kept — feeds admin_force_market_rise) ─
CREATE TABLE engine_backup_20260514.admin_decisions_log AS
  TABLE public.admin_decisions_log;

-- ─── 8. Row-count manifest ───────────────────────────────────────
-- Persisted so we can verify pre/post counts later.
DROP TABLE IF EXISTS engine_backup_20260514._manifest;
CREATE TABLE engine_backup_20260514._manifest AS
SELECT 'market_engine_config'         AS table_name, COUNT(*) AS row_count FROM engine_backup_20260514.market_engine_config
UNION ALL SELECT 'market_engine_log',                COUNT(*) FROM engine_backup_20260514.market_engine_log
UNION ALL SELECT 'market_engine_settings',           COUNT(*) FROM engine_backup_20260514.market_engine_settings
UNION ALL SELECT 'engine_daily_runs',                COUNT(*) FROM engine_backup_20260514.engine_daily_runs
UNION ALL SELECT 'market_settings',                  COUNT(*) FROM engine_backup_20260514.market_settings
UNION ALL SELECT 'market_settings_audit',            COUNT(*) FROM engine_backup_20260514.market_settings_audit
UNION ALL SELECT 'price_history_last_90d',           COUNT(*) FROM engine_backup_20260514.price_history_last_90d
UNION ALL SELECT 'projects_price_snapshot',          COUNT(*) FROM engine_backup_20260514.projects_price_snapshot
UNION ALL SELECT 'market_state_snapshot',            COUNT(*) FROM engine_backup_20260514.market_state_snapshot
UNION ALL SELECT 'admin_decisions_log',              COUNT(*) FROM engine_backup_20260514.admin_decisions_log;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION — run separately after the BEGIN/COMMIT above
-- ═══════════════════════════════════════════════════════════════════

-- 1. Inspect the manifest
SELECT table_name, row_count
  FROM engine_backup_20260514._manifest
  ORDER BY table_name;

-- 2. Confirm the new-engine snapshot is non-empty
SELECT
  (SELECT COUNT(*) FROM engine_backup_20260514.engine_daily_runs)           AS daily_runs,
  (SELECT COUNT(*) FROM engine_backup_20260514.market_settings)             AS settings_keys,
  (SELECT COUNT(*) FROM engine_backup_20260514.projects_price_snapshot)     AS projects;

-- 3. Per-project price snapshot (this is the row you'll consult if you
--    ever need to compare "before vs after" for any project).
SELECT id, name, project_type, current_market_price
  FROM engine_backup_20260514.projects_price_snapshot
  ORDER BY name;


-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK STRATEGY (only if Step 2 catastrophically corrupts data)
-- ═══════════════════════════════════════════════════════════════════
--
-- To restore an archived table back to `public`:
--   ALTER TABLE engine_backup_20260514.market_engine_config
--     SET SCHEMA public;
--
-- To restore project prices wholesale:
--   UPDATE public.projects p
--     SET current_market_price = s.current_market_price
--     FROM engine_backup_20260514.projects_price_snapshot s
--    WHERE p.id = s.id;
--
-- To restore market_settings (e.g. if someone fat-fingers a value):
--   TRUNCATE public.market_settings;
--   INSERT INTO public.market_settings
--     SELECT * FROM engine_backup_20260514.market_settings;
--
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.2 — Step 1 BACKUP complete.';
  RAISE NOTICE '  Schema: engine_backup_20260514';
  RAISE NOTICE '  Tables: 9 + manifest';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify with:';
  RAISE NOTICE '  SELECT * FROM engine_backup_20260514._manifest;';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Step 2 — DB Migration (consolidation).';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
