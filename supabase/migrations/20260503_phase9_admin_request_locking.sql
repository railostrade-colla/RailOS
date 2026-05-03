-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.4 — Admin notification locking
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Lets two admins co-exist on the requests inbox without stepping on
-- each other. When admin A clicks an admin-targeted notification the
-- row gets `locked_by = A.id`; admin B then sees a disabled row with
-- "قيد المعالجة من <A's name>". Super admins can override.
--
-- Locks auto-expire after 15 minutes — if an admin closes the tab
-- without finishing, the row becomes processable again on the next
-- lock attempt.
--
-- Three RPCs:
--   • admin_lock_notification(id)     — acquire / refresh own lock
--                                       (super_admin overrides others)
--   • admin_unlock_notification(id)   — release own lock (Cancel)
--   • admin_process_notification(id)  — record final processor + clear
--                                       lock + mark as read
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Schema additions ─────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS locked_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_locked
  ON public.notifications(locked_by) WHERE locked_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_processed
  ON public.notifications(processed_by) WHERE processed_by IS NOT NULL;

-- ─── 2. RPC: admin_lock_notification ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_lock_notification(
  p_notification_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_locked_by UUID;
  v_locked_at TIMESTAMPTZ;
  v_role TEXT;
  v_is_super BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT locked_by, locked_at INTO v_locked_by, v_locked_at
  FROM public.notifications
  WHERE id = p_notification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Auto-expire stale locks (>15 minutes old)
  IF v_locked_by IS NOT NULL
     AND v_locked_at IS NOT NULL
     AND v_locked_at < NOW() - INTERVAL '15 minutes' THEN
    v_locked_by := NULL;
  END IF;

  -- Locked by someone else?
  IF v_locked_by IS NOT NULL AND v_locked_by <> v_uid THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
    v_is_super := (v_role = 'super_admin');

    IF v_is_super THEN
      UPDATE public.notifications
      SET locked_by = v_uid, locked_at = NOW()
      WHERE id = p_notification_id;
      RETURN jsonb_build_object(
        'success', TRUE,
        'override', TRUE,
        'previous_locker', v_locked_by
      );
    END IF;

    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'already_locked',
      'locked_by', v_locked_by,
      'locked_at', v_locked_at
    );
  END IF;

  -- Acquire (or refresh) own lock
  UPDATE public.notifications
  SET locked_by = v_uid, locked_at = NOW()
  WHERE id = p_notification_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_lock_notification(UUID) TO authenticated;

-- ─── 3. RPC: admin_unlock_notification ──────────────────────
CREATE OR REPLACE FUNCTION public.admin_unlock_notification(
  p_notification_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_deleted INT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  UPDATE public.notifications
  SET locked_by = NULL, locked_at = NULL
  WHERE id = p_notification_id
    AND (locked_by = v_uid OR v_role = 'super_admin');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_locked_by_you');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_unlock_notification(UUID) TO authenticated;

-- ─── 4. RPC: admin_process_notification ─────────────────────
-- Marks the notification as "handled by <admin>" and clears the lock.
-- Also flips is_read so it doesn't keep showing as unread for the
-- admin themselves.
CREATE OR REPLACE FUNCTION public.admin_process_notification(
  p_notification_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_locked_by UUID;
  v_updated INT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT locked_by INTO v_locked_by
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  -- Only the locker, an unlocked record, or a super_admin can process.
  IF v_locked_by IS NOT NULL
     AND v_locked_by <> v_uid
     AND v_role <> 'super_admin' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'locked_by_other',
      'locked_by', v_locked_by
    );
  END IF;

  UPDATE public.notifications
  SET processed_by = v_uid,
      processed_at = NOW(),
      locked_by = NULL,
      locked_at = NULL,
      is_read = TRUE,
      read_at = COALESCE(read_at, NOW())
  WHERE id = p_notification_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'update_failed');
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_notification(UUID) TO authenticated;
