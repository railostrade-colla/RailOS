-- ═══════════════════════════════════════════════════════════════════
-- admin_broadcast_notification RPC (Phase DD)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Powers /admin?tab=notifications_broadcast: lets an admin send a
-- system_announcement to a filtered audience in one transaction.
-- The notifications-realtime channel + the existing
-- /api/push/webhook fan-out still drive push + email per the user's
-- own preferences, so this RPC just inserts the rows.
--
-- Audiences supported:
--   'all'             → every active, non-banned user
--   'kyc_verified'    → + kyc_status = 'approved'
--   'advanced_plus'   → + level IN ('advanced','pro','elite')
--   'pro_only'        → + level IN ('pro','elite')
--   'specific_user'   → id = audience_param (UUID)
--   'by_city'         → joins user_profile_extras (Phase M migration)
--                       and matches city = audience_param
--
-- Returns JSONB: { success, recipients_count, error? }.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_audience TEXT DEFAULT 'all',
  p_audience_param TEXT DEFAULT NULL,
  p_link_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_priority notification_priority;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'title_required');
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'message_required');
  END IF;

  -- Coerce priority into the enum; default to 'normal' on bad values
  -- so a typo never aborts the whole broadcast.
  v_priority := CASE p_priority
    WHEN 'low'    THEN 'low'::notification_priority
    WHEN 'normal' THEN 'normal'::notification_priority
    WHEN 'high'   THEN 'high'::notification_priority
    WHEN 'urgent' THEN 'urgent'::notification_priority
    ELSE 'normal'::notification_priority
  END;

  -- Insert one notifications row per matching user. The `WHERE`
  -- clause varies by audience. Each branch builds its own INSERT
  -- so the planner can use the proper indexes.
  IF p_audience = 'specific_user' THEN
    IF p_audience_param IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'audience_param_required'
      );
    END IF;
    INSERT INTO public.notifications (
      user_id, notification_type, title, message, priority,
      link_url, metadata
    )
    SELECT
      p.id, 'system_announcement', p_title, p_message, v_priority,
      p_link_url, p_metadata
    FROM public.profiles p
    WHERE p.id = p_audience_param::UUID
      AND p.is_active = TRUE
      AND p.is_banned = FALSE;

  ELSIF p_audience = 'by_city' THEN
    IF p_audience_param IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'audience_param_required'
      );
    END IF;
    INSERT INTO public.notifications (
      user_id, notification_type, title, message, priority,
      link_url, metadata
    )
    SELECT
      p.id, 'system_announcement', p_title, p_message, v_priority,
      p_link_url, p_metadata
    FROM public.profiles p
    JOIN public.user_profile_extras x ON x.user_id = p.id
    WHERE x.city = p_audience_param
      AND p.is_active = TRUE
      AND p.is_banned = FALSE;

  ELSE
    -- One canonical INSERT for the level/kyc-based audiences.
    INSERT INTO public.notifications (
      user_id, notification_type, title, message, priority,
      link_url, metadata
    )
    SELECT
      p.id, 'system_announcement', p_title, p_message, v_priority,
      p_link_url, p_metadata
    FROM public.profiles p
    WHERE p.is_active = TRUE
      AND p.is_banned = FALSE
      AND CASE p_audience
        WHEN 'all'           THEN TRUE
        WHEN 'kyc_verified'  THEN p.kyc_status = 'approved'
        WHEN 'advanced_plus' THEN COALESCE(p.level, 'basic') IN ('advanced', 'pro', 'elite')
        WHEN 'pro_only'      THEN COALESCE(p.level, 'basic') IN ('pro', 'elite')
        ELSE FALSE
      END;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', TRUE,
    'recipients_count', v_count
  );
END;
$$;

COMMENT ON FUNCTION public.admin_broadcast_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Admin-only system_announcement broadcaster. Inserts one '
  'notifications row per matched user; push/email fan-out is handled '
  'by the existing realtime channel + /api/push/webhook.';

GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
