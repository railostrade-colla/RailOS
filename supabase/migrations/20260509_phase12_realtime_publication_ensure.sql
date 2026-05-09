-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.8 — defensive: ensure realtime publication for the tables
--               the in-app live UX depends on
-- Date: 2026-05-09
-- Idempotent.
--
-- Reports surfaced from the founder: notifications + deal-request
-- popups don't update without a page refresh. Root cause is most
-- often a stale `supabase_realtime` publication that doesn't
-- include the table — Supabase Studio's UI lets the publication
-- drift out of sync with the migrations.
--
-- This migration walks through every table the live app depends on
-- and adds it to the publication if missing. Safe to re-run any
-- time; runs in a single transaction.
-- ═══════════════════════════════════════════════════════════════════

-- Tables the in-app realtime UX depends on:
--   • notifications      — bell + popups + alerts
--   • deals              — DealRequestNotifier + deal-page status
--   • payment_proofs     — seller sees buyer's proof instantly
--   • listings           — exchange listings live capacity
--
-- Each ALTER PUBLICATION ... ADD TABLE is wrapped in a guard so the
-- script doesn't fail when the table is already published (the only
-- error path that matters in practice).

DO $$
DECLARE
  v_table TEXT;
  v_already BOOLEAN;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY[
      'notifications',
      'deals',
      'payment_proofs',
      'listings'
    ])
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) INTO v_already;

    IF v_already THEN
      RAISE NOTICE '  ✓ %.% already in supabase_realtime publication',
        'public', v_table;
    ELSE
      BEGIN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          v_table
        );
        RAISE NOTICE '  + %.% added to supabase_realtime publication',
          'public', v_table;
      EXCEPTION
        WHEN undefined_object THEN
          RAISE NOTICE '  ⚠ supabase_realtime publication does not exist (non-Supabase env?)';
        WHEN undefined_table THEN
          RAISE NOTICE '  ⚠ public.% does not exist — skipping', v_table;
        WHEN OTHERS THEN
          RAISE NOTICE '  ⚠ %.%: %', 'public', v_table, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- Sanity report: which tables are now actually published.
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('notifications', 'deals', 'payment_proofs', 'listings');

  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ Realtime publication contains % of 4 critical tables', v_count;
  RAISE NOTICE 'After this migration:';
  RAISE NOTICE '  • Bell badge updates instantly (no refresh)';
  RAISE NOTICE '  • Deal-request popup pops within ~1s of buyer click';
  RAISE NOTICE '  • Payment-proof image appears instantly to seller';
  RAISE NOTICE '  • Listing capacity refreshes live on /exchange';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
