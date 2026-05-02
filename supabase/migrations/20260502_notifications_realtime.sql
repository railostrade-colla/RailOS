-- ═══════════════════════════════════════════════════════════════════
-- Notifications — extensions for the in-app bell + dropdown
-- Date: 2026-05-02
--
-- ⚠️ This migration EXTENDS the existing `notifications` table created
-- in `supabase/06_notifications.sql`. It is fully idempotent: safe to
-- run on a database that already has the table, and safe to re-run.
--
-- It does NOT create a new table, drop columns, or change types. It only:
--   1. Adds an optional `action_label` column (skipped if exists).
--   2. Creates two helper RPCs (CREATE OR REPLACE).
--   3. Enables realtime publication for the table (skipped if already in).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. ADD action_label column (optional)
--    Used by NotificationItem to render an action button label.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_label TEXT;

-- ─────────────────────────────────────────────────────────────────
-- 2. RPC: get_unread_count(p_user_id)
--    Faster than COUNT(*) over the table for high-frequency polling.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = p_user_id
    AND is_read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. RPC: mark_all_notifications_read(p_user_id)
--    Marks every unread notification for a user as read in one shot.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Authorization: caller can only mark their own notifications
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE user_id = p_user_id AND is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Enable realtime publication for the table
--    (skipped silently if the table is already in the publication)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- supabase_realtime publication doesn't exist (non-Supabase env) — ignore
    NULL;
END
$$;
