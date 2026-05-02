-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 — Helper function: create_user_notification
-- Date: 2026-05-02
--
-- Single chokepoint used by every Phase-2 trigger to create a
-- notification. It:
--   • Resolves the user's notification_preferences row (auto-creates
--     defaults if missing).
--   • Filters by category preference (deals_*, kyc_*, level_*,
--     disputes_*).
--   • urgent priority bypasses preferences entirely (security/abuse).
--   • Inserts into notifications and returns the new id, or NULL when
--     the user has the category disabled.
--   • EXCEPTION-safe: a failure here never bubbles up to the calling
--     trigger (which would abort the original event).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id   UUID,
  p_type      notification_type,
  p_title     TEXT,
  p_message   TEXT,
  p_priority  notification_priority DEFAULT 'normal',
  p_link_url  TEXT  DEFAULT NULL,
  p_metadata  JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_prefs           RECORD;
  v_should_send     BOOLEAN := TRUE;
  v_type_text       TEXT;
BEGIN
  -- Guard: skip on null recipient.
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_type_text := p_type::TEXT;

  -- Load preferences row (insert default if missing).
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;
  END IF;

  -- urgent always goes through (e.g. KYC rejected, dispute opened).
  IF p_priority <> 'urgent' THEN
    -- deals + payments
    IF v_type_text LIKE 'deal_%'
       OR v_type_text = 'payment_submitted'
       OR v_type_text = 'payment_received'
    THEN
      v_should_send := COALESCE(v_prefs.deals_enabled, TRUE);

    -- KYC
    ELSIF v_type_text LIKE 'kyc_%' THEN
      v_should_send := COALESCE(v_prefs.kyc_enabled, TRUE);

    -- Level upgrades
    ELSIF v_type_text = 'level_upgraded' THEN
      v_should_send := COALESCE(v_prefs.level_enabled, TRUE);

    -- Disputes
    ELSIF v_type_text LIKE 'dispute_%' THEN
      v_should_send := COALESCE(v_prefs.disputes_enabled, TRUE);
    END IF;
  END IF;

  -- Category disabled → no insert.
  IF NOT v_should_send THEN
    RETURN NULL;
  END IF;

  -- Insert.
  INSERT INTO notifications (
    user_id,
    notification_type,
    title,
    message,
    priority,
    link_url,
    metadata,
    is_read,
    sent_via_email,
    sent_via_push
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_link_url,
    p_metadata,
    FALSE,
    FALSE,
    FALSE
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;

EXCEPTION WHEN OTHERS THEN
  -- Never break the caller (the original DB event).
  RAISE WARNING 'create_user_notification failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_notification(
  UUID, notification_type, TEXT, TEXT, notification_priority, TEXT, JSONB
) TO authenticated, service_role;
