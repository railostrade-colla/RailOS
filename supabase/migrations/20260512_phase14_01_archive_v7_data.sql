-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.01 — Archive V7 legacy data before drop
-- Date: 2026-05-12
-- Idempotent. Read-mostly. No destructive operations.
--
-- Founder approval: Discovery audit found only 2 V7 tables with
-- actual data:
--   • admin_decisions_log    (3 rows — admin manual-rise audit trail)
--   • market_engine_log      (2 rows — daily rise log)
--
-- The other 5 V7 tables exist but are EMPTY (account_trust_score,
-- user_activity_scores, railos_eligibility_tracking,
-- railos_dividend_distributions, market_engine_settings). They get
-- archived as empty shell rows for completeness but the data
-- snapshot is trivial.
--
-- This migration:
--   1. Creates `v7_archive` schema
--   2. Snapshots both populated tables AS-IS (data + structure)
--   3. Creates empty mirror tables for the 5 empty V7 tables
--      (preserves schema for emergency reference)
--   4. Adds COMMENT to each archive table noting the date + reason
--
-- Safety: idempotent — re-running it skips already-archived tables.
-- The archive lives forever; we never restore from it (per founder
-- spec). It's purely a forensic safety net.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Archive schema ──────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS v7_archive;

COMMENT ON SCHEMA v7_archive IS
  'Phase 14 cleanup archive (2026-05-12). Frozen snapshot of V7 tables before drop. DO NOT RESTORE.';


-- ─── 2. Archive tables WITH data ────────────────────────────────

-- admin_decisions_log (3 rows — keep the audit trail of manual rises)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='v7_archive' AND table_name='admin_decisions_log'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='admin_decisions_log'
  ) THEN
    EXECUTE 'CREATE TABLE v7_archive.admin_decisions_log AS '
         || 'SELECT * FROM public.admin_decisions_log';
    EXECUTE 'COMMENT ON TABLE v7_archive.admin_decisions_log IS '
         || quote_literal('Archived 2026-05-12 (Phase 14). Snapshot of '
                       || 'public.admin_decisions_log before drop. Read-only.');
    RAISE NOTICE '  ✓ Archived: admin_decisions_log';
  ELSE
    RAISE NOTICE '  • Skipped (already archived or source missing): admin_decisions_log';
  END IF;
END $$;

-- market_engine_log (2 rows — keep the daily rise history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='v7_archive' AND table_name='market_engine_log'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='market_engine_log'
  ) THEN
    EXECUTE 'CREATE TABLE v7_archive.market_engine_log AS '
         || 'SELECT * FROM public.market_engine_log';
    EXECUTE 'COMMENT ON TABLE v7_archive.market_engine_log IS '
         || quote_literal('Archived 2026-05-12 (Phase 14). Snapshot of '
                       || 'public.market_engine_log before drop. Read-only.');
    RAISE NOTICE '  ✓ Archived: market_engine_log';
  ELSE
    RAISE NOTICE '  • Skipped (already archived or source missing): market_engine_log';
  END IF;
END $$;


-- ─── 3. Archive empty-table SCHEMAS (no rows, just structure) ──
-- Using LIKE preserves column types + constraints but copies no data.
-- Useful as forensic reference if we ever need to reconstruct.

DO $$
DECLARE
  tbl TEXT;
  empty_tables TEXT[] := ARRAY[
    'account_trust_score',
    'user_activity_scores',
    'railos_eligibility_tracking',
    'railos_dividend_distributions',
    'market_engine_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY empty_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='v7_archive' AND table_name=tbl
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl
    ) THEN
      EXECUTE format(
        'CREATE TABLE v7_archive.%I (LIKE public.%I INCLUDING ALL)',
        tbl, tbl
      );
      EXECUTE format(
        'COMMENT ON TABLE v7_archive.%I IS %L',
        tbl,
        'Archived 2026-05-12 (Phase 14). Source was EMPTY at archive time. '
        || 'Schema preserved for forensic reference. Read-only.'
      );
      RAISE NOTICE '  ✓ Archived schema (empty): %', tbl;
    ELSE
      RAISE NOTICE '  • Skipped (already archived or source missing): %', tbl;
    END IF;
  END LOOP;
END $$;


-- ─── 4. Manifest table — what we archived + when + why ─────────
CREATE TABLE IF NOT EXISTS v7_archive._manifest (
  table_name      TEXT PRIMARY KEY,
  rows_archived   BIGINT NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT NOT NULL DEFAULT 'Phase 14 V7 cleanup'
);

-- Populate the manifest (idempotent ON CONFLICT DO NOTHING).
DO $$
DECLARE
  tbl TEXT;
  cnt BIGINT;
  all_tables TEXT[] := ARRAY[
    'admin_decisions_log','market_engine_log',
    'account_trust_score','user_activity_scores',
    'railos_eligibility_tracking','railos_dividend_distributions',
    'market_engine_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='v7_archive' AND table_name=tbl
    ) THEN
      EXECUTE format('SELECT count(*) FROM v7_archive.%I', tbl) INTO cnt;
      INSERT INTO v7_archive._manifest(table_name, rows_archived)
      VALUES (tbl, cnt)
      ON CONFLICT (table_name) DO NOTHING;
    END IF;
  END LOOP;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.01 V7 archive complete.';
  RAISE NOTICE '  ✓ v7_archive schema created';
  RAISE NOTICE '  ✓ 2 populated tables archived WITH data';
  RAISE NOTICE '  ✓ 5 empty tables archived (schema-only)';
  RAISE NOTICE '  ✓ _manifest table records what + when + why';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: review Migration 2 (DROP 7 V7 functions)';
  RAISE NOTICE '      before any destructive operation.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
