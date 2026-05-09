-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 hotfix — ensure every column the deal RPCs write to exists
-- Date: 2026-05-09
-- Idempotent.
--
-- Founder report: clicking "شراء — تحديد الكمية" on an exchange
-- listing dropped to the global "حدث خطأ غير متوقع" error wall.
--
-- Root cause: place_deal_from_listing INSERTs into columns
-- (`source`, `buyer_commission`, `seller_commission`,
-- `cancellation_requested_by`, `cancellation_reason`) that were
-- added in scattered later migrations. On a DB where any of those
-- migrations were skipped (or run out of order after a wipe), the
-- INSERT fails with "column does not exist" 42703, and the
-- exception escapes through the redirect to /deals/[id] before
-- the modal's catch can format a friendly Arabic error.
--
-- This migration is a single safety net: every column a Phase-10+
-- deal RPC expects is added with IF NOT EXISTS — safe to re-run, no
-- effect when already present.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Source flag — distinguishes exchange / quick_sell / direct_buy etc.
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'exchange';

  -- Commission breakdown
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS buyer_commission BIGINT DEFAULT 0;
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS seller_commission BIGINT DEFAULT 0;

  -- Cancellation flow
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID
      REFERENCES auth.users(id) ON DELETE SET NULL;
  ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
EXCEPTION WHEN undefined_table THEN
  RAISE WARNING 'public.deals table missing — cannot add columns';
END $$;


-- ─── Verify the deal RPCs are still wired (re-grants, no-op if exists) ──
DO $$
BEGIN
  -- Make sure place_deal_from_listing exists. If a stale RPC was
  -- dropped without re-creating, this migration leaves a pointer to
  -- the migration that owns it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'place_deal_from_listing'
  ) THEN
    RAISE WARNING
      'place_deal_from_listing RPC missing — re-apply 20260504_phase10_deal_lifecycle.sql';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_buy_listing'
  ) THEN
    RAISE WARNING
      'accept_buy_listing RPC missing — re-apply 20260504_phase10_buy_listing_escrow.sql';
  END IF;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 deals columns safety applied:';
  RAISE NOTICE '  ✓ deals.source';
  RAISE NOTICE '  ✓ deals.buyer_commission';
  RAISE NOTICE '  ✓ deals.seller_commission';
  RAISE NOTICE '  ✓ deals.cancellation_requested_by';
  RAISE NOTICE '  ✓ deals.cancellation_reason';
  RAISE NOTICE 'Buy/sell flow on /exchange should now work end-to-end.';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
