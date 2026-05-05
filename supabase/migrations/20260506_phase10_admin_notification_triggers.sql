-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.61 — admin notification triggers (fan-out to all admins)
-- Date: 2026-05-06
-- Idempotent: safe to re-run.
--
-- Why this migration exists:
--   The user-facing notifications table receives KYC approval/rejection
--   notifications when an admin takes action — but admins themselves
--   weren't being notified when a USER submitted something. They had
--   to refresh the admin panel manually.
--
--   This migration adds INSERT triggers on the major submission tables
--   that fan out a notification row to every admin/super_admin via a
--   helper function.
--
-- New surfaces:
--   • notify_all_admins() — helper that loops admins and inserts
--     notifications, using a generic 'system_announcement' type so
--     it doesn't require enum extensions.
--   • trg_notify_admins_on_kyc_submitted (AFTER INSERT on kyc_submissions)
--   • trg_notify_admins_on_share_modification (AFTER INSERT on
--     share_modification_requests, if the table exists)
--   • trg_notify_user_on_kyc_submitted (AFTER INSERT on kyc_submissions
--     — user-side confirmation that the request was received)
--
-- Defensive: every block is wrapped in EXCEPTION so a missing table
-- never aborts the migration.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Helper: fan-out notification to all admins ──────────────────
CREATE OR REPLACE FUNCTION public.notify_all_admins(
  p_title    TEXT,
  p_message  TEXT,
  p_link_url TEXT DEFAULT NULL,
  p_priority notification_priority DEFAULT 'high',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_count INT := 0;
BEGIN
  FOR v_admin IN
    SELECT id FROM public.profiles
    WHERE role IN ('admin', 'super_admin')
      AND COALESCE(is_active, TRUE) = TRUE
  LOOP
    BEGIN
      INSERT INTO public.notifications (
        user_id, notification_type, title, message,
        priority, link_url, metadata
      ) VALUES (
        v_admin.id,
        'system_announcement'::notification_type,
        p_title,
        p_message,
        p_priority,
        p_link_url,
        p_metadata
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip this admin and keep going so a single bad row doesn't
      -- silence the whole fan-out.
      CONTINUE;
    END;
  END LOOP;
  RETURN v_count;
END
$$;

REVOKE ALL ON FUNCTION public.notify_all_admins(TEXT, TEXT, TEXT, notification_priority, JSONB) FROM PUBLIC;
-- No GRANT to authenticated — this is meant to be called from
-- SECURITY DEFINER triggers only, not directly from clients.


-- ─── KYC submitted: notify all admins + the user ─────────────────
CREATE OR REPLACE FUNCTION public.notify_on_kyc_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_label TEXT;
BEGIN
  -- Admin fan-out
  BEGIN
    SELECT COALESCE(p.full_name, p.username, '—')
    INTO v_user_label
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    PERFORM public.notify_all_admins(
      p_title    := '🛡 طلب توثيق جديد (KYC)',
      p_message  := 'من ' || COALESCE(v_user_label, 'مستخدم') ||
                    ' — مدينة ' || COALESCE(NEW.city, '—'),
      p_link_url := '/admin?tab=users',
      p_priority := 'high'::notification_priority,
      p_metadata := jsonb_build_object(
        'kyc_id', NEW.id,
        'user_id', NEW.user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_kyc_submitted admin fan-out failed: %', SQLERRM;
  END;

  -- User-side confirmation
  BEGIN
    PERFORM public.create_user_notification(
      p_user_id  := NEW.user_id,
      p_type     := 'system_announcement'::notification_type,
      p_title    := '📬 تم استلام طلب التوثيق',
      p_message  := 'سنراجع وثائقك قريباً وسنُعلمك بالنتيجة',
      p_priority := 'normal'::notification_priority,
      p_link_url := '/profile'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_kyc_submitted user confirmation failed: %', SQLERRM;
  END;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_kyc_submitted ON public.kyc_submissions;
CREATE TRIGGER trg_notify_admins_on_kyc_submitted
AFTER INSERT ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_kyc_submitted();


-- ─── Share modification: notify all admins ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'share_modification_requests'
  ) THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.notify_admins_on_share_modification()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_project_name TEXT;
        v_user_label TEXT;
      BEGIN
        BEGIN
          SELECT name INTO v_project_name
          FROM public.projects WHERE id = NEW.project_id;
          SELECT COALESCE(full_name, username, '—') INTO v_user_label
          FROM public.profiles WHERE id = NEW.requested_by;

          PERFORM public.notify_all_admins(
            p_title    := '◎ طلب تعديل حصص جديد',
            p_message  := 'مشروع: ' || COALESCE(v_project_name, '—') ||
                          ' · من: ' || COALESCE(v_user_label, '—') ||
                          ' · النوع: ' ||
                          CASE NEW.modification_type
                            WHEN 'increase' THEN 'زيادة ↑'
                            WHEN 'decrease' THEN 'تخفيض ↓'
                            ELSE NEW.modification_type
                          END,
            p_link_url := '/admin?tab=share_modification',
            p_priority := 'high'::notification_priority,
            p_metadata := jsonb_build_object(
              'request_id', NEW.id,
              'project_id', NEW.project_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_admins_on_share_modification failed: %', SQLERRM;
        END;
        RETURN NEW;
      END
      $body$;
    $func$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_admins_on_share_modification ON public.share_modification_requests';
    EXECUTE 'CREATE TRIGGER trg_notify_admins_on_share_modification
             AFTER INSERT ON public.share_modification_requests
             FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_share_modification()';
  END IF;
END $$;


-- ─── Ambassador application: notify all admins ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ambassadors'
  ) THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.notify_admins_on_ambassador_application()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_user_label TEXT;
      BEGIN
        IF NEW.application_status IS DISTINCT FROM 'pending' THEN
          RETURN NEW;
        END IF;
        BEGIN
          SELECT COALESCE(full_name, username, '—') INTO v_user_label
          FROM public.profiles WHERE id = NEW.user_id;

          PERFORM public.notify_all_admins(
            p_title    := '🌟 طلب سفير جديد',
            p_message  := 'من: ' || COALESCE(v_user_label, '—'),
            p_link_url := '/admin?tab=ambassadors_admin',
            p_priority := 'high'::notification_priority,
            p_metadata := jsonb_build_object(
              'ambassador_id', NEW.id,
              'user_id', NEW.user_id
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_admins_on_ambassador_application failed: %', SQLERRM;
        END;
        RETURN NEW;
      END
      $body$;
    $func$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_admins_on_ambassador_application ON public.ambassadors';
    EXECUTE 'CREATE TRIGGER trg_notify_admins_on_ambassador_application
             AFTER INSERT ON public.ambassadors
             FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_ambassador_application()';
  END IF;
END $$;


-- ─── Fee unit charge request: notify all admins ──────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fee_unit_requests'
  ) THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.notify_admins_on_fee_request()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_user_label TEXT;
      BEGIN
        IF NEW.status IS DISTINCT FROM 'pending' THEN
          RETURN NEW;
        END IF;
        BEGIN
          SELECT COALESCE(full_name, username, '—') INTO v_user_label
          FROM public.profiles WHERE id = NEW.user_id;

          PERFORM public.notify_all_admins(
            p_title    := '💎 طلب شحن وحدات رسوم',
            p_message  := 'من: ' || COALESCE(v_user_label, '—') ||
                          ' · الكمية: ' || COALESCE(NEW.amount_requested::TEXT, '—'),
            p_link_url := '/admin?tab=fee_units_requests',
            p_priority := 'normal'::notification_priority,
            p_metadata := jsonb_build_object('request_id', NEW.id)
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_admins_on_fee_request failed: %', SQLERRM;
        END;
        RETURN NEW;
      END
      $body$;
    $func$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_admins_on_fee_request ON public.fee_unit_requests';
    EXECUTE 'CREATE TRIGGER trg_notify_admins_on_fee_request
             AFTER INSERT ON public.fee_unit_requests
             FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_fee_request()';
  END IF;
END $$;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.61 applied:';
  RAISE NOTICE '  ✓ notify_all_admins() helper';
  RAISE NOTICE '  ✓ trg_notify_admins_on_kyc_submitted';
  RAISE NOTICE '  ✓ trg_notify_admins_on_share_modification (if table exists)';
  RAISE NOTICE '  ✓ trg_notify_admins_on_ambassador_application (if table exists)';
  RAISE NOTICE '  ✓ trg_notify_admins_on_fee_request (if table exists)';
  RAISE NOTICE '  ✓ user-side KYC-submitted confirmation notification';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
