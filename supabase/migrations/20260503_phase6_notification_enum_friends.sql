-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.3 — Extend notification_type enum for friendships + council
-- Date: 2026-05-03
-- Idempotent: each ADD VALUE is guarded by a pg_enum check.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- friend_request_received
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'friend_request_received'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'friend_request_received';
  END IF;

  -- friend_request_accepted
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'friend_request_accepted'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'friend_request_accepted';
  END IF;

  -- council_proposal_new
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'council_proposal_new'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'council_proposal_new';
  END IF;

  -- council_proposal_decided
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'council_proposal_decided'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'council_proposal_decided';
  END IF;

  -- support_ticket_replied
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'support_ticket_replied'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'support_ticket_replied';
  END IF;
END $$;
