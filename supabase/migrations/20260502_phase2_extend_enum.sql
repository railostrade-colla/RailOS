-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 — Extend notification_type enum
-- Date: 2026-05-02
--
-- Adds 5 missing values needed by the Phase 2 trigger functions:
--   deal_expired, level_upgraded, dispute_resolved,
--   payment_received, reminder
--
-- Idempotent: each ADD VALUE is guarded by a pg_enum check so re-runs
-- are safe (PostgreSQL <12 would otherwise abort on duplicate values).
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- deal_expired
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'deal_expired'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'deal_expired';
  END IF;

  -- level_upgraded
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'level_upgraded'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'level_upgraded';
  END IF;

  -- dispute_resolved
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'dispute_resolved'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'dispute_resolved';
  END IF;

  -- payment_received
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'payment_received'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'payment_received';
  END IF;

  -- reminder
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'reminder'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'reminder';
  END IF;
END $$;
