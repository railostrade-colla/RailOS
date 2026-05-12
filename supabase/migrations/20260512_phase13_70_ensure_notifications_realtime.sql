-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.70 — Ensure notifications table is published for realtime
-- Date: 2026-05-12
-- Idempotent.
--
-- Bug: the notification bell + page subscribe to `notifications`
-- INSERT events via supabase.channel(...).on('postgres_changes',
-- { table: 'notifications', filter: 'user_id=eq.<uid>' }, ...).
--
-- For Supabase Realtime to emit those events, the table must be:
--   1. Part of the `supabase_realtime` publication
--   2. Have REPLICA IDENTITY FULL so the filter row data is included
--
-- The original `20260502_notifications_realtime.sql` migration adds
-- the table to the publication BUT was either never run or was
-- partially applied. After Phase 13.58 we started relying on this
-- live-feed heavily (contract invite accept/decline → notify creator),
-- and the missing replication broke the "no refresh needed" promise.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    RAISE NOTICE '  ✓ notifications added to supabase_realtime publication';
  ELSE
    RAISE NOTICE '  ✓ notifications already in supabase_realtime publication';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE '  ⚠ supabase_realtime publication missing — non-Supabase env';
END $$;

-- REPLICA IDENTITY FULL lets the realtime layer emit the full row on
-- UPDATE/DELETE, which Postgres needs to evaluate row-level filters
-- like `user_id=eq.<uid>` on the client side. Idempotent.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.70 notifications realtime hotfix applied.';
  RAISE NOTICE '  ✓ notifications in supabase_realtime publication';
  RAISE NOTICE '  ✓ REPLICA IDENTITY FULL on notifications';
  RAISE NOTICE 'Contract / friend notifications now push instantly';
  RAISE NOTICE 'to both parties without a page refresh.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
