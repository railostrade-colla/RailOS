-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.0 — admin realtime publication (every table that fires
--               an admin-side popup or refreshes a sidebar badge)
-- Date: 2026-05-09
-- Idempotent.
--
-- Goal: zero-refresh admin dashboard. The moment any of these tables
-- gets a new row (or a status change), the admin sees it live.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table TEXT;
  v_already BOOLEAN;
  v_added INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY[
      -- Already covered by Phase 12.8 — listed for completeness.
      'notifications',
      'deals',
      'deal_messages',
      'payment_proofs',
      'listings',
      -- Admin-action queues:
      'fee_unit_requests',          -- buyer requests fee units
      'kyc_submissions',            -- KYC applications
      'disputes',                   -- open disputes
      'share_purchase_requests',    -- direct share purchases
      'share_transfers',            -- user-to-user transfers
      'ambassador_rewards',         -- ambassador commissions
      'project_updates',            -- new project announcements
      -- Governance:
      'council_proposals',          -- new proposals
      'council_votes',              -- voting in real time
      -- Auctions:
      'auctions',                   -- new auctions / settlements
      'auction_bids',               -- new bids
      -- Content:
      'support_tickets',            -- support inbox
      'support_messages',           -- support replies
      -- Finance:
      'invoices',                   -- new invoices
      'fee_unit_balances',          -- balance changes
      -- Audit:
      'admin_decisions_log'         -- admin actions trail
    ])
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) INTO v_already;

    IF v_already THEN
      v_skipped := v_skipped + 1;
    ELSE
      BEGIN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          v_table
        );
        v_added := v_added + 1;
      EXCEPTION
        WHEN undefined_object THEN
          RAISE NOTICE '⚠ supabase_realtime publication missing — skipping %', v_table;
        WHEN undefined_table THEN
          -- Table doesn't exist yet on this DB — silently skip.
          NULL;
        WHEN OTHERS THEN
          RAISE NOTICE '⚠ %.%: %', 'public', v_table, SQLERRM;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 13.0 admin realtime publication:';
  RAISE NOTICE '  ✓ Added: % tables', v_added;
  RAISE NOTICE '  ✓ Already in publication: % tables', v_skipped;
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
