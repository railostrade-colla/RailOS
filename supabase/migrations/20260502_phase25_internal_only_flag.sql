-- ═══════════════════════════════════════════════════════════════════
-- Phase 2.5 — Internal-only flag on notifications
-- Date: 2026-05-02
--
-- Adds an opt-out boolean so a notification can be created in the table
-- (and surface in the in-app Bell) without firing an external Web Push.
-- The Database Webhook (configured in Supabase Dashboard → Database →
-- Webhooks → push_on_new_notification) reads this flag and skips Push
-- when TRUE.
--
-- Idempotent: the column, index and comment use IF [NOT] EXISTS so re-
-- runs are safe.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index — only the rows where push *should* fire are indexed,
-- which is the common case the webhook filters on.
CREATE INDEX IF NOT EXISTS idx_notifications_internal_only
  ON public.notifications(is_internal_only)
  WHERE is_internal_only = FALSE;

COMMENT ON COLUMN public.notifications.is_internal_only IS
  'TRUE = show only in the in-app Bell, do not send external Web Push';
