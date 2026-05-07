-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.01 — Drop share_modification system entirely
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Founder request: "احذف لي صفحة ونظام تعديل الحصص نهائيا من لوحة
-- التحكم ومن التطبيق". The two-factor "تعديل الحصص" admin flow
-- (Phase 9.5) has been retired. Increasing shares now happens via
-- Project Wallets → "إضافة حصص للطرح" (Phase 10.92), and the legacy
-- table + RPCs are no longer referenced from any frontend code.
--
-- Drops (IF EXISTS — idempotent):
--   • RPCs:  admin_generate_share_code,
--            admin_submit_share_modification,
--            admin_approve_share_modification,
--            admin_reject_share_modification
--   • Tables: share_modification_requests
--             share_modification_codes
--   • Any indexes / FKs / triggers attached to those tables get
--     removed by CASCADE.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Drop the four RPCs ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_reject_share_modification(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_reject_share_modification(UUID);
DROP FUNCTION IF EXISTS public.admin_approve_share_modification(UUID);
DROP FUNCTION IF EXISTS public.admin_submit_share_modification(UUID, TEXT, BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_submit_share_modification(UUID, BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_generate_share_code(UUID);
DROP FUNCTION IF EXISTS public.admin_generate_share_code();


-- ─── 2. Drop the two tables (CASCADE removes FKs/indexes/triggers) ─
DROP TABLE IF EXISTS public.share_modification_requests CASCADE;
DROP TABLE IF EXISTS public.share_modification_codes    CASCADE;


-- ─── 3. Drop any leftover types if they exist ────────────────────
-- The Phase 9.5 migration may have created enum types just for this
-- module. Best-effort drops:
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP TYPE IF EXISTS public.share_modification_status CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    EXECUTE 'DROP TYPE IF EXISTS public.share_modification_type CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.01 applied:';
  RAISE NOTICE '  ✓ share_modification_requests + share_modification_codes dropped';
  RAISE NOTICE '  ✓ admin_generate_share_code / admin_submit_share_modification';
  RAISE NOTICE '    / admin_approve_share_modification / admin_reject_share_modification';
  RAISE NOTICE '    all dropped (IF EXISTS — safe re-run)';
  RAISE NOTICE '  → Adding shares to a published project now uses the';
  RAISE NOTICE '    project-wallet RPC: admin_add_shares_to_offering (Phase 10.92).';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
